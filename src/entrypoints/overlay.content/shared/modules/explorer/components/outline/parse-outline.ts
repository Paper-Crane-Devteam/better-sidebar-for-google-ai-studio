/**
 * Parse model response content into structured outline items using marked's Lexer.
 *
 * Extracts:
 * - Markdown headings (h1–h4)
 * - Code blocks with language labels and raw content
 * - Bold section headers (**text**:)
 * - Images (![alt](url))
 * - Tables
 * - Links ([text](url)) — standalone link lines
 * - Math blocks ($$...$$)
 * - Nested lists (top-level items become outline nodes)
 * - Blockquotes
 * - HTML <details>/<summary> blocks
 */

import { Lexer, type Token, type Tokens } from 'marked';
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

/** Find the depth of the last heading-type item in the list */
function getLastHeadingDepth(items: ParsedItem[]): number {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].type === 'heading') {
      return items[i].depth;
    }
  }
  return 0;
}

/** Strip inline markdown syntax from text for clean label display */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')   // **bold**
    .replace(/\*([^*]+)\*/g, '$1')        // *italic*
    .replace(/__([^_]+)__/g, '$1')        // __bold__
    .replace(/_([^_]+)_/g, '$1')          // _italic_
    .replace(/~~([^~]+)~~/g, '$1')        // ~~strike~~
    .replace(/`([^`]+)`/g, '$1')          // `code`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // [text](url)
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
  // Pre-process: extract math blocks before lexing (marked doesn't handle $$)
  const { processed, mathBlocks } = extractMathBlocks(content);

  const tokens = Lexer.lex(processed);
  const items: ParsedItem[] = [];

  for (const token of tokens) {
    processToken(token, items, mathBlocks);
  }

  return items;
}

function extractMathBlocks(content: string): {
  processed: string;
  mathBlocks: Map<string, string>;
} {
  const mathBlocks = new Map<string, string>();
  let counter = 0;
  const processed = content.replace(
    /\$\$\n([\s\S]*?)\n\$\$/g,
    (_match, inner: string) => {
      const placeholder = `<!--math-block-${counter++}-->`;
      mathBlocks.set(placeholder, inner);
      return placeholder;
    },
  );
  return { processed, mathBlocks };
}

function processToken(
  token: Token,
  items: ParsedItem[],
  mathBlocks: Map<string, string>,
): void {
  switch (token.type) {
    case 'heading': {
      const t = token as Tokens.Heading;
      if (t.depth <= 4) {
        items.push({
          type: 'heading',
          label: stripInlineMarkdown(t.text),
          meta: `h${t.depth}`,
          depth: Math.max(0, t.depth - 1),
        });
      }
      break;
    }

    case 'code': {
      const t = token as Tokens.Code;
      const lineCount = t.text.split('\n').length;
      const lang = t.lang || '';
      const label = lang
        ? `${lang} (${lineCount} lines)`
        : `code (${lineCount} lines)`;
      const parentDepth = getLastHeadingDepth(items);
      items.push({
        type: 'code-block',
        label,
        meta: lang || undefined,
        rawContent: t.text,
        depth: parentDepth + 1,
      });
      break;
    }

    case 'table': {
      const t = token as Tokens.Table;
      const dataRows = t.rows.length;
      const raw = token.raw;
      const parentDepth = getLastHeadingDepth(items);
      items.push({
        type: 'table',
        label: `table (${dataRows} rows)`,
        meta: `${dataRows + 1}`,
        rawContent: raw,
        depth: parentDepth + 1,
      });
      break;
    }

    case 'blockquote': {
      const t = token as Tokens.Blockquote;
      const stripped = stripInlineMarkdown(t.text);
      const preview = stripped.length > 50
        ? stripped.substring(0, 50) + '…'
        : stripped;
      const parentDepth = getLastHeadingDepth(items);
      items.push({
        type: 'heading',
        label: `> ${preview}`,
        meta: 'blockquote',
        rawContent: t.text,
        depth: parentDepth + 1,
      });
      break;
    }

    case 'list': {
      const t = token as Tokens.List;
      const parentDepth = getLastHeadingDepth(items);
      for (const item of t.items) {
        const rawText = item.text.split('\n')[0].trim();
        if (rawText) {
          // Extract bold prefix as label: "**Bold Text** rest..." → label="Bold Text"
          const boldPrefixMatch = /^\*\*([^*]+)\*\*[:：]?\s*/.exec(rawText);
          if (boldPrefixMatch) {
            items.push({
              type: 'heading',
              label: boldPrefixMatch[1].trim(),
              meta: 'list-item',
              rawContent: rawText,
              depth: parentDepth + 1,
            });
          } else {
            items.push({
              type: 'heading',
              label: stripInlineMarkdown(rawText),
              meta: 'list-item',
              rawContent: rawText !== stripInlineMarkdown(rawText) ? rawText : undefined,
              depth: parentDepth + 1,
            });
          }
        }
      }
      break;
    }

    case 'html': {
      const t = token as Tokens.HTML;
      // Detect <details><summary>...</summary>
      const summaryMatch = /<summary>([^<]+)<\/summary>/i.exec(t.raw);
      if (summaryMatch) {
        const parentDepth = getLastHeadingDepth(items);
        items.push({
          type: 'heading',
          label: summaryMatch[1].trim(),
          meta: 'details',
          rawContent: t.raw,
          depth: parentDepth + 1,
        });
      }
      // Detect math block placeholders
      for (const [placeholder, mathContent] of mathBlocks) {
        if (t.raw.includes(placeholder)) {
          const preview = mathContent.length > 40
            ? mathContent.substring(0, 40) + '…'
            : mathContent;
          const parentDepth = getLastHeadingDepth(items);
          items.push({
            type: 'math',
            label: `formula: ${preview}`,
            rawContent: mathContent,
            depth: parentDepth + 1,
          });
          mathBlocks.delete(placeholder);
        }
      }
      break;
    }

    case 'paragraph': {
      const t = token as Tokens.Paragraph;
      const trimmed = t.text.trim();

      // Check for math block placeholders in paragraphs
      for (const [placeholder, mathContent] of mathBlocks) {
        if (trimmed.includes(placeholder)) {
          const preview = mathContent.length > 40
            ? mathContent.substring(0, 40) + '…'
            : mathContent;
          const parentDepth = getLastHeadingDepth(items);
          items.push({
            type: 'math',
            label: `formula: ${preview}`,
            rawContent: mathContent,
            depth: parentDepth + 1,
          });
          mathBlocks.delete(placeholder);
          return;
        }
      }

      // Standalone image: ![alt](url)
      const imageMatch = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed);
      if (imageMatch) {
        const alt = imageMatch[1] || 'image';
        const url = imageMatch[2];
        const filename = url.split('/').pop()?.split('?')[0] || url;
        const parentDepth = getLastHeadingDepth(items);
        items.push({
          type: 'image',
          label: alt !== 'image' ? alt : filename,
          meta: url,
          depth: parentDepth + 1,
        });
        return;
      }

      // Standalone link: [text](url)
      const linkMatch = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(trimmed);
      if (linkMatch) {
        const parentDepth = getLastHeadingDepth(items);
        items.push({
          type: 'link',
          label: linkMatch[1],
          meta: linkMatch[2],
          rawContent: linkMatch[2],
          depth: parentDepth + 1,
        });
        return;
      }

      // Bold section header: line starts with **text** followed by colon/content or standalone
      // Matches: "**视觉欺骗性**：通过大量...", "**text**:", "**text**"
      const boldMatch = /^\*\*([^*]+)\*\*[:：]?\s*(.*)$/.exec(trimmed);
      if (boldMatch) {
        const text = boldMatch[1].trim();
        if (text.length <= 80) {
          const parentDepth = getLastHeadingDepth(items);
          items.push({
            type: 'heading',
            label: text,
            meta: 'bold',
            rawContent: trimmed,
            depth: parentDepth + 1,
          });
        }
      }
      break;
    }
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
