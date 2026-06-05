/**
 * execute_sql Tool Implementation.
 *
 * Executes SQL statements against the local SQLite WASM database.
 * - SELECT: direct execution, max 1000 rows
 * - DML (INSERT/UPDATE/DELETE): paywall check + optional confirmation
 * - DDL (DROP/ALTER/CREATE/PRAGMA...): blocked
 */

import { runQuery, runCommand } from '@/shared/db';
import { useLicenseStore } from '@/shared/lib/license-store';
import { useAgentLoopStore } from '../agent-loop-store';

/** Blocked SQL patterns (DDL and dangerous operations) */
const BLOCKED_PATTERN = /^\s*(DROP|ALTER|CREATE|PRAGMA|ATTACH|DETACH|VACUUM|REINDEX)\b/i;

/** SELECT detection */
const SELECT_PATTERN = /^\s*SELECT\b/i;

/** Maximum rows returned for SELECT queries */
const MAX_RESULT_ROWS = 1000;

export interface ExecuteSqlParams {
  query: string;
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

  // 4. Execute
  try {
    if (isSelect) {
      const rows = await runQuery(query);
      if (!rows || rows.length === 0) {
        return 'Result: 0 rows returned.';
      }
      const truncated = rows.length > MAX_RESULT_ROWS;
      const displayRows = truncated ? rows.slice(0, MAX_RESULT_ROWS) : rows;
      let result = `Result: ${rows.length} row(s)`;
      if (truncated) {
        result += ` (showing first ${MAX_RESULT_ROWS}, ${rows.length - MAX_RESULT_ROWS} omitted)`;
      }
      result += '\n' + JSON.stringify(displayRows, null, 2);
      return result;
    } else {
      await runCommand(query);
      // Get affected row count
      try {
        const changesResult = await runQuery('SELECT changes() as affected_rows');
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
 * Sets store state → UI renders confirmation dialog → resolves with user choice.
 */
async function requestUserConfirmation(sql: string): Promise<boolean> {
  // Check if confirmation is disabled in settings
  // Import dynamically to avoid circular deps at module level
  const { useSettingsStore } = await import('@/shared/lib/settings-store');
  const settings = useSettingsStore.getState();
  const agentLoopSettings = (settings.enhancedFeatures.gemini as any).agentLoop;

  if (agentLoopSettings && !agentLoopSettings.confirmWrites) {
    return true;
  }

  return new Promise((resolve) => {
    useAgentLoopStore.getState().setPendingConfirmation({
      sql,
      resolve,
    });
  });
}
