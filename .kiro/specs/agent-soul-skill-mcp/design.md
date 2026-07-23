# Technical Design: Agent Soul + Skill + MCP Architecture

## Overview

将现有 Agent Loop 的扁平 prompt + tool-registry 结构重构为三层架构：Soul（固定 base prompt）→ Skill（可管理能力单元）→ MCP（标准化工具层）。核心变化是将 `built-in-registry.ts` + `base-prompt.ts` 拆分为 Soul 层和 Skill 层，将 `tool-registry.ts` 的 switch-case 改为 MCP provider 注册模式，并新增 Agent Tab UI 和 Skill Store。

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         OverlayPanel                                 │
│  ┌──────────┐  ┌──────────────────────────────────────────────────┐ │
│  │ Sidebar  │  │  Content Area                                    │ │
│  │  Nav     │  │  ┌────────────────────────────────────────────┐  │ │
│  │          │  │  │  AgentTab (NEW)                            │  │ │
│  │  [Bot]───┼──┼──│  ├─ SkillsSection (CollapsibleSection)    │  │ │
│  │          │  │  │  │   ├─ SkillCard[] (L1: 可见)            │  │ │
│  │          │  │  │  │   └─ SkillEditorDrawer (L3: 深入)      │  │ │
│  │          │  │  │  └─ ToolsSection (CollapsibleSection)     │  │ │
│  │          │  │  │      └─ ToolItem[] (L2: 展开可达)         │  │ │
│  │          │  │  └────────────────────────────────────────────┘  │ │
│  └──────────┘  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     Agent Loop Engine (Modified)                      │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────────────┐  │
│  │  Soul Layer   │  │  Skill Layer  │  │  MCP Layer             │  │
│  │  prompts/     │  │  skill-store  │  │  mcp/                  │  │
│  │  soul.ts      │  │  skill-       │  │  ├─ types.ts           │  │
│  │  (固定 prompt │  │  registry.ts  │  │  ├─ registry.ts        │  │
│  │   + 动态注入) │  │               │  │  ├─ providers/         │  │
│  └───────┬───────┘  └───────┬───────┘  │  │  ├─ sql-provider    │  │
│          │                   │          │  │  ├─ sync-provider   │  │
│          ▼                   ▼          │  │  ├─ export-provider │  │
│  ┌─────────────────────────────────┐   │  │  └─ task-provider   │  │
│  │  Prompt Assembler (NEW)         │   │  └────────────────────────┘│
│  │  assembleFinalPrompt(skill?)    │   │                             │
│  │  → Soul + Skill + MCP schemas  │   │                             │
│  └─────────────────────────────────┘   │                             │
└─────────────────────────────────────────────────────────────────────┘
```


## Data Models

### 实体关系

```
Agent (1 条: bettersidebar)
  ├── has many ── MCP Server (1:N)
  │                 └── has many ── Tool (1:N)
  └── has many ── Skill (1:N)
```

- 1 个 Agent，目前固定为 "bettersidebar"
- Agent 拥有 N 个 MCP Server（内置 1 个 + 用户可添加）
- 每个 MCP Server 包含 N 个 Tool
- Agent 拥有 N 个 Skill（内置若干 + 用户可添加）
- MCP 和 Skill 之间无直接关系（无 allowedTools）

### 存储策略

- **chrome.storage.local** + zustand persist（与现有模式一致）
- **不建 SQLite 表** — 数据量小（< 50KB），只需列表读写，无关系查询需求
- **内置数据写在代码里**（常量），store 只存 custom 数据 + enabled 状态覆盖
- 运行时 merge: `[...builtins, ...customFromStore]`

### Core Types

```typescript
// ─── Tool ────────────────────────────────────────────────────────────

/** 单个工具的 schema（写入 prompt 供 AI 识别） */
interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

/** 工具定义（包含执行函数） */
interface ToolDefinition {
  schema: ToolSchema;
  execute: (params: Record<string, string>) => Promise<string>;
}

// ─── MCP Server ──────────────────────────────────────────────────────

/** MCP Server 定义 */
interface MCPServer {
  id: string;                          // 'builtin-bettersidebar' | 'custom-{nanoid}'
  type: 'builtin' | 'custom';
  name: string;                        // 显示名称，如 "Better Sidebar"
  description: string;                 // 简短描述
  enabled: boolean;                    // 用户可启用/禁用
  tools: ToolDefinition[];             // 该 MCP 下的所有 tools
}

// ─── Skill ───────────────────────────────────────────────────────────

/** Skill 定义 */
interface Skill {
  id: string;                          // 'builtin-auto-classify' | 'custom-{nanoid}'
  type: 'builtin' | 'custom';
  title: string;                       // max 50 chars
  description: string;                 // max 200 chars
  icon: string;                        // Lucide icon name, default 'Sparkles'
  promptContent: string;               // max 5000 chars — skill 专属 prompt
  enabled: boolean;                    // 是否在触发弹窗中展示
  createdAt: number;                   // timestamp
  updatedAt: number;                   // timestamp
}

// ─── Agent ───────────────────────────────────────────────────────────

/** Agent 定义（目前只有 1 个） */
interface Agent {
  id: 'bettersidebar';
  name: 'Better Sidebar Agent';
  soulPromptVersion: number;           // 用于未来热更新 soul 时的版本标记
}
```

### 持久化 Store 结构

```typescript
/** 存储在 chrome.storage.local 的用户数据，key: 'bs-agent-config' */
interface AgentConfigStoreState {
  // 用户自定义的 MCP Servers
  customMCPServers: Array<{
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    tools: Array<ToolSchema>;          // 只存 schema，execute 由用户通过其他方式提供（TODO: V2）
  }>;

  // 内置 MCP 的 enabled 覆盖（默认全部 enabled，只记录被禁用的）
  disabledBuiltinMCPs: string[];       // 如 ['builtin-bettersidebar']

  // 用户自定义 Skills
  customSkills: Skill[];               // max 20 items

  // 内置 Skill 的 enabled 覆盖
  disabledBuiltinSkills: string[];     // 如 ['builtin-export-chats']

  // Actions
  addCustomSkill: (skill: Omit<Skill, 'id' | 'type' | 'createdAt' | 'updatedAt'>) => void;
  updateCustomSkill: (id: string, updates: Partial<Pick<Skill, 'title' | 'description' | 'icon' | 'promptContent'>>) => void;
  removeCustomSkill: (id: string) => void;
  toggleBuiltinSkill: (id: string) => void;
  toggleBuiltinMCP: (id: string) => void;
  setSkillEnabled: (id: string, enabled: boolean) => void;
}
```

### 内置数据常量（代码中）

```typescript
// mcp/builtin-mcp.ts — 内置 MCP Server
export const BUILTIN_MCP: MCPServer = {
  id: 'builtin-bettersidebar',
  type: 'builtin',
  name: 'Better Sidebar',
  description: 'Core tools for managing conversations, data, and tasks',
  enabled: true,
  tools: [
    activateSkillTool,   // 元工具：activate_skill
    sqlTool,             // execute_sql
    syncTool,            // sync_conversation_messages
    exportTool,          // export
    taskTool,            // complete_task
  ],
};

// skills/builtin-skills.ts — 内置 Skills
export const BUILTIN_SKILLS: Skill[] = [
  { id: 'builtin-auto-classify', ... },
  { id: 'builtin-find-empty-chats', ... },
  { id: 'builtin-export-chats', ... },
  { id: 'builtin-freeform', ... },
];
```


## Component Hierarchy

### New Files

```
src/entrypoints/overlay.content/shared/modules/agent-loop/
├── mcp/
│   ├── types.ts                       # ToolSchema, ToolDefinition, MCPServer interfaces
│   ├── registry.ts                    # MCPRegistry class — register servers, execute tools
│   ├── schema-generator.ts            # generateToolSchemaPrompt() → string for Soul prompt
│   ├── builtin-mcp.ts                 # BUILTIN_MCP 常量定义（包含 5 个 tools）
│   └── providers/
│       ├── sql-provider.ts            # execute_sql ToolDefinition
│       ├── sync-provider.ts           # sync_conversation_messages ToolDefinition
│       ├── export-provider.ts         # export ToolDefinition
│       ├── task-provider.ts           # complete_task ToolDefinition
│       └── activate-skill-provider.ts # activate_skill ToolDefinition (schema only, execute in engine)
├── skills/
│   ├── types.ts                       # Skill interface
│   ├── builtin-skills.ts             # BUILTIN_SKILLS 常量（迁移自 built-in-registry.ts）
│   └── skill-registry.ts             # getEnabledSkills(), getSkillById(), getSkillsForPopup()
├── agent-config-store.ts              # Zustand persisted store (chrome.storage.local)
├── prompts/
│   ├── soul.ts                        # Soul prompt template (replaces base-prompt.ts)
│   └── prompt-assembler.ts            # assembleFinalPrompt(), assembleSkillActivation()
```

```
src/entrypoints/overlay.content/shared/modules/agent-tab/
├── AgentTab.tsx                        # Tab root component
├── SkillsSection.tsx                   # CollapsibleSection wrapping skill list
├── SkillCard.tsx                       # Individual skill card (icon + title + desc + switch)
├── SkillEditorDrawer.tsx              # Create/edit skill drawer
├── MCPSection.tsx                      # CollapsibleSection wrapping MCP server list
├── MCPServerCard.tsx                   # MCP server card (name + tool count + enable/disable)
└── index.ts                            # Barrel export
```

### Modified Files

```
├── prompts/base-prompt.ts             # DEPRECATED → replaced by soul.ts + prompt-assembler.ts
├── prompts/built-in-registry.ts       # DEPRECATED → replaced by skills/skill-registry.ts
├── tools/tool-registry.ts            # Simplified: delegates to mcp/registry.ts
├── useAgentTrigger.ts                 # Source items from skill-registry instead of built-in-registry
├── AgentCommandPopup.tsx              # Render Skill items (same UI, different data source)
├── agent-loop-store.ts               # Add activeSkillId field
├── engine/AgentLoopEngine.ts         # Handle activate_skill tool call, prompt assembly
├── index.ts                           # Export new modules
```

```
src/entrypoints/overlay.content/gemini/OverlayPanel.tsx
  # Add 'agent' to tab union, add Bot icon button, render AgentTab
```


## Key Interfaces

### MCP Registry

```typescript
// mcp/registry.ts

/**
 * MCP Registry — 管理所有 MCP Server 及其 tools。
 * 运行时 merge 内置 MCP + 用户自定义 MCP。
 * 工具可见性由 MCP 的 enabled 状态整体控制。
 */
class MCPRegistry {
  private servers: MCPServer[] = [];

  /** Register a MCP server (called at init) */
  registerServer(server: MCPServer): void;

  /** Get all enabled tools across all enabled MCP servers */
  getEnabledTools(): ToolDefinition[];

  /** Get all enabled tool schemas (for writing into prompt) */
  getEnabledToolSchemas(): ToolSchema[];

  /** Find and execute a tool by name */
  execute(toolName: string, params: Record<string, string>): Promise<string>;

  /** Get all MCP server info (for UI display) */
  getServers(): MCPServer[];

  /** Check if a tool is available (its MCP is enabled) */
  isToolEnabled(toolName: string): boolean;
}

/** Singleton instance */
export const mcpRegistry = new MCPRegistry();
```

### Agent Config Store

```typescript
// agent-config-store.ts
export const useAgentConfigStore = create<AgentConfigStoreState>()(
  persist(
    (set, get) => ({
      customMCPServers: [],
      disabledBuiltinMCPs: [],
      customSkills: [],
      disabledBuiltinSkills: [],

      addCustomSkill: (data) => { /* generate id, set type/timestamps, push */ },
      updateCustomSkill: (id, updates) => { /* find and merge */ },
      removeCustomSkill: (id) => { /* filter out */ },
      toggleBuiltinSkill: (id) => { /* toggle in disabledBuiltinSkills */ },
      toggleBuiltinMCP: (id) => { /* toggle in disabledBuiltinMCPs */ },
      setSkillEnabled: (id, enabled) => { /* for custom skills */ },
    }),
    {
      name: 'bs-agent-config',
      storage: createJSONStorage(() => chromeStorageAdapter),
    }
  )
);
```

### Prompt Assembler

```typescript
// prompts/prompt-assembler.ts

/**
 * Assemble the final prompt to inject into the editor capsule.
 *
 * Structure:
 * 1. Soul prompt (fixed)
 * 2. Available skills summary (for AI to choose via activate_skill)
 * 3. All enabled MCP tool schemas (from enabled MCP servers)
 * 4. Selected skill prompt content (if user pre-selected one from popup)
 */
export function assembleFinalPrompt(options: {
  selectedSkill?: Skill;        // User explicitly chose a skill from popup
  allSkills: Skill[];           // All enabled skills (for generating summary)
}): string;

/**
 * Assemble response when AI calls activate_skill.
 * Returns skill prompt content so AI gets specialized instructions.
 */
export function assembleSkillActivation(skill: Skill): string;
```

### Skill Registry (combines builtin + custom)

```typescript
// skills/skill-registry.ts

/** Built-in skill definitions (migrated from built-in-registry.ts) */
export const BUILTIN_SKILLS: Skill[];

/** Get all enabled skills (builtin not in disabledBuiltinSkills + enabled custom) */
export function getEnabledSkills(): Skill[];

/** Get a skill by ID (from both builtin and custom) */
export function getSkillById(id: string): Skill | undefined;

/** Get skills for the trigger popup (enabled only, sorted: builtin first, then custom by date desc) */
export function getSkillsForPopup(): Skill[];
```


## Soul Prompt Template

```typescript
// prompts/soul.ts
export function getSoulPrompt(): string {
  return `
## Identity

You are an AI assistant integrated with the Better Sidebar extension for Google Gemini/AI Studio. You have access to tools that can query and modify the user's conversation database, export data, and manage tasks.

## Tool Calling Protocol

When you need to use a tool, output it in XML format:
<tool_call>
<name>tool_name</name>
<param name="param_name">value</param>
</tool_call>

## Execution Rules

1. Always start by understanding the user's intent
2. For database operations, begin with SELECT queries to understand current state
3. Never execute destructive operations without clear user intent
4. When a task is complete, call complete_task with a summary
5. If you encounter an error, explain it and try an alternative approach

## Skill Selection

If the user's task clearly matches one of the available skills listed below, call activate_skill to load specialized instructions. If no skill matches, proceed with your general capabilities.

{{SKILLS_SUMMARY}}

## Available Tools

{{TOOL_SCHEMAS}}
`;
}
```

### 动态注入区域

- `{{SKILLS_SUMMARY}}`: 由 `prompt-assembler.ts` 生成，格式为 skill ID + title + description 的列表
- `{{TOOL_SCHEMAS}}`: 由 `schema-generator.ts` 生成，格式为每个工具的 name + description + parameters


## Engine Modifications

### activate_skill 处理流程

```typescript
// In AgentLoopEngine — tool execution section:

// Before delegating to mcpRegistry, intercept activate_skill:
if (toolCall.name === 'activate_skill') {
  const skillId = toolCall.params.skill_id;
  const skill = getSkillById(skillId);

  if (!skill) {
    return `ERROR: Skill "${skillId}" not found. Available skills: ${getEnabledSkills().map(s => s.id).join(', ')}`;
  }

  // Record activated skill in store
  useAgentLoopStore.getState().setActiveSkillId(skillId);

  // Return skill prompt content
  return assembleSkillActivation(skill);
}

// Otherwise delegate to MCP registry (which checks if tool's MCP is enabled):
if (!mcpRegistry.isToolEnabled(toolCall.name)) {
  return `CANCELLED: 工具 ${toolCall.name} 不可用（其所属 MCP 已被禁用）`;
}
return mcpRegistry.execute(toolCall.name, toolCall.params);
```

### Prompt Assembly 时机

```
用户选择 skill → AgentCommandPopup onSelect
  → assembleFinalPrompt({ selectedSkill, allSkills })
  → capsule.dataAttrs['data-prompt-content'] = assembledPrompt
  → 后续流程不变（capsule 展开 → triggerSend）
```

如果用户选择 "Custom Task"（free-form）：
```
  → assembleFinalPrompt({ selectedSkill: undefined, allSkills })
  → Soul + 所有 enabled skills summary + 所有 enabled MCP 的 tool schemas
```

### Tool Registry 重构

```typescript
// tools/tool-registry.ts — Simplified wrapper
import { mcpRegistry } from '../mcp/registry';
import { getSkillById, getEnabledSkills } from '../skills/skill-registry';
import { useAgentLoopStore } from '../agent-loop-store';
import { assembleSkillActivation } from '../prompts/prompt-assembler';

export async function executeToolCall(toolCall: ParsedToolCall): Promise<string> {
  // 1. Meta-tool: activate_skill
  if (toolCall.name === 'activate_skill') {
    const skillId = toolCall.params.skill_id;
    const skill = getSkillById(skillId);
    if (!skill) {
      return `ERROR: Skill "${skillId}" not found. Available: ${getEnabledSkills().map(s => s.id).join(', ')}`;
    }
    useAgentLoopStore.getState().setActiveSkillId(skillId);
    return assembleSkillActivation(skill);
  }

  // 2. Check if tool's MCP server is enabled
  if (!mcpRegistry.isToolEnabled(toolCall.name)) {
    return `CANCELLED: 工具 ${toolCall.name} 不可用（其所属 MCP 已被禁用）`;
  }

  // 3. Delegate to MCP registry
  return mcpRegistry.execute(toolCall.name, toolCall.params);
}
```


## Component Designs

### AgentTab.tsx

```tsx
// Agent Tab root — two collapsible sections
export const AgentTab: React.FC = () => {
  const [skillsExpanded, setSkillsExpanded] = useState(true);
  const [mcpExpanded, setMcpExpanded] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <CollapsibleSection
        title="Skills"
        isExpanded={skillsExpanded}
        onToggle={() => setSkillsExpanded(!skillsExpanded)}
        fillAvailable={!mcpExpanded}
        actions={<NewSkillButton />}
      >
        <SkillsSection />
      </CollapsibleSection>

      <CollapsibleSection
        title="MCP"
        isExpanded={mcpExpanded}
        onToggle={() => setMcpExpanded(!mcpExpanded)}
        fillAvailable={skillsExpanded ? false : true}
        actions={<MCPSummaryBadge />}
      >
        <MCPSection />
      </CollapsibleSection>
    </div>
  );
};
```

### SkillCard.tsx

```tsx
interface SkillCardProps {
  skill: Skill;
  onEdit: () => void;
  onToggle: (enabled: boolean) => void;
}

export const SkillCard: React.FC<SkillCardProps> = ({ skill, onEdit, onToggle }) => (
  <div className="flex items-center gap-2 px-3 py-2 hover:bg-accent/50 rounded-md group">
    {/* Icon */}
    <div className="shrink-0 w-6 h-6 flex items-center justify-center text-muted-foreground">
      <DynamicIcon name={skill.icon} className="h-4 w-4" />
    </div>

    {/* Title + Description */}
    <div className="flex-1 min-w-0">
      <div className="text-xs font-medium text-foreground truncate">{skill.title}</div>
      <div className="text-[10px] text-muted-foreground truncate">{skill.description}</div>
    </div>

    {/* Actions (hover visible) */}
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {skill.type === 'custom' && (
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
        </Button>
      )}
    </div>

    {/* Enable/Disable switch */}
    <Switch
      checked={skill.enabled}
      onCheckedChange={onToggle}
      className="shrink-0"
    />
  </div>
);
```

### SkillEditorDrawer.tsx

```tsx
// Drawer 从右侧滑入，覆盖 Agent Tab 内容区域
interface SkillEditorDrawerProps {
  skill?: Skill;          // undefined = 新建模式
  onSave: (data: SkillFormData) => void;
  onClose: () => void;
}

export const SkillEditorDrawer: React.FC<SkillEditorDrawerProps> = ({ skill, onSave, onClose }) => {
  const [form, setForm] = useState<SkillFormData>(initFromSkill(skill));
  const [dirty, setDirty] = useState(false);

  const handleClose = () => {
    if (dirty) {
      if (!confirm('放弃未保存的修改？')) return;
    }
    onClose();
  };

  return (
    <div className="absolute inset-0 z-10 bg-background flex flex-col animate-in slide-in-from-right">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold">{skill ? '编辑 Skill' : '新建 Skill'}</span>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Form body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Field label="标题" required>
          <Input value={form.title} onChange={...} maxLength={50} />
        </Field>
        <Field label="描述" required>
          <Input value={form.description} onChange={...} maxLength={200} />
        </Field>
        <Field label="图标">
          <IconPicker value={form.icon} onChange={...} />
        </Field>
        <Field label="Prompt 内容" required>
          <Textarea
            value={form.promptContent}
            onChange={...}
            maxLength={5000}
            className="font-mono text-xs min-h-[200px]"
            placeholder="## Task: Your task name\n\nDescribe what this skill does..."
          />
        </Field>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
        <Button variant="ghost" size="sm" onClick={handleClose}>取消</Button>
        <Button size="sm" onClick={() => onSave(form)}>保存</Button>
      </div>
    </div>
  );
};
```


## Store Modifications

### agent-loop-store.ts 扩展

```typescript
// 新增字段:
activeSkillId: string | null;          // 当前循环中被激活的 skill ID

// 新增 action:
setActiveSkillId: (id: string | null) => void;

// 修改 start():
start: (maxRounds) => set({
  // ...existing...
  activeSkillId: null,                 // 每次新循环重置
});

// 修改 stop():
stop: () => set((state) => ({
  // ...existing...
  activeSkillId: null,
}));
```

### OverlayPanel.tsx 修改

```typescript
// Tab type union 新增 'agent':
type TabType = 'files' | 'favorites' | 'tags' | 'feedback' | 'settings'
  | 'search' | 'prompts' | 'gems' | 'notebooks' | 'snippets'
  | 'agent';  // NEW

// Sidebar nav 新增按钮（位于 Prompts 之后）:
<SimpleTooltip content={t('tabs.agent')}>
  <Button
    variant={activeTab === 'agent' ? 'secondary' : 'ghost'}
    size="icon"
    onClick={() => handleTabChange('agent')}
    className="sidebar-btn transition-all"
  >
    <Bot className="sidebar-icon" />
  </Button>
</SimpleTooltip>

// Content area 新增渲染:
{activeTab === 'agent' && <AgentTab />}
```


## MCP Provider Implementation Example

```typescript
// mcp/providers/sql-provider.ts
import type { MCPToolProvider } from '../types';
import { executeSql } from '../../tools/execute-sql';

export const sqlProvider: MCPToolProvider = {
  name: 'execute_sql',
  schema: {
    name: 'execute_sql',
    description: 'Execute a SQL query against the conversation database. Supports SELECT, INSERT, UPDATE, DELETE, and DDL statements.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The SQL query to execute',
        },
      },
      required: ['query'],
    },
  },
  execute: async (params) => executeSql({ query: params.query }),
};
```

```typescript
// mcp/registry.ts — initialization
import { sqlProvider } from './providers/sql-provider';
import { syncProvider } from './providers/sync-provider';
import { exportProvider } from './providers/export-provider';
import { taskProvider } from './providers/task-provider';

export const mcpRegistry = new MCPRegistry();

// Register all built-in providers
mcpRegistry.register(sqlProvider);
mcpRegistry.register(syncProvider);
mcpRegistry.register(exportProvider);
mcpRegistry.register(taskProvider);
```

## Schema Generator

```typescript
// mcp/schema-generator.ts

/**
 * Generate the tool schema section for injection into Soul prompt.
 * Lists all tools from all enabled MCP servers.
 * Grouped by MCP server name for clarity.
 */
export function generateToolSchemaPrompt(): string {
  const servers = mcpRegistry.getServers().filter(s => s.enabled);

  if (servers.length === 0) return 'No tools available.';

  let output = '';
  for (const server of servers) {
    output += `## MCP: ${server.name}\n`;
    output += `${server.description}\n\n`;
    for (const tool of server.tools) {
      output += `### ${tool.schema.name}\n`;
      output += `${tool.schema.description}\n`;
      output += `Parameters:\n`;
      for (const [key, val] of Object.entries(tool.schema.parameters.properties)) {
        const required = tool.schema.parameters.required.includes(key) ? ' (required)' : '';
        output += `  - ${key}: ${val.type}${required} — ${val.description}\n`;
      }
      output += '\n';
    }
  }

  return output.trim();
}
```


## Execution Flow

### 完整 Agent Loop with Skill Activation

```
1. 用户输入 ">" → useAgentTrigger 检测
2. AgentCommandPopup 展示 getSkillsForPopup() 结果
3. 用户选择某 skill（或 Custom Task）
4. assembleFinalPrompt() 生成完整 prompt:
   - Soul prompt (固定文本)
   - Skills summary (所有 enabled skills 的 id + title + description)
   - Tool schemas (按 selectedSkill.allowedTools 过滤)
   - Selected skill prompt (如果用户指定了 skill)
5. Capsule 插入编辑器，用户输入任务描述，发送
6. AgentLoopEngine.start()
7. AI 回复 → parseToolCalls()
   - Case A: AI 调用 activate_skill → 返回 skill prompt，下一轮 AI 获得专项指导
   - Case B: AI 直接调用 MCP 工具 → mcpRegistry.execute()
   - Case C: AI 无 tool call → 任务完成，循环结束
8. 结果 capsule 插入 → 用户按 Enter → 下一轮
```

### Skill Activation 详细流程

```
AI 调用 <tool_call><name>activate_skill</name><param name="skill_id">builtin-auto-classify</param></tool_call>
  ↓
executeToolCall() 拦截 → getSkillById('builtin-auto-classify')
  ↓
store.setActiveSkillId('builtin-auto-classify')
  ↓
assembleSkillActivation(skill) 返回:
  """
  ## Skill Activated: Auto Classify Conversations

  [skill.promptContent 的完整内容]

  You now have specialized instructions for this task. Proceed with execution.
  """
  ↓
结果作为 result capsule 回传给 AI
  ↓
AI 下一轮根据 skill prompt 执行具体操作（使用所有 enabled MCP 的工具）
```


## Migration Strategy

### Phase 1: 数据结构迁移（无 UI 变化）

1. 创建 `mcp/` 目录，将现有 tool 函数包装为 MCPToolProvider
2. 创建 `skills/` 目录，将 `built-in-registry.ts` 的 4 个 prompt 转换为 `BUILTIN_SKILLS`
3. 创建 `prompts/soul.ts`，将 `base-prompt.ts` 内容迁移过来
4. 修改 `tool-registry.ts` 内部委托给 `mcpRegistry.execute()`
5. 此阶段外部行为完全不变

### Phase 2: 引擎改造

1. 添加 `activate_skill` 处理逻辑
2. `useAgentTrigger` 数据源从 `getBuiltInPrompts()` 改为 `getSkillsForPopup()`
3. Prompt 注入从 `getBasePrompt()` + `prompt.getPromptContent()` 改为 `assembleFinalPrompt()`
4. `AgentCommandPopup` UI 不变，只是数据接口改变

### Phase 3: Agent Tab UI

1. 新增 `agent-tab/` 模块
2. `OverlayPanel.tsx` 添加 agent tab 入口
3. 实现 SkillsSection + ToolsSection + SkillEditorDrawer
4. Skill store 持久化

### 旧文件处理

| 文件 | 处理方式 |
|------|----------|
| `prompts/base-prompt.ts` | 标记 deprecated，保留但不再被引用 |
| `prompts/built-in-registry.ts` | 标记 deprecated，内容迁移到 `skills/skill-registry.ts` |
| `tools/tool-registry.ts` | 简化为 thin wrapper，内部委托 MCP registry |
| `tools/execute-sql.ts` | 保留，被 `mcp/providers/sql-provider.ts` import |
| `tools/complete-task.ts` | 保留，被 `mcp/providers/task-provider.ts` import |


## Event Bus Extensions

```typescript
// 新增事件类型到 AgentEventMap:
'skill:activated': { skillId: string; skillTitle: string };
'skill:created': { skillId: string };
'skill:updated': { skillId: string };
'skill:deleted': { skillId: string };
'mcp:tool-registered': { toolName: string };
'mcp:tool-executed': { toolName: string; success: boolean; durationMs: number };
```

## ToolCallParser 修改

```typescript
// ToolCallParser.ts — SUPPORTED_TOOLS 新增:
const SUPPORTED_TOOLS = [
  'execute_sql',
  'sync_conversation_messages',
  'export',
  'complete_task',
  'activate_skill',  // NEW — 元工具
];

const REQUIRED_PARAMS: Record<string, string[]> = {
  execute_sql: ['query'],
  sync_conversation_messages: ['conversation_ids'],
  export: ['ids', 'format'],
  complete_task: ['summary'],
  activate_skill: ['skill_id'],  // NEW
};
```

## Error Handling

| 场景 | 处理方式 |
|------|----------|
| AI 调用 activate_skill 传入不存在的 skill_id | 返回错误字符串，列出可用 skill IDs |
| AI 调用被禁用 MCP 下的工具 | 返回 CANCELLED，提示所属 MCP 已被禁用 |
| Agent config store chrome.storage.local 写入失败 | 在 AgentTab 顶部显示错误 toast，保持内存状态有效 |
| 自定义 skill 数量达到 20 上限 | "新建 Skill" 按钮 disabled + tooltip 说明 |
| MCP registry 找不到 tool | 返回 `ERROR: Unknown tool` (与现有行为一致) |
| Skill prompt 内容为空字符串 | 编辑器保存时校验阻止，不允许空 prompt |

## Dependencies

- 无新增外部依赖
- 复用现有: `zustand` (persist), `@radix-ui/react-collapsible`, `lucide-react`
- 复用现有 `CollapsibleSection` 组件
- 复用现有 chrome.storage.local adapter 模式

## Requirement Traceability

| Requirement | Design Components |
|---|---|
| R1: 触发机制 | `useAgentTrigger` → `getSkillsForPopup()`, `prompt-assembler.ts` |
| R2: Soul 层 | `prompts/soul.ts`, `assembleFinalPrompt()` |
| R3: Skill 管理 | `agent-config-store.ts`, `skill-registry.ts`, `SkillEditorDrawer.tsx` |
| R4: MCP 层 | `mcp/registry.ts`, `mcp/providers/*`, `schema-generator.ts`, `builtin-mcp.ts` |
| R5: Agent Tab | `agent-tab/AgentTab.tsx`, `SkillsSection`, `MCPSection` |
| R6: 渐进式 UI | `CollapsibleSection` (Skills 展开, MCP 折叠), SkillCard (L1), Drawer (L3) |
| R7: Skill 编辑器 | `SkillEditorDrawer.tsx` |
| R8: Control Panel 集成 | `agent-loop-store.activeSkillId`, `PanelHeader` 显示 skill 名称 |
| R9: 向后兼容 | Migration Phase 1-3, deprecated 标记, `BUILTIN_SKILLS` 映射 |
