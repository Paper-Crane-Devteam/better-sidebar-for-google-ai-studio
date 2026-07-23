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
export { completeTask, COMPLETE_TASK_SIGNAL } from './tools/complete-task';

// Prompts
export { assembleFinalPrompt, assembleSkillActivation } from './prompts/prompt-assembler';
export { getSoulPrompt } from './prompts/soul';
/** @deprecated Use assembleFinalPrompt instead */
export { getBasePrompt } from './prompts/base-prompt';
/** @deprecated Use getSkillsForPopup from skills layer instead */
export { getBuiltInPrompts, getBuiltInPromptById } from './prompts/built-in-registry';

// Hooks
export { useAgentTrigger } from './useAgentTrigger';

// Adapters
export type { AgentPlatformAdapter } from './adapters/types';
export { GeminiAgentAdapter } from './adapters/gemini-adapter';
export {
  createAdapterForCurrentPlatform,
  createAdapterForPlatform,
  detectPlatform,
  getCurrentPlatformId,
  getCurrentPlatformName,
  getRegisteredPlatforms,
} from './adapters/adapter-factory';
export type { PlatformId, PlatformInfo } from './adapters/adapter-factory';

// UI Components
export { AgentCommandPopup } from './AgentCommandPopup';

// Control Panel Store (still used by execute-sql confirmation logic)
export { useControlPanelStore } from './control-panel-store';
export type { ControlPanelState } from './control-panel-store';

// Renderer
export { ConversationOverlay, ConversationViewSwitcher, injectRendererStyles, buildPromptMarker } from './renderer';
export { TOOL_TAG } from './engine/ToolCallParser';

// ─── New Architecture: Soul + Skill + MCP ────────────────────────────────────

// MCP Layer
export { mcpRegistry, BUILTIN_MCP, generateToolSchemaPrompt } from './mcp';
export type { MCPServer, ToolSchema, ToolDefinition } from './mcp';

// Skills Layer
export { getEnabledSkills, getSkillsForPopup, getSkillById, getAllSkills, BUILTIN_SKILLS } from './skills';
export type { Skill } from './skills';

// Agent Config Store
export { useAgentConfigStore } from './agent-config-store';
export type { AgentConfigStoreState } from './agent-config-store';

// MCP Setup
export { initMCPRegistry, syncMCPEnabledState } from './mcp/setup';
