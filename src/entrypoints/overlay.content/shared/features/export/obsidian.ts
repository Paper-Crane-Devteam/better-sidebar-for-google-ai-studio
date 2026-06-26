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
 * Falls back to downloading as .md if Obsidian is not installed.
 *
 * @param item - The export item
 * @param vault - Optional vault name. If omitted, Obsidian uses the last-opened vault.
 * @param folder - Optional folder path inside the vault (e.g. "Snippets/AI")
 */
export function openInObsidian(
  item: ExportItem,
  vault?: string,
  folder?: string,
): void {
  const filename = safeFilename(item.title);
  const content = buildObsidianNote(item);

  // Build the path: folder/filename or just filename
  const fullPath = folder ? `${folder}/${filename}` : filename;

  // Construct obsidian://new URI
  // See: https://help.obsidian.md/Extending+Obsidian/Obsidian+URI
  // Note: We use encodeURIComponent instead of URLSearchParams because
  // URLSearchParams encodes spaces as '+' which Obsidian doesn't decode properly.
  const parts: string[] = [];
  if (vault) parts.push(`vault=${encodeURIComponent(vault)}`);
  parts.push(`name=${encodeURIComponent(fullPath)}`);
  parts.push(`content=${encodeURIComponent(content)}`);
  parts.push('overwrite=false');

  const uri = `obsidian://new?${parts.join('&')}`;

  // Open via the URI protocol using a hidden link click
  // (window.location.href doesn't work well for multiple sequential calls)
  const a = document.createElement('a');
  a.href = uri;
  a.click();
}
