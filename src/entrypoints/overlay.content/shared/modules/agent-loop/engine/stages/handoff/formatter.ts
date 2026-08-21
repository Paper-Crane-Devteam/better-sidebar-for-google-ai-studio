/**
 * The wire format between the engine and the AI.
 *
 * Two directions, and they must stay inverses of each other:
 * - `formatResults`  — tool sections → one markdown document
 * - `splitSections`  — that document → per-tool chunks, one capsule each
 *
 * The round trip exists because the editor shows a tidy capsule per tool while the
 * AI receives a single `<bs_agent_result>` block. If the separator here and the
 * split regex ever drift apart, the capsules silently collapse into one.
 *
 * `formatResults` is also where the composer's character cap is enforced (see
 * `budget.ts`) — it is the single funnel every payload passes through, including the
 * one `holdForRetry` parks for a later retry.
 */

import { ROUND_BUDGET, clampPayload, fitSections } from './budget';

/** Wrapper the AI is told to look for — also the marker for raw-text staging */
export const RESULT_OPEN_TAG = '<bs_agent_result>';
const RESULT_CLOSE_TAG = '</bs_agent_result>';

/**
 * What `wrapForAI` (or the send interceptor) adds around the payload. Counted against
 * the budget here because by the time it is added, there is no trimming left to do.
 */
const WRAPPER_OVERHEAD = RESULT_OPEN_TAG.length + RESULT_CLOSE_TAG.length + 2;

/**
 * Exported because the renderer has to read this format back out of the
 * conversation DOM to tell what became of each historical tool call — a third
 * consumer of the same grammar, and the one furthest away from this file.
 */
export const RESULTS_HEADER = '## Tool Execution Results';
export const SECTION_SEPARATOR = '\n\n---\n\n';
/** Prefix of the block `formatResults` prepends when a parse went wrong */
export const PARSE_ERRORS_HEADER = '## Parse Errors';
/** Prefix of the block `formatResults` prepends for a mid-round user instruction */
export const USER_INSTRUCTION_HEADER = '## User Instruction';

export interface ResultSection {
  /** Short label shown on the capsule in the editor */
  label: string;
  /** Full markdown for this section, sent to the AI */
  content: string;
}

// ─── The join key ────────────────────────────────────────────────────────────

/**
 * Each section carries the digest of the call it answers, so a reader can line the
 * two up exactly instead of guessing.
 *
 * The alternative, which this replaces, was matching a section to its call by the
 * label and falling back to ordinal position. Labels are written by the AI and it
 * repeats itself; positions shift the moment a round gains a section belonging to no
 * call (a loop warning), and `SECTION_SEPARATOR` can be imitated by a `---` inside a
 * result body — a markdown table border, which SQL output produces constantly. Both
 * fallbacks fail quietly, as "Not run" on a call that ran.
 *
 * Written in one canonical form and read back permissively. The payload makes a round
 * trip through Quill, Gemini's renderer and `htmlToMarkdown` before anyone parses it,
 * and that trip is known to inject zero-width characters and collapse blank lines —
 * `SECTION_SEPARATOR` already had to be matched by shape rather than literally for the
 * same reason. So `KEY_RE` looks for the `bs:` marker anywhere on the heading line and
 * ignores whatever brackets, backticks or spacing survived around it.
 */
const KEY_MARKER = 'bs:';
const KEY_RE = /bs:([0-9a-f]{6,16})/i;

/** Heading line for one tool result, carrying the key of the call it answers. */
export function formatSectionHeading(label: string, key: string): string {
  return `### ${label} [[${KEY_MARKER}${key}]]`;
}

/** The join key on a heading line, or null on a section written before this existed. */
export function readSectionKey(heading: string): string | null {
  const match = heading.match(KEY_RE);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Drop the key from a heading so it can be shown to a person.
 *
 * Every consumer of the label is display: the capsule in the composer, the card's
 * headline. Leaving the token in would put a hex string in front of the user in
 * exchange for nothing.
 */
export function stripSectionKey(label: string): string {
  return label
    .replace(/\[*\s*`?bs:[0-9a-f]{6,16}`?\s*\]*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Wrap payload text in the tag the AI's prompt tells it to expect */
export function wrapForAI(text: string): string {
  return `${RESULT_OPEN_TAG}\n${text}\n${RESULT_CLOSE_TAG}`;
}

/**
 * Assemble one round's outcome into the document sent back to the AI.
 *
 * A user instruction typed mid-round is prepended so it lands in the same turn.
 *
 * Tool output is trimmed to fit the composer's cap; the instruction and error blocks
 * are not, since they are short by nature and are the parts the AI most needs whole.
 * They are still *counted*, so tool output shrinks to make room for them.
 */
export function formatResults(
  results: string[],
  errors: string[],
  userInstruction?: string | null,
): string {
  const instructionBlock = userInstruction
    ? `${USER_INSTRUCTION_HEADER}\n\n${userInstruction}\n\n`
    : '';

  // A round carrying only an instruction ran no tools, and titling it "Tool
  // Execution Results" would have the AI hunting for output that doesn't exist.
  const resultsHeader = results.length > 0 ? `${RESULTS_HEADER}\n\n` : '';

  const errorBlock =
    errors.length > 0
      ? `\n\n${PARSE_ERRORS_HEADER}\n\n${errors.map((e) => `- ${e}`).join('\n')}`
      : '';

  const reserved =
    WRAPPER_OVERHEAD +
    instructionBlock.length +
    resultsHeader.length +
    errorBlock.length +
    Math.max(0, results.length - 1) * SECTION_SEPARATOR.length;

  const { sections, truncated } = fitSections(results, reserved);

  if (truncated > 0) {
    console.warn(
      `[AgentLoop] ${truncated} of ${results.length} tool result(s) exceeded the ` +
        `${ROUND_BUDGET}-character round budget and were truncated`,
    );
  }

  const output = instructionBlock + resultsHeader + sections.join(SECTION_SEPARATOR) + errorBlock;

  return clampPayload(output, WRAPPER_OVERHEAD);
}

/**
 * Split a formatted document back into per-tool sections.
 * Returns an empty array when the text has no recognisable structure — the caller
 * then stages it as a single capsule.
 */
export function splitSections(resultText: string): ResultSection[] {
  const body = resultText.replace(new RegExp(`^${RESULTS_HEADER}\\n\\n`), '');

  return body
    .split(SECTION_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((trimmed) => {
      const heading = trimmed.match(/^### (.+)\n([\s\S]*)$/);
      // The key stays in `content` — that is what goes to the AI and what a later
      // read matches on — but never in the label, which is what the user sees on
      // the capsule.
      const label = heading ? stripSectionKey(heading[1]) : '';
      return {
        label: label || 'Result',
        content: trimmed,
      };
    });
}
