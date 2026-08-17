import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Strip markdown syntax to produce plain text (e.g. for copy-as-text). */
export function stripMarkdown(md: string): string {
  let s = md;
  // Fenced code blocks (preserve inner newlines, drop fences)
  s = s.replace(/```[\w]*\n([\s\S]*?)```/g, (_, inner) => inner);
  // Inline code
  s = s.replace(/`([^`]+)`/g, '$1');
  // Bold/strong: ** or __
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1');
  // Italic: * or _ (single, not double)
  s = s
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
    .replace(/(?<!_)_([^_]+)_(?!_)/g, '$1');
  // Strikethrough
  s = s.replace(/~~([^~]+)~~/g, '$1');
  // Links: [text](url) -> text
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Images: ![alt](url) -> alt
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  // ATX headers: # ## ### ...
  s = s.replace(/^#{1,6}\s+/gm, '');
  // Setext header underline (=== or ---)
  s = s.replace(/^[=-]{2,}\s*$/gm, '');
  // Blockquote
  s = s.replace(/^>\s?/gm, '');
  // List markers: - * + or 1.
  s = s.replace(/^[\s]*[-*+]\s+/gm, '').replace(/^[\s]*\d+\.\s+/gm, '');
  // Horizontal rule (--- *** ___)
  s = s.replace(/^[-*_]{3,}\s*$/gm, '');
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

// Cache: reuse a single CSSStyleSheet instance for identical CSS strings.
// This avoids parsing the same (often large) stylesheet N times when injecting
// into many shadow DOMs (e.g. one per AI response for snippet buttons).
const styleSheetCache = new Map<string, CSSStyleSheet>();

// Helper to safely apply styles to shadow root (compatible with Firefox Xray wrappers)
export function applyShadowStyles(shadow: ShadowRoot, css: string) {
  try {
    let sheet = styleSheetCache.get(css);
    if (!sheet) {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      styleSheetCache.set(css, sheet);
    }
    shadow.adoptedStyleSheets = [sheet];
  } catch (e) {
    console.warn(
      'Better Sidebar: Failed to use adoptedStyleSheets, falling back to <style>',
      e,
    );
    const style = document.createElement('style');
    style.textContent = css;
    shadow.appendChild(style);
  }
}

/**
 * Tags that flow inside a line of text. Used to decide whether the whitespace
 * around a text node carries meaning: the space in `<strong>a</strong> b` does,
 * the newline between two `<p>`s does not.
 */
const INLINE_TAGS = new Set([
  'A', 'ABBR', 'B', 'BDI', 'BDO', 'BR', 'CITE', 'CODE', 'DEL', 'EM', 'I', 'IMG',
  'INS', 'KBD', 'MARK', 'Q', 'S', 'SAMP', 'SMALL', 'SPAN', 'STRONG', 'SUB',
  'SUP', 'TIME', 'U', 'VAR', 'WBR',
]);

function isInlineNeighbour(node: Node | null): boolean {
  if (!node) return false;
  if (node.nodeType === Node.TEXT_NODE) return !!node.textContent?.trim();
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  return INLINE_TAGS.has((node as Element).tagName.toUpperCase());
}

/**
 * Squash runs of blank lines, leaving fenced code blocks alone — a code sample
 * with two blank lines in it is not the same sample once they're collapsed.
 */
function collapseBlankLines(md: string): string {
  return md
    .split(/(`{3,}[^\n]*\n[\s\S]*?\n`{3,})/g)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/\n{3,}/g, '\n\n')))
    .join('');
}

/** Indent every line but the first, so a nested block stays inside its list item. */
function indentContinuation(body: string, indent: string): string {
  return body
    .split('\n')
    .map((line, i) => (i === 0 || !line ? line : indent + line))
    .join('\n');
}

/**
 * Render `<ul>`/`<ol>` children as markdown list lines.
 *
 * Nested lists are indented by the parent marker's width. Without this every
 * level came out flush left and sub-items read as siblings of their parent.
 */
function parseListToMarkdown(element: HTMLElement, ordered: boolean): string {
  const start = ordered
    ? parseInt(element.getAttribute('start') || '1', 10) || 1
    : 1;
  const items: string[] = [];

  for (const child of Array.from(element.children)) {
    const tag = child.tagName.toUpperCase();

    if (tag === 'LI') {
      const marker = ordered ? `${start + items.length}. ` : '- ';
      const body = collapseBlankLines(parseNodeToMarkdown(child)).trim();
      items.push(marker + indentContinuation(body, ' '.repeat(marker.length)));
      continue;
    }

    // A list nested directly under the list (rather than under an <li>) still
    // belongs to the item above it.
    if ((tag === 'UL' || tag === 'OL') && items.length > 0) {
      const nested = parseNodeToMarkdown(child).trim();
      if (nested) {
        const indented = nested
          .split('\n')
          .map((line) => (line ? '  ' + line : line))
          .join('\n');
        items[items.length - 1] += '\n' + indented;
      }
    }
  }

  if (items.length === 0) return '';
  return `\n${items.join('\n')}\n`;
}

function parseNodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    // Attempt to preserve whitespace for elements like <pre>
    if (
      node.parentElement?.tagName.toUpperCase() === 'CODE' ||
      node.parentElement?.tagName.toUpperCase() === 'PRE'
    ) {
      return node.textContent || '';
    }
    const raw = node.textContent || '';
    const trimmed = raw.trim();
    // Whitespace-only nodes are layout artefacts unless they separate two
    // inline siblings, where they are the space between two words.
    if (!trimmed) {
      return isInlineNeighbour(node.previousSibling) &&
        isInlineNeighbour(node.nextSibling)
        ? ' '
        : '';
    }
    // Keep the single space that hugs an inline sibling — trimming it merged
    // words together, e.g. `**bold** text` came out as `**bold**text`.
    const lead = /^\s/.test(raw) && isInlineNeighbour(node.previousSibling) ? ' ' : '';
    const tail = /\s$/.test(raw) && isInlineNeighbour(node.nextSibling) ? ' ' : '';
    return lead + trimmed + tail;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toUpperCase();

  let children: Node[] = Array.from(element.childNodes);
  // Support Shadow DOM if present
  try {
    if (element.shadowRoot) {
      children = Array.from(element.shadowRoot.childNodes);
    }
  } catch (e) {
    // Ignore Xray wrapper access errors
  }

  let childrenMarkdown = children.map(parseNodeToMarkdown).join('');

  switch (tagName) {
    case 'P':
      return `\n${childrenMarkdown}\n`;
    case 'BR':
      return '\n';
    case 'STRONG':
    case 'B':
      return childrenMarkdown.trim() ? `**${childrenMarkdown}**` : childrenMarkdown;
    case 'EM':
    case 'I':
      return childrenMarkdown.trim() ? `*${childrenMarkdown}*` : childrenMarkdown;
    case 'DEL':
    case 'S':
      return childrenMarkdown.trim() ? `~~${childrenMarkdown}~~` : childrenMarkdown;
    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6':
      return `\n${'#'.repeat(Number(tagName[1]))} ${childrenMarkdown.trim()}\n\n`;
    case 'UL':
      return parseListToMarkdown(element, false);
    case 'OL':
      return parseListToMarkdown(element, true);
    case 'LI':
      return childrenMarkdown;
    case 'BLOCKQUOTE': {
      const body = childrenMarkdown.replace(/\n{3,}/g, '\n\n').trim();
      if (!body) return '';
      return `\n${body
        .split('\n')
        .map((line) => `> ${line}`.trimEnd())
        .join('\n')}\n\n`;
    }
    case 'A': {
      const href = element.getAttribute('href') || '';
      const label = childrenMarkdown.trim();
      if (!label) return '';
      return href ? `[${label}](${href})` : label;
    }
    case 'IMG': {
      const src = element.getAttribute('src') || '';
      if (!src) return '';
      return `![${element.getAttribute('alt') || ''}](${src})`;
    }
    case 'TABLE': {
      const rows = Array.from(element.querySelectorAll('tr'));
      if (rows.length === 0) return childrenMarkdown;
      const cellsOf = (row: Element) =>
        Array.from(row.children)
          .filter((c) => /^T[HD]$/.test(c.tagName.toUpperCase()))
          .map((c) =>
            parseNodeToMarkdown(c)
              .replace(/\s*\n\s*/g, ' ')
              .trim()
              .replace(/\|/g, '\\|'),
          );
      const header = cellsOf(rows[0]);
      const toLine = (cells: string[]) => `| ${cells.join(' | ')} |`;
      return [
        '',
        toLine(header),
        toLine(header.map(() => '---')),
        ...rows.slice(1).map((r) => toLine(cellsOf(r))),
        '',
      ].join('\n');
    }
    case 'THEAD':
    case 'TBODY':
    case 'TFOOT':
    case 'TR':
    case 'TH':
    case 'TD':
      return childrenMarkdown;
    case 'SPAN':
      if (element.classList.contains('inline-code')) {
        return `\`${childrenMarkdown}\``;
      }
      return childrenMarkdown;
    case 'MS-CODE-BLOCK': {
      const langElement = element.querySelector(
        'mat-panel-title span.ng-star-inserted',
      );
      const lang = langElement
        ? langElement.textContent?.trim().toLowerCase()
        : '';
      const codeElement = element.querySelector('pre code');
      // Use textContent to get the raw code text
      const code = codeElement ? codeElement.textContent : '';
      return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
    }
    case 'HR':
      return '\n\n---\n\n';
    case 'PRE': {
      // Gemini wraps code blocks in <code-block><pre><code class="language-x">.
      // Reading textContent keeps the code verbatim; recursing would strip its
      // indentation and syntax-highlight spans.
      const codeEl = element.querySelector('code');
      const code = (codeEl?.textContent ?? element.textContent ?? '').replace(
        /\n+$/,
        '',
      );
      const lang =
        /language-([\w+#.-]+)/.exec(codeEl?.className || '')?.[1] || '';
      // Longer fence than any run of backticks inside, so embedded fences survive
      const fence = '`'.repeat(
        Math.max(3, ...[...code.matchAll(/`+/g)].map((m) => m[0].length + 1)),
      );
      return `\n${fence}${lang}\n${code}\n${fence}\n`;
    }
    case 'CODE': {
      if (element.closest('pre')) return childrenMarkdown;
      const code = element.textContent || '';
      if (!code.trim()) return childrenMarkdown;
      const fence = code.includes('`') ? '``' : '`';
      return `${fence}${code}${fence}`;
    }
    // These are container tags, just process their children.
    case 'MS-PROMPT-CHUNK':
    case 'MS-TEXT-CHUNK':
    case 'MS-CMARK-NODE':
    case 'DIV':
      return childrenMarkdown;

    default:
      return childrenMarkdown;
  }
}

export function htmlToMarkdown(container: HTMLElement): string {
  // Pre-process: Remove all HTML comments from the innerHTML before parsing
  // This avoids comments messing up the structure or being counted as empty nodes
  const cleanHtml = container.innerHTML.replace(/<!--[\s\S]*?-->/g, '');
  const tempContainer = document.createElement('div');
  tempContainer.innerHTML = cleanHtml;

  // First, try to find the specific content node (common in Model responses)
  const cmarkNode = tempContainer.querySelector('ms-cmark-node');
  if (cmarkNode) {
    // We clean up excessive newlines that might be generated
    return collapseBlankLines(parseNodeToMarkdown(cmarkNode).trim());
  }

  // Fallback: Parse the entire container if no specific wrapper is found (e.g. User messages)
  return collapseBlankLines(parseNodeToMarkdown(tempContainer).trim());
}

export async function syncGeminiTheme(theme: 'light' | 'dark' | 'system') {
  if (typeof document === 'undefined') return;

  try {
    if (theme === 'system') {
      localStorage.removeItem('Bard-Color-Theme');

      const isSystemDark = window.matchMedia(
        '(prefers-color-scheme: dark)',
      ).matches;
      if (isSystemDark) {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
        document.body.style.colorScheme = 'dark';
      } else {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        document.body.style.colorScheme = 'light';
      }

      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'Bard-Color-Theme',
          newValue: null,
          storageArea: localStorage,
        }),
      );
    } else {
      const themeValue =
        theme === 'dark' ? 'Bard-Dark-Theme' : 'Bard-Light-Theme';
      localStorage.setItem('Bard-Color-Theme', themeValue);

      if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
      } else {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
      }

      document.body.style.colorScheme = theme;

      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'Bard-Color-Theme',
          newValue: themeValue,
          storageArea: localStorage,
        }),
      );
    }
  } catch (error) {
    console.error('Better Sidebar: syncGeminiTheme error:', error);
  }
}

export function syncAiStudioTheme(theme: 'light' | 'dark' | 'system') {
  try {
    if (typeof localStorage !== 'undefined') {
      const key = 'aiStudioUserPreference';
      const stored = localStorage.getItem(key);
      if (stored) {
        const prefs = JSON.parse(stored);
        prefs.theme = theme;
        localStorage.setItem(key, JSON.stringify(prefs));
      }
    }

    // Also sync DOM classes for immediate effect
    if (typeof document !== 'undefined') {
      let isDark = false;
      if (theme === 'system') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      } else {
        isDark = theme === 'dark';
      }

      if (isDark) {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
      } else {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
      }
      document.body.style.colorScheme = isDark ? 'dark' : 'light';
    }
  } catch (e) {
    // ignore
  }
}

export function syncChatGPTTheme(theme: 'light' | 'dark' | 'system') {
  if (typeof document === 'undefined') return;
  const settingsButton = document.querySelector(
    'button[aria-label="Settings & help"]',
  ) as HTMLElement;
  if (!settingsButton) return;

  settingsButton.click();
}
