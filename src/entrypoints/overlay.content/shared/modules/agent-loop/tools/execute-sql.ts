/**
 * execute_sql Tool Implementation.
 *
 * Executes SQL statements against the local SQLite WASM database.
 * - SELECT: direct execution, max 1000 rows
 * - DML (INSERT/UPDATE/DELETE): paywall check + optional confirmation
 * - DDL (DROP/ALTER/CREATE/PRAGMA...): blocked
 *
 * Communicates via browser.runtime.sendMessage (EXECUTE_SQL) so it works
 * correctly from content script context.
 */

import { useLicenseStore } from '@/shared/lib/license-store';
import { useAgentLoopStore } from '../agent-loop-store';

/** Blocked SQL patterns (DDL and dangerous operations) */
const BLOCKED_PATTERN = /^\s*(DROP|ALTER|CREATE|PRAGMA|ATTACH|DETACH|VACUUM|REINDEX)\b/i;

/** SELECT detection */
const SELECT_PATTERN = /^\s*SELECT\b/i;

/** Maximum rows returned for SELECT queries */
const MAX_RESULT_ROWS = 1000;

/** Placeholder that AI uses instead of generating random UUIDs */
const UUID_PLACEHOLDER = /__NEW_UUID__/g;

/** Replace all __NEW_UUID__ placeholders with real crypto UUIDs */
function hydrateUuids(sql: string): string {
  return sql.replace(UUID_PLACEHOLDER, () => crypto.randomUUID());
}

export interface ExecuteSqlParams {
  query: string;
}

/**
 * Execute SQL via the background service worker's EXECUTE_SQL handler.
 * This works from content script context (unlike direct runQuery which
 * requires the offscreen/worker communication that only background has).
 */
async function executeSqlViaBackground(sql: string): Promise<any> {
  const response = await browser.runtime.sendMessage({
    type: 'EXECUTE_SQL',
    payload: { sql },
  });

  if (!response.success) {
    throw new Error(response.error || 'SQL execution failed');
  }

  return response.data;
}

/**
 * Execute a SQL statement with safety checks.
 * Returns a formatted string result (success or error).
 */
export async function executeSql(params: ExecuteSqlParams): Promise<string> {
  const { query } = params;

  if (!query || !query.trim()) {
    return 'ERROR: Empty SQL query provided.';
  }

  // 1. Blocklist check
  if (BLOCKED_PATTERN.test(query)) {
    return 'ERROR: This SQL statement type is not allowed. Only SELECT, INSERT, UPDATE, DELETE are permitted.';
  }

  const isSelect = SELECT_PATTERN.test(query);

  // 2. Non-SELECT: paywall check
  if (!isSelect) {
    const license = useLicenseStore.getState();
    const hasPowerPack =
      license.tier === 'power_pack' || license.tier === 'pro' || license.tier === 'support_pack';

    if (!hasPowerPack) {
      return 'ERROR: PAYWALL - Writing to database requires Power Pack subscription. The user has been shown an upgrade prompt.';
    }

    // 3. User confirmation (if enabled)
    const confirmed = await requestUserConfirmation(query);
    if (!confirmed) {
      return 'CANCELLED: User cancelled the operation.';
    }
  }

  // 4. Hydrate UUID placeholders
  const hydratedQuery = hydrateUuids(query);

  // 5. Execute
  try {
    const result = await executeSqlViaBackground(hydratedQuery);

    if (isSelect) {
      const rows = Array.isArray(result) ? result : [];
      if (rows.length === 0) {
        return 'Result: 0 rows returned.';
      }
      const truncated = rows.length > MAX_RESULT_ROWS;
      const displayRows = truncated ? rows.slice(0, MAX_RESULT_ROWS) : rows;
      let output = `Result: ${rows.length} row(s)`;
      if (truncated) {
        output += ` (showing first ${MAX_RESULT_ROWS}, ${rows.length - MAX_RESULT_ROWS} omitted)`;
      }
      output += '\n' + JSON.stringify(displayRows, null, 2);
      return output;
    } else {
      // For write operations, query changes()
      try {
        const changesResult = await executeSqlViaBackground('SELECT changes() as affected_rows');
        const affectedRows = changesResult?.[0]?.affected_rows ?? 'unknown';
        return `Success: ${affectedRows} row(s) affected.`;
      } catch {
        return 'Success: Operation completed (affected rows unknown).';
      }
    }
  } catch (e) {
    return `ERROR: SQL execution failed - ${(e as Error).message}`;
  }
}

/**
 * Request user confirmation for write operations.
 * Uses the control panel's confirmation strategy.
 */
async function requestUserConfirmation(sql: string): Promise<boolean> {
  const { requiresConfirmation } = await import('../control-panel/utils');
  const toolCall = { name: 'execute_sql', params: { query: sql } };

  if (!requiresConfirmation(toolCall)) {
    return true; // Speed mode or no confirmation needed
  }

  return new Promise((resolve) => {
    useAgentLoopStore.getState().setPendingConfirmation({
      sql,
      resolve,
    });
    // Auto-open panel when confirmation is needed
    useAgentLoopStore.getState().setPanelOpen(true);
  });
}
