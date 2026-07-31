const pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
let isOffscreenCreating = false;
let localWorker: Worker | null = null;

/**
 * The database this side of the bridge believes should be open.
 * Set by initDB/switchDB and replayed to any freshly created worker.
 */
let desiredDbName: string | null = null;

/**
 * True when the worker host was just created and has therefore not been told
 * which database to open. The worker refuses to guess (see db-worker.ts), so we
 * must replay INIT before any other request.
 *
 * This matters because the offscreen document can be reclaimed or crash
 * independently of the service worker: without the replay, the recreated worker
 * would have no dbName and every subsequent request would fail.
 */
let workerNeedsInit = false;

// ─── DB session lock ─────────────────────────────────────────────────────────

/**
 * Serializes database *switches* against multi-step database *operations*.
 *
 * There is exactly one worker and one open database at a time, but callers run
 * concurrently: every extension message is handled in its own async task, and
 * each one may switch the active database to match its sender tab. Meanwhile a
 * sync performs dozens of separate round trips (read a table, write a batch,
 * read the next table...).
 *
 * Without this lock, a switch can land between any two of those round trips, so
 * the second half of an operation executes against a different database than the
 * first half. For a merge that means Phase 2 issues its DELETEs against another
 * profile's data while judging it against this profile's remote payload — which
 * deletes nearly everything in it.
 *
 * Validating the database once at the start cannot catch this; the connection
 * has to stay pinned for the whole operation.
 */
let lockChain: Promise<unknown> = Promise.resolve();

function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const result = lockChain.then(fn, fn);
  // Keep the chain alive regardless of individual failures
  lockChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

// Helper to handle partial chunks
const chunkedResponses = new Map<string, { chunks: string[]; received: number; total: number }>();

// Listen for responses from Offscreen document
browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'DB_RESPONSE') {
    const { id, success, data, error, chunk } = message.payload;
    const request = pendingRequests.get(id);
    
    if (request) {
      if (!success) {
        request.reject(new Error(error));
        pendingRequests.delete(id);
        return;
      }

      if (chunk) {
        // Handle chunked response
        let entry = chunkedResponses.get(id);
        if (!entry) {
          entry = { chunks: new Array(chunk.total), received: 0, total: chunk.total };
          chunkedResponses.set(id, entry);
        }

        entry.chunks[chunk.index] = data;
        entry.received++;

        if (entry.received === entry.total) {
          const fullData = entry.chunks.join('');
          request.resolve(fullData);
          pendingRequests.delete(id);
          chunkedResponses.delete(id);
        }
      } else {
        // Standard response
        request.resolve(data);
        pendingRequests.delete(id);
      }
    }
  }
});

async function ensureWorker() {
  // Method 1: Use local worker (Firefox or fallback)
  // Check if offscreen API is missing OR if we prefer local worker in this context
  // Use explicit check for offscreen API existence on the browser object
  // @ts-ignore - offscreen might not be in the definition depending on version/types
  const hasOffscreenApi = typeof browser !== 'undefined' && !!browser.offscreen;
  
  if (!hasOffscreenApi) {
    if (localWorker) return;
    
    console.log('Initializing local DB Worker (Fallback/Firefox mode)...');
    // Dynamic import to avoid `new Worker()` appearing in service worker context (Chrome MV3)
    const { default: DbWorker } = await import('@/shared/workers/db-worker?worker');
    localWorker = new DbWorker();
    workerNeedsInit = true;
    localWorker.onmessage = (e) => {
      const { id, success, data, error, chunk } = e.data;
      const request = pendingRequests.get(id);
      if (request) {
        if (!success) {
          request.reject(new Error(error));
          pendingRequests.delete(id);
          return;
        }

        if (chunk) {
          // Handle chunked response
          let entry = chunkedResponses.get(id);
          if (!entry) {
            entry = { chunks: new Array(chunk.total), received: 0, total: chunk.total };
            chunkedResponses.set(id, entry);
          }

          entry.chunks[chunk.index] = data;
          entry.received++;

          if (entry.received === entry.total) {
            const fullData = entry.chunks.join('');
            request.resolve(fullData);
            pendingRequests.delete(id);
            chunkedResponses.delete(id);
          }
        } else {
          request.resolve(data);
          pendingRequests.delete(id);
        }
      }
    };
    return;
  }

  // Method 2: Use Offscreen API (Chrome)
  // @ts-ignore
  if (hasOffscreenApi) {
      try {
        let hasOffscreen = false;
        // @ts-ignore
        if (browser.runtime.getContexts) {
          try {
             // @ts-ignore
             const contexts = await browser.runtime.getContexts({
               contextTypes: ['OFFSCREEN_DOCUMENT' as any],
             });
             hasOffscreen = contexts.length > 0;
          } catch (e) {
             // Ignore error if contextTypes is invalid or API differs
             console.warn('getContexts check failed', e);
          }
        } else {
          // Fallback for browsers with offscreen API but no getContexts (rare, but safe)
          // We assume it doesn't exist and try to create, catching the error if it does.
          // @ts-ignore
          const clients = await browser.runtime.sendMessage({ type: 'PING_OFFSCREEN' }).catch(() => null);
          // If we had a ping mechanism, we could use it. But createDocument handles duplicates by throwing.
        }

        if (hasOffscreen) {
          return;
        }

        if (isOffscreenCreating) {
          await new Promise(resolve => setTimeout(resolve, 100));
          return;
        }

        isOffscreenCreating = true;
        // @ts-ignore
        await browser.offscreen.createDocument({
          url: 'offscreen.html',
          // @ts-ignore
          reasons: [browser.offscreen.Reason.WORKERS],
          justification: 'Run SQLite WASM in a Web Worker',
        });
        // Brand new document → its worker has no dbName yet
        workerNeedsInit = true;
      } catch (err: any) {
        if (!err.message.startsWith('Only a single offscreen')) {
           console.error('Failed to create offscreen document:', err);
           // If offscreen creation fails entirely, maybe fallback to local worker?
           // But we already decided to use offscreen if API exists.
           throw err;
        }
      } finally {
        isOffscreenCreating = false;
      }
      return;
  }
}

export const initDB = async (dbName?: string) =>
  runExclusive(async () => {
    await ensureWorker();
    if (dbName) desiredDbName = dbName;
    const result = await rawSendWorkerMessage(
      'INIT',
      dbName ? { dbName } : undefined,
    );
    workerNeedsInit = false;
    return result;
  });

/**
 * Switch the active database.
 *
 * Waits for any in-flight `withDbSession` to finish, so a tab that wants a
 * different profile cannot yank the connection out from under a running sync.
 */
export const switchDB = async (dbName: string) =>
  runExclusive(() => rawSwitchDB(dbName));

/** Switch without taking the lock. Only for callers that already hold it. */
const rawSwitchDB = async (dbName: string) => {
  await ensureWorker();
  desiredDbName = dbName;
  const result = await rawSendWorkerMessage('SWITCH_DB', { dbName });
  workerNeedsInit = false;
  return result;
};

/**
 * Run a multi-step database operation with the connection pinned to `dbName`.
 *
 * Switches to the database first, then holds the lock for the duration of `fn`,
 * so concurrent `switchDB` calls queue behind it instead of changing the
 * database mid-operation.
 *
 * Use this for anything that issues more than one dependent query — sync,
 * export, import, restore. Do not call `switchDB`/`initDB`/`withDbSession` from
 * inside `fn`; the lock is not reentrant.
 */
export const withDbSession = async <T>(
  dbName: string,
  fn: () => Promise<T>,
): Promise<T> =>
  runExclusive(async () => {
    await ensureWorker();
    const current = workerNeedsInit
      ? null
      : await rawSendWorkerMessage('GET_DB_NAME');
    if (current !== dbName) {
      console.log(`[DB] Session pinning "${dbName}" (was "${current}")`);
      await rawSwitchDB(dbName);
    }
    return fn();
  });

/**
 * Ask the worker which database it actually has open.
 * Returns null when the worker has nothing open and none is expected.
 *
 * Use this to verify assumptions before destructive or identity-sensitive work
 * (sync, export). The value being verified against generally comes from a
 * different piece of service-worker memory (e.g. the tab→profile map), so this
 * still catches real drift; it only settles a worker that was just recreated
 * rather than reporting a transient "nothing open".
 */
export const getWorkerDbName = async (): Promise<string | null> => {
  return sendWorkerMessage('GET_DB_NAME');
};

const sendWorkerMessage = async (type: string, payload?: any): Promise<any> => {
  await ensureWorker();

  // A freshly (re)created worker has no dbName. Replay INIT before anything
  // else so the request lands on the intended database rather than failing.
  if (workerNeedsInit && desiredDbName) {
    console.log(`[DB] Worker was recreated, re-initializing "${desiredDbName}"`);
    await rawSendWorkerMessage('INIT', { dbName: desiredDbName });
    workerNeedsInit = false;
  }

  return rawSendWorkerMessage(type, payload);
};

/** Post a message to the worker without any ensure/re-init handling. */
const rawSendWorkerMessage = async (
  type: string,
  payload?: any,
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    
    const timeoutId = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`DB Request ${type} timed out after 30s`));
      }
    }, 30000);

    pendingRequests.set(id, { 
      resolve: (val) => {
        clearTimeout(timeoutId);
        resolve(val);
      }, 
      reject: (err) => {
        clearTimeout(timeoutId);
        reject(err);
      } 
    });
    
    if (localWorker) {
      localWorker.postMessage({ id, type, payload });
    } else {
      browser.runtime.sendMessage({
        type: 'DB_REQUEST',
        payload: { id, workerType: type, payload }
      });
    }
  });
};

export const getDB = () => {
  // Legacy: Should not be used directly anymore
  throw new Error('Direct DB access deprecated. Use async operations.');
};

export const runQuery = async (sql: string, bind?: any[]) => {
  console.log('[DB Query]', sql, bind);
  return sendWorkerMessage('EXEC', { sql, bind });
};

export const runCommand = async (sql: string, bind?: any[]) => {
  console.log('[DB Command]', sql, bind);
  return sendWorkerMessage('RUN', { sql, bind });
};

export const runBatch = async (operations: { sql: string; bind?: any[] }[]) => {
  console.log('[DB Batch]', operations.length, 'operations');
  return sendWorkerMessage('RUN_BATCH', { operations });
};

export const exportDB = async (): Promise<string> => {
  return sendWorkerMessage('EXPORT');
};

export const importDB = async (data: string, chunk?: { index: number; total: number }): Promise<void> => {
  return sendWorkerMessage('IMPORT', { data, chunk });
};

