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

/** Find the depth of the last real markdown heading (h1-h4) in the list.
 *  Used to determine sibling depth for pseudo-headings (bold, list-item, etc.) */
function getLastRealHeadingDepth(items: ParsedItem[]): number {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].type === 'heading' && items[i].meta && /^h[1-4]$/.test(items[i].meta!)) {
      return items[i].depth;
    }
  }
  return 0;
}

/** Find the depth of the last heading-type item (any kind) in the list.
 *  Used to nest content nodes (code, table, image, etc.) under their parent heading. */
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
  const tree = buildTree(items, messageId);
  // Compute source ranges for heading nodes so copy can extract full original content
  assignSourceRanges(tree, content);
  return tree;
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
          // Use real heading depth so consecutive bold headers stay as siblings
          const parentDepth = getLastRealHeadingDepth(items);
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

// ── Source range assignment ───────────────────────────────────────────
// For each heading node, compute sourceStart/sourceEnd in the original content.
// A heading's content spans from its own line to just before the next heading
// at the same or higher level (or end of content).

/**
 * Flatten all heading nodes in DFS order, then assign sourceStart/sourceEnd
 * by finding each heading's position in the original content and computing
 * ranges based on sibling boundaries.
 */
function assignSourceRanges(roots: OutlineNode[], content: string): void {
  // Collect all heading nodes in DFS order (flattened)
  const allHeadings: OutlineNode[] = [];
  function collectHeadings(nodes: OutlineNode[]) {
    for (const node of nodes) {
      if (node.type === 'heading') {
        allHeadings.push(node);
      }
      collectHeadings(node.children);
    }
  }
  collectHeadings(roots);

  if (allHeadings.length === 0) return;

  // For each heading, find its start position in the content
  const lines = content.split('\n');
  const lineOffsets: number[] = []; // character offset of each line start
  let offset = 0;
  for (const line of lines) {
    lineOffsets.push(offset);
    offset += line.length + 1; // +1 for \n
  }

  // Build an ordered list of heading positions by scanning content
  interface HeadingPos {
    node: OutlineNode;
    lineIndex: number;
    charStart: number;
  }
  const positions: HeadingPos[] = [];

  // Track which headings we've already matched (avoid double-matching)
  const matched = new Set<OutlineNode>();

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const trimmed = line.trim();

    for (const heading of allHeadings) {
      if (matched.has(heading)) continue;

      let isMatch = false;

      if (heading.meta && /^h[1-4]$/.test(heading.meta)) {
        // Markdown heading: ### Title
        const level = Number(heading.meta[1]);
        const prefix = '#'.repeat(level) + ' ';
        if (trimmed.startsWith(prefix) && stripInlineMarkdown(trimmed.slice(prefix.length).trim()) === heading.label) {
          isMatch = true;
        }
      } else if (heading.meta === 'bold') {
        // Bold header: **text**: or **text**
        if (trimmed.includes(`**${heading.label}**`)) {
          isMatch = true;
        }
      } else if (heading.meta === 'list-item') {
        // List item with bold prefix or plain text
        const stripped = trimmed.replace(/^[-*+]\s*/, '');
        if (stripped.includes(heading.label) || (heading.rawContent && trimmed.includes(heading.rawContent.slice(0, 30)))) {
          isMatch = true;
        }
      } else if (heading.meta === 'blockquote') {
        if (trimmed.startsWith('>') && heading.label.startsWith('> ')) {
          isMatch = true;
        }
      } else if (heading.meta === 'details') {
        if (trimmed.includes('<summary>') && trimmed.includes(heading.label)) {
          isMatch = true;
        }
      }

      if (isMatch) {
        matched.add(heading);
        positions.push({
          node: heading,
          lineIndex: li,
          charStart: lineOffsets[li],
        });
        break; // one match per line
      }
    }
  }

  // Sort positions by charStart (should already be in order, but ensure)
  positions.sort((a, b) => a.charStart - b.charStart);

  // Assign sourceStart/sourceEnd
  // A heading's content ends where the next heading of same or lesser depth starts
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    pos.node.sourceStart = pos.charStart;

    // Find the next heading at same or lesser depth (i.e., same or higher in hierarchy)
    let endOffset = content.length;
    for (let j = i + 1; j < positions.length; j++) {
      if (positions[j].node.depth <= pos.node.depth) {
        endOffset = positions[j].charStart;
        break;
      }
    }
    pos.node.sourceEnd = endOffset;
  }

  // For non-heading nodes (code-block, table, etc.), we don't assign source ranges
  // since they already carry full rawContent. Only headings need section extraction.
}
