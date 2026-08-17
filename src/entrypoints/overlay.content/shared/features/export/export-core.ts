/**
 * Export core — the file-producing half of the export feature, without React.
 *
 * This logic used to live inside `useExport`, which made it reachable only from a
 * component. The agent's `export` tool is a plain async function, so it either had
 * to duplicate the formatting (and drift from what the Export menu produces) or
 * this had to come out of the hook. It came out of the hook.
 *
 * The other reason for a separate module: a tool has to *report* what happened
 * back to the model. The hook's contract is "fire and raise a toast", which tells
 * the AI nothing. Here the outcome is returned, and the caller decides whether it
 * becomes a toast, a tool result, or both.
 */

import type { ExportItem } from './types';
import {
  safeFilename,
  buildExportText,
  buildExportMarkdown,
  buildExportJson,
  downloadBlob,
} from './utils';

/** The formats that produce a downloadable file. Obsidian/Notion are handled elsewhere. */
export type FileExportFormat = 'markdown' | 'text' | 'json';

export const FILE_EXPORT_FORMATS: readonly FileExportFormat[] = ['markdown', 'text', 'json'];

export function isFileExportFormat(value: string): value is FileExportFormat {
  return (FILE_EXPORT_FORMATS as readonly string[]).includes(value);
}

const EXTENSIONS: Record<FileExportFormat, string> = {
  markdown: 'md',
  text: 'txt',
  json: 'json',
};

const MIME_TYPES: Record<FileExportFormat, string> = {
  markdown: 'text/markdown;charset=utf-8',
  text: 'text/plain;charset=utf-8',
  json: 'application/json;charset=utf-8',
};

export interface ExportFilesOptions {
  /**
   * When several items are exported: true writes one file per item into a zip,
   * false (default) merges them into a single file.
   */
  multiFileZip?: boolean;
  /** Base filename for the merged file or the zip. Ignored for a single item. */
  batchName?: string;
}

export interface ExportFilesResult {
  ok: boolean;
  /** How many items ended up in the output */
  count: number;
  /** Filenames that were handed to the browser */
  files: string[];
  /** Why nothing was written. Callers map this to their own messaging. */
  reason?: 'no-items' | 'no-content';
}

/** Render one item's body in the given format. */
function renderItem(item: ExportItem, format: FileExportFormat): string {
  if (format === 'text') return buildExportText(item);
  if (format === 'markdown') return buildExportMarkdown(item);
  return buildExportJson([item]);
}

/** Render several items into one document. */
function renderMerged(items: ExportItem[], format: FileExportFormat): string {
  if (format === 'text') {
    return items
      .map((item) => `# ${item.title}\n\n${buildExportText(item)}`)
      .join('\n\n---\n\n');
  }
  if (format === 'markdown') {
    return items.map((item) => buildExportMarkdown(item)).join('\n---\n\n');
  }
  return buildExportJson(items);
}

/** Give every file in a zip a distinct name, so same-titled conversations don't collide. */
function uniqueName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let counter = 2;
  while (used.has(`${base} (${counter})`)) counter++;
  const name = `${base} (${counter})`;
  used.add(name);
  return name;
}

async function downloadZip(
  items: ExportItem[],
  format: FileExportFormat,
  zipName: string,
): Promise<string> {
  const { zipSync, strToU8 } = await import('fflate');
  const files: Record<string, Uint8Array> = {};
  const used = new Set<string>();

  for (const item of items) {
    const name = uniqueName(safeFilename(item.title), used);
    files[`${name}.${EXTENSIONS[format]}`] = strToU8(renderItem(item, format));
  }

  const blob = new Blob([zipSync(files, { level: 6 })], { type: 'application/zip' });
  const filename = `${zipName}.zip`;
  downloadBlob(blob, filename);
  return filename;
}

/**
 * Write one or more items to disk in a file format.
 *
 * A single item is named after its title, matching what the Export menu does for
 * one conversation; several items get `<batchName>-<date>`.
 */
export async function exportItemsToFiles(
  items: ExportItem[],
  format: FileExportFormat,
  options: ExportFilesOptions = {},
): Promise<ExportFilesResult> {
  if (items.length === 0) {
    return { ok: false, count: 0, files: [], reason: 'no-items' };
  }

  // JSON stays useful for an empty conversation (it still records the metadata);
  // an empty .md or .txt is just a confusing download.
  if (items.length === 1 && !items[0].content && format !== 'json') {
    return { ok: false, count: 0, files: [], reason: 'no-content' };
  }

  if (items.length === 1) {
    const item = items[0];
    const filename = `${safeFilename(item.title)}.${EXTENSIONS[format]}`;
    downloadBlob(new Blob([renderItem(item, format)], { type: MIME_TYPES[format] }), filename);
    return { ok: true, count: 1, files: [filename] };
  }

  const baseName = `${safeFilename(options.batchName || 'export')}-${new Date()
    .toISOString()
    .slice(0, 10)}`;

  if (options.multiFileZip) {
    const filename = await downloadZip(items, format, baseName);
    return { ok: true, count: items.length, files: [filename] };
  }

  const filename = `${baseName}.${EXTENSIONS[format]}`;
  downloadBlob(new Blob([renderMerged(items, format)], { type: MIME_TYPES[format] }), filename);
  return { ok: true, count: items.length, files: [filename] };
}
