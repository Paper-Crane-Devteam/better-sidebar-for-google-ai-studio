# Technical Design: Agent Loop Power Pack

## Overview

Agent Loop 是一个平台无关的多轮 AI 自动执行系统。核心逻辑放在 `shared/modules/agent-loop/` 下，各平台仅提供 adapter（输入框操作、DOM 解析）。第一阶段仅支持 Gemini，但架构为未来扩展 AI Studio 做好准备。

DB Snapshot、Export Tool、Sync Conversation Messages Tool 在本阶段仅为占位接口，不实现具体逻辑。

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Enhanced Features                            │
│  (GeminiEnhancedFeatures / AIStudioEnhancedFeatures)                │
│                                                                      │
│  ┌──────────────────────┐                                           │
│  │ AgentLoopFeature.tsx │ ← 平台入口组件，传入 platform adapter     │
│  │ (per-platform thin)  │                                           │
│  └──────────┬───────────┘                                           │
│             │                                                        │
└─────────────┼────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│              shared/modules/agent-loop/ (平台无关)                    │
│                                                                      │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │ TriggerDetector │  │BuiltInPrompts    │  │ AgentLoopEngine   │  │
│  │ (useAgentTrigger│  │(prompt registry) │  │ (orchestrator)    │  │
│  │  hook)          │  │                  │  │                   │  │
│  └────────┬────────┘  └────────┬─────────┘  └────────┬──────────┘  │
│           │                    │                      │              │
│           ▼                    ▼                      ▼              │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │AgentCommandPopup│  │ToolCallParser    │  │  ToolExecutors    │  │
│  │(UI component)   │  │(DOM/text parser) │  │  (registry)       │  │
│  └─────────────────┘  └──────────────────┘  └───────────────────┘  │
│                                                      │              │
│                               ┌──────────────────────┼──────────┐   │
│                               ▼                      ▼          ▼   │
│                        ┌───────────┐  ┌────────────────┐ ┌──────┐  │
│                        │execute_sql│  │sync_messages   │ │export│  │
│                        │(active)   │  │(placeholder)   │ │(plh) │  │
│                        └───────────┘  └────────────────┘ └──────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ agent-loop-store.ts (Zustand) — 运行时状态管理                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ types.ts — 所有共享类型定义                                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Platform Adapters (接口实现)                                        │
│                                                                      │
│  ┌────────────────────────────┐  ┌──────────────────────────────┐  │
│  │ GeminiAgentAdapter         │  │ AIStudioAgentAdapter (future) │  │
│  │ - getEditor()              │  │ - getEditor()                 │  │
│  │ - insertText()             │  │ - insertText()                │  │
│  │ - triggerSend()            │  │ - triggerSend()               │  │
│  │ - observeAIResponse()     │  │ - observeAIResponse()         │  │
│  │ - parseToolCalls()        │  │ - parseToolCalls()            │  │
│  └────────────────────────────┘  └──────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Existing Infrastructure                                             │
│                                                                      │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────────────────┐  │
│  │ db/index.ts  │  │license-store  │  │ settings-store           │  │
│  │ runQuery()   │  │useLicenseStore│  │ useSettingsStore          │  │
│  │ runCommand() │  │               │  │                           │  │
│  └──────────────┘  └───────────────┘  └─────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── entrypoints/overlay.content/
│   ├── gemini/enhanced-features/
│   │   └── AgentLoopFeature.tsx          # Gemini 入口，创建 GeminiAgentAdapter
│   └── shared/modules/agent-loop/
│       ├── index.ts                       # Public API exports
│       ├── types.ts                       # 所有类型定义
│       ├── agent-loop-store.ts            # Zustand store (运行时状态)
│       ├── AgentCommandPopup.tsx          # > 前缀弹出 UI 组件
│       ├── AgentLoopStatusBar.tsx         # 执行状态指示器 UI
│       ├── AgentLoopConfirmDialog.tsx     # SQL 确认对话框
│       ├── useAgentTrigger.ts             # > 前缀检测 hook
│       ├── engine/
│       │   ├── AgentLoopEngine.ts         # 核心循环引擎
│       │   └── ToolCallParser.ts          # Tool 调用解析器
│       ├── prompts/
│       │   ├── base-prompt.ts             # Base prompt 定义
│       │   ├── built-in-registry.ts       # 内置 prompt 注册表
│       │   └── utilities/                 # Utility prompts
│       │       ├── auto-classify.ts
│       │       ├── find-empty-chats.ts
│       │       └── export-chats.ts
│       ├── tools/
│       │   ├── tool-registry.ts           # Tool 注册表
│       │   ├── execute-sql.ts             # execute_sql 实现
│       │   ├── sync-messages.ts           # placeholder
│       │   └── export-tool.ts             # placeholder
│       ├── adapters/
│       │   ├── types.ts                   # AgentPlatformAdapter 接口
│       │   └── gemini-adapter.ts          # Gemini 平台适配器
│       └── snapshot/
│           └── snapshot-manager.ts        # placeholder
```

## Components and Interfaces

### 1. Platform Adapter Interface (`adapters/types.ts`)

```typescript
/**
 * 平台适配器接口 — 每个支持的平台实现此接口。
 * Agent Loop 核心引擎通过此接口与具体平台交互。
 */
export interface AgentPlatformAdapter {
  /** 获取输入编辑器 DOM 元素 */
  getEditor(): HTMLElement | null;

  /** 向编辑器插入文本（替换当前内容） */
  insertText(text: string): void;

  /** 程序化触发发送按钮 */
  triggerSend(): Promise<void>;

  /** 获取当前编辑器中的文本内容 */
  getText(): string;

  /** 获取光标位置 */
  getCursorPosition(): number;

  /**
   * 观察 AI 回复完成。
   * 返回一个 Promise，resolve 时携带 AI 回复的 DOM 容器元素。
   * 如果超时则 reject。
   */
  observeAIResponseComplete(timeoutMs: number): Promise<HTMLElement>;

  /**
   * 从 AI 回复 DOM 容器中提取文本内容（用于 tool call 解析）。
   * 需要处理 Markdown 渲染后的 DOM 结构。
   */
  extractResponseText(responseElement: HTMLElement): string;

  /** 判断 AI 是否正在流式输出中 */
  isStreaming(): boolean;

  /** 获取最后一条 AI 回复的 DOM 容器 */
  getLastAIResponseElement(): HTMLElement | null;
}
```

### 2. Gemini Adapter (`adapters/gemini-adapter.ts`)

```typescript
/**
 * Gemini 平台适配器。
 * 操作 Gemini 的 Quill-based rich-textarea。
 */
export class GeminiAgentAdapter implements AgentPlatformAdapter {
  getEditor(): HTMLElement | null {
    return document.querySelector('rich-textarea .ql-editor[contenteditable="true"]');
  }

  insertText(text: string): void {
    const editor = this.getEditor();
    if (!editor) return;
    editor.textContent = text;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async triggerSend(): Promise<void> {
    // 等待 Gemini 检测到输入变化
    await new Promise(r => setTimeout(r, 100));
    const sendBtn = document.querySelector(
      'button.send-button, button[aria-label="Send message"]'
    ) as HTMLButtonElement | null;
    sendBtn?.click();
  }

  getText(): string {
    return this.getEditor()?.textContent || '';
  }

  getCursorPosition(): number {
    // 复用 SlashCommandFeature 中的逻辑
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;
    const editor = this.getEditor();
    if (!editor) return 0;
    const range = sel.getRangeAt(0);
    const preRange = document.createRange();
    preRange.selectNodeContents(editor);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().length;
  }

  observeAIResponseComplete(timeoutMs: number): Promise<HTMLElement> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        observer.disconnect();
        reject(new Error('AI response timeout'));
      }, timeoutMs);

      // 观察 model-response 容器的 DOM 变化，500ms 无变化视为完成
      let debounceTimer: ReturnType<typeof setTimeout>;
      const checkComplete = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const lastResponse = this.getLastAIResponseElement();
          if (lastResponse && !this.isStreaming()) {
            clearTimeout(timeout);
            observer.disconnect();
            resolve(lastResponse);
          }
        }, 500);
      };

      const observer = new MutationObserver(checkComplete);
      const chatContainer = document.querySelector('chat-window, .conversation-container');
      if (chatContainer) {
        observer.observe(chatContainer, { childList: true, subtree: true, characterData: true });
      }
      // 也立即检查一次（可能已经完成）
      checkComplete();
    });
  }

  extractResponseText(responseElement: HTMLElement): string {
    return responseElement.innerText || '';
  }

  isStreaming(): boolean {
    // Gemini 在流式输出时会有 loading indicator
    return !!document.querySelector('.loading-indicator, .streaming-indicator, mat-progress-bar');
  }

  getLastAIResponseElement(): HTMLElement | null {
    const responses = document.querySelectorAll('model-response, .model-response-text');
    return responses[responses.length - 1] as HTMLElement | null;
  }
}
```

### 3. Agent Loop Store (`agent-loop-store.ts`)

```typescript
import { create } from 'zustand';

export type AgentLoopStatus = 'idle' | 'waiting_ai' | 'parsing' | 'executing' | 'sending' | 'paused' | 'error';

export interface ToolCallResult {
  toolName: string;
  success: boolean;
  result: string;
  timestamp: number;
}

export interface AgentLoopState {
  /** 当前循环状态 */
  status: AgentLoopStatus;
  /** 当前轮次（从 1 开始） */
  currentRound: number;
  /** 最大轮次 */
  maxRounds: number;
  /** 当前正在执行的 tool 名称 */
  currentTool: string | null;
  /** 当前轮次的所有 tool 执行结果 */
  currentResults: ToolCallResult[];
  /** 历史轮次结果 */
  history: Array<{ round: number; results: ToolCallResult[] }>;
  /** 错误信息 */
  errorMessage: string | null;
  /** 是否已在本次 session 中创建过快照 */
  snapshotCreated: boolean;

  // Actions
  start: () => void;
  nextRound: () => void;
  setStatus: (status: AgentLoopStatus) => void;
  setCurrentTool: (tool: string | null) => void;
  addResult: (result: ToolCallResult) => void;
  pause: (reason?: string) => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
  setError: (message: string) => void;
  setSnapshotCreated: (created: boolean) => void;
}
```

### 4. Tool Call Parser (`engine/ToolCallParser.ts`)

```typescript
/**
 * Tool Call Tag 格式定义。
 * 在 base prompt 中指示 AI 使用此格式输出 tool 调用。
 *
 * 格式:
 * <tool_call>
 * <name>execute_sql</name>
 * <params>
 * <query>SELECT * FROM conversations LIMIT 10</query>
 * </params>
 * </tool_call>
 */

export interface ParsedToolCall {
  name: string;
  params: Record<string, string>;
}

export interface ParseResult {
  toolCalls: ParsedToolCall[];
  errors: string[];
}

/**
 * 从 AI 回复文本中解析 tool 调用。
 * 使用正则而非 DOM 解析，因为 Gemini 渲染后的 DOM 结构不可预测。
 */
export function parseToolCalls(responseText: string): ParseResult {
  const toolCalls: ParsedToolCall[] = [];
  const errors: string[] = [];

  // 匹配 <tool_call>...</tool_call> 块
  const toolCallRegex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  let match: RegExpExecArray | null;
  let count = 0;

  while ((match = toolCallRegex.exec(responseText)) !== null && count < 20) {
    const block = match[1];

    // 检查是否在代码块内 (简单启发式: 前面有 ``` 且后面有 ```)
    const beforeMatch = responseText.substring(0, match.index);
    const codeBlockCount = (beforeMatch.match(/```/g) || []).length;
    if (codeBlockCount % 2 !== 0) {
      // 在代码块内，跳过
      continue;
    }

    // 提取 name
    const nameMatch = block.match(/<name>(.*?)<\/name>/);
    if (!nameMatch) {
      errors.push('Tool call missing <name> tag');
      continue;
    }

    const name = nameMatch[1].trim();
    const supportedTools = ['execute_sql', 'sync_conversation_messages', 'export'];
    if (!supportedTools.includes(name)) {
      errors.push(`Unknown tool: ${name}`);
      continue;
    }

    // 提取 params
    const paramsMatch = block.match(/<params>([\s\S]*?)<\/params>/);
    const params: Record<string, string> = {};
    if (paramsMatch) {
      const paramsBlock = paramsMatch[1];
      // 提取每个参数 <key>value</key>
      const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
      let paramMatch: RegExpExecArray | null;
      while ((paramMatch = paramRegex.exec(paramsBlock)) !== null) {
        params[paramMatch[1]] = paramMatch[2].trim();
      }
    }

    // 验证必需参数
    if (name === 'execute_sql' && !params.query) {
      errors.push('execute_sql: missing required param "query"');
      continue;
    }
    if (name === 'sync_conversation_messages' && !params.conversation_ids) {
      errors.push('sync_conversation_messages: missing required param "conversation_ids"');
      continue;
    }
    if (name === 'export' && (!params.ids || !params.format)) {
      errors.push('export: missing required param "ids" or "format"');
      continue;
    }

    toolCalls.push({ name, params });
    count++;
  }

  return { toolCalls, errors };
}
```

### 5. Agent Loop Engine (`engine/AgentLoopEngine.ts`)

```typescript
import type { AgentPlatformAdapter } from '../adapters/types';
import type { AgentLoopState } from '../agent-loop-store';
import { parseToolCalls, ParsedToolCall } from './ToolCallParser';
import { executeToolCall } from '../tools/tool-registry';

/**
 * Agent Loop 核心引擎。
 * 负责循环控制、tool 调用调度、结果回填。
 */
export class AgentLoopEngine {
  private adapter: AgentPlatformAdapter;
  private store: AgentLoopState;  // Zustand store reference
  private abortController: AbortController | null = null;

  constructor(adapter: AgentPlatformAdapter, store: AgentLoopState) {
    this.adapter = adapter;
    this.store = store;
  }

  /**
   * 启动 Agent Loop。
   * 在用户消息发送后调用，开始监听 AI 回复。
   */
  async start(): Promise<void> {
    this.abortController = new AbortController();
    this.store.start();

    try {
      await this.runLoop();
    } catch (e) {
      if ((e as Error).message !== 'Agent loop aborted') {
        this.store.setError((e as Error).message);
      }
    }
  }

  /** 停止循环 */
  stop(): void {
    this.abortController?.abort();
    this.store.stop();
  }

  private async runLoop(): Promise<void> {
    while (this.store.currentRound <= this.store.maxRounds) {
      this.checkAbort();

      // 1. 等待 AI 回复完成
      this.store.setStatus('waiting_ai');
      let responseElement: HTMLElement;
      try {
        responseElement = await this.adapter.observeAIResponseComplete(60000);
      } catch (e) {
        this.store.pause('AI 回复超时');
        return; // 暂停，等用户操作
      }

      this.checkAbort();

      // 2. 解析 tool 调用
      this.store.setStatus('parsing');
      const responseText = this.adapter.extractResponseText(responseElement);
      const { toolCalls, errors } = parseToolCalls(responseText);

      // 3. 如果没有 tool 调用，循环结束
      if (toolCalls.length === 0) {
        this.store.stop();
        return;
      }

      // 4. 执行 tool 调用
      this.store.setStatus('executing');
      const results: string[] = [];

      for (const toolCall of toolCalls) {
        this.checkAbort();
        this.store.setCurrentTool(toolCall.name);

        const result = await executeToolCall(toolCall);
        this.store.addResult({
          toolName: toolCall.name,
          success: !result.startsWith('ERROR:'),
          result,
          timestamp: Date.now(),
        });
        results.push(`[${toolCall.name}] ${result}`);
      }

      this.store.setCurrentTool(null);

      // 5. 格式化结果并发送
      this.store.setStatus('sending');
      const formattedResult = this.formatResults(results, errors);
      this.adapter.insertText(formattedResult);
      await this.adapter.triggerSend();

      // 6. 进入下一轮
      this.store.nextRound();

      // 7. 检查是否达到最大轮次
      if (this.store.currentRound > this.store.maxRounds) {
        this.store.pause('已达到最大轮次限制');
        return;
      }
    }
  }

  private formatResults(results: string[], errors: string[]): string {
    let output = '## Tool Execution Results\n\n';
    for (const r of results) {
      output += r + '\n\n';
    }
    if (errors.length > 0) {
      output += '## Parse Errors\n\n';
      for (const e of errors) {
        output += `- ${e}\n`;
      }
    }
    return output;
  }

  private checkAbort(): void {
    if (this.abortController?.signal.aborted) {
      throw new Error('Agent loop aborted');
    }
  }
}
```

### 6. execute_sql Tool (`tools/execute-sql.ts`)

```typescript
import { runQuery, runCommand } from '@/shared/db';
import { useLicenseStore } from '@/shared/lib/license-store';
import { useAgentLoopStore } from '../agent-loop-store';

/** SQL 语句类型黑名单 */
const BLOCKED_PATTERNS = /^\s*(DROP|ALTER|CREATE|PRAGMA|ATTACH|DETACH|VACUUM|REINDEX)\b/i;
const SELECT_PATTERN = /^\s*SELECT\b/i;
const MAX_RESULT_ROWS = 1000;

export interface ExecuteSqlParams {
  query: string;
}

/**
 * 执行 SQL 语句。
 * - SELECT: 直接执行
 * - DML (INSERT/UPDATE/DELETE): 检查权限 + 可选确认
 * - DDL (DROP/ALTER/CREATE...): 拒绝执行
 */
export async function executeSql(params: ExecuteSqlParams): Promise<string> {
  const { query } = params;

  // 1. 安全检查: 黑名单
  if (BLOCKED_PATTERNS.test(query)) {
    return 'ERROR: This SQL statement type is not allowed. Only SELECT, INSERT, UPDATE, DELETE are permitted.';
  }

  // 2. 判断是否为 SELECT
  const isSelect = SELECT_PATTERN.test(query);

  // 3. 非 SELECT: 付费墙检查
  if (!isSelect) {
    const license = useLicenseStore.getState();
    if (license.tier !== 'pro' && license.tier !== 'support_pack') {
      // TODO: 确认 Power Pack 对应的 tier 值
      return 'ERROR: PAYWALL - Writing to database requires Power Pack subscription.';
    }

    // 4. 可选确认 (由 UI 层处理，这里通过 store 信号通信)
    // 确认逻辑通过 store 的 pendingConfirmation 状态 + Promise 实现
    const confirmed = await requestUserConfirmation(query);
    if (!confirmed) {
      return 'CANCELLED: User cancelled the operation.';
    }
  }

  // 5. 执行
  try {
    if (isSelect) {
      const rows = await runQuery(query);
      if (!rows || rows.length === 0) {
        return 'Result: 0 rows returned.';
      }
      const truncated = rows.length > MAX_RESULT_ROWS;
      const displayRows = truncated ? rows.slice(0, MAX_RESULT_ROWS) : rows;
      let result = `Result: ${rows.length} row(s)${truncated ? ` (showing first ${MAX_RESULT_ROWS})` : ''}\n`;
      result += JSON.stringify(displayRows, null, 2);
      return result;
    } else {
      await runCommand(query);
      // SQLite WASM 的 runCommand 不直接返回 changes count
      // 可以通过 SELECT changes() 获取
      const changesResult = await runQuery('SELECT changes() as affected_rows');
      const affectedRows = changesResult?.[0]?.affected_rows ?? 'unknown';
      return `Success: ${affectedRows} row(s) affected.`;
    }
  } catch (e) {
    return `ERROR: SQL execution failed - ${(e as Error).message}`;
  }
}

/**
 * 请求用户确认。
 * 通过 store 设置 pendingConfirmation 状态，UI 组件监听并展示对话框。
 * 返回 Promise<boolean>。
 */
async function requestUserConfirmation(sql: string): Promise<boolean> {
  const store = useAgentLoopStore.getState();
  // 检查设置是否跳过确认
  // TODO: 从 settings-store 读取 agentLoop.skipConfirmation 配置
  // if (skipConfirmation) return true;

  return new Promise((resolve) => {
    store.setPendingConfirmation({
      sql,
      resolve,
    });
  });
}
```

### 7. Tool Registry (`tools/tool-registry.ts`)

```typescript
import type { ParsedToolCall } from '../engine/ToolCallParser';
import { executeSql } from './execute-sql';

/**
 * Tool 注册表。执行已解析的 tool 调用。
 */
export async function executeToolCall(toolCall: ParsedToolCall): Promise<string> {
  switch (toolCall.name) {
    case 'execute_sql':
      return executeSql({ query: toolCall.params.query });

    case 'sync_conversation_messages':
      // Placeholder - Phase 2
      return 'ERROR: sync_conversation_messages is not yet implemented. Please use execute_sql to query existing data.';

    case 'export':
      // Placeholder - Phase 2
      return 'ERROR: export tool is not yet implemented. Please use execute_sql to query data and display results instead.';

    default:
      return `ERROR: Unknown tool "${toolCall.name}"`;
  }
}
```

### 8. Built-in Prompt (`prompts/base-prompt.ts`)

```typescript
import { SCHEMA } from '@/shared/db/schema';

/**
 * Base prompt 模板。
 * 告诉 AI 如何与插件交互。
 */
export function getBasePrompt(): string {
  return `You are an AI assistant integrated with the "Better Sidebar" browser extension for Google Gemini. You have the ability to interact with the extension's local SQLite database to help users manage their conversations, folders, tags, and more.

## Your Capabilities

You can execute tool calls by outputting them in a special XML format. The extension will parse your output, execute the tools, and send you the results automatically.

## Tool Call Format

When you need to execute a tool, output it in this exact format:

<tool_call>
<name>TOOL_NAME</name>
<params>
<PARAM_NAME>PARAM_VALUE</PARAM_NAME>
</params>
</tool_call>

## Available Tools

### 1. execute_sql
Execute SQL queries against the local database.

**Parameters:**
- \`query\` (required): The SQL statement to execute.

**Allowed operations:** SELECT, INSERT, UPDATE, DELETE
**Blocked operations:** DROP, ALTER, CREATE, PRAGMA, ATTACH, DETACH

**Example:**
<tool_call>
<name>execute_sql</name>
<params>
<query>SELECT id, title, platform FROM conversations WHERE platform = 'gemini' ORDER BY last_active_at DESC LIMIT 20</query>
</params>
</tool_call>

### 2. sync_conversation_messages (coming soon)
Sync message history for specified conversations.

**Parameters:**
- \`conversation_ids\` (required): JSON array of conversation external_ids.

### 3. export (coming soon)
Export conversations to file.

**Parameters:**
- \`ids\` (required): JSON array of conversation IDs.
- \`format\` (required): One of "markdown", "plaintext", "json".

## Database Schema

\`\`\`sql
${SCHEMA}
\`\`\`

## Important Notes

1. **Always start with SELECT queries** to understand the current data before making changes.
2. **Be careful with DELETE/UPDATE** — explain what you're about to do before executing.
3. **Use transactions for batch operations** — wrap multiple related changes in a single request when possible.
4. **IDs are UUIDs** — generate them with random UUID format when inserting.
5. **Timestamps are Unix epoch in seconds** — use unixepoch() for current time.
6. **The \`external_id\` field** maps to the platform's native conversation ID.
7. **Soft deletes** — conversations use \`deleted_at\` field (NULL = active).
8. You can output multiple tool_call blocks in a single response. They will be executed in order.
9. After receiving results, analyze them and continue with the next step of the task.
10. When the task is complete, summarize what was done without outputting any more tool_calls.
`;
}
```

### 9. useAgentTrigger Hook (`useAgentTrigger.ts`)

```typescript
import { useState, useCallback } from 'react';
import { getBuiltInPrompts, type BuiltInPrompt } from './prompts/built-in-registry';

export interface AgentTriggerState {
  isOpen: boolean;
  query: string;
  triggerPosition: number;
  matches: BuiltInPrompt[];
  selectedIndex: number;
}

const initialState: AgentTriggerState = {
  isOpen: false,
  query: '',
  triggerPosition: -1,
  matches: [],
  selectedIndex: 0,
};

/**
 * > 前缀检测 hook。
 * 逻辑与 useSlashCommand 类似，但触发字符为 > 且搜索内置 prompts。
 * 当 slashCommand popup 处于打开状态时不触发。
 */
export function useAgentTrigger(isSlashCommandActive: boolean) {
  const [state, setState] = useState<AgentTriggerState>(initialState);

  const handleInput = useCallback((text: string, cursorPos: number) => {
    // 如果斜杠命令正在活动，不响应
    if (isSlashCommandActive) {
      if (state.isOpen) setState(initialState);
      return;
    }

    // 从光标位置向前查找 >
    let triggerPos = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      if (text[i] === '>') {
        if (i === 0 || /[\s\n]/.test(text[i - 1])) {
          triggerPos = i;
        }
        break;
      }
      if (text[i] === '\n') break;
    }

    if (triggerPos === -1) {
      setState(initialState);
      return;
    }

    const query = text.slice(triggerPos + 1, cursorPos);
    const allPrompts = getBuiltInPrompts();
    const matches = filterPrompts(allPrompts, query);

    if (query.trim() && matches.length === 0) {
      setState(initialState);
      return;
    }

    setState({
      isOpen: true,
      query,
      triggerPosition: triggerPos,
      matches: matches.slice(0, 8),
      selectedIndex: 0,
    });
  }, [isSlashCommandActive, state.isOpen]);

  // ... selectPrevious, selectNext, close 等方法同 useSlashCommand

  return { state, handleInput, /* ... */ };
}

function filterPrompts(prompts: BuiltInPrompt[], query: string): BuiltInPrompt[] {
  if (!query.trim()) return prompts;
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return prompts.filter(p => {
    const title = p.title.toLowerCase();
    return words.every(w => title.includes(w));
  });
}
```

### 10. Settings Extension

在 `settings-store.ts` 的 `enhancedFeatures` 中添加:

```typescript
interface AgentLoopSettings {
  /** Agent Loop 功能开关 */
  enabled: boolean;
  /** 非 SELECT 操作是否需要确认 */
  confirmWrites: boolean;
  /** 最大循环轮次 */
  maxRounds: number;
}

// 添加到 GeminiEnhancedFeatures / AIStudioEnhancedFeatures:
interface GeminiEnhancedFeatures {
  // ... existing fields
  agentLoop: AgentLoopSettings;
}
```

默认值:
```typescript
agentLoop: {
  enabled: true,
  confirmWrites: true,
  maxRounds: 20,
}
```

### 11. License Tier Extension

Power Pack 对应的 tier 值需要在 `license-store.ts` 中扩展:

```typescript
export type LicenseTier = 'support_pack' | 'power_pack' | 'pro' | 'none';
```

付费墙检查逻辑:
```typescript
function isPowerPackUser(): boolean {
  const { tier } = useLicenseStore.getState();
  return tier === 'power_pack' || tier === 'pro';
}
```

## Data Flow

### 正常执行流程

```
1. 用户输入 ">" → useAgentTrigger 检测到 → 显示 AgentCommandPopup
2. 用户选择 utility prompt + 输入需求
3. 系统拼接: base_prompt + utility_prompt + user_input
4. 插入到编辑器并发送 (替换 ">" 文本)
5. AgentLoopEngine.start() → 开始监听 AI 回复
6. AI 回复完成 → ToolCallParser 解析
7. 有 tool_call → executeToolCall() 逐个执行
8. 所有结果格式化 → insertText + triggerSend
9. 循环回到步骤 5
10. 无 tool_call → 停止循环
```

### 付费墙流程

```
1. executeSql 检测到非 SELECT
2. 检查 license tier
3. tier 不够 → 返回 PAYWALL error string
4. AgentLoopEngine 将 error 加入 results
5. results 回填给 AI → AI 知道需要升级，终止任务
(同时 UI 层展示升级对话框)
```

### 用户确认流程

```
1. executeSql 检测到非 SELECT + confirmWrites=true
2. store.setPendingConfirmation({ sql, resolve })
3. AgentLoopConfirmDialog 组件检测到 pendingConfirmation
4. 展示对话框，显示 SQL 内容
5. 用户确认 → resolve(true) → 继续执行
6. 用户取消 → resolve(false) → 返回 CANCELLED
```

## Data Models

### AgentLoopState (Zustand Runtime Store)

| Field | Type | Description |
|-------|------|-------------|
| status | `AgentLoopStatus` | idle / waiting_ai / parsing / executing / sending / paused / error |
| currentRound | number | 当前轮次 (1-based) |
| maxRounds | number | 最大轮次 (默认 20) |
| currentTool | string \| null | 当前正在执行的 tool 名称 |
| currentResults | ToolCallResult[] | 本轮 tool 执行结果 |
| history | Array<{round, results}> | 历史轮次记录 |
| errorMessage | string \| null | 错误信息 |
| snapshotCreated | boolean | 本次 session 是否已创建快照 |
| pendingConfirmation | PendingConfirmation \| null | 待确认的写操作 |

### PendingConfirmation

| Field | Type | Description |
|-------|------|-------------|
| sql | string | 待确认的 SQL 语句 |
| resolve | (confirmed: boolean) => void | 确认回调 |

### ParsedToolCall

| Field | Type | Description |
|-------|------|-------------|
| name | string | tool 名称 (execute_sql / sync_conversation_messages / export) |
| params | Record<string, string> | 参数键值对 |

### BuiltInPrompt

| Field | Type | Description |
|-------|------|-------------|
| id | string | 唯一标识 |
| title | string | 显示名称 |
| description | string | 简短描述 |
| icon | string | 图标名称 |
| getPromptContent | () => string | 返回 utility prompt 内容 |

### AgentLoopSettings (Persisted in settings-store)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| enabled | boolean | true | 功能开关 |
| confirmWrites | boolean | true | 非 SELECT 是否需要确认 |
| maxRounds | number | 20 | 最大循环轮次 |

## Error Handling

| Scenario | Handling |
|----------|----------|
| AI 回复超时 (>60s) | 暂停循环，展示 "重试" / "停止" 选项 |
| SQL 执行错误 | 将错误信息作为 result 返回给 AI，AI 可自行修正 |
| DDL/危险 SQL | 直接拒绝，返回错误信息 |
| Tool Call 格式错误 | 跳过该 tool call，记录 error，继续处理其他 |
| 所有 tool calls 都无效 | 停止循环（视为无 tool call） |
| 网络错误/Gemini 限流 | 暂停循环，展示错误信息 + "重试" / "停止" |
| 付费墙拦截 | 返回 PAYWALL error，同时 UI 展示升级对话框 |
| 用户取消确认 | 返回 CANCELLED 信息，AI 收到后知道终止该操作 |
| 达到最大轮次 | 自动暂停，提示用户是否继续 |
| 编辑器/发送按钮找不到 | 停止循环，展示 DOM 异常错误 |

## Testing Strategy

| 层级 | 策略 |
|------|------|
| ToolCallParser | 单元测试：各种格式的 tool call 文本解析（正常、嵌套、代码块内、格式错误） |
| execute-sql | 单元测试：黑名单过滤、SELECT vs DML 判断、结果截断逻辑 |
| AgentLoopEngine | 集成测试：mock adapter + mock tool registry，验证循环控制逻辑 |
| useAgentTrigger | 单元测试：> 前缀检测、与 / 命令互斥、过滤逻辑 |
| GeminiAgentAdapter | 手动测试：在 Gemini 页面上验证 DOM 操作（编辑器交互、发送触发、回复检测） |
| 付费墙 | 单元测试：各 tier 的权限判断 |
| E2E | 手动测试：完整 agent loop 流程（触发 → 选择 prompt → 多轮执行 → 停止） |

## Correctness Properties

### Property 1: 循环终止保证
maxRounds 硬上限 + abort controller 确保循环一定会终止。无论 AI 输出什么内容，循环在 maxRounds 轮后必定暂停。

**Validates: Requirements 7.5**

### Property 2: 数据一致性
非 SELECT 操作默认需要用户确认，确认前数据不变。付费墙检查在 executor 内部执行，UI 无法绕过。

**Validates: Requirements 4.2, 8.1**

### Property 3: 状态机完整性
AgentLoopStatus 的状态转换有明确路径：idle → waiting_ai → parsing → executing → sending → (waiting_ai | idle | paused | error)。不存在无效转换。

**Validates: Requirements 7.3, 7.4**

### Property 4: 平台隔离
核心引擎通过 AgentPlatformAdapter 接口与平台交互，不直接依赖任何平台特定 DOM 选择器或 API。

**Validates: Requirements 10.1, 10.4**

### Property 5: 付费墙不可绕过
写操作权限检查在 tool executor 函数内部（execute-sql.ts），无法通过修改 UI 状态或跳过 prompt 来绕过。

**Validates: Requirements 9.2, 9.3, 9.4**

## Key Design Decisions

1. **平台无关的核心引擎**: 所有 agent loop 逻辑在 `shared/modules/agent-loop/` 中，各平台仅实现 adapter 接口。这样未来支持 AI Studio 只需新增 `aistudio-adapter.ts`。

2. **文本解析而非 DOM 解析**: Tool Call 使用从 AI 回复中提取的纯文本进行正则匹配，而非直接解析 DOM 元素。这样更可靠，不受 Gemini 渲染变化的影响。

3. **XML-like Tag 格式**: 选择 `<tool_call><name>...</name><params>...</params></tool_call>` 格式，因为:
   - LLM 对 XML 格式的遵循度高
   - 正则解析简单可靠
   - 不容易与正常文本混淆
   - 代码块内的 tool_call 会被自动过滤

4. **Placeholder 模式**: sync_messages 和 export 返回 "not implemented" 错误，AI 收到后会知道使用替代方案。

5. **确认机制通过 Store 通信**: 非 SELECT 的确认不使用 `window.confirm()`，而是通过 Zustand store 的 pending state + Promise resolve，UI 组件响应式渲染对话框。

6. **Snapshot 延迟实现**: DB Snapshot 功能作为接口保留在 `snapshot/snapshot-manager.ts`，但不在第一阶段实现。快照逻辑可以在后续版本中使用现有的 `exportDB()` 和 `importDB()` 基础设施。

## Security Considerations

1. **SQL 注入防护**: AI 生成的 SQL 直接执行，但通过黑名单阻止 DDL 和危险操作。
2. **无限循环防护**: maxRounds 硬上限 + 用户可随时停止。
3. **数据安全**: 非 SELECT 默认需要确认，用户明确选择后才执行。
4. **Token 安全**: 不涉及外部 API token，所有操作本地执行。
