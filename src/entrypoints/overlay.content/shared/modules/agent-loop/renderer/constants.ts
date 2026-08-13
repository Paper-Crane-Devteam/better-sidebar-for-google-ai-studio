/**
 * Agent Loop Renderer — Constants & Markers.
 *
 * Defines the unique markers used to identify our prompt messages
 * and tool calls in the Gemini conversation DOM.
 */

/**
 * Marker prefix inserted at the beginning of agent loop messages (user-query).
 * This is the first line of text the user sends when they select a built-in prompt.
 * Format: [#bs-agent:<prompt-id>#]
 *
 * Example: [#bs-agent:auto-classify#]
 */
export const PROMPT_MARKER_PREFIX = '[#bs-agent:';
export const PROMPT_MARKER_SUFFIX = '#]';

/** Build a full prompt marker line for a given prompt ID */
export function buildPromptMarker(promptId: string): string {
  return `${PROMPT_MARKER_PREFIX}${promptId}${PROMPT_MARKER_SUFFIX}`;
}

/** Extract prompt ID from text, or null if not a valid marker */
export function extractPromptId(text: string): string | null {
  const match = text.match(/\[#bs-agent:([a-zA-Z0-9_-]+)#\]/);
  return match ? match[1] : null;
}

/**
 * The tool call tag name used in AI responses.
 * Re-exported from the parser so the two can't drift apart.
 */
export { TOOL_TAG as TOOL_CALL_TAG } from '../engine/parser/tool-schema';

/**
 * The result tag name used in user messages when sending tool results back.
 * Wraps the tool execution output sent to the AI.
 */
export const RESULT_TAG = 'bs_agent_result';

/**
 * Tool calls that get no card in the conversation view.
 *
 * `complete_task` is protocol plumbing, not work: it carries no result worth
 * reading, takes no approval, and its summary already headlines the session card
 * in the Agent tab. Shown in the chat it reads as one more step the agent took,
 * right at the moment the user is looking for the outcome.
 *
 * Hidden means the card is skipped, *not* that the block is dropped from parsing —
 * the raw `<bs_agent_tool>` text still has to be swallowed, or it surfaces as JSON
 * in the markdown around it.
 *
 * Deliberately its own list rather than an alias for `CONTROL_TOOLS`: that one
 * answers "does this need approval", this one answers "is this worth showing", and
 * a tool can plausibly be one without the other.
 */
export const HIDDEN_TOOLS: readonly string[] = ['complete_task'];

/** Whether this tool call should be rendered in the conversation view */
export function isHiddenTool(toolName: string): boolean {
  return HIDDEN_TOOLS.includes(toolName);
}

/**
 * CSS class applied to user-query elements that contain agent prompts.
 * Used by the renderer to mark elements as already processed.
 */
export const PROMPT_RENDERED_CLASS = 'bs-agent-prompt-rendered';

/**
 * CSS class applied to model-response elements that contain tool calls.
 * Used by the renderer to mark elements as already processed.
 */
export const TOOL_CALL_RENDERED_CLASS = 'bs-agent-tool-rendered';

/**
 * Data attribute for storing prompt ID on rendered elements.
 */
export const PROMPT_ID_ATTR = 'data-bs-agent-prompt-id';

/**
 * Data attribute for storing tool call info on rendered elements.
 */
export const TOOL_CALL_ATTR = 'data-bs-agent-tool';

/**
 * Candidate selectors for the conversation scroll container, in priority order.
 *
 * ⚠️ Order matters and a comma-separated selector list will NOT work here:
 * `querySelector('a, b')` returns the first match in *document order*, not in
 * the order the selectors are listed. On Gemini the infinite-scroller has no
 * `.chat-history` class, so a combined list silently resolved to the first
 * `.conversation-container` — a single turn, nested inside the very element the
 * overlay hides. Iterate explicitly instead.
 */
const SCROLLER_SELECTORS = [
  'chat-window infinite-scroller', // Gemini
  'infinite-scroller.chat-history', // Gemini (older markup)
  '#chat-history', // Gemini fallback
  'ms-autoscroll-container', // AI Studio
  '.conversation-container', // last resort — a single turn
] as const;

/** On screen, as opposed to a detached/hidden leftover of a previous conversation. */
function isRendered(el: HTMLElement): boolean {
  return el.isConnected && el.offsetHeight > 0 && el.offsetWidth > 0;
}

/**
 * Find the conversation scroll container for the current platform.
 *
 * Within one selector we take the first *rendered* match, not simply the first:
 * Gemini can leave the previous conversation's scroller in the document during
 * SPA navigation, and document order puts it ahead of the live one. Picking it
 * left the overlay and the view toggle reading a chat the user had already left.
 */
export function findConversationScroller(): HTMLElement | null {
  for (const selector of SCROLLER_SELECTORS) {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));
    if (candidates.length === 0) continue;
    return candidates.find(isRendered) ?? candidates[0];
  }
  return null;
}
