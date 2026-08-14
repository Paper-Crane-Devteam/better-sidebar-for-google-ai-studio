/**
 * Reading a round's outcome back out of the conversation.
 *
 * The runtime store's `executedCalls` ledger only knows about the session running
 * in this tab: it is wiped by `start()` and by a page reload. Reopen an old chat and
 * every card reported "not run" — for calls whose output is sitting right there on
 * screen, one message below.
 *
 * The results *are* the history. Stage ④ sends them back to the AI as a real user
 * message (`<bs_agent_result>` … `### label` … body), so the conversation DOM is the
 * durable record, and it beats persisting a ledger on two counts: it covers sessions
 * that ran in another browser or before this feature existed, and it carries the
 * actual output rather than a boolean.
 *
 * This file is the inverse of `engine/stages/handoff/formatter.ts`. The grammar
 * constants come from there rather than being retyped, because a drift between the
 * two ends shows up as every card silently going back to "not run".
 */

import {
  PARSE_ERRORS_HEADER,
  RESULTS_HEADER,
  SECTION_SEPARATOR,
  USER_INSTRUCTION_HEADER,
} from '../../engine/stages/handoff/formatter';
import { RESULT_TAG } from '../constants';
import type { ExtractedToolCall } from './tool-parser';

// ─── Types ───────────────────────────────────────────────────────────────────

/** A single tool result section extracted from a user message */
export interface ToolResultEntry {
  toolName: string;
  /** Short description from the ### header line */
  description: string;
  /** Full content of this tool result section, header line included */
  content: string;
}

/** What became of a tool call, recovered from the results message that followed it */
export interface DerivedToolOutcome {
  success: boolean;
  /** The user refused it — a `CANCELLED:` body rather than an `ERROR:` one */
  rejected: boolean;
  /** The body as the AI received it, header line stripped */
  content: string;
}

// ─── Parsing the results message ─────────────────────────────────────────────

const RESULT_TAG_RE = new RegExp(`<${RESULT_TAG}>([\\s\\S]*?)<\\/${RESULT_TAG}>`, 'g');

/**
 * Reading is looser than writing.
 *
 * The payload has been through the DOM and back out via `htmlToMarkdown`, and exact
 * blank-line counts don't survive that: Gemini renders each line of a user message as
 * its own element, and empty ones collapse. What is stable is the separator's shape —
 * a `---` alone on its line — so that's what we match, rather than the literal
 * `SECTION_SEPARATOR` the formatter writes.
 *
 * A stray `---` inside a result body (a table border, say) does split off a bogus
 * section, and that is survivable: the count stops matching, so `deriveToolOutcomes`
 * drops the positional fallback and relies on labels alone.
 */
const SEPARATOR_RE = new RegExp(`\\n+${SECTION_SEPARATOR.trim()}\\n+`);

/**
 * Trim a payload down to just the tool sections.
 *
 * `formatResults` may bracket them with a user instruction in front and parse errors
 * behind. Splitting the whole payload on the separator lets those bleed in as
 * pseudo-sections, which throws off any positional matching downstream.
 */
function isolateSections(inner: string): string {
  let body = inner.trim();

  const headerAt = body.indexOf(RESULTS_HEADER);
  if (headerAt >= 0) {
    body = body.slice(headerAt + RESULTS_HEADER.length);
  } else if (body.startsWith(USER_INSTRUCTION_HEADER)) {
    // Instruction-only round: no tools ran, so there is nothing to match.
    return '';
  }

  const errorsAt = body.indexOf(PARSE_ERRORS_HEADER);
  if (errorsAt >= 0) body = body.slice(0, errorsAt);

  return body.trim();
}

/**
 * Parse all `<bs_agent_result>` blocks out of a user message.
 * Each block holds one or more `### label` sections joined by the separator.
 */
export function parseToolResults(text: string): {
  results: ToolResultEntry[];
  cleanText: string;
} {
  const results: ToolResultEntry[] = [];
  RESULT_TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = RESULT_TAG_RE.exec(text)) !== null) {
    const body = isolateSections(match[1]);
    if (!body) continue;

    for (const section of body.split(SEPARATOR_RE)) {
      const trimmed = section.trim();
      if (!trimmed) continue;

      const heading = trimmed.match(/^###\s+(.+)/);
      const description = heading
        ? heading[1].trim()
        : trimmed.slice(0, trimmed.indexOf('\n') > 0 ? trimmed.indexOf('\n') : 60).trim();
      const toolNameMatch = description.match(/^([a-zA-Z0-9_-]+)/);

      results.push({
        toolName: toolNameMatch ? toolNameMatch[1] : 'tool_result',
        description,
        content: trimmed,
      });
    }
  }

  const cleanText = text.replace(RESULT_TAG_RE, '').trim();
  return { results, cleanText };
}

// ─── Matching sections back to calls ─────────────────────────────────────────

/** Sections that stand for something other than a tool call */
const NOT_A_TOOL_SECTION = [/^⚠️/, /^##/];

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function readOutcome(entry: ToolResultEntry): DerivedToolOutcome {
  const body = entry.content.replace(/^###[^\n]*\n?/, '').trim();
  // `startsWith`, not a multiline search: a query's own output can perfectly well
  // contain the word ERROR, and only the first line is the verdict. Escalating
  // guidance is appended *after* the result, so the prefix survives it.
  const rejected = body.startsWith('CANCELLED:');
  const failed = rejected || body.startsWith('ERROR:');
  return { success: !failed, rejected, content: body };
}

/**
 * Line up a model turn's tool calls with the result sections in the user message
 * that followed it. Returns one slot per call, `null` where nothing matched.
 *
 * Label first, position as the fallback. The label is `description || name`, the
 * same expression `formatter.section()` used to write the header, so it normally
 * hits — but the AI writes those descriptions and it can repeat one, and the round
 * may have gained a `### ⚠️ Loop Warning` section that belongs to no call. Position
 * alone would then be off by one for everything after it, so it is only trusted when
 * the counts agree.
 *
 * `null` rather than a guess: "not run" on a call that did run is a smaller lie than
 * "done" on one that didn't.
 */
export function deriveToolOutcomes(
  calls: ExtractedToolCall[],
  entries: ToolResultEntry[],
): Array<DerivedToolOutcome | null> {
  const outcomes: Array<DerivedToolOutcome | null> = calls.map(() => null);
  if (entries.length === 0 || calls.length === 0) return outcomes;

  const sections = entries.filter(
    (entry) => !NOT_A_TOOL_SECTION.some((re) => re.test(entry.description.trim())),
  );
  if (sections.length === 0) return outcomes;

  const positionalIsSafe = sections.length === calls.length;
  let cursor = 0;

  calls.forEach((call, index) => {
    const label = normalize(call.toolCall.description || call.toolCall.name);

    let found = -1;
    for (let j = cursor; j < sections.length; j++) {
      if (normalize(sections[j].description) === label) {
        found = j;
        break;
      }
    }
    if (found === -1 && positionalIsSafe && cursor < sections.length) found = cursor;
    if (found === -1) return;

    cursor = found + 1;
    outcomes[index] = readOutcome(sections[found]);
  });

  return outcomes;
}
