/**
 * What the parser accepts — the tool vocabulary and each tool's required params.
 *
 * Kept separate from the parsing code because this is the list that grows: it is
 * the hook-in point for the MCP layer, which will eventually supply tool names and
 * schemas dynamically instead of these hardcoded tables.
 */

/** Maximum tool calls honoured in a single AI response */
export const MAX_TOOL_CALLS = 20;

/**
 * The wrapper tag for tool calls. A custom HTML tag, so it survives Gemini's
 * markdown renderer and can't collide with Gemini's own `<tool_call>`.
 */
export const TOOL_TAG = 'bs_agent_tool';

/** Tool names the engine can actually execute */
export const SUPPORTED_TOOLS = [
  'execute_sql',
  'sync_conversation_messages',
  'export',
  'complete_task',
  'activate_skill',
] as const;

/** Params that must be present and non-empty, per tool */
export const REQUIRED_PARAMS: Record<string, string[]> = {
  execute_sql: ['query'],
  sync_conversation_messages: ['conversation_ids'],
  export: ['ids', 'format'],
  complete_task: ['summary'],
  activate_skill: ['skill_id'],
};

/**
 * Tools that steer the loop rather than doing work.
 *
 * `complete_task` just ends the session; there is nothing to allow or refuse, so it
 * is classified `control` (see `getToolRisk`) and skips the approval gate entirely
 * instead of being filed under `read` and inheriting the auto-run-reads switch.
 *
 * The list lives here, in the leaf schema module, so the policy layer and the
 * renderer can both read it without importing each other.
 */
export const CONTROL_TOOLS: readonly string[] = ['complete_task'];

/**
 * Whether the response looks cut off mid tool call.
 *
 * An unclosed opening tag is the one unambiguous signal, and it needs its own
 * branch: told "you forgot the tool format", the AI resends the whole response
 * from the top, which wastes a round and can re-run the first half.
 */
export function hasUnclosedToolBlock(responseText: string): boolean {
  const opens = responseText.split(`<${TOOL_TAG}>`).length - 1;
  const closes = responseText.split(`</${TOOL_TAG}>`).length - 1;
  return opens > closes;
}

export function isSupportedTool(name: string): boolean {
  return (SUPPORTED_TOOLS as readonly string[]).includes(name);
}

/** Required params that `params` is missing */
export function findMissingParams(name: string, params: Record<string, string>): string[] {
  return (REQUIRED_PARAMS[name] || []).filter((p) => !params[p]);
}
