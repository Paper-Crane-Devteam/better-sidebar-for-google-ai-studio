export const CURRENT_VERSION = '2.7.0';

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
 * Convert a ChangeLogItem to a markdown string for rendering.
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
