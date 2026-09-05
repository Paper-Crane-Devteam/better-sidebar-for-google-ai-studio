/**
 * Projecting a docx into addressable text.
 *
 * ## The format, and why it looks like this
 *
 *     [p12 h1] 3 实验设计
 *     [p13] 为了验证上述假设，本文设计了……
 *     [t2 4×3]
 *     | 方法 | 准确率 | 召回率 |
 *     | --- | --- | --- |
 *     | ours | 0.91 | 0.88 |
 *
 * Two decisions worth defending:
 *
 * ⚠️ **No inline markup.** No `**bold**`, no `*italic*`. The projection is not only read,
 * it is *quoted back* — `doc_edit` locates text by matching what the agent supplies
 * against the paragraph's real characters. The moment the projection contains `**`, the
 * agent quotes it, and the match fails on text that is plainly there. Structure that
 * lives outside the text (the address prefix, table pipes) is safe; anything inside the
 * sentence is not.
 *
 * ⚠️ **The address is a prefix, not a suffix or a separate column.** The agent reads
 * top-to-bottom and has to know the address *before* the text it is about to quote,
 * otherwise it cites the previous paragraph's id. Same reason `read_file` prefixes line
 * numbers instead of reporting a range in a header.
 */

import type { DocProjectionResult, DocReadRequest } from '../types';
import { DocumentError } from '../types';
import type { LoadedDocument } from '../storage';
import {
  openDocx,
  paragraphText,
  tableGrid,
  type Block,
  type DocxDocument,
} from './model';

/**
 * Default ceiling on returned characters.
 *
 * The round budget is 29998 characters *for every tool result in the round combined*
 * (see `engine/stages/handoff/budget.ts`). A reader that defaults to the whole budget
 * leaves nothing for the other calls the agent makes in the same turn, and the overflow
 * is silently truncated rather than reported. 12000 is enough for a full chapter.
 */
const DEFAULT_MAX_CHARS = 12000;

/** Hard ceiling, whatever the caller asks for. */
const ABSOLUTE_MAX_CHARS = 24000;

/** Context shown either side of a search hit. */
const SNIPPET_CONTEXT = 50;

/** Search hits returned at most. */
const MAX_HITS = 40;

export function docxRead(
  loaded: LoadedDocument,
  request: DocReadRequest,
): DocProjectionResult {
  const doc = openDocx(loaded.bytes);

  if (request.mode === 'search') {
    return search(doc, loaded.path, request);
  }

  return project(doc, loaded.path, request);
}

// ─── Range projection ────────────────────────────────────────────────────────

function project(
  doc: DocxDocument,
  path: string,
  request: DocReadRequest,
): DocProjectionResult {
  const paragraphs = doc.blocks.filter((b) => b.kind === 'paragraph');
  const total = paragraphs.length;
  const { startIndex, endIndex } = resolveRange(doc, request.range, total);

  const limit = Math.min(
    request.maxChars && request.maxChars > 0 ? request.maxChars : DEFAULT_MAX_CHARS,
    ABSOLUTE_MAX_CHARS,
  );
  const withStructure = request.formatting !== false;

  const layout = mapLayout(doc);
  const lines: string[] = [];
  let used = 0;
  let lastRendered = startIndex - 1;
  let truncated = false;

  /**
   * Offset past which we are still inside an already-rendered table.
   *
   * A table is rendered as one block, so the paragraphs in its cells must not also be
   * emitted on their own — they are already in the grid. Skipping by offset handles
   * nested tables without a second mechanism.
   */
  let skipUntil = -1;

  for (const block of doc.blocks) {
    if (block.el.outerStart < skipUntil) continue;

    if (block.kind === 'table') {
      const span = layout.tableSpan.get(block.id);
      // A table with no paragraphs of its own (all cells empty) has no span, so it is
      // placed by the paragraph numbers around it — which we do not track. Skipping it
      // loses an empty grid, which is the cheaper mistake.
      if (!span) continue;
      if (span.last < startIndex || span.first > endIndex) continue;

      const rendered = renderTable(doc, block, withStructure);
      if (used + rendered.length > limit && lines.length > 0) {
        truncated = true;
        break;
      }
      lines.push(rendered);
      used += rendered.length;
      skipUntil = block.el.outerEnd;
      lastRendered = Math.max(lastRendered, Math.min(span.last, endIndex));
      continue;
    }

    const index = layout.paragraphIndex.get(block.id);
    if (index === undefined || index < startIndex || index > endIndex) continue;

    const rendered = renderParagraph(doc, block, withStructure);
    if (used + rendered.length > limit && lines.length > 0) {
      truncated = true;
      break;
    }
    lines.push(rendered);
    used += rendered.length;
    lastRendered = index;
  }

  const from = paragraphs[startIndex]?.id ?? 'p1';
  const to = paragraphs[Math.max(startIndex, lastRendered)]?.id ?? from;
  const nextIndex = lastRendered + 1;
  const incomplete = truncated || lastRendered < endIndex || endIndex < total - 1;

  return {
    kind: 'projection',
    path,
    format: 'docx',
    text: lines.join('\n'),
    covered: `${from}–${to} of ${total} paragraphs`,
    truncated: incomplete,
    nextRange:
      incomplete && nextIndex < total
        ? `${paragraphs[nextIndex].id}-p${total}`
        : undefined,
  };
}

interface Layout {
  /** Paragraph id → its 0-based position among paragraphs. */
  paragraphIndex: Map<string, number>;
  /** Table id → the paragraph positions it encloses. */
  tableSpan: Map<string, { first: number; last: number }>;
}

/**
 * One pass that answers both "where is this paragraph in the sequence" and "which
 * paragraphs does this table cover".
 *
 * Blocks are already in document order, so a running counter gives paragraph positions,
 * and a stack of open tables (properly nested by construction) attributes each paragraph
 * to every table containing it. Computing this per paragraph instead would be
 * `indexOf` in a loop — quadratic on exactly the documents where it matters.
 */
function mapLayout(doc: DocxDocument): Layout {
  const paragraphIndex = new Map<string, number>();
  const tableSpan = new Map<string, { first: number; last: number }>();
  const open: Array<{ id: string; end: number }> = [];
  let index = -1;

  for (const block of doc.blocks) {
    while (open.length > 0 && block.el.outerStart >= open[open.length - 1].end) {
      open.pop();
    }

    if (block.kind === 'table') {
      open.push({ id: block.id, end: block.el.outerEnd });
      continue;
    }

    index++;
    paragraphIndex.set(block.id, index);

    for (const table of open) {
      const span = tableSpan.get(table.id);
      if (span) {
        span.last = index;
      } else {
        tableSpan.set(table.id, { first: index, last: index });
      }
    }
  }

  return { paragraphIndex, tableSpan };
}

function renderParagraph(
  doc: DocxDocument,
  block: Block,
  withStructure: boolean,
): string {
  const text = paragraphText(doc, block).replace(/\n/g, ' ');
  const marker =
    withStructure && block.headingLevel ? ` h${block.headingLevel}` : '';
  return `[${block.id}${marker}] ${text}`;
}

function renderTable(
  doc: DocxDocument,
  block: Block,
  withStructure: boolean,
): string {
  const grid = tableGrid(doc, block);
  const columns = grid.reduce((max, row) => Math.max(max, row.length), 0);
  const header = `[${block.id} ${grid.length}×${columns}]`;

  if (!withStructure) {
    return `${header} ${grid.map((row) => row.join(' | ')).join(' / ')}`;
  }

  if (grid.length === 0) return `${header} (empty)`;

  const rows = grid.map((row) => `| ${row.join(' | ')} |`);
  // A Markdown separator after the first row, because the first row of a Word table is
  // a header often enough that labelling it is worth one line — and because without it
  // the block does not read as a table at all.
  rows.splice(1, 0, `| ${Array(columns).fill('---').join(' | ')} |`);
  return `${header}\n${rows.join('\n')}`;
}

// ─── Range parsing ───────────────────────────────────────────────────────────

/**
 * Turn `p12-p48`, `p12`, `12-48`, `t3` or nothing into paragraph indices.
 *
 * Forgiving on purpose: the model writes all of these forms, and refusing `12-48`
 * because it lacks the `p` costs a whole round to correct something that has exactly
 * one meaning.
 */
function resolveRange(
  doc: DocxDocument,
  range: string | undefined,
  total: number,
): { startIndex: number; endIndex: number } {
  if (total === 0) {
    throw new DocumentError('This document has no paragraphs.');
  }

  const spec = (range ?? '').trim().toLowerCase();
  if (spec === '' || spec === 'all') {
    return { startIndex: 0, endIndex: total - 1 };
  }

  // A table id names the paragraphs it contains, which is what "read t3" means.
  const asTable = /^t(\d+)$/.exec(spec);
  if (asTable) {
    const table = doc.byId.get(`t${asTable[1]}`);
    if (!table) throw new DocumentError(`There is no ${spec} in this document.`);
    const paragraphs = doc.blocks.filter((b) => b.kind === 'paragraph');
    const inside = paragraphs
      .map((p, index) => ({ p, index }))
      .filter(
        ({ p }) =>
          p.el.outerStart > table.el.outerStart && p.el.outerEnd < table.el.outerEnd,
      );
    if (inside.length === 0) {
      throw new DocumentError(`${spec} has no text in it.`);
    }
    return { startIndex: inside[0].index, endIndex: inside[inside.length - 1].index };
  }

  const match = /^p?(\d+)(?:\s*[-–~]\s*p?(\d+))?$/.exec(spec);
  if (!match) {
    throw new DocumentError(
      `Could not read "${range}" as a range. Use a paragraph range like "p12-p48", a ` +
        'single paragraph like "p12", or a table id like "t3".',
    );
  }

  const first = Number(match[1]);
  const second = match[2] ? Number(match[2]) : first;

  if (first < 1 || first > total) {
    throw new DocumentError(
      `p${first} is outside this document, which has ${total} paragraphs (p1–p${total}).`,
    );
  }

  return {
    startIndex: first - 1,
    endIndex: Math.min(Math.max(second, first), total) - 1,
  };
}

// ─── Search ──────────────────────────────────────────────────────────────────

/**
 * Find text across the document, returning addresses and snippets.
 *
 * The point is not to read the document but to *locate* something in it, so the result
 * is deliberately narrow: the paragraph id and enough context to confirm it is the right
 * hit. The agent's next move is `mode: 'range'` on the id it picked.
 */
function search(
  doc: DocxDocument,
  path: string,
  request: DocReadRequest,
): DocProjectionResult {
  const query = (request.query ?? '').trim();
  if (query === '') {
    throw new DocumentError('doc_read with mode "search" needs a "query".');
  }

  const matcher = buildMatcher(query);
  const lines: string[] = [];
  let hits = 0;

  for (const block of doc.blocks) {
    if (block.kind !== 'paragraph') continue;
    const text = paragraphText(doc, block);
    if (text === '') continue;

    const at = matcher(text);
    if (at === -1) continue;

    hits++;
    if (hits > MAX_HITS) break;

    const from = Math.max(0, at - SNIPPET_CONTEXT);
    const to = Math.min(text.length, at + query.length + SNIPPET_CONTEXT);
    const snippet = `${from > 0 ? '…' : ''}${text.slice(from, to).replace(/\s+/g, ' ')}${to < text.length ? '…' : ''}`;
    lines.push(`[${block.id}] ${snippet}`);
  }

  const truncated = hits > MAX_HITS;
  const header =
    lines.length === 0
      ? `No paragraph contains "${query}".`
      : `${truncated ? `${MAX_HITS}+` : lines.length} paragraph(s) contain "${query}".`;

  return {
    kind: 'projection',
    path,
    format: 'docx',
    text: [header, ...lines].join('\n'),
    covered: `search for "${query}"`,
    truncated,
  };
}

/**
 * Case-insensitive literal search, with whitespace treated loosely.
 *
 * Not a regex, for the same reason `findInParagraph` is not: the query is text the user
 * or the agent quoted, and a bracket in a citation should not be a syntax error. The
 * whitespace tolerance matters because the projection joins Word's line breaks into
 * spaces, so a phrase the agent read may not have the spacing the document has.
 */
function buildMatcher(query: string): (text: string) => number {
  const needle = query.toLowerCase().replace(/\s+/g, ' ');
  return (text) => text.toLowerCase().replace(/\s+/g, ' ').indexOf(needle);
}
