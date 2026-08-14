/**
 * Work out *which tables* a statement writes to. Nothing more.
 *
 * This is the whole reason the snapshot approach is safer than recording inverse
 * statements: that needed the WHERE clause, and pulling a WHERE clause back out of
 * arbitrary SQL by regex is a losing game — `INSERT ... SELECT`, CTEs, subqueries,
 * `DELETE ... LIMIT`, multiple statements in one string. Every gap failed silently,
 * which for a safety net is worse than not having one.
 *
 * A table name is a single identifier right after `INTO` / `UPDATE` / `FROM`, so it
 * only ever needs the first few tokens of a statement. Anything these patterns do
 * not recognise is reported as unparseable, and the caller refuses to offer undo —
 * failing loudly instead of pretending.
 */

import { isKnownTable } from './schema-map';

export type WriteOperation = 'insert' | 'update' | 'delete';

export interface WriteTarget {
  operation: WriteOperation;
  table: string;
}

export interface TargetScanResult {
  targets: WriteTarget[];
  /**
   * A statement that writes something we could not identify.
   *
   * Carries the reason so the UI can say why undo is unavailable — "unrecognised
   * statement" and "table we don't know" are different problems for the user.
   */
  unsupported: string | null;
}

// Only the head of a statement is matched: `\w+` stops at the first non-word
// character, so nothing after the table name can widen the match.
// An optional schema qualifier (`main.folders`) and optional quoting are allowed
// because both are valid SQLite and cheap to accept.
const IDENT = String.raw`["'\[\`]?(?:\w+\s*\.\s*)?(\w+)["'\]\`]?`;

const PATTERNS: ReadonlyArray<{ operation: WriteOperation; re: RegExp }> = [
  { operation: 'insert', re: new RegExp(String.raw`^\s*INSERT\s+(?:OR\s+\w+\s+)?INTO\s+${IDENT}`, 'i') },
  { operation: 'insert', re: new RegExp(String.raw`^\s*REPLACE\s+INTO\s+${IDENT}`, 'i') },
  { operation: 'update', re: new RegExp(String.raw`^\s*UPDATE\s+(?:OR\s+\w+\s+)?${IDENT}`, 'i') },
  { operation: 'delete', re: new RegExp(String.raw`^\s*DELETE\s+FROM\s+${IDENT}`, 'i') },
];

/** Statements that change nothing and therefore need no undo */
const READ_ONLY = /^\s*(SELECT|WITH|EXPLAIN|PRAGMA)\b/i;

/**
 * Split on `;` while ignoring separators inside string literals, identifier
 * quotes and comments.
 *
 * Needed because the worker runs statements through `db.run`, which accepts
 * several at once — a single `DELETE` regex anchored at `^` would look at the
 * first statement and miss the rest.
 */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let current = '';
  let quote: string | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (lineComment) {
      current += ch;
      if (ch === '\n') lineComment = false;
      continue;
    }

    if (blockComment) {
      current += ch;
      if (ch === '*' && next === '/') {
        current += next;
        i++;
        blockComment = false;
      }
      continue;
    }

    if (quote) {
      current += ch;
      if (ch === quote) {
        // Doubled quote is an escaped literal quote, not a terminator
        if (next === quote) {
          current += next;
          i++;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (ch === '-' && next === '-') {
      current += ch + next;
      i++;
      lineComment = true;
      continue;
    }

    if (ch === '/' && next === '*') {
      current += ch + next;
      i++;
      blockComment = true;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      current += ch;
      continue;
    }

    if (ch === ';') {
      out.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  out.push(current);
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Every table `sql` writes to, across all statements in it.
 *
 * `unsupported` being non-null means: something in here changes data and we could
 * not tell what. The caller must then treat the whole operation as un-undoable
 * rather than capturing a partial snapshot.
 */
export function scanWriteTargets(sql: string): TargetScanResult {
  const targets: WriteTarget[] = [];
  const seen = new Set<string>();

  for (const statement of splitStatements(sql)) {
    if (READ_ONLY.test(statement)) continue;

    const match = PATTERNS.map(({ operation, re }) => {
      const m = statement.match(re);
      return m ? { operation, table: m[1] } : null;
    }).find((m): m is WriteTarget => m !== null);

    if (!match) {
      return {
        targets,
        unsupported: `Unrecognised statement: ${statement.slice(0, 60)}`,
      };
    }

    if (!isKnownTable(match.table)) {
      return {
        targets,
        unsupported: `Unknown table "${match.table}"`,
      };
    }

    const key = `${match.operation}:${match.table}`;
    if (!seen.has(key)) {
      seen.add(key);
      targets.push(match);
    }
  }

  return { targets, unsupported: null };
}
