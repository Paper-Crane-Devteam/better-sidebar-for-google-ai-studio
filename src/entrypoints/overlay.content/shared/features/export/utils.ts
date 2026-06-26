import { stripMarkdown } from '@/shared/lib/utils/utils';
import type { ExportItem } from './types';
import i18n from '@/locale/i18n';

/** Sanitize filename: remove invalid chars and limit length. */
export function safeFilename(name: string, maxLen = 80): string {
  const sanitized = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
  return sanitized.slice(0, maxLen) || i18n.t('export.defaultFilename');
}

/** Build YAML frontmatter for Obsidian/markdown export. */
/** Build YAML frontmatter for Obsidian/markdown export. */
export function buildFrontmatter(item: ExportItem): string {
  const lines: string[] = ['---'];

  lines.push(`title: "${item.title.replace(/"/g, '\\"')}"`);

  if (item.sourceUrl) {
    lines.push(`source: "${item.sourceUrl}"`);
  }

  if (item.createdAt) {
    lines.push(`created: ${new Date(item.createdAt * 1000).toISOString()}`);
  }

  if (item.updatedAt) {
    lines.push(`updated: ${new Date(item.updatedAt * 1000).toISOString()}`);
  }

  if (item.tags && item.tags.length > 0) {
    lines.push(`tags: [${item.tags.join(', ')}]`);
  }

  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

/** Build plain text export (strip markdown). */
export function buildExportText(item: ExportItem): string {
  return stripMarkdown(item.content || '');
}

/** Build markdown export with frontmatter. */
export function buildExportMarkdown(item: ExportItem): string {
  const frontmatter = buildFrontmatter(item);
  return `${frontmatter}\n${item.content || ''}\n`;
}

/** Build JSON export. */
export function buildExportJson(items: ExportItem[]): string {
  const data = items.map((item) => ({
    title: item.title,
    content: item.content,
    source_url: item.sourceUrl || null,
    created_at: item.createdAt
      ? new Date(item.createdAt * 1000).toISOString()
      : null,
    updated_at: item.updatedAt
      ? new Date(item.updatedAt * 1000).toISOString()
      : null,
  }));
  return JSON.stringify(items.length === 1 ? data[0] : data, null, 2);
}

/** Trigger download of a blob with the given filename. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
