/**
 * The docx document model — just enough of it.
 *
 * Opens the archive, tokenises the main part, and numbers the body's blocks so every
 * paragraph and table has an address (`p12`, `t3`). That numbering is the document's
 * table of contents *and* the coordinate system the projection quotes back, so it has
 * exactly one rule: **document order, every depth included.**
 *
 * Including paragraphs inside table cells in the same `pN` sequence is deliberate. The
 * alternative — numbering only body-level paragraphs — leaves the text inside a table
 * with no address at all, and a results table is exactly the kind of thing a reviewer
 * asks to have reworded.
 *
 * ⚠️ Ids are stable for a given file, not across an edit. Inserting a paragraph shifts
 * every later number. That is why ids are navigation only and edits are addressed by
 * quoted text (see `.kiro/docs/document-formats.md` §7.1) — an id the agent is holding
 * from a previous call may already mean a different paragraph.
 */

import { openArchive, looksLikeZip, type Archive } from '../zip';
import { DocumentError } from '../types';
import {
  type ElementRange,
  type XmlPart,
  attr,
  element,
  elementAt,
  elements,
  textOf,
  tokenize,
} from '../ooxml/xml-cursor';
import { flattenParagraph, type FlatParagraph } from '../ooxml/runs';
import { headingLevelOf, readStyles, styleIdOf, type StyleMap } from './styles';

export interface Block {
  kind: 'paragraph' | 'table';
  /** `p12` or `t3`. */
  id: string;
  el: ElementRange;
  /** 1–9 for a heading paragraph, null for body text and for tables. */
  headingLevel: number | null;
  /** The paragraph's style id, when it has one. Useful in warnings. */
  styleId: string | null;
  /** True when this block sits inside a table cell (or a nested table). */
  inTable: boolean;
}

export interface DocxDocument {
  archive: Archive;
  /** Name of the main part, which is *usually* but not always `word/document.xml`. */
  mainName: string;
  main: XmlPart;
  body: ElementRange;
  styles: StyleMap;
  blocks: Block[];
  byId: Map<string, Block>;
}

/** Relationship type identifying the main document part. */
const OFFICE_DOCUMENT_REL = '/officeDocument';

export function openDocx(bytes: Uint8Array): DocxDocument {
  if (!looksLikeZip(bytes)) {
    throw new DocumentError(
      'This is not a .docx file. A file with a .docx name but no zip header is ' +
        'usually a legacy .doc saved under the wrong extension — it has to be ' +
        're-saved as .docx in Word first.',
    );
  }

  const archive = openArchive(bytes);
  const mainName = findMainPart(archive);
  const main = tokenize(archive.text(mainName));

  const body = element(main, 'w:body');
  if (!body) {
    throw new DocumentError(
      `"${mainName}" has no <w:body>, so this file is not a readable Word document.`,
    );
  }

  const styles = readStyles(archive.textOrNull('word/styles.xml'));
  const blocks = numberBlocks(main, body, styles);

  return {
    archive,
    mainName,
    main,
    body,
    styles,
    blocks,
    byId: new Map(blocks.map((b) => [b.id, b])),
  };
}

/**
 * Locate the main part through `_rels/.rels` rather than assuming its name.
 *
 * Word writes `word/document.xml`, but a file that has been through Google Docs,
 * Pages, or certain converters can name it `word/document2.xml`. Assuming the name
 * turns that into "this file is not valid", which is both wrong and unactionable.
 */
function findMainPart(archive: Archive): string {
  const rels = archive.textOrNull('_rels/.rels');
  if (rels) {
    const part = tokenize(rels);
    for (const rel of elements(part, 'Relationship')) {
      const type = attr(part, rel, 'Type') ?? '';
      if (!type.endsWith(OFFICE_DOCUMENT_REL)) continue;
      const target = (attr(part, rel, 'Target') ?? '').replace(/^\/+/, '');
      if (target && archive.has(target)) return target;
    }
  }

  if (archive.has('word/document.xml')) return 'word/document.xml';

  throw new DocumentError(
    'Could not find the main document part. The file may be an .xlsx or .pptx that ' +
      'was renamed to .docx.',
  );
}

/**
 * Walk the body once, assigning ids in document order.
 *
 * Iterative over the token stream rather than recursive over elements: a deeply nested
 * table would otherwise recurse per level, and the token walk gives document order for
 * free — which is the property the ids depend on.
 */
function numberBlocks(
  part: XmlPart,
  body: ElementRange,
  styles: StyleMap,
): Block[] {
  const blocks: Block[] = [];
  let paragraphNumber = 0;
  let tableNumber = 0;

  /** Depths of the tables we are currently inside, for the `inTable` flag. */
  const tableDepths: number[] = [];

  for (let i = body.openIndex + 1; i < body.closeIndex; i++) {
    const token = part.tokens[i];

    if (token.kind === 'close' && token.name === 'w:tbl') {
      tableDepths.pop();
      continue;
    }
    if (token.kind !== 'open' && token.kind !== 'self') continue;

    if (token.name === 'w:tbl') {
      const el = elementAt(part, i);
      blocks.push({
        kind: 'table',
        id: `t${++tableNumber}`,
        el,
        headingLevel: null,
        styleId: null,
        inTable: tableDepths.length > 0,
      });
      if (token.kind === 'open') tableDepths.push(token.depth);
      continue;
    }

    if (token.name !== 'w:p') continue;

    const el = elementAt(part, i);
    // `w:pPr` must be this paragraph's own, not one belonging to a run or a nested
    // paragraph: `element()` returns the first match anywhere inside, so the depth
    // check is what makes it correct.
    const pPr = ownChild(part, el, 'w:pPr');

    blocks.push({
      kind: 'paragraph',
      id: `p${++paragraphNumber}`,
      el,
      headingLevel: headingLevelOf(part, pPr, styles),
      styleId: styleIdOf(part, pPr),
      inTable: tableDepths.length > 0,
    });
  }

  return blocks;
}

/** A direct child element by name, or null. */
export function ownChild(
  part: XmlPart,
  parent: ElementRange,
  name: string,
): ElementRange | null {
  const found = element(part, name, parent);
  return found && found.depth === parent.depth + 1 ? found : null;
}

// ─── Reading blocks ──────────────────────────────────────────────────────────

/** A paragraph's visible text plus its run map. Cached per call site, not globally. */
export function flatten(doc: DocxDocument, block: Block): FlatParagraph {
  if (block.kind !== 'paragraph') {
    throw new DocumentError(`${block.id} is a table, not a paragraph.`);
  }
  return flattenParagraph(doc.main, block.el);
}

/** A paragraph's text, without building the run map. */
export function paragraphText(doc: DocxDocument, block: Block): string {
  return flatten(doc, block).text;
}

/**
 * A table as rows of cell text.
 *
 * Cell text is the cell's paragraphs joined by a space rather than a newline: a
 * Markdown table cannot hold a line break, and a cell that wraps in Word is one value.
 * Nested tables collapse to their own text, which is lossy and is the right trade for a
 * projection — a nested table is addressable on its own `tN` id.
 */
export function tableGrid(doc: DocxDocument, block: Block): string[][] {
  if (block.kind !== 'table') {
    throw new DocumentError(`${block.id} is a paragraph, not a table.`);
  }

  const grid: string[][] = [];
  const rows = elements(doc.main, 'w:tr', block.el).filter(
    (row) => row.depth === block.el.depth + 1,
  );

  for (const row of rows) {
    const cells = elements(doc.main, 'w:tc', row).filter(
      (cell) => cell.depth === row.depth + 1,
    );
    grid.push(
      cells.map((cell) =>
        // `textOf` takes every text node under the cell, which is exactly right here:
        // we want the words, not the run structure.
        textOf(doc.main, cell).replace(/\s+/g, ' ').trim(),
      ),
    );
  }

  return grid;
}
