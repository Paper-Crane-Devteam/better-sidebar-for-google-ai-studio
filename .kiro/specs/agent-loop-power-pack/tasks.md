# Tasks

## Task 1: Create types and adapter interface
- [x] Create `src/entrypoints/overlay.content/shared/modules/agent-loop/types.ts` with all shared types (AgentLoopStatus, ToolCallResult, ParsedToolCall, BuiltInPrompt, PendingConfirmation, AgentLoopSettings)
- [x] Create `src/entrypoints/overlay.content/shared/modules/agent-loop/adapters/types.ts` with AgentPlatformAdapter interface
- [x] Create `src/entrypoints/overlay.content/shared/modules/agent-loop/index.ts` barrel export

## Task 2: Implement ToolCallParser
- [x] Create `src/entrypoints/overlay.content/shared/modules/agent-loop/engine/ToolCallParser.ts` with parseToolCalls function
- [x] Support XML-like `<tool_call>` format parsing with regex
- [x] Filter out tool calls inside code blocks
- [x] Validate required params per tool type
- [x] Enforce max 20 tool calls per message

## Task 3: Implement agent-loop-store
- [x] Create `src/entrypoints/overlay.content/shared/modules/agent-loop/agent-loop-store.ts` Zustand store
- [x] Implement all state fields and actions (start, nextRound, stop, pause, resume, reset, setError, setPendingConfirmation)

## Task 4: Implement execute_sql tool
- [x] Create `src/entrypoints/overlay.content/shared/modules/agent-loop/tools/execute-sql.ts`
- [x] Implement DDL/dangerous SQL blacklist filtering
- [x] Implement SELECT direct execution with 1000 row limit
- [x] Implement DML paywall check via license-store
- [x] Implement user confirmation flow via store pendingConfirmation
- [x] Return formatted results (rows, affected count, errors)

## Task 5: Implement tool registry and placeholder tools
- [x] Create `src/entrypoints/overlay.content/shared/modules/agent-loop/tools/tool-registry.ts`
- [x] Create `src/entrypoints/overlay.content/shared/modules/agent-loop/tools/sync-messages.ts` (placeholder)
- [x] Create `src/entrypoints/overlay.content/shared/modules/agent-loop/tools/export-tool.ts` (placeholder)
- [x] Create `src/entrypoints/overlay.content/shared/modules/agent-loop/snapshot/snapshot-manager.ts` (placeholder)

## Task 6: Implement built-in prompts
- [x] Create `src/entrypoints/overlay.content/shared/modules/agent-loop/prompts/base-prompt.ts` with getBasePrompt()
- [x] Create `src/entrypoints/overlay.content/shared/modules/agent-loop/prompts/built-in-registry.ts`
- [x] Create utility prompts: auto-classify.ts, find-empty-chats.ts, export-chats.ts

## Task 7: Implement Gemini adapter
- [x] Create `src/entrypoints/overlay.content/shared/modules/agent-loop/adapters/gemini-adapter.ts`
- [x] Implement getEditor, insertText, triggerSend, getText, getCursorPosition
- [x] Implement observeAIResponseComplete with MutationObserver + 500ms debounce
- [x] Implement extractResponseText, isStreaming, getLastAIResponseElement

## Task 8: Implement AgentLoopEngine
- [x] Create `src/entrypoints/overlay.content/shared/modules/agent-loop/engine/AgentLoopEngine.ts`
- [x] Implement main runLoop with abort controller
- [x] Implement response waiting, parsing, execution, result formatting, auto-send cycle
- [x] Implement max rounds check and pause logic
- [x] Implement error/timeout handling

## Task 9: Implement useAgentTrigger hook
- [x] Create `src/entrypoints/overlay.content/shared/modules/agent-loop/useAgentTrigger.ts`
- [x] Implement `>` prefix detection (similar to useSlashCommand but for built-in prompts)
- [x] Implement mutual exclusion with slash command mode
- [x] Implement fuzzy filtering of built-in prompts

## Task 10: Implement UI components
- [x] Create `src/entrypoints/overlay.content/shared/modules/agent-loop/AgentCommandPopup.tsx` (> prefix popup)
- [x] Create `src/entrypoints/overlay.content/shared/modules/agent-loop/AgentLoopStatusBar.tsx` (execution status indicator)
- [x] Create `src/entrypoints/overlay.content/shared/modules/agent-loop/AgentLoopConfirmDialog.tsx` (SQL write confirmation)

## Task 11: Implement AgentLoopFeature entry point for Gemini
- [x] Create `src/entrypoints/overlay.content/gemini/enhanced-features/AgentLoopFeature.tsx`
- [x] Wire up GeminiAgentAdapter, useAgentTrigger, AgentLoopEngine
- [x] Monitor editor input for `>` prefix, show popup, handle selection
- [x] On prompt selection: compose full message (base + utility + user input), insert, send, start engine
- [x] Register in GeminiEnhancedFeatures.tsx

## Task 12: Extend settings-store and license-store
- [x] Add 'power_pack' to LicenseTier type
- [x] Add isPowerPackUser() helper function
- [ ] Add `agentLoop` settings to GeminiEnhancedFeatures interface (enabled, confirmWrites, maxRounds)
- [ ] Add settings migration (version bump)
