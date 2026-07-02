/**
 * Parse model response content into structured outline items.
 *
 * Extracts:
 * - Markdown headings (##, ###, ####)
 * - Code blocks with language labels
 * - Bold section headers (**text**:)
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code block boundaries
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim().split(/\s/)[0] || '';
        codeBlockStartLine = i;
      } else {
        inCodeBlock = false;
        const lineCount = i - codeBlockStartLine - 1;
        const label = codeBlockLang
          ? `${codeBlockLang} (${lineCount} lines)`
          : `code (${lineCount} lines)`;
        items.push({
          type: 'code-block',
          label,
          meta: codeBlockLang || undefined,
          depth: 2,
        });
      }
      continue;
    }

    if (inCodeBlock) continue;

    // Headings: ## (h2), ### (h3), #### (h4)
    const headingMatch = /^(#{2,4})\s+(.+)/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      items.push({
        type: 'heading',
        label: text,
        meta: `h${level}`,
        depth: level - 2, // h2=0, h3=1, h4=2
      });
      continue;
    }

    // Bold text at start of line as section header
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

  return items;
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
