/**
 * Applying edits to a Word document.
 *
 * ## Edits are addressed by quoted text, never by paragraph number
 *
 * `p12` is navigation. It is *not* an edit address, and the difference is the most
 * important rule in this file. Insert one paragraph and every later number shifts, so a
 * `pN` the agent read in a previous round may already mean a different paragraph — and
 * nothing about the result would look wrong. An address that can silently drift is a
 * source of "it edited the wrong section" bugs that are invisible in the tool output.
 *
 * So the address is `old_text`, with exactly the semantics `edit_file` already
 * established: match it character for character against what was read, refuse when it
 * matches more than once, and let `scope: "p12"` narrow the search when the same sentence
 * genuinely appears twice. Refusing an ambiguous match is the check that prevents the
 * wrong edit; `all: true` exists for the deliberate global rename and says so.
 *
 * ## Every op resolves against the document as it was loaded
 *
 * Ops do not see each other's results. Each one produces splices into the *original*
 * `document.xml`, and `applyEdits` applies them right-to-left at the end, refusing any
 * overlap. Two ops that touch the same sentence therefore fail loudly instead of
 * composing into something neither intended.
 *
 * ⚠️ The consequence is worth stating: an op cannot be written against text that an
 * earlier op in the same call produced. Two calls, in that case.
 *
 * ## One failed op does not fail the call
 *
 * A refused op goes into `skipped` with the reason, and the rest still apply. The agent
 * usually sends four or five ops from one reading pass, and losing all of them because one
 * quote had a typo costs a whole round to rebuild work that was fine.
 */

import { DocumentError, type DocEditRequest, type DocOp } from '../types';
import type { LoadedDocument } from '../storage';
import type { EditOutcome } from '../registry';
import { type Edit, XmlError, applyEdits } from '../ooxml/xml-cursor';
import {
  type FlatParagraph,
  type TextHit,
  checkEditable,
  findInParagraph,
  rPrAt,
} from '../ooxml/runs';
import { flatten, openDocx, type Block, type DocxDocument } from './model';
import {
  type Revisions,
  countExistingRevisions,
  directReplaceEdits,
  existingAuthors,
  insertedParagraphXml,
  openRevisions,
  setStyleEdits,
  trackedDeleteParagraphEdits,
  trackedReplaceEdits,
} from './revisions';
import {
  type CommentWriter,
  commentOnParagraphEdits,
  commentOnTextEdits,
  initialsFor,
  openComments,
} from './comments';

/**
 * Ceiling on one `all: true` replacement.
 *
 * A global rename across a thesis is a legitimate ~50 hits. Four hundred means the quote
 * was a word like "the", and the agent should hear that rather than produce a document
 * with four hundred tracked changes in it.
 */
const MAX_BULK_HITS = 120;

/** Characters of text quoted back in the result summary. */
const SNIPPET = 40;

export function docxEdit(loaded: LoadedDocument, request: DocEditRequest): EditOutcome {
  const doc = openDocx(loaded.bytes);
  const tracked = (request.mode ?? 'track') === 'track';
  const rev = openRevisions(doc, request.author);
  const comments = openComments(
    doc,
    { name: rev.author, initials: initialsFor(rev.author) },
    rev.date,
  );

  const edits: Edit[] = [];
  const applied: string[] = [];
  const skipped: string[] = [];
  const context: OpContext = {
    doc,
    tracked,
    rev,
    comments,
    label: '',
    claimed: new Map(),
  };

  request.ops.forEach((op, index) => {
    // The label travels into every `Edit` so an overlap can name which two ops collided —
    // "op 2 and op 4" is actionable, "two changes overlap" is not.
    context.label = `op ${index + 1} (${String(op.op ?? '?')})`;
    try {
      const outcome = applyOp(op, context);
      edits.push(...outcome.edits);
      applied.push(...outcome.summaries);
    } catch (e) {
      skipped.push(`${context.label}: ${describe(e)}`);
    }
  });

  if (edits.length === 0) {
    // No bytes change hands, so the engine skips the write and the backup entirely.
    return { bytes: loaded.bytes, applied: [], skipped };
  }

  let source: string;
  try {
    source = applyEdits(doc.main.source, edits);
  } catch (e) {
    throw new DocumentError(
      `${describe(e)} Nothing was written — the file is unchanged. Send the conflicting ` +
        'changes in separate doc_edit calls.',
    );
  }

  doc.archive.setText(doc.mainName, source);
  comments.commit();

  return {
    bytes: doc.archive.save(),
    applied: [...applied, ...notes(doc, comments, tracked)],
    skipped,
  };
}

/**
 * Lines appended after the per-op summaries.
 *
 * Both exist so the agent's report to the user is not misleading. Telling someone "I made
 * 6 tracked changes" in a document that already carried 40 from their supervisor leaves
 * them unable to tell which are which, and claiming the changes are tracked when the call
 * ran in `direct` mode is the more dangerous half of the same problem.
 */
function notes(
  doc: DocxDocument,
  comments: CommentWriter,
  tracked: boolean,
): string[] {
  const lines: string[] = [];

  if (!tracked) {
    lines.push(
      'These edits were written directly, not as tracked changes, so the user cannot ' +
        'accept or reject them one by one. Say so when you report back.',
    );
  }

  const existing = countExistingRevisions(doc);
  if (existing > 0) {
    const others = existingAuthors(doc).filter((a) => a !== 'AI (Better Sidebar)');
    lines.push(
      `The document already contained ${existing} tracked changes` +
        (others.length > 0 ? ` from ${others.join(', ')}` : '') +
        ', so yours are mixed in with theirs.',
    );
  }

  if (comments.count > 0) {
    lines.push(
      `${comments.count} comment${comments.count === 1 ? '' : 's'} added. They appear in ` +
        "Word's review pane and change no text.",
    );
  }

  return lines;
}

function describe(e: unknown): string {
  if (e instanceof DocumentError || e instanceof XmlError) return e.message;
  return `unexpected failure — ${(e as Error)?.message ?? String(e)}`;
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

interface OpContext {
  doc: DocxDocument;
  tracked: boolean;
  rev: Revisions;
  comments: CommentWriter;
  label: string;
  /** Paragraphs already changed at the properties level in this call. See `claim`. */
  claimed: Map<string, string>;
}

/**
 * Reserve a paragraph's *structure* for one op, refusing a second claim on it.
 *
 * ⚠️ This closes a hole `applyEdits` cannot see. Ops that work at the `w:pPr` level — a
 * whole-paragraph comment, a tracked delete, a style change — insert at the same offset in a
 * paragraph that has no `w:pPr` yet. Two zero-length insertions at one offset do not
 * *overlap*, so the overlap check passes, and the result can be a `w:commentRangeStart`
 * emitted ahead of the `w:pPr` the other op created. `w:pPr` must be the first child of
 * `w:p`, so that is a schema violation — and it is the kind Word reports as "unreadable
 * content", after a call that said it succeeded.
 *
 * Refusing is also the right answer on the merits: commenting on a paragraph while deleting
 * it, or restyling it while deleting it, are contradictory instructions.
 */
function claim(ctx: OpContext, id: string, what: string): void {
  const holder = ctx.claimed.get(id);
  if (holder) {
    throw new DocumentError(
      `${id} is already being changed by ${holder} in this call, so it cannot also be ` +
        `${what}. Put the two changes in separate doc_edit calls.`,
    );
  }
  ctx.claimed.set(id, ctx.label);
}

interface OpOutcome {
  edits: Edit[];
  /** One line per change, phrased for the summary the user reads. */
  summaries: string[];
}

/** Every verb this handler understands, for the error message when one is misspelled. */
const OPS = [
  'replace_text',
  'insert_paragraph',
  'delete_paragraph',
  'comment',
  'set_style',
] as const;

function applyOp(op: DocOp, ctx: OpContext): OpOutcome {
  switch (String(op.op ?? '').trim()) {
    case 'replace_text':
      return replaceText(op, ctx);
    case 'insert_paragraph':
      return insertParagraph(op, ctx);
    case 'delete_paragraph':
      return deleteParagraph(op, ctx);
    case 'comment':
      return comment(op, ctx);
    case 'set_style':
      return setStyle(op, ctx);
    default:
      throw new DocumentError(
        `"${String(op.op ?? '')}" is not a Word document operation. ` +
          `Use one of: ${OPS.join(', ')}.`,
      );
  }
}

// ─── replace_text ────────────────────────────────────────────────────────────

/**
 * Rewrite a stretch of text, as a tracked change unless the call asked otherwise.
 *
 * An empty `new_text` is a deletion, not a missing parameter — the same convention
 * `edit_file` uses for `new_string`, and the natural way to say "cut this clause".
 */
function replaceText(op: DocOp, ctx: OpContext): OpOutcome {
  const oldText = required(op, 'old_text');
  const newText = optional(op, 'new_text') ?? '';
  const all = flag(op, 'all');

  const targets = locate(ctx.doc, {
    oldText,
    scope: optional(op, 'scope'),
    all,
    what: 'replace',
  });

  const edits: Edit[] = [];
  const summaries: string[] = [];

  for (const target of targets) {
    edits.push(
      ...(ctx.tracked
        ? trackedReplaceEdits(target.flat, target.hit, newText, ctx.rev, ctx.label)
        : directReplaceEdits(ctx.doc.main, target.flat, target.hit, newText, ctx.label)),
    );
    summaries.push(
      newText === ''
        ? `${target.block.id}: deleted “${clip(oldText)}”`
        : `${target.block.id}: “${clip(oldText)}” → “${clip(newText)}”`,
    );
  }

  // One line for a bulk rename instead of 50 near-identical ones, which would eat the
  // round's budget with no information in it.
  if (summaries.length > 4) {
    return {
      edits,
      summaries: [
        `Replaced “${clip(oldText)}” with “${clip(newText)}” in ${summaries.length} ` +
          `places (${targets.map((t) => t.block.id).slice(0, 8).join(', ')}` +
          `${targets.length > 8 ? ', …' : ''}).`,
      ],
    };
  }

  return { edits, summaries };
}

// ─── insert_paragraph ────────────────────────────────────────────────────────

/**
 * Add a paragraph next to an existing one.
 *
 * This is the one op addressed by id rather than by quoted text, and it has to be: the
 * address names a *gap*, and a gap has no text to quote. The drift risk is real but
 * bounded — the worst outcome is a paragraph landing one place away, which the user sees
 * immediately, as opposed to a replacement silently rewriting the wrong sentence.
 *
 * Run properties are inherited from the anchor paragraph so the new text arrives in the
 * document's own font rather than Word's default. For a CJK document that is not cosmetic:
 * the East Asian typeface lives in the run properties, and a paragraph without them
 * renders in a fallback font that is obvious on the page.
 */
function insertParagraph(op: DocOp, ctx: OpContext): OpOutcome {
  const text = required(op, 'text');
  const afterId = optional(op, 'after');
  const beforeId = optional(op, 'before');

  if (!afterId && !beforeId) {
    throw new DocumentError(
      'insert_paragraph needs "after" or "before" naming a paragraph id, e.g. after="p12".',
    );
  }
  if (afterId && beforeId) {
    throw new DocumentError(
      'insert_paragraph takes "after" or "before", not both.',
    );
  }

  const anchor = resolveBlock(ctx.doc, (afterId ?? beforeId)!);
  const rPr =
    anchor.kind === 'paragraph'
      ? inheritedRPr(flatten(ctx.doc, anchor))
      : '';

  const xml = insertedParagraphXml(text, ctx.rev, {
    styleId: optional(op, 'style'),
    rPr,
    tracked: ctx.tracked,
  });

  const at = afterId ? anchor.el.outerEnd : anchor.el.outerStart;

  return {
    edits: [{ start: at, end: at, text: xml, label: ctx.label }],
    summaries: [
      `${afterId ? 'after' : 'before'} ${anchor.id}: inserted “${clip(text)}”`,
    ],
  };
}

/** The run properties to copy onto new text, or '' when the paragraph is empty. */
function inheritedRPr(flat: FlatParagraph): string {
  return flat.slices.length > 0 ? rPrAt(flat, flat.text.length - 1) : '';
}

// ─── delete_paragraph ────────────────────────────────────────────────────────

/**
 * Remove a whole paragraph.
 *
 * Addressed by `scope` (an id) or by `old_text` matching somewhere in it. Both are offered
 * because the two intents differ: "drop p47" comes from reading the outline, "drop the
 * paragraph that says X" comes from reading the text.
 *
 * ⚠️ In `direct` mode a paragraph inside a table keeps its shell. A table cell must contain
 * at least one paragraph — removing the last one produces a file Word refuses to open, and
 * an empty cell is what the user meant anyway.
 */
function deleteParagraph(op: DocOp, ctx: OpContext): OpOutcome {
  const scope = optional(op, 'scope');
  const oldText = optional(op, 'old_text');

  if (!scope && !oldText) {
    throw new DocumentError(
      'delete_paragraph needs "scope" (a paragraph id like "p47") or "old_text" from the ' +
        'paragraph to remove.',
    );
  }

  const targets = oldText
    ? locate(ctx.doc, { oldText, scope, all: flag(op, 'all'), what: 'delete' })
    : [wholeParagraph(ctx.doc, resolveBlock(ctx.doc, scope!))];

  const edits: Edit[] = [];
  const summaries: string[] = [];

  for (const target of targets) {
    claim(ctx, target.block.id, 'deleted');

    if (ctx.tracked) {
      edits.push(
        ...trackedDeleteParagraphEdits(
          ctx.doc,
          target.block,
          target.flat,
          ctx.rev,
          ctx.label,
        ),
      );
    } else if (target.block.inTable) {
      edits.push({
        start: target.block.el.innerStart,
        end: target.block.el.innerEnd,
        text: '',
        label: ctx.label,
      });
    } else {
      edits.push({
        start: target.block.el.outerStart,
        end: target.block.el.outerEnd,
        text: '',
        label: ctx.label,
      });
    }

    const quoted = clip(target.flat.text);
    summaries.push(
      quoted === ''
        ? `${target.block.id}: deleted an empty paragraph`
        : `${target.block.id}: deleted the paragraph “${quoted}”`,
    );
  }

  return { edits, summaries };
}

// ─── comment ─────────────────────────────────────────────────────────────────

/**
 * Attach a margin comment, changing no text.
 *
 * `old_text` anchors it to an exact phrase; `scope` alone anchors it to the whole
 * paragraph. The paragraph form is the reliable fallback and is worth reaching for
 * deliberately: it works on a paragraph whose text runs through an image, an equation or a
 * citation field, where an exact-phrase anchor has to be refused.
 */
function comment(op: DocOp, ctx: OpContext): OpOutcome {
  const body = required(op, 'text');
  const scope = optional(op, 'scope');
  const oldText = optional(op, 'old_text');

  if (!scope && !oldText) {
    throw new DocumentError(
      'comment needs "old_text" (the phrase to attach it to) or "scope" (a paragraph id).',
    );
  }

  if (!oldText) {
    const block = resolveBlock(ctx.doc, scope!);
    if (block.kind !== 'paragraph') {
      throw new DocumentError(
        `${block.id} is a table. Comment on a paragraph inside it instead — doc_read with ` +
          `range="${block.id}" lists their ids.`,
      );
    }
    // A whole-paragraph comment brackets the paragraph's content, so it is structural.
    claim(ctx, block.id, 'commented on as a whole');

    const id = ctx.comments.add(body);
    return {
      edits: commentOnParagraphEdits(ctx.doc, block, id, ctx.label),
      summaries: [`${block.id}: commented on the paragraph — “${clip(body)}”`],
    };
  }

  const [target] = locate(ctx.doc, {
    oldText,
    scope,
    all: false,
    what: 'comment on',
  });

  // ⚠️ Checked *before* staging the comment body. `commentOnTextEdits` refuses a range
  // spanning an image or a field, and a body staged for edits that then throw would be
  // written into comments.xml with nothing in the document pointing at it.
  const problem = checkEditable(target.flat, target.hit);
  if (problem) {
    throw new DocumentError(
      `Cannot anchor a comment there: ${problem}. Use scope="${target.block.id}" to ` +
        'comment on the whole paragraph instead.',
    );
  }

  const id = ctx.comments.add(body);
  return {
    edits: commentOnTextEdits(target.flat, target.hit, id, ctx.label),
    summaries: [`${target.block.id}: commented on “${clip(oldText)}” — “${clip(body)}”`],
  };
}

// ─── set_style ───────────────────────────────────────────────────────────────

/**
 * Change a paragraph's style — in practice, promote a line to a heading.
 *
 * The case this exists for: a thesis whose headings are direct bold-and-bigger formatting
 * rather than styles, so it has no navigable outline at all. `doc_read` says as much in its
 * warnings, and this is the fix.
 *
 * ⚠️ `style` is a style **id**, not the name shown in Word's gallery, and the two differ in
 * a localised document — Chinese Word writes ids like `2` for what it displays as `标题 2`.
 * An unknown id is refused rather than written, because Word silently falls back to Normal
 * and the result looks like the call did nothing.
 */
function setStyle(op: DocOp, ctx: OpContext): OpOutcome {
  const scope = required(op, 'scope');
  const styleId = required(op, 'style');
  const block = resolveBlock(ctx.doc, scope);

  if (block.kind !== 'paragraph') {
    throw new DocumentError(`${block.id} is a table; styles apply to paragraphs.`);
  }

  claim(ctx, block.id, 'restyled');

  if (ctx.doc.styles.size > 0 && !ctx.doc.styles.has(styleId)) {
    const headings = [...ctx.doc.styles.values()]
      .filter((s) => s.headingLevel !== null)
      .map((s) => s.id)
      .slice(0, 12);
    throw new DocumentError(
      `This document has no style with id "${styleId}". Heading style ids in it: ` +
        `${headings.join(', ') || 'none — it has no heading styles at all'}.`,
    );
  }

  return {
    edits: setStyleEdits(ctx.doc, block, styleId, ctx.rev, ctx.tracked, ctx.label),
    summaries: [
      `${block.id}: style set to ${styleId}` +
        (block.styleId ? ` (was ${block.styleId})` : ''),
    ],
  };
}

// ─── Locating ────────────────────────────────────────────────────────────────

interface Target {
  block: Block;
  flat: FlatParagraph;
  hit: TextHit;
}

/**
 * Turn `old_text` (+ optional `scope`) into the ranges to act on.
 *
 * The three outcomes and why each is phrased the way it is:
 *
 * - **No match.** The likeliest cause is quoting from the model's own paraphrase rather
 *   than from the projection, so the message says to read the range again. Whitespace is
 *   already forgiven by `findInParagraph`, so a failure here is a real content mismatch.
 * - **One match.** Proceed.
 * - **Several matches.** Refused, with the ids listed. This is the check that stops the
 *   wrong sentence being edited, so the message offers the two legitimate ways forward —
 *   more surrounding words, or `scope` — and `all: true` only for a rename that really is
 *   meant to be global.
 */
function locate(
  doc: DocxDocument,
  request: { oldText: string; scope?: string; all: boolean; what: string },
): Target[] {
  if (request.oldText.trim() === '') {
    throw new DocumentError('"old_text" is empty, so there is nothing to find.');
  }

  const candidates: Block[] = request.scope
    ? [scopeParagraphs(doc, request.scope)].flat()
    : doc.blocks.filter((b) => b.kind === 'paragraph');

  const found: Target[] = [];
  for (const block of candidates) {
    const flat = flatten(doc, block);
    for (const hit of findInParagraph(flat, request.oldText)) {
      found.push({ block, flat, hit });
    }
  }

  if (found.length === 0) {
    const where = request.scope ? ` in ${request.scope}` : '';
    throw new DocumentError(
      `Nothing${where} matches “${clip(request.oldText)}”. Re-read that range with ` +
        'doc_read and copy the text from the output — spacing is forgiven, wording is not.',
    );
  }

  if (found.length > 1 && !request.all) {
    const ids = [...new Set(found.map((t) => t.block.id))];
    throw new DocumentError(
      `“${clip(request.oldText)}” appears ${found.length} times (${ids.slice(0, 10).join(', ')}` +
        `${ids.length > 10 ? ', …' : ''}), so it is not safe to ${request.what} one of them. ` +
        'Add surrounding words until the quote is unique, or pass scope="p12" to pick the ' +
        'paragraph. Only use all=true when every occurrence really should change.',
    );
  }

  if (found.length > MAX_BULK_HITS) {
    throw new DocumentError(
      `“${clip(request.oldText)}” appears ${found.length} times, past the ${MAX_BULK_HITS} ` +
        'limit for one call. That many hits usually means the quote is too short to be ' +
        'the thing you meant.',
    );
  }

  return found;
}

/**
 * The paragraphs a `scope` names.
 *
 * A table id expands to the paragraphs inside it, which is what "replace this in t3" has
 * to mean — the text of a table lives in its cells' paragraphs, and refusing the id would
 * leave a results table unaddressable.
 */
function scopeParagraphs(doc: DocxDocument, scope: string): Block[] {
  const block = resolveBlock(doc, scope);
  if (block.kind === 'paragraph') return [block];

  const inside = doc.blocks.filter(
    (b) =>
      b.kind === 'paragraph' &&
      b.el.outerStart > block.el.outerStart &&
      b.el.outerEnd < block.el.outerEnd,
  );
  if (inside.length === 0) {
    throw new DocumentError(`${block.id} has no text in it.`);
  }
  return inside;
}

/** A block by id, tolerating the case the model wrote it in. */
function resolveBlock(doc: DocxDocument, id: string): Block {
  const key = id.trim().toLowerCase();
  const block = doc.byId.get(key);
  if (block) return block;

  const paragraphs = doc.blocks.filter((b) => b.kind === 'paragraph').length;
  throw new DocumentError(
    `There is no "${id}" in this document. It has p1–p${paragraphs}; run doc_read first — ` +
      'ids shift whenever paragraphs are added or removed, so one from an earlier read may ' +
      'be stale.',
  );
}

/** A target covering a whole paragraph, for the ops addressed by id alone. */
function wholeParagraph(doc: DocxDocument, block: Block): Target {
  if (block.kind !== 'paragraph') {
    throw new DocumentError(`${block.id} is a table, not a paragraph.`);
  }
  const flat = flatten(doc, block);
  return { block, flat, hit: { start: 0, end: flat.text.length } };
}

// ─── Parameters ──────────────────────────────────────────────────────────────

/**
 * Read a string parameter off an op.
 *
 * Values arrive as JSON the model wrote, so a number or a boolean where a string was
 * expected is routine and coercing is kinder than refusing. `null` and `undefined` both
 * mean absent.
 */
function optional(op: DocOp, key: string): string | undefined {
  const value = op[key];
  if (value == null) return undefined;
  if (typeof value === 'string') return value === '' ? undefined : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  throw new DocumentError(
    `"${key}" must be text, but it arrived as ${Array.isArray(value) ? 'a list' : typeof value}.`,
  );
}

function required(op: DocOp, key: string): string {
  const value = optional(op, key);
  if (value === undefined) {
    throw new DocumentError(`"${String(op.op)}" needs a "${key}" value.`);
  }
  return value;
}

/** A boolean the model may have written as `true`, `"true"`, `"yes"` or `1`. */
function flag(op: DocOp, key: string): boolean {
  const value = op[key];
  if (typeof value === 'boolean') return value;
  if (value == null) return false;
  return /^(true|1|yes|on)$/i.test(String(value).trim());
}

/** A short, single-line quote of some text, for the summary lines. */
function clip(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > SNIPPET ? `${flat.slice(0, SNIPPET)}…` : flat;
}
