import i18n from '@/locale/i18n';
import type { ChangeLogItem, ChangeLogEntry, ChangeLogMarkdownEntry } from './types';
import { changelog as en } from './en';
import { changelog as zhCN } from './zh-CN';
import { changelog as zhTW } from './zh-TW';
import { changelog as ja } from './ja';
import { changelog as ru } from './ru';
import { changelog as es } from './es';
import { changelog as pt } from './pt';

export { CURRENT_VERSION, changelogItemToMarkdown, getEntryMarkdown, isMarkdownEntry, isMajorVersion, getMajorVersion, hasSeenMajorVersion } from './types';
export type { ChangeLogItem, ChangeLogEntry, ChangeLogMarkdownEntry } from './types';

// --- Markdown-based changelog (>= 2.8.0) ---
// Glob-import all md files and meta.json from version directories.
// Vite resolves these at build time — no manual imports needed per version.
const mdModules = import.meta.glob<string>('./*/*.md', { eager: true, import: 'default', query: '?raw' });
const metaModules = import.meta.glob<{ version: string; date: string }>('./**/meta.json', { eager: true, import: 'default' });

/**
 * Parse glob results into structured markdown changelog entries.
 * Expects paths like: ./2.8.0/en.md, ./2.8.0/zh-CN.md, ./2.8.0/meta.json
 */
function buildMarkdownChangelog(): Array<{
  version: string;
  date: string;
  locales: Record<string, string>;
}> {
  // Collect meta info per version
  const versionMeta: Record<string, { version: string; date: string }> = {};
  for (const [path, meta] of Object.entries(metaModules)) {
    // path: ./2.8.0/meta.json
    const match = path.match(/^\.\/([^/]+)\/meta\.json$/);
    if (match) {
      versionMeta[match[1]] = meta;
    }
  }

  // Collect markdown content per version per locale
  const versionLocales: Record<string, Record<string, string>> = {};
  for (const [path, content] of Object.entries(mdModules)) {
    // path: ./2.8.0/en.md or ./2.8.0/zh-CN.md
    const match = path.match(/^\.\/([^/]+)\/(.+)\.md$/);
    if (match) {
      const [, ver, locale] = match;
      if (!versionLocales[ver]) versionLocales[ver] = {};
      versionLocales[ver][locale] = content;
    }
  }

  // Merge and sort by version descending
  const entries = Object.entries(versionMeta)
    .filter(([ver]) => versionLocales[ver])
    .map(([ver, meta]) => ({
      version: meta.version,
      date: meta.date,
      locales: versionLocales[ver],
    }));

  // Sort newest first (simple semver comparison via localeCompare works for x.y.z)
  entries.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));

  return entries;
}

const markdownChangelog = buildMarkdownChangelog();

// --- Legacy structured changelog (< 2.8.0) ---
const legacyChangelogMap: Record<string, ChangeLogItem[]> = {
  en,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ja,
  ru,
  es,
  pt,
};

/**
 * Get the combined changelog for the current i18n language.
 * Returns markdown-based entries first (newest versions), then legacy entries.
 * Falls back to English for unsupported languages.
 */
export function getChangelog(): ChangeLogEntry[] {
  const lang = i18n.language;

  // Build markdown entries for current locale (fallback to 'en')
  const mdEntries: ChangeLogMarkdownEntry[] = markdownChangelog
    .map((entry) => ({
      version: entry.version,
      date: entry.date,
      markdown: entry.locales[lang] || entry.locales.en || '',
    }))
    .filter((entry) => entry.markdown.length > 0);

  // Get legacy entries for current locale (fallback to 'en')
  const legacyEntries: ChangeLogItem[] = legacyChangelogMap[lang] ?? en;

  return [...mdEntries, ...legacyEntries];
}
