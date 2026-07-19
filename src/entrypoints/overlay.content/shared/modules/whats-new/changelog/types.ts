export const CURRENT_VERSION = '2.8.0';

/**
 * Legacy structured changelog item (used for versions < 2.8.0).
 */
export interface ChangeLogItem {
  version: string;
  date: string;
  features: string[];
  fixes?: string[];
  announcement?: {
    title: string;
    content: string[];
  };
}

/**
 * Markdown-based changelog entry (used for versions >= 2.8.0).
 * Content is loaded directly from .md files per locale.
 */
export interface ChangeLogMarkdownEntry {
  version: string;
  date: string;
  markdown: string;
}

/**
 * Unified changelog entry — either markdown-based or legacy structured.
 */
export type ChangeLogEntry = ChangeLogMarkdownEntry | ChangeLogItem;

/**
 * Type guard: check if an entry is markdown-based.
 */
export function isMarkdownEntry(entry: ChangeLogEntry): entry is ChangeLogMarkdownEntry {
  return 'markdown' in entry;
}

/**
 * Convert a legacy ChangeLogItem to a markdown string for rendering.
 */
export function changelogItemToMarkdown(item: ChangeLogItem): string {
  const lines: string[] = [];

  if (item.features && item.features.length > 0) {
    lines.push('### ✨ New Features\n');
    for (const feature of item.features) {
      lines.push(`- ${feature}`);
    }
    lines.push('');
  }

  if (item.fixes && item.fixes.length > 0) {
    lines.push('### 🔧 Improvements & Fixes\n');
    for (const fix of item.fixes) {
      lines.push(`- ${fix}`);
    }
    lines.push('');
  }

  if (item.announcement) {
    lines.push(`### 💌 ${item.announcement.title}\n`);
    for (const line of item.announcement.content) {
      lines.push(`${line}\n`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get the markdown content from a ChangeLogEntry (works for both formats).
 */
export function getEntryMarkdown(entry: ChangeLogEntry): string {
  if (isMarkdownEntry(entry)) {
    return entry.markdown;
  }
  return changelogItemToMarkdown(entry);
}
