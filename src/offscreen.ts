// This script runs in the offscreen document
// It acts as a bridge between the Background Script and the DB Worker
//
// NOTE: We cannot use Vite's `?worker` import because in dev mode it creates
// a Worker URL pointing to http://localhost:3000 which doesn't match the
// chrome-extension:// origin of the offscreen document. Chrome 149+ enforces
// strict same-origin checks on Dedicated Workers (DWH_INVALID_SCRIPT_URL_ORIGIN).
//
// Instead, we reference the pre-bundled worker file from web_accessible_resources
// using chrome.runtime.getURL(), which stays within the extension's origin.

let worker: Worker | null = null;

const handleWorkerMessage = async (e: MessageEvent) => {
  // Forward result back to background script
  const { id, success, data, error, code, chunk } = e.data;

  // If the worker already chunked it, just forward it
  if (chunk) {
    browser.runtime.sendMessage({
      type: 'DB_RESPONSE',
      payload: { id, success, data, error, code, chunk },
    });
    return;
  }

  // Chunking threshold (e.g., 10MB to be safe, max is ~64MB in Chrome but safer to stay lower)
  const CHUNK_SIZE = 10 * 1024 * 1024;

  if (success && data && typeof data === 'string' && data.length > CHUNK_SIZE) {
    console.log(
      `[Offscreen] Data too large (${data.length} chars), splitting into chunks...`,
    );
    const totalChunks = Math.ceil(data.length / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const chunk = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await browser.runtime.sendMessage({
        type: 'DB_RESPONSE',
        payload: {
          id,
          success: true,
          data: chunk,
          chunk: { index: i, total: totalChunks },
        },
      });
    }
  } else {
    browser.runtime.sendMessage({
      type: 'DB_RESPONSE',
      payload: { id, success, data, error, code },
    });
  }
};

/** How many workers this document has built; >1 means we replaced a dead one. */
let workerCount = 0;

const createWorker = (): Worker => {
  const workerUrl = browser.runtime.getURL('assets/db-worker.js');
  const created = new Worker(workerUrl);
  workerCount++;
  created.onmessage = handleWorkerMessage;

  /**
   * A worker that died takes its database connection with it, and it can never
   * be revived. Drop the reference so the next request builds a fresh one —
   * otherwise every later request is posted into a dead worker and simply never
   * answered, which reads as "the database is gone" on the other side.
   */
  created.onerror = (event) => {
    console.error('[Offscreen] DB Worker error, discarding it:', event.message);
    try {
      created.terminate();
    } catch (e) {
      // Already gone
    }
    if (worker === created) worker = null;
  };

  // A replacement worker knows nothing about the database the previous one had
  // open, and this document existing is what the bridge uses to decide it does
  // not need to send INIT. Tell it explicitly, or the next request lands on a
  // nameless worker and gets refused.
  if (workerCount > 1) {
    browser.runtime
      .sendMessage({ type: 'DB_WORKER_REPLACED' })
      .catch(() => {
        // Service worker is asleep; it will re-init on its own when it wakes.
      });
  }

  console.log('[Offscreen] DB Worker created via extension URL:', workerUrl);
  return created;
};

/** Lazily (re)create the worker so a crash is recoverable. */
const getWorker = (): Worker => {
  if (!worker) worker = createWorker();
  return worker;
};

// Warm up immediately: the background side usually sends INIT right away.
try {
  getWorker();
} catch (e) {
  console.error('[Offscreen] Failed to create worker:', e);
}

// Listen for messages from background script
browser.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.type !== 'DB_REQUEST') return;

  const { id, workerType, payload } = message.payload;
  try {
    getWorker().postMessage({ id, type: workerType, payload });
  } catch (e: any) {
    console.error('[Offscreen] Failed to forward request to worker:', e);
    worker = null;
    browser.runtime.sendMessage({
      type: 'DB_RESPONSE',
      payload: {
        id,
        success: false,
        error: `Worker unavailable: ${e?.message ?? e}`,
      },
    });
  }
});
