/**
 * The one hard ceiling in the loop: how much text can physically get back to the AI.
 *
 * Gemini's composer stops accepting input at 31,998 characters (measured; UTF-16
 * length, so a CJK character counts as one). Everything stage ④ produces travels
 * through that box, so a round whose results exceed it loses its tail.
 *
 * ⚠️ Losing the tail is worse than it sounds, because **nothing downstream notices**.
 * `send-watcher` confirms delivery by seeing the payload leave the composer and a new
 * `user-query` appear — a truncated message satisfies both. So the round advances
 * normally while the AI receives a payload whose closing `</bs_agent_result>` tag and
 * final rows are simply gone, and neither it nor the user is told. That silent loss is
 * why the ceiling is enforced here, in code, with a notice the AI can read, instead of
 * being left to the prompt's "keep results small" guidance.
 *
 * Two levels, and both are needed:
 * - `fitSections` — the graceful one. Per-section allowances that keep the `### label`
 *   structure intact, so capsules and `tool-outcomes.ts` still line up.
 * - `clampPayload` — the blunt last resort, for when the parts we don't truncate
 *   (a mid-round user instruction, parse errors) blow the budget on their own.
 */

/** Measured cap of Gemini's composer, in UTF-16 code units */
export const COMPOSER_CHAR_LIMIT = 31998;

/**
 * Room left for things we can't count exactly at this layer:
 * the `<bs_agent_result>` wrapper the send interceptor adds, the `\u200B` placeholder
 * `replaceAllContent` puts in every blank line, and whatever Gemini counts differently
 * from `String.length`. Overshooting the cap costs a silent truncation; undershooting
 * costs a few hundred characters of a 30k budget.
 */
const SAFETY_MARGIN = 2000;

/** What one round's payload may occupy, before per-round reservations */
export const ROUND_BUDGET = COMPOSER_CHAR_LIMIT - SAFETY_MARGIN;

/**
 * Floor for a truncated section's body. Below this there is nothing to learn from what
 * survived, so the section is cut bluntly instead of pretending to carry data.
 */
const MIN_SECTION_BODY = 200;

/**
 * What the AI reads where the data stopped.
 *
 * It has to do three things: say the output is incomplete (otherwise the AI draws
 * conclusions from a partial table), give it a way to get the rest, and rule out the
 * one move it would otherwise make — re-running the same query, which gets cut at
 * exactly the same place and burns a round.
 */
function buildNotice(omitted: number, total: number): string {
  return (
    `\n\n[TRUNCATED by Better Sidebar: ${omitted} of ${total} characters removed. ` +
    `One round's tool results must fit ~${ROUND_BUDGET} characters, the hard limit of the chat input. ` +
    `Treat the output above as incomplete — do not draw conclusions from it as if it were the full set. ` +
    `To see the rest, narrow the request: fewer columns, substr(content, 1, N) instead of whole messages, ` +
    `or LIMIT/OFFSET to page through it. Re-running the same query unchanged will be cut at the same point.]`
  );
}

export interface FittedSections {
  sections: string[];
  /** How many sections had to be cut — for logging, not for the wire format */
  truncated: number;
}

/**
 * Trim `sections` so the joined document fits, keeping each one's heading intact.
 *
 * Allowances are water-filled rather than split evenly: every section gets an equal
 * share, and whatever the small ones don't use flows back to the big ones. So a single
 * oversized result gets the whole budget, and four short reads next to one huge dump
 * don't squeeze the dump down to a fifth of the space — which is the case a flat
 * per-tool cap gets wrong, and the reason there isn't one in `execute-sql`.
 *
 * @param reserved Characters already committed this round (wrapper, headers,
 *                 separators, instruction and error blocks).
 */
export function fitSections(sections: string[], reserved: number): FittedSections {
  const budget = ROUND_BUDGET - reserved;
  const total = sections.reduce((sum, section) => sum + section.length, 0);

  if (total <= budget) return { sections, truncated: 0 };

  const order = sections
    .map((_, index) => index)
    .sort((a, b) => sections[a].length - sections[b].length);

  const allowance = new Array<number>(sections.length).fill(0);
  let pool = Math.max(0, budget);
  let unresolved = order.length;

  for (const index of order) {
    const share = Math.floor(pool / unresolved);
    const take = Math.min(sections[index].length, share);
    allowance[index] = take;
    pool -= take;
    unresolved--;
  }

  let truncated = 0;
  const fitted = sections.map((section, index) => {
    if (section.length <= allowance[index]) return section;
    truncated++;
    return truncateSection(section, allowance[index]);
  });

  return { sections: fitted, truncated };
}

/**
 * Last resort, applied to the assembled document.
 *
 * `fitSections` only trims tool output; a 40k-character mid-round instruction would
 * sail past it. Nothing here tries to be tidy — the point is that the payload reaching
 * the composer is never over the cap, whatever produced it.
 */
export function clampPayload(payload: string, reserved: number): string {
  const limit = ROUND_BUDGET - reserved;
  if (payload.length <= limit) return payload;

  console.warn('[AgentLoop] Payload still over budget after fitting sections, clamping', {
    length: payload.length,
    limit,
  });

  const noticeLength = buildNotice(payload.length, payload.length).length;
  const kept = payload.slice(0, Math.max(0, limit - noticeLength));
  return kept + buildNotice(payload.length - kept.length, payload.length);
}

/**
 * Cut one section down to `allowance`, keeping its `### label` line whole.
 *
 * The heading has to survive: `splitSections` reads it back as the capsule's label, and
 * `tool-outcomes.ts` matches historical calls to their output by that same label. Cut
 * into it and the capsule silently becomes an unlabelled "Result".
 */
function truncateSection(text: string, allowance: number): string {
  const lineBreak = text.indexOf('\n');
  const header = lineBreak === -1 ? '' : text.slice(0, lineBreak + 1);
  const body = text.slice(header.length);

  // Upper bound on the notice: the omitted count can never have more digits than the
  // total, so sizing it with (total, total) is safe in one pass.
  const noticeLength = buildNotice(body.length, body.length).length;

  if (allowance < header.length + noticeLength + MIN_SECTION_BODY) {
    // No room to say anything useful here; `clampPayload`'s notice carries the message.
    return text.slice(0, Math.max(0, allowance));
  }

  const kept = body.slice(0, allowance - header.length - noticeLength);
  return header + kept + buildNotice(body.length - kept.length, body.length);
}
