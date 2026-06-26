import type { ExportItem } from './types';
import { safeFilename, buildFrontmatter } from './utils';

/**
 * Build an Obsidian-compatible markdown note with YAML frontmatter.
 */
export function buildObsidianNote(item: ExportItem): string {
  const frontmatter = buildFrontmatter(item);
  const content = item.content || '';
  return `${frontmatter}\n${content}\n`;
}

/**
 * Open a single note in Obsidian via the `obsidian://new` URI protocol.
 * Uses clipboard as intermediary to avoid URL length limits.
 * The content is written to clipboard, then Obsidian reads it via `clipboard=true`.
 * This is the approach used by Obsidian Web Clipper and most community plugins.
 *
 * @param item - The export item
 * @param vault - Optional vault name. If omitted, Obsidian uses the last-opened vault.
 * @param folder - Optional folder path inside the vault (e.g. "Snippets/AI")
 */
export async function openInObsidian(
  item: ExportItem,
  vault?: string,
  folder?: string,
): Promise<void> {
  const filename = safeFilename(item.title);
  const content = buildObsidianNote(item);

  // Write content to clipboard first — Obsidian will read from it
  await navigator.clipboard.writeText(content);

  // Build the path: folder/filename or just filename
  const fullPath = folder ? `${folder}/${filename}` : filename;

  // Construct obsidian://new URI with clipboard=true
  // See: https://help.obsidian.md/Extending+Obsidian/Obsidian+URI
  const parts: string[] = [];
  if (vault) parts.push(`vault=${encodeURIComponent(vault)}`);
  parts.push(`name=${encodeURIComponent(fullPath)}`);
  parts.push('clipboard=true');
  parts.push('overwrite=false');

  const uri = `obsidian://new?${parts.join('&')}`;

  // Open via the URI protocol
  const a = document.createElement('a');
  a.href = uri;
  a.click();
}
