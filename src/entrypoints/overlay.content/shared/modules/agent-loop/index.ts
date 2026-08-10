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
  PendingApproval,
  ApprovalDecision,
  ApprovalScope,
  ToolRisk,
  AgentQuestion,
  PendingQuestion,
  AgentLoopSettings,
  AgentEndReason,
  TaskOutcome,
} from './types';

// Store
export { useAgentLoopStore } from './agent-loop-store';

// Event Bus
export { agentEventBus } from './event-bus';
export type { AgentEventMap } from './event-bus';

// Engine
export {
  AgentLoopEngine,
  setActiveEngine,
  getActiveEngine,
  clearActiveEngine,
  parseToolCalls,
  TOOL_TAG,
  CircuitBreaker,
} from './engine';
export type {
  CircuitBreakerState,
  LoopCheckResult,
  FailureCheckResult,
  NoProgressResult,
} from './engine';

// Tools
export { executeToolCall } from './tools/tool-registry';
export { executeSql } from './tools/execute-sql';
export {
  completeTask,
  COMPLETE_TASK_SIGNAL,
  parseCompleteTaskSignal,
} from './tools/complete-task';
export {
  askUser,
  ASK_USER_SIGNAL,
  parseAskUserSignal,
  MAX_ASK_USER_PER_SESSION,
} from './tools/ask-user';

// Prompts
export { assembleFinalPrompt, assembleSkillActivation } from './prompts/prompt-assembler';
export { getSoulPrompt } from './prompts/soul';
/** @deprecated Use assembleFinalPrompt instead */
export { getBasePrompt } from './prompts/base-prompt';
/** @deprecated Use getSkillsForPopup from skills layer instead */
export { getBuiltInPrompts, getBuiltInPromptById } from './prompts/built-in-registry';

// Hooks
export { useAgentTrigger } from './useAgentTrigger';
export type { AgentTriggerPopupState } from './useAgentTrigger';

// Agent entries (auto entry + skills) — shared by the `>` popup and the tab launcher
export {
  getAgentEntries,
  getAgentEntryById,
  searchAgentEntries,
  AGENT_AUTO_ID,
} from './agent-entry';
export type { AgentEntry } from './agent-entry';

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

// Execution policy (confirmation strategy + token helpers)
export { useAgentPolicyStore } from './agent-policy-store';
export type { AgentPolicyState } from './agent-policy-store';
export {
  requiresApproval,
  getToolRisk,
  isWriteOperation,
  buildToolCallFingerprint,
  estimateTokens,
  formatTokenCount,
} from './execution-policy';

// Renderer
export { ConversationOverlay, ConversationViewSwitcher, injectRendererStyles, buildPromptMarker } from './renderer';

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
