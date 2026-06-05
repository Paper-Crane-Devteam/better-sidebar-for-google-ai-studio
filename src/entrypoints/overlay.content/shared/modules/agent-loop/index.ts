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

// Engine
export { AgentLoopEngine } from './engine/AgentLoopEngine';
export { parseToolCalls } from './engine/ToolCallParser';

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
