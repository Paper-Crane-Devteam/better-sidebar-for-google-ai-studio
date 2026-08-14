/**
 * Raw SQL channel for the undo layer.
 *
 * Deliberately separate from `tools/execute-sql.ts`:
 *
 * - That module is the *agent's* door and enforces agent rules (paywall, a
 *   blocklist that rejects `PRAGMA`). A restore legitimately needs `PRAGMA
 *   foreign_keys` and must work regardless of licence tier — refusing to undo
 *   because a subscription lapsed would be the wrong answer.
 * - It also avoids an import cycle: execute-sql calls into the undo layer.
 */

/** Send SQL to the background worker. Throws on failure. */
export async function runSql(sql: string): Promise<any> {
  const response = await browser.runtime.sendMessage({
    type: 'EXECUTE_SQL',
    payload: { sql },
  });
  if (!response?.success) {
    throw new Error(response?.error || 'SQL execution failed');
  }
  return response.data;
}

/** Read every row of a table. */
export async function selectAll(table: string): Promise<Record<string, unknown>[]> {
  const rows = await runSql(`SELECT * FROM "${table}"`);
  return Array.isArray(rows) ? rows : [];
}

/**
 * Render a JS value as a SQL literal.
 *
 * Every column in the schema is TEXT or INTEGER, so there are no blobs to worry
 * about. Non-finite numbers become NULL because SQLite has no representation for
 * them and `'NaN'` would silently land in an INTEGER column.
 */
export function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'bigint') return String(value);
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return `'${text.replace(/'/g, "''")}'`;
}

/** `INSERT INTO "t" ("a","b") VALUES (...)` for one row. */
export function buildInsert(table: string, row: Record<string, unknown>): string {
  const columns = Object.keys(row);
  const names = columns.map((c) => `"${c}"`).join(', ');
  const values = columns.map((c) => sqlLiteral(row[c])).join(', ');
  return `INSERT INTO "${table}" (${names}) VALUES (${values})`;
}
