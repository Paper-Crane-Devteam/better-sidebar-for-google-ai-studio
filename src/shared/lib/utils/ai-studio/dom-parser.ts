/**
 * AI Studio DOM parsing utilities.
 *
 * Provides functions to convert AI Studio's DOM elements (ms-chat-turn,
 * ms-code-block, ms-text-chunk, etc.) into Markdown text, and to extract
 * structured snippet data (title + content) from model response turns.
 */

// ─── Classes / tags to skip during markdown conversion ────────────────────────

const SKIP_CLASSES = [
  'author-label',
  'actions-container',
  'turn-footer',
  'thinking-progress-icon',
  'thought-collapsed-text',
  'mat-icon',
];

const SKIP_TAGS = new Set(['MS-THOUGHT-CHUNK', 'BUTTON']);

// ─── DOM to Markdown ──────────────────────────────────────────────────────────

/**
 * Recursively converts an AI Studio DOM node to Markdown text.
 * Handles: ms-code-block, headings, lists, paragraphs, bold, italic, inline code.
 */
export function domToMarkdown(node: Node): string {
  if (!node) return '';

  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';

  const el = node as HTMLElement;
  if (!el.tagName) return '';

  // Skip irrelevant elements
  if (el.classList && SKIP_CLASSES.some((c) => el.classList.contains(c))) return '';
  if (SKIP_TAGS.has(el.tagName)) return '';

  // Code Blocks (ms-code-block)
  if (el.tagName === 'MS-CODE-BLOCK') {
    let lang = 'text';
    const titleSpan = el.querySelector('.title span:last-child');
    if (titleSpan) lang = titleSpan.textContent?.trim() || 'text';

    const codeEl = el.querySelector('code');
    const codeText = codeEl ? codeEl.textContent || '' : el.textContent || '';
    return `\n\`\`\`${lang}\n${codeText.trim()}\n\`\`\`\n`;
  }

  // List items
  if (el.tagName === 'LI') return `- ${parseChildren(el).trim()}\n`;

  // Headings
  if (/^H[1-6]$/.test(el.tagName)) {
    const level = parseInt(el.tagName[1]);
    return `\n${'#'.repeat(level)} ${parseChildren(el).trim()}\n`;
  }

  // Paragraph & LineBreak
  if (el.tagName === 'P') return `\n${parseChildren(el).trim()}\n\n`;
  if (el.tagName === 'BR') return '\n';

  let result = parseChildren(el);

  // Inline formatting
  if (el.tagName === 'STRONG' || el.tagName === 'B') result = `**${result}**`;
  if (el.tagName === 'EM' || el.tagName === 'I') result = `*${result}*`;
  if (el.classList && el.classList.contains('inline-code')) result = `\`${result}\``;

  return result;
}

/**
 * Recursively converts child nodes to Markdown.
 */
export function parseChildren(node: Node): string {
  let text = '';
  node.childNodes.forEach((child) => {
    text += domToMarkdown(child);
  });
  return text;
}

// ─── Turn-level extraction ────────────────────────────────────────────────────

/**
 * Extracts Markdown content from an AI Studio model turn element.
 * Looks for `.turn-content` first, then falls back to `ms-text-chunk`.
 */
export function extractMarkdownFromTurn(turnEl: HTMLElement): string {
  const contentDiv =
    turnEl.querySelector('.turn-content') || turnEl.querySelector('ms-text-chunk');
  if (!contentDiv) return '';
  let md = domToMarkdown(contentDiv);
  md = md.replace(/\n{3,}/g, '\n\n').trim();
  return md;
}

/**
 * Finds the user question (title) for a given model turn by traversing
 * preceding sibling `ms-chat-turn` elements to find one with
 * `.user-prompt-container` and `ms-text-chunk`.
 */
export function findUserQuestionForTurn(modelTurn: HTMLElement): string {
  let prevSibling = modelTurn.previousElementSibling;
  while (prevSibling) {
    if (prevSibling.tagName === 'MS-CHAT-TURN') {
      const hasUserContainer = prevSibling.querySelector('.user-prompt-container');
      const hasTextChunk = prevSibling.querySelector('ms-text-chunk');
      if (hasUserContainer && hasTextChunk) {
        return hasTextChunk.textContent?.trim() || '';
      }
    }
    prevSibling = prevSibling.previousElementSibling;
  }
  return '';
}

/**
 * Clean up a raw title string (remove "you said" prefix, surrounding quotes).
 */
export function cleanTitle(raw: string): string {
  let cleaned = raw.replace(/^(you said[:\s]*)/i, '').trim();
  cleaned = cleaned.replace(/^["'"']/, '').replace(/["'"']$/, '');
  return cleaned;
}

/**
 * Extracts structured snippet data { title, content } from an AI Studio model turn.
 * Returns null if no meaningful content is found.
 */
export function extractSnippetData(
  modelTurn: HTMLElement,
): { title: string; content: string } | null {
  const content = extractMarkdownFromTurn(modelTurn);
  if (!content) return null;

  let title = findUserQuestionForTurn(modelTurn);
  title = cleanTitle(title);

  if (!title) {
    title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
  }
  if (title.length > 100) {
    title = title.substring(0, 100) + '...';
  }

  return { title, content };
}
