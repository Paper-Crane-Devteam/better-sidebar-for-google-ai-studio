export type ExportFormat = 'markdown' | 'text' | 'json' | 'obsidian' | 'notion';

export interface ExportItem {
  /** Unique identifier */
  id: string;
  /** Display title / filename base */
  title: string;
  /** Markdown content */
  content: string;
  /** Optional description / summary */
  description?: string | null;
  /** Optional source URL */
  sourceUrl?: string | null;
  /** Optional creation timestamp (unix seconds) */
  createdAt?: number;
  /** Optional update timestamp (unix seconds) */
  updatedAt?: number;
  /** Optional folder path segments for nested export */
  folderPath?: string[];
  /** Optional tags for frontmatter */
  tags?: string[];
}

export interface ExportItemsOptions {
  /** Custom batch name for the combined file/note (e.g. folder name). Falls back to batchPrefix. */
  batchName?: string;
}
