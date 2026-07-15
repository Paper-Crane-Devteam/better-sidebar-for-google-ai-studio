# Technical Design: Agent Loop Control Panel

## Overview

本设计文档描述 Agent Loop Control Panel 的技术架构。核心思路是将现有 `AgentLoopStatusBar` 改造为 Radix Popover 的 Trigger，点击后展开控制面板；新增 `AgentControlPanelStore`（持久化）管理面板设置；修改 `AgentLoopEngine` 的执行流以支持运行时确认策略切换。

## Components and Interfaces

### Component Hierarchy Summary

| Component | Role | Props |
|---|---|---|
| `AgentLoopControlPanel` | Root, wraps Popover | `onStop`, `onRetry` |
| `ControlPanelContent` | Panel body layout | `status`, `onStop`, `onRetry` |
| `PanelHeader` | Status + tokens display | — (reads store) |
| `ConfirmationSection` | Inline write confirm | — (reads store) |
| `SettingsSection` | Settings switches | — (reads stores) |
| `ToolManagementSection` | Tool enable/disable | — (reads store) |
| `ExecutionHistorySection` | History list | — (reads store) |
| `InstructionInput` | User instruction textarea | — (reads store) |

### Public Interfaces

See "Key Interfaces" and "Store Implementation" sections above for TypeScript interfaces.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AgentLoopFeature.tsx                      │
│  (existing entry point, mounts all agent loop UI)           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  AgentLoopControlPanel (NEW)                        │    │
│  │  ┌───────────────────────────────────────────────┐  │    │
│  │  │  Radix Popover.Root                           │  │    │
│  │  │  ├─ Popover.Trigger → AgentLoopStatusBar      │  │    │
│  │  │  └─ Popover.Content → ControlPanelContent     │  │    │
│  │  │     ├─ PanelHeader (status + token est.)      │  │    │
│  │  │     ├─ ConfirmationSection (inline confirm)   │  │    │
│  │  │     ├─ SettingsSection (switches)             │  │    │
│  │  │     ├─ ToolManagementSection (collapsible)    │  │    │
│  │  │     ├─ ExecutionHistorySection (collapsible)  │  │    │
│  │  │     └─ InstructionInput (bottom)              │  │    │
│  │  └───────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Stores                                             │    │
│  │  ├─ useAgentLoopStore (existing, runtime)           │    │
│  │  └─ useControlPanelStore (NEW, persisted)           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Engine Modifications                               │    │
│  │  ├─ AgentLoopEngine.runLoop() — breakpoint check    │    │
│  │  ├─ executeToolCall() — blacklist check             │    │
│  │  └─ executeSql() — confirmation strategy check      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Data Models

### ControlPanelStore (Persisted via chrome.storage.local)

```typescript
interface ControlPanelSettings {
  /** Auto-execute read operations without confirmation */
  autoExecuteReads: boolean;           // default: true
  /** List of disabled tool names */
  disabledTools: string[];             // default: []
}
```

### AgentLoopStore Extensions (Runtime only, not persisted)

```typescript
// Added to existing AgentLoopStoreState:
interface AgentLoopStoreExtensions {
  /** Speed mode — auto-approve everything */
  speedMode: boolean;                  // default: false
  /** Whether speed mode risk warning was shown this session */
  speedModeWarningShown: boolean;      // default: false
  /** Breakpoint round (null = no breakpoint) */
  breakpointRound: number | null;      // default: null
  /** Accumulated token estimation */
  tokenEstimation: number;             // default: 0
  /** User instruction to inject into next round */
  pendingInstruction: string | null;   // default: null
  /** Whether the control panel popover is open */
  panelOpen: boolean;                  // default: false

  // Actions
  setSpeedMode: (enabled: boolean) => void;
  setSpeedModeWarningShown: () => void;
  setBreakpointRound: (round: number | null) => void;
  addTokens: (count: number) => void;
  resetTokens: () => void;
  setPendingInstruction: (instruction: string | null) => void;
  setPanelOpen: (open: boolean) => void;
}
```


## Component Hierarchy

### File Structure (New Files)

```
src/entrypoints/overlay.content/shared/modules/agent-loop/
├── control-panel/
│   ├── AgentLoopControlPanel.tsx      # Root: Popover.Root wrapping StatusBar + Content
│   ├── ControlPanelContent.tsx        # Main panel body (scrollable)
│   ├── PanelHeader.tsx                # Status indicator + round + token est.
│   ├── ConfirmationSection.tsx        # Inline write confirmation (replaces dialog)
│   ├── SettingsSection.tsx            # Auto-execute, speed mode, breakpoint, max rounds
│   ├── ToolManagementSection.tsx      # Collapsible tool enable/disable list
│   ├── ExecutionHistorySection.tsx    # Collapsible history list
│   ├── InstructionInput.tsx           # Bottom text input for user instructions
│   └── index.ts                       # Barrel export
├── control-panel-store.ts             # New persisted store (ControlPanelSettings)
```

### Modified Files

```
├── agent-loop-store.ts                # Add runtime extensions (speedMode, breakpoint, etc.)
├── AgentLoopStatusBar.tsx             # Becomes Popover.Trigger (add cursor-pointer, remove own click handlers)
├── AgentLoopConfirmDialog.tsx         # DEPRECATED — replaced by ConfirmationSection
├── engine/AgentLoopEngine.ts          # Add breakpoint check, blacklist check, instruction injection
├── tools/tool-registry.ts            # Add blacklist gate before execution
├── index.ts                           # Export new components and store
├── types.ts                           # Add new type definitions
```

## Key Interfaces

### Token Estimation Utility

```typescript
/**
 * Estimate token count from text using character-based heuristic.
 * Chinese characters: ~2 chars/token
 * Other characters: ~4 chars/token
 */
function estimateTokens(text: string): number {
  let tokens = 0;
  for (const char of text) {
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(char)) {
      tokens += 0.5; // 2 chars per token → each char = 0.5 token
    } else {
      tokens += 0.25; // 4 chars per token → each char = 0.25 token
    }
  }
  return Math.round(tokens);
}

/**
 * Format token count for display.
 * <1000: "~800 tokens"
 * 1000-999999: "~2.3k tokens"
 * ≥1000000: "~1.2M tokens"
 */
function formatTokenCount(count: number): string {
  if (count < 1000) return `~${count} tokens`;
  if (count < 1000000) return `~${(count / 1000).toFixed(1)}k tokens`;
  return `~${(count / 1000000).toFixed(1)}M tokens`;
}
```

### Confirmation Strategy

```typescript
type ConfirmationStrategy = 'auto' | 'confirm_writes' | 'confirm_all' | 'speed';

/**
 * Determine confirmation strategy based on current settings.
 */
function getConfirmationStrategy(): ConfirmationStrategy {
  const { speedMode } = useAgentLoopStore.getState();
  if (speedMode) return 'speed';

  const { autoExecuteReads } = useControlPanelStore.getState();
  if (autoExecuteReads) return 'confirm_writes';
  return 'confirm_all';
}

/**
 * Determine if a tool call requires user confirmation.
 */
function requiresConfirmation(toolCall: ParsedToolCall): boolean {
  const strategy = getConfirmationStrategy();
  if (strategy === 'speed') return false;
  if (strategy === 'confirm_all') return true;
  // confirm_writes: only write operations need confirmation
  return isWriteOperation(toolCall);
}

function isWriteOperation(toolCall: ParsedToolCall): boolean {
  if (toolCall.name !== 'execute_sql') return false;
  const sql = (toolCall.params.query || '').trim().toUpperCase();
  return /^(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)/.test(sql);
}
```


## Engine Modifications

### 1. Breakpoint Check (runLoop 开头)

```typescript
// In AgentLoopEngine.runLoop(), at the start of while loop:
private async runLoop(): Promise<void> {
  const getStore = () => useAgentLoopStore.getState();

  while (getStore().currentRound <= getStore().maxRounds) {
    this.checkAbort();

    // ── NEW: Breakpoint check ────────────────────────────────────────
    const breakpoint = getStore().breakpointRound;
    if (breakpoint !== null && getStore().currentRound === breakpoint) {
      getStore().pause('已到达断点轮次');
      getStore().setBreakpointRound(null); // Clear after triggering
      agentEventBus.emit('loop:paused', { reason: 'breakpoint' });
      return;
    }
    // ─────────────────────────────────────────────────────────────────

    // ... existing code continues
  }
}
```

### 2. Tool Blacklist Gate (tool-registry.ts)

```typescript
import { useControlPanelStore } from '../control-panel-store';

export async function executeToolCall(toolCall: ParsedToolCall): Promise<string> {
  // ── NEW: Blacklist check ─────────────────────────────────────────
  const { disabledTools } = useControlPanelStore.getState();
  if (disabledTools.includes(toolCall.name)) {
    return `CANCELLED: 工具 ${toolCall.name} 已被用户禁用，请使用其他方式完成任务`;
  }
  // ─────────────────────────────────────────────────────────────────

  // ... existing switch statement
}
```

### 3. Confirmation Strategy (execute-sql.ts 修改)

```typescript
// Before executing a write SQL, check confirmation strategy:
async function executeSqlWithConfirmation(query: string): Promise<string> {
  const toolCall: ParsedToolCall = { name: 'execute_sql', params: { query } };

  if (!requiresConfirmation(toolCall)) {
    // Speed mode or auto-execute — no confirmation needed
    return executeSqlDirect(query);
  }

  // Set pending confirmation and wait for user response
  return new Promise<string>((resolve) => {
    const store = useAgentLoopStore.getState();
    store.setPendingConfirmation({
      sql: query,
      resolve: (confirmed) => {
        if (confirmed) {
          executeSqlDirect(query).then(resolve);
        } else {
          resolve('CANCELLED: 用户拒绝执行该写操作');
        }
      },
    });
    // Auto-open panel when confirmation is needed
    store.setPanelOpen(true);
  });
}
```

### 4. User Instruction Injection (insertResultCapsule 之前)

```typescript
// In runLoop, before inserting result capsule:
private formatResultsWithInstruction(results: string[], errors: string[]): string {
  const instruction = useAgentLoopStore.getState().pendingInstruction;
  let output = '';

  if (instruction) {
    output += `## User Instruction\n\n${instruction}\n\n`;
    useAgentLoopStore.getState().setPendingInstruction(null);
  }

  output += '## Tool Execution Results\n\n';
  output += results.join('\n\n---\n\n');

  if (errors.length > 0) {
    output += '\n\n## Parse Errors\n\n';
    output += errors.map((e) => `- ${e}`).join('\n');
  }

  return output;
}
```

### 5. Token Estimation (event bus 监听)

```typescript
// In AgentLoopControlPanel component, subscribe to events:
useEffect(() => {
  const unsub1 = agentEventBus.on('ai:response-received', ({ textLength }) => {
    useAgentLoopStore.getState().addTokens(estimateTokens('x'.repeat(textLength)));
  });

  const unsub2 = agentEventBus.on('tool:executed', ({ result }) => {
    useAgentLoopStore.getState().addTokens(estimateTokens(result));
  });

  return () => { unsub1(); unsub2(); };
}, []);
```


## Component Designs

### AgentLoopControlPanel.tsx (Root)

```tsx
import * as Popover from '@radix-ui/react-popover';

export const AgentLoopControlPanel: React.FC<{ onStop; onRetry }> = ({ onStop, onRetry }) => {
  const panelOpen = useAgentLoopStore((s) => s.panelOpen);
  const setPanelOpen = useAgentLoopStore((s) => s.setPanelOpen);
  const status = useAgentLoopStore((s) => s.status);
  const pendingConfirmation = useAgentLoopStore((s) => s.pendingConfirmation);

  // Auto-open when confirmation arrives
  useEffect(() => {
    if (pendingConfirmation && !panelOpen) {
      setPanelOpen(true);
    }
  }, [pendingConfirmation]);

  return (
    <Popover.Root open={panelOpen} onOpenChange={setPanelOpen}>
      <Popover.Trigger asChild>
        <AgentLoopStatusBar onStop={onStop} onRetry={onRetry} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="center"
          sideOffset={8}
          className="z-[99999] w-[480px] max-w-[calc(100vw-32px)] min-w-[320px]
                     rounded-lg border border-border bg-popover shadow-xl
                     animate-in fade-in-0 slide-in-from-bottom-2
                     data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        >
          <ControlPanelContent status={status} onStop={onStop} onRetry={onRetry} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
```

### ControlPanelContent.tsx (Layout)

```tsx
export const ControlPanelContent: React.FC<Props> = ({ status, onStop, onRetry }) => {
  const isRunning = status !== 'idle';

  return (
    <div className="flex max-h-[60vh] flex-col overflow-hidden">
      {/* Fixed header */}
      <PanelHeader />

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Confirmation (shown first when pending) */}
        <ConfirmationSection />

        {/* Settings */}
        <SettingsSection />

        {/* Tool management (collapsible) */}
        <ToolManagementSection />

        {/* Execution history (collapsible, only when running) */}
        {isRunning && <ExecutionHistorySection />}
      </div>

      {/* Fixed footer — instruction input */}
      {isRunning && <InstructionInput />}
    </div>
  );
};
```

### PanelHeader.tsx

```tsx
export const PanelHeader: React.FC = () => {
  const status = useAgentLoopStore((s) => s.status);
  const currentRound = useAgentLoopStore((s) => s.currentRound);
  const maxRounds = useAgentLoopStore((s) => s.maxRounds);
  const breakpointRound = useAgentLoopStore((s) => s.breakpointRound);
  const tokenEstimation = useAgentLoopStore((s) => s.tokenEstimation);
  const speedMode = useAgentLoopStore((s) => s.speedMode);

  return (
    <div className={cn(
      "flex items-center justify-between border-b border-border px-4 py-3",
      speedMode && "border-orange-500/30 bg-orange-500/5"
    )}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Agent Loop</span>
        {status !== 'idle' && (
          <span className="text-xs text-muted-foreground">
            Round {currentRound}/{maxRounds}
            {breakpointRound && <span className="ml-1 text-orange-500">⏸{breakpointRound}</span>}
          </span>
        )}
        {speedMode && <span className="text-xs text-orange-500 font-medium">⚡ SPEED</span>}
      </div>
      <span className="text-xs text-muted-foreground">
        {formatTokenCount(tokenEstimation)}
      </span>
    </div>
  );
};
```

### SettingsSection.tsx

```tsx
export const SettingsSection: React.FC = () => {
  const { autoExecuteReads, setAutoExecuteReads } = useControlPanelStore();
  const speedMode = useAgentLoopStore((s) => s.speedMode);
  const setSpeedMode = useAgentLoopStore((s) => s.setSpeedMode);
  const breakpointRound = useAgentLoopStore((s) => s.breakpointRound);
  const setBreakpointRound = useAgentLoopStore((s) => s.setBreakpointRound);
  const currentRound = useAgentLoopStore((s) => s.currentRound);
  const maxRounds = useAgentLoopStore((s) => s.maxRounds);

  return (
    <div className="space-y-3">
      {/* Auto-execute reads */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-foreground">自动执行读操作</label>
        <Switch checked={autoExecuteReads} onCheckedChange={setAutoExecuteReads} />
      </div>

      {/* Speed mode */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-foreground">极速模式</label>
        <Switch checked={speedMode} onCheckedChange={handleSpeedModeToggle} />
      </div>

      {/* Breakpoint */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-foreground">断点轮次</label>
        <input
          type="number"
          min={currentRound + 1}
          max={maxRounds}
          value={breakpointRound ?? ''}
          onChange={(e) => setBreakpointRound(e.target.value ? Number(e.target.value) : null)}
          placeholder="无"
          className="w-16 rounded border border-border bg-muted px-2 py-1 text-xs"
        />
      </div>
    </div>
  );
};
```


### ConfirmationSection.tsx

```tsx
export const ConfirmationSection: React.FC = () => {
  const pendingConfirmation = useAgentLoopStore((s) => s.pendingConfirmation);
  const [expanded, setExpanded] = useState(false);

  if (!pendingConfirmation) return null;

  const sql = pendingConfirmation.sql;
  const truncated = sql.length > 500 && !expanded;
  const displaySql = truncated ? sql.slice(0, 500) + '...' : sql;

  return (
    <div className="rounded-md border border-warning/30 bg-warning/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm">⚠️</span>
        <span className="text-xs font-medium text-foreground">写操作确认</span>
      </div>
      <div className="max-h-[200px] overflow-auto rounded border border-border bg-muted/50 p-2">
        <pre className="whitespace-pre-wrap text-xs font-mono text-foreground">
          {displaySql}
        </pre>
      </div>
      {truncated && (
        <button onClick={() => setExpanded(true)} className="text-xs text-primary hover:underline">
          查看完整内容
        </button>
      )}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => pendingConfirmation.resolve(false)}>
          Reject
        </Button>
        <Button size="sm" variant="outline" onClick={() => pendingConfirmation.resolve(true)}>
          Approve
        </Button>
      </div>
    </div>
  );
};
```

### InstructionInput.tsx

```tsx
export const InstructionInput: React.FC = () => {
  const [value, setValue] = useState('');
  const [sent, setSent] = useState(false);
  const status = useAgentLoopStore((s) => s.status);
  const setPendingInstruction = useAgentLoopStore((s) => s.setPendingInstruction);
  const disabled = status === 'idle';
  const MAX_LENGTH = 2000;

  const handleSend = () => {
    if (!value.trim() || disabled) return;
    setPendingInstruction(value.trim());
    setValue('');
    setSent(true);
    setTimeout(() => setSent(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="输入指令引导 AI..."
          rows={1}
          className="w-full resize-none rounded-md border border-border bg-muted/50 px-3 py-2
                     text-xs text-foreground placeholder:text-muted-foreground
                     focus:outline-none focus:ring-1 focus:ring-primary
                     disabled:cursor-not-allowed disabled:opacity-50"
        />
        {value.length > 1800 && (
          <span className="absolute bottom-1 right-2 text-[10px] text-muted-foreground">
            {value.length}/{MAX_LENGTH}
          </span>
        )}
      </div>
      {sent && (
        <span className="mt-1 block text-[10px] text-green-500">✓ 指令已发送</span>
      )}
    </div>
  );
};
```

### ExecutionHistorySection.tsx

```tsx
export const ExecutionHistorySection: React.FC = () => {
  const currentResults = useAgentLoopStore((s) => s.currentResults);
  const history = useAgentLoopStore((s) => s.history);
  const currentRound = useAgentLoopStore((s) => s.currentRound);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  // Flatten all results, newest first
  const allResults = [
    ...currentResults.map((r) => ({ ...r, round: currentRound })),
    ...history.flatMap((h) => h.results.map((r) => ({ ...r, round: h.round }))),
  ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);

  return (
    <Collapsible open={!collapsed} onOpenChange={(open) => setCollapsed(!open)}>
      <CollapsibleTrigger className="flex w-full items-center justify-between">
        <span className="text-xs font-medium">执行历史</span>
        <span className="text-[10px] text-muted-foreground">
          本轮已执行 {currentResults.length} 个工具
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {allResults.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">暂无执行记录</p>
        ) : (
          <div className="mt-2 max-h-[200px] space-y-1 overflow-y-auto">
            {allResults.map((result, i) => (
              <HistoryItem
                key={i}
                result={result}
                expanded={expandedItem === i}
                onToggle={() => setExpandedItem(expandedItem === i ? null : i)}
              />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
```

### ToolManagementSection.tsx

```tsx
export const ToolManagementSection: React.FC = () => {
  const { disabledTools, toggleTool } = useControlPanelStore();
  const [collapsed, setCollapsed] = useState(true);

  const allTools = [
    { name: 'execute_sql', label: 'Execute SQL' },
    { name: 'sync_conversation_messages', label: 'Sync Messages' },
    { name: 'export', label: 'Export' },
    { name: 'complete_task', label: 'Complete Task' },
  ];

  const disabledCount = disabledTools.length;

  return (
    <Collapsible open={!collapsed} onOpenChange={(open) => setCollapsed(!open)}>
      <CollapsibleTrigger className="flex w-full items-center justify-between">
        <span className="text-xs font-medium">工具管控</span>
        {disabledCount > 0 && (
          <span className="text-[10px] text-destructive">已禁用 {disabledCount} 个工具</span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-2">
          {allTools.map((tool) => (
            <div key={tool.name} className="flex items-center justify-between">
              <span className="text-xs text-foreground">{tool.label}</span>
              <Switch
                checked={!disabledTools.includes(tool.name)}
                onCheckedChange={() => toggleTool(tool.name)}
              />
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
```


## Store Implementation

### control-panel-store.ts (Persisted)

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ControlPanelState {
  autoExecuteReads: boolean;
  disabledTools: string[];

  setAutoExecuteReads: (enabled: boolean) => void;
  toggleTool: (toolName: string) => void;
  enableTool: (toolName: string) => void;
  disableTool: (toolName: string) => void;
}

export const useControlPanelStore = create<ControlPanelState>()(
  persist(
    (set, get) => ({
      autoExecuteReads: true,
      disabledTools: [],

      setAutoExecuteReads: (enabled) => set({ autoExecuteReads: enabled }),

      toggleTool: (toolName) => {
        const current = get().disabledTools;
        if (current.includes(toolName)) {
          set({ disabledTools: current.filter((t) => t !== toolName) });
        } else {
          set({ disabledTools: [...current, toolName] });
        }
      },

      enableTool: (toolName) => {
        set({ disabledTools: get().disabledTools.filter((t) => t !== toolName) });
      },

      disableTool: (toolName) => {
        if (!get().disabledTools.includes(toolName)) {
          set({ disabledTools: [...get().disabledTools, toolName] });
        }
      },
    }),
    {
      name: 'bs-agent-control-panel',
      storage: createJSONStorage(() => ({
        getItem: async (name) => {
          const result = await chrome.storage.local.get(name);
          return result[name] ?? null;
        },
        setItem: async (name, value) => {
          await chrome.storage.local.set({ [name]: value });
        },
        removeItem: async (name) => {
          await chrome.storage.local.remove(name);
        },
      })),
    }
  )
);
```

### agent-loop-store.ts (Extensions)

```typescript
// Add to existing useAgentLoopStore create():
// New state fields:
speedMode: false,
speedModeWarningShown: false,
breakpointRound: null,
tokenEstimation: 0,
pendingInstruction: null,
panelOpen: false,

// New actions:
setSpeedMode: (enabled) => set({ speedMode: enabled }),
setSpeedModeWarningShown: () => set({ speedModeWarningShown: true }),
setBreakpointRound: (round) => set({ breakpointRound: round }),
addTokens: (count) => set((s) => ({ tokenEstimation: s.tokenEstimation + count })),
resetTokens: () => set({ tokenEstimation: 0 }),
setPendingInstruction: (instruction) => set({ pendingInstruction: instruction }),
setPanelOpen: (open) => set({ panelOpen: open }),

// Modify start() to reset token counter:
start: (maxRounds) => set({
  // ... existing fields ...
  tokenEstimation: 0,
  speedMode: false,
  pendingInstruction: null,
}),

// Modify stop() to auto-disable speed mode:
stop: () => set((state) => ({
  // ... existing fields ...
  speedMode: false,
})),
```

## Event Bus Extensions

```typescript
// Add to AgentEventMap:
'control:speed-mode-changed': { enabled: boolean };
'control:instruction-injected': { instruction: string };
'control:tool-disabled': { toolName: string };
'control:tool-enabled': { toolName: string };
'control:breakpoint-set': { round: number | null };
'control:undo-requested': undefined;
'control:undo-completed': { success: boolean; error?: string };
```

## Undo Implementation

```typescript
/**
 * Undo last database write operation by restoring snapshot.
 * Only applicable when:
 * 1. snapshotCreated === true
 * 2. Last history entry is a database write (execute_sql with write)
 */
async function undoLastAction(): Promise<{ success: boolean; error?: string }> {
  const store = useAgentLoopStore.getState();

  if (!store.snapshotCreated) {
    return { success: false, error: '无可用快照' };
  }

  // Get last result
  const allResults = [...store.currentResults];
  const lastResult = allResults[allResults.length - 1];
  if (!lastResult || lastResult.toolName !== 'execute_sql') {
    return { success: false, error: '该操作不可撤销' };
  }

  try {
    // Restore from snapshot (uses existing snapshot mechanism)
    await restoreFromSnapshot();

    // Remove last result from store
    store.removeLastResult(); // New action needed

    // Inject undo notification for AI
    store.setPendingInstruction(
      '[SYSTEM] 上一步操作已被用户撤销，数据库已恢复到执行前的状态。请注意之前的操作结果不再有效。'
    );

    agentEventBus.emit('control:undo-completed', { success: true });
    return { success: true };
  } catch (e) {
    const error = (e as Error).message;
    agentEventBus.emit('control:undo-completed', { success: false, error });
    return { success: false, error };
  }
}
```

## Speed Mode Flow

```
User clicks Speed Mode ON
  → Check speedModeWarningShown
  → If false: show modal.confirm() with risk warning
    → User confirms → setSpeedMode(true), setSpeedModeWarningShown()
    → User cancels → do nothing
  → If true: setSpeedMode(true) directly

While speedMode is active:
  → getConfirmationStrategy() returns 'speed'
  → requiresConfirmation() always returns false
  → If pendingConfirmation exists → auto-resolve(true)
  → StatusBar shows orange/speed visual
  → Panel header shows ⚡ SPEED badge

When engine stops (status → idle):
  → store.stop() auto-sets speedMode = false
```

## Migration & Backward Compatibility

- `AgentLoopConfirmDialog` 将被标记为 deprecated 但不立即删除，保留作为 fallback
- 新的 `ConfirmationSection` 通过相同的 `pendingConfirmation` store 字段驱动
- 在 `AgentLoopFeature.tsx` 中，用 `<AgentLoopControlPanel />` 替代 `<AgentLoopStatusBar />` + `<AgentLoopConfirmDialog />`
- 现有 `AgentLoopSettings.confirmWrites` 将映射到新的 `autoExecuteReads`（语义等价）

## Dependencies

- `@radix-ui/react-popover` — **需要新增安装** (`npm i @radix-ui/react-popover`)
- `@radix-ui/react-collapsible` — 已安装
- `@radix-ui/react-switch` — 已安装
- `zustand` (persist middleware) — 已安装

## Requirement Traceability

| Requirement | Components / Files |
|---|---|
| R1: 面板 UI 展示与交互 | `AgentLoopControlPanel.tsx`, `ControlPanelContent.tsx`, `PanelHeader.tsx` |
| R2: 自动执行开关 | `SettingsSection.tsx`, `control-panel-store.ts`, Engine confirmation strategy |
| R3: 内联写操作确认 | `ConfirmationSection.tsx`, Engine `executeSqlWithConfirmation()` |
| R4: 用户中途指令输入 | `InstructionInput.tsx`, Engine `formatResultsWithInstruction()` |
| R5: 执行历史 | `ExecutionHistorySection.tsx`, existing store `history`/`currentResults` |
| R6: 工具白名单与黑名单 | `ToolManagementSection.tsx`, `control-panel-store.ts`, `tool-registry.ts` |
| R7: 极速模式 | `SettingsSection.tsx`, Speed mode flow, `agent-loop-store.ts` |
| R8: 断点暂停 | `SettingsSection.tsx`, Engine breakpoint check in `runLoop()` |
| R9: Token 用量估算 | `PanelHeader.tsx`, `estimateTokens()`, event bus listeners |
| R10: 撤销上一步操作 | `ExecutionHistorySection.tsx` (undo button), `undoLastAction()` |


## Error Handling

| Scenario | Handling |
|---|---|
| chrome.storage.local write fails | Log error, keep in-memory state valid, show warning icon next to switch |
| Snapshot restore fails | Show error toast, keep current state, disable undo button |
| User instruction injection with no active capsule | Queue instruction for next round, show "will inject next round" toast |
| Speed mode + loop ends unexpectedly | `stop()` auto-resets speedMode to false |
| Popover auto-open for confirmation + user closes it | Confirmation stays pending; StatusBar pulses to indicate pending action |
| Tool call to disabled tool | Return clear error string (not throw), AI sees feedback |
| Token estimation overflow (extremely long sessions) | Cap display at "~999M tokens", no functional impact |

## Testing Strategy

| Layer | Approach |
|---|---|
| Store logic | Unit test `useControlPanelStore` and `useAgentLoopStore` extensions: toggle states, persistence mock |
| Confirmation strategy | Unit test `requiresConfirmation()` with various tool calls and mode combinations |
| Token estimation | Unit test `estimateTokens()` with mixed Chinese/English text |
| Engine modifications | Integration test breakpoint check, blacklist gate, instruction injection in runLoop |
| Components | Manual testing in extension dev mode (Radix Popover + Chrome extension environment is hard to unit test) |
| Undo flow | Integration test with mock snapshot restore |
