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

/** Extract prompt ID from a marker line, or null if not a valid marker */
export function extractPromptId(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith(PROMPT_MARKER_PREFIX) && trimmed.endsWith(PROMPT_MARKER_SUFFIX)) {
    return trimmed.slice(PROMPT_MARKER_PREFIX.length, -PROMPT_MARKER_SUFFIX.length);
  }
  return null;
}

/**
 * The tool call tag name used in AI responses.
 * Must match ToolCallParser's TOOL_TAG constant.
 */
export const TOOL_CALL_TAG = 'bs_agent_tool';

/**
 * The result tag name used in user messages when sending tool results back.
 * Wraps the tool execution output sent to the AI.
 */
export const RESULT_TAG = 'bs_agent_result';

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
