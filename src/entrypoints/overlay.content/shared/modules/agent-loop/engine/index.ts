/**
 * Engine — public surface.
 *
 * Import from here, not from the internals. `stages/*` and `context.ts` are
 * implementation detail and free to change shape; what's re-exported below is what
 * the rest of the app (and `agent-loop/index.ts`) is allowed to depend on.
 *
 * Layout:
 *   AgentLoopEngine.ts   state machine + lifecycle
 *   context.ts           LoopContext — store / events / abort / breaker facade
 *   stages/              one file per round stage, in data-flow order
 *   guards/              circuit breaker, abort token
 *   parser/              AI text → tool calls
 *   engine-registry.ts   handle to the active instance, for UI outside the feature
 */

export { AgentLoopEngine } from './AgentLoopEngine';

export { setActiveEngine, getActiveEngine, clearActiveEngine } from './engine-registry';

// Parser
export {
  parseToolCalls,
  TOOL_TAG,
  SUPPORTED_TOOLS,
  REQUIRED_PARAMS,
  CONTROL_TOOLS,
  hasUnclosedToolBlock,
} from './parser';

// Guards
export { CircuitBreaker } from './guards/circuit-breaker';
export type {
  CircuitBreakerState,
  LoopCheckResult,
  FailureCheckResult,
} from './guards/circuit-breaker';
export { ABORT_MESSAGE, AbortError, isAbortError } from './guards/abort';

// Wire format — the renderer and the send interceptor share these
export { RESULT_OPEN_TAG, wrapForAI } from './stages/handoff';
