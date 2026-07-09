/**
 * Parse model response content into structured outline items.
 *
 * Extracts:
 * - Markdown headings (#, ##, ###, ####)
 * - Code blocks with language labels and raw content
 * - Bold section headers (**text**:)
 * - Images (![alt](url))
 * - Tables (| header | header |)
 * - Links ([text](url)) — standalone link lines
 * - Math blocks ($$...$$)
 */

import type { OutlineNode, OutlineItemType } from './types';

let nodeIdCounter = 0;
function genId(): string {
  return `ol-${++nodeIdCounter}-${Date.now().toString(36)}`;
}

interface ParsedItem {
  type: OutlineItemType;
  label: string;
  meta?: string;
  rawContent?: string;
  depth: number;
}

export function parseOutlineFromContent(
  content: string,
  messageId: string,
): OutlineNode[] {
  if (!content) return [];
  const items = extractItems(content);
  return buildTree(items, messageId);
}

function extractItems(content: string): ParsedItem[] {
  const lines = content.split('\n');
  const items: ParsedItem[] = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockStartLine = -1;
  let codeBlockLines: string[] = [];
  let inMathBlock = false;
  let mathBlockStartLine = -1;
  let mathBlockLines: string[] = [];
  let inTable = false;
  let tableRowCount = 0;
  let tableStartLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── Math block boundaries ($$) ─────────────────────────────────
    if (trimmed === '$$' && !inCodeBlock) {
      if (!inMathBlock) {
        inMathBlock = true;
        mathBlockStartLine = i;
        mathBlockLines = [];
      } else {
        inMathBlock = false;
        const rawContent = mathBlockLines.join('\n');
        const preview = rawContent.length > 40
          ? rawContent.substring(0, 40) + '…'
          : rawContent;
        items.push({
          type: 'math',
          label: `formula: ${preview}`,
          rawContent,
          depth: 2,
        });
      }
      continue;
    }

    if (inMathBlock) {
      mathBlockLines.push(line);
      continue;
    }

    // ── Code block boundaries ──────────────────────────────────────
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim().split(/\s/)[0] || '';
        codeBlockStartLine = i;
        codeBlockLines = [];

        // End any ongoing table
        if (inTable) {
          finishTable();
        }
      } else {
        inCodeBlock = false;
        const lineCount = i - codeBlockStartLine - 1;
        const label = codeBlockLang
          ? `${codeBlockLang} (${lineCount} lines)`
          : `code (${lineCount} lines)`;
        const rawContent = codeBlockLines.join('\n');
        items.push({
          type: 'code-block',
          label,
          meta: codeBlockLang || undefined,
          rawContent,
          depth: 2,
        });
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // ── Table detection ────────────────────────────────────────────
    const isTableRow = /^\|(.+\|)+\s*$/.test(trimmed);
    const isSeparator = /^\|[\s\-:|]+\|$/.test(trimmed);

    if (isTableRow || isSeparator) {
      if (!inTable) {
        inTable = true;
        tableRowCount = 0;
        tableStartLine = i;
      }
      if (!isSeparator) {
        tableRowCount++;
      }
      continue;
    } else if (inTable) {
      finishTable();
    }

    // ── Headings: # (h1), ## (h2), ### (h3), #### (h4) ────────────
    const headingMatch = /^(#{1,4})\s+(.+)/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      items.push({
        type: 'heading',
        label: text,
        meta: `h${level}`,
        depth: Math.max(0, level - 1), // h1=0, h2=1, h3=2, h4=3
      });
      continue;
    }

    // ── Images: ![alt](url) ────────────────────────────────────────
    const imageMatch = /!\[([^\]]*)\]\(([^)]+)\)/.exec(trimmed);
    if (imageMatch) {
      const alt = imageMatch[1] || 'image';
      const url = imageMatch[2];
      const filename = url.split('/').pop()?.split('?')[0] || url;
      const label = alt !== 'image' ? alt : filename;
      items.push({
        type: 'image',
        label,
        meta: url,
        depth: 2,
      });
      continue;
    }

    // ── Standalone links: [text](url) on its own line ──────────────
    const linkLineMatch = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s*$/.exec(trimmed);
    if (linkLineMatch) {
      const text = linkLineMatch[1];
      const url = linkLineMatch[2];
      items.push({
        type: 'link',
        label: text,
        meta: url,
        rawContent: url,
        depth: 2,
      });
      continue;
    }

    // ── Bold text at start of line as section header ───────────────
    const boldHeaderMatch = /^\*\*([^*]+)\*\*[:：]?\s*$/.exec(trimmed);
    if (boldHeaderMatch && items.length > 0) {
      const text = boldHeaderMatch[1].trim();
      if (text.length <= 60) {
        items.push({
          type: 'heading',
          label: text,
          meta: 'bold',
          depth: 1,
        });
      }
    }
  }

  // End any ongoing table at EOF
  if (inTable) {
    finishTable();
  }

  return items;

  function finishTable() {
    if (tableRowCount > 0) {
      // Subtract 1 for header row to get data rows
      const dataRows = Math.max(0, tableRowCount - 1);
      items.push({
        type: 'table',
        label: `table (${dataRows} rows)`,
        meta: `${tableRowCount}`,
        depth: 2,
      });
    }
    inTable = false;
    tableRowCount = 0;
  }
}

function buildTree(items: ParsedItem[], messageId: string): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const stack: OutlineNode[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const node: OutlineNode = {
      id: genId(),
      messageId,
      parentId: null,
      type: item.type,
      label: item.label,
      meta: item.meta,
      rawContent: item.rawContent,
      depth: item.depth,
      navigable: true,
      order: i,
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].depth >= item.depth) {
      stack.pop();
    }

    if (stack.length > 0) {
      const parent = stack[stack.length - 1];
      node.parentId = parent.id;
      parent.children.push(node);
    } else {
      roots.push(node);
    }

    if (item.type === 'heading') {
      stack.push(node);
    }
  }

  return roots;
}
