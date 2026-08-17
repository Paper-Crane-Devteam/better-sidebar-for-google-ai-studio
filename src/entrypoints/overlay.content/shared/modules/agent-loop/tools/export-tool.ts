/**
 * export Tool Implementation.
 *
 * Downloads conversations as files, through the exact same code path as the Export
 * command in the sidebar: messages come from the background handler the menu uses,
 * and the bytes are produced by `features/export/export-core`. Nothing here
 * re-implements a format, so a file the agent produces is indistinguishable from
 * one the user produced by hand.
 *
 * Three shapes of request, all in one call:
 * - several conversations (`ids` is a list)
 * - several formats (`format` is a list) — one download per format
 * - no format at all — the extension asks the user with its own format picker
 *
 * That last case is why this tool asks and the model doesn't. The loop has no
 * channel for a question: a response that ends in prose ends the task (see
 * `prompts/soul.ts`). So "which format?" is answered by the same modal the Export
 * menu opens, and the model just leaves the parameter out.
 */

import { toast } from '@/shared/lib/toast';
import i18n from '@/locale/i18n';
import type { ExportItem } from '../../../features/export/types';
import {
  exportItemsToFiles,
  isFileExportFormat,
  FILE_EXPORT_FORMATS,
  type FileExportFormat,
} from '../../../features/export/export-core';
import { pickExportFormat } from '../../../features/export/ExportFormatDialog';
import {
  fetchMessagesForExport,
  buildExportMarkdown as buildConversationMarkdown,
} from '../../explorer/lib/exportConversation';

export interface ExportToolParams {
  ids?: string;
  format?: string;
  separate_files?: string;
  batch_name?: string;
}

/** Guard against an over-eager `SELECT id FROM conversations` turning into a 5000-file zip. */
const MAX_CONVERSATIONS = 100;

/** Spellings the model reaches for that aren't the canonical format names. */
const FORMAT_ALIASES: Record<string, FileExportFormat> = {
  markdown: 'markdown',
  md: 'markdown',
  text: 'text',
  txt: 'text',
  plain: 'text',
  plaintext: 'text',
  'plain text': 'text',
  json: 'json',
};

/** Formats that exist in the UI but not here, so the error can say why. */
const UI_ONLY_FORMATS = new Set(['obsidian', 'notion']);

/**
 * Split a parameter that may arrive as a JSON array, a comma-separated list, or a
 * bare single value. The model uses all three no matter how the schema is worded.
 */
function parseList(raw?: string): string[] {
  const input = (raw ?? '').trim();
  if (!input) return [];

  if (input.startsWith('[')) {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return dedupe(parsed.map((v) => String(v).trim()).filter(Boolean));
      }
    } catch {
      // Malformed JSON — fall through to the separator split below.
    }
  }

  return dedupe(
    input
      .split(/[,\n]/)
      .map((part) => part.trim().replace(/^["'`]|["'`]$/g, ''))
      .filter(Boolean),
  );
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

/** Escape a value for inline use in a SQL string literal. */
function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function selectRows(sql: string): Promise<any[]> {
  const response = await browser.runtime.sendMessage({ type: 'EXECUTE_SQL', payload: { sql } });
  if (!response?.success) {
    throw new Error(response?.error || 'SQL execution failed');
  }
  return Array.isArray(response.data) ? response.data : [];
}

interface ConversationRow {
  id: string;
  title: string | null;
  description: string | null;
  external_url: string | null;
  created_at: number | null;
  updated_at: number | null;
  last_active_at: number | null;
}

async function loadConversations(ids: string[]): Promise<ConversationRow[]> {
  const list = ids.map(sqlLiteral).join(', ');
  return (await selectRows(
    `SELECT id, title, description, external_url, created_at, updated_at, last_active_at
     FROM conversations WHERE id IN (${list})`,
  )) as ConversationRow[];
}

/** Tag names per conversation, so exported frontmatter matches the manual export. */
async function loadTags(ids: string[]): Promise<Map<string, string[]>> {
  const list = ids.map(sqlLiteral).join(', ');
  const byConversation = new Map<string, string[]>();

  try {
    const rows = await selectRows(
      `SELECT ct.conversation_id AS conversation_id, t.name AS name
       FROM conversation_tags ct JOIN tags t ON t.id = ct.tag_id
       WHERE ct.conversation_id IN (${list})`,
    );
    for (const row of rows as { conversation_id: string; name: string }[]) {
      const existing = byConversation.get(row.conversation_id) ?? [];
      existing.push(row.name);
      byConversation.set(row.conversation_id, existing);
    }
  } catch {
    // Tags are decoration on the export, not the point of it. Losing them beats
    // failing the whole download.
  }

  return byConversation;
}

/** Resolve the requested formats, asking the user when the model didn't specify any. */
async function resolveFormats(
  raw?: string,
): Promise<{ formats: FileExportFormat[] } | { error: string }> {
  const requested = parseList(raw).map((f) => f.toLowerCase());

  if (requested.length === 0) {
    const picked = await pickExportFormat({ allowed: FILE_EXPORT_FORMATS });
    if (!picked) {
      return {
        error:
          'CANCELLED: The user closed the format picker without choosing. Do not retry the ' +
          'export unless they ask again.',
      };
    }
    // The picker is restricted to file formats, so this is always one of ours.
    return { formats: [picked as FileExportFormat] };
  }

  const formats: FileExportFormat[] = [];
  for (const name of requested) {
    const canonical = FORMAT_ALIASES[name];
    if (canonical) {
      if (!formats.includes(canonical)) formats.push(canonical);
      continue;
    }
    if (UI_ONLY_FORMATS.has(name)) {
      return {
        error:
          `ERROR: "${name}" export is only available from the sidebar's Export menu — it needs ` +
          `vault/API settings this tool cannot supply. Offer ${FILE_EXPORT_FORMATS.join(', ')} ` +
          `instead, or tell the user to use the Export menu for ${name}.`,
      };
    }
    return {
      error: `ERROR: Unknown export format "${name}". Supported: ${FILE_EXPORT_FORMATS.join(', ')}.`,
    };
  }

  return { formats };
}

function isTruthy(value?: string): boolean {
  return ['true', '1', 'yes', 'y'].includes((value ?? '').trim().toLowerCase());
}

/**
 * Export conversations to downloadable files.
 * Returns a summary string for the agent loop (never throws).
 */
export async function exportConversations(params: ExportToolParams): Promise<string> {
  const ids = parseList(params.ids);

  if (ids.length === 0) {
    return 'ERROR: export requires "ids" — a JSON array of conversation IDs, e.g. ["abc","def"].';
  }
  if (ids.length > MAX_CONVERSATIONS) {
    return (
      `ERROR: ${ids.length} conversations is too many for one export (limit ${MAX_CONVERSATIONS}). ` +
      `Narrow the selection, or export in batches.`
    );
  }

  // ── Load metadata ────────────────────────────────────────────────────────
  let rows: ConversationRow[];
  try {
    rows = await loadConversations(ids);
  } catch (e) {
    return `ERROR: Could not read the conversations - ${(e as Error).message}`;
  }

  const found = new Map(rows.map((row) => [row.id, row]));
  const missing = ids.filter((id) => !found.has(id));

  if (rows.length === 0) {
    return (
      `ERROR: None of those IDs exist in the conversations table. Check them with ` +
      `execute_sql — the export tool takes the "id" column, not external_id or the title.`
    );
  }

  const tagsById = await loadTags(rows.map((row) => row.id));

  // ── Load message bodies ──────────────────────────────────────────────────
  // In parallel: a batch export is up to MAX_CONVERSATIONS round-trips to the
  // background worker, and one at a time makes a folder export feel hung.
  // `Promise.all` keeps the requested order, which the merged file relies on.
  const ordered = ids.map((id) => found.get(id)).filter((row): row is ConversationRow => !!row);
  const fetched = await Promise.all(
    ordered.map(async (row) => ({ row, messages: await fetchMessagesForExport(row.id) })),
  );

  const items: ExportItem[] = [];
  const empty: string[] = [];

  for (const { row, messages } of fetched) {
    const title = row.title || row.id;

    if (!messages?.length) {
      empty.push(`"${title}" (${row.id})`);
      continue;
    }

    items.push({
      id: row.id,
      title,
      content: buildConversationMarkdown(messages),
      description: row.description || undefined,
      sourceUrl: row.external_url || undefined,
      createdAt: row.created_at ?? row.last_active_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
      tags: tagsById.get(row.id),
    });
  }

  if (items.length === 0) {
    return (
      `ERROR: None of the ${ids.length} conversation(s) have synced messages, so there is nothing ` +
      `to write. Their content is only in the database once the conversation has been opened in ` +
      `the browser. Tell the user which ones need opening: ${empty.join(', ')}`
    );
  }

  // ── Ask for the format if it wasn't given, then write the files ──────────
  const resolved = await resolveFormats(params.format);
  if ('error' in resolved) return resolved.error;

  const separateFiles = isTruthy(params.separate_files);
  const batchName = params.batch_name?.trim() || i18n.t('export.defaultFilename');

  const written: string[] = [];
  const failures: string[] = [];

  for (const format of resolved.formats) {
    const result = await exportItemsToFiles(items, format, {
      multiFileZip: separateFiles,
      batchName,
    });
    if (result.ok) {
      written.push(...result.files);
    } else {
      failures.push(`${format} (${result.reason})`);
    }
  }

  if (written.length === 0) {
    return `ERROR: The export produced no files - ${failures.join(', ')}.`;
  }

  toast.success(
    items.length === 1
      ? i18n.t('export.exported')
      : i18n.t('export.exportedCount', { count: items.length }),
  );

  // ── Report back ──────────────────────────────────────────────────────────
  const lines = [
    `Downloaded ${items.length} conversation(s) as ${resolved.formats.join(', ')}.`,
    `Files: ${written.join(', ')}`,
  ];
  if (empty.length > 0) {
    lines.push(
      `Skipped, no synced messages (the user has to open these in the browser first): ` +
        `${empty.join(', ')}`,
    );
  }
  if (missing.length > 0) {
    lines.push(`Skipped, no such conversation ID: ${missing.join(', ')}`);
  }
  if (failures.length > 0) {
    lines.push(`Formats that produced nothing: ${failures.join(', ')}`);
  }

  return lines.join('\n');
}
