/**
 * Agent Loop module — Public API.
 */

// Types
export type {
  AgentLoopStatus,
  ParsedToolCall,
  ParseResult,
  ToolCallResult,
  BuiltInPrompt,
  PendingConfirmation,
  AgentLoopSettings,
  AgentTriggerState,
} from './types';

// Store
export { useAgentLoopStore } from './agent-loop-store';

// Event Bus
export { agentEventBus } from './event-bus';
export type { AgentEventMap } from './event-bus';

// Engine
export { AgentLoopEngine } from './engine/AgentLoopEngine';
export { parseToolCalls } from './engine/ToolCallParser';
export { CircuitBreaker } from './engine/circuit-breaker';
export type { CircuitBreakerState, LoopCheckResult, FailureCheckResult, NoProgressResult } from './engine/circuit-breaker';

// Tools
export { executeToolCall } from './tools/tool-registry';
export { executeSql } from './tools/execute-sql';

// Prompts
export { getBasePrompt } from './prompts/base-prompt';
export { getBuiltInPrompts, getBuiltInPromptById } from './prompts/built-in-registry';

// Hooks
export { useAgentTrigger } from './useAgentTrigger';

// Adapters
export type { AgentPlatformAdapter } from './adapters/types';
export { GeminiAgentAdapter } from './adapters/gemini-adapter';

// UI Components
export { AgentCommandPopup } from './AgentCommandPopup';
export { AgentLoopStatusBar } from './AgentLoopStatusBar';
export { AgentLoopConfirmDialog } from './AgentLoopConfirmDialog';

// Renderer
export { ConversationRenderer, injectRendererStyles, buildPromptMarker } from './renderer';
export { TOOL_TAG } from './engine/ToolCallParser';
