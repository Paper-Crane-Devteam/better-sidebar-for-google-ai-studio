---
inclusion: fileMatch
fileMatchPattern: "**/agent-loop/**"
---

# Agent Loop — 架构参考文档

## 功能概述

Agent Loop 让用户在 Gemini Web App 中通过 `>` 前缀触发内置 prompt，启动多轮 AI 自动执行循环。AI 通过 XML tag 输出 tool 调用 → 插件解析执行 → 结果自动回填 → 继续对话，直到任务完成。

核心价值：用户用自然语言描述需求，AI 自动操作插件的 SQLite 数据库完成对话管理任务（分类、打 tag、创建文件夹等）。

## 目录结构

```
src/entrypoints/overlay.content/shared/modules/agent-loop/
├── index.ts                    # 公共 API barrel export
├── types.ts                    # 所有共享类型
├── agent-loop-store.ts         # Zustand 运行时状态（非持久化）
├── useAgentTrigger.ts          # > 前缀检测 hook
├── AgentCommandPopup.tsx       # > 弹出选择列表
├── AgentLoopStatusBar.tsx      # 循环执行状态条
├── AgentLoopConfirmDialog.tsx  # SQL 写操作确认对话框
├── adapters/
│   ├── types.ts                # AgentPlatformAdapter 接口定义
│   └── gemini-adapter.ts       # Gemini 平台实现
├── engine/
│   ├── AgentLoopEngine.ts      # 核心循环引擎（调度器）
│   └── ToolCallParser.ts       # XML tool call 正则解析
├── prompts/
│   ├── base-prompt.ts          # Base prompt（schema + tool 定义）
│   ├── built-in-registry.ts    # 内置 prompt 注册表
│   └── utilities/              # 各 utility prompt
│       ├── auto-classify.ts
│       ├── find-empty-chats.ts
│       └── export-chats.ts
├── tools/
│   ├── tool-registry.ts        # Tool 路由分发
│   ├── execute-sql.ts          # SQL 执行（完整实现）
│   ├── sync-messages.ts        # 占位
│   └── export-tool.ts          # 占位
└── snapshot/
    └── snapshot-manager.ts     # 占位
```

入口组件：
```
src/entrypoints/overlay.content/gemini/enhanced-features/AgentLoopFeature.tsx
```
已注册在 `GeminiEnhancedFeatures.tsx` 中。

## 核心执行流程

```
用户输入 ">" → useAgentTrigger 检测 → AgentCommandPopup 弹出
       ↓ 用户选择 prompt
拼接消息: getBasePrompt() + prompt.getPromptContent() + 用户输入
       ↓
GeminiAgentAdapter.insertText() + triggerSend()
       ↓
AgentLoopEngine.start() 开始循环 ─────────────────────┐
       ↓                                               │
  adapter.observeAIResponseComplete(60s)               │
       ↓ AI 回复完成                                    │
  adapter.extractResponseText() → parseToolCalls()     │
       ↓                                               │
  toolCalls.length === 0 → 停止循环                     │
  toolCalls.length > 0  → executeToolCall() 逐个执行   │
       ↓                                               │
  结果格式化 → adapter.insertText() + triggerSend()    │
       ↓                                               │
  nextRound() → 回到顶部 ─────────────────────────────┘
```


## 关键组件详解

### AgentPlatformAdapter（平台适配器）

位于 `adapters/types.ts`。所有平台特定的 DOM 操作都通过此接口抽象。

| 方法 | 用途 |
|------|------|
| `getEditor()` | 获取输入编辑器 DOM |
| `insertText(text)` | 向编辑器写入文本 |
| `triggerSend()` | 点击发送按钮 |
| `getText()` / `getCursorPosition()` | 读取编辑器状态 |
| `observeAIResponseComplete(timeout)` | 等待 AI 回复流式输出完成 |
| `extractResponseText(element)` | 从回复 DOM 提取纯文本 |
| `isStreaming()` | 判断 AI 是否在输出中 |
| `getLastAIResponseElement()` | 获取最后一条 AI 回复容器 |

当前实现：`gemini-adapter.ts`（操作 Quill 编辑器）。
未来扩展：新建 `aistudio-adapter.ts` 即可支持 AI Studio。

### ToolCallParser

位于 `engine/ToolCallParser.ts`。用正则从 AI 回复文本中提取 `<tool_call>` 块。

格式约定（写在 base-prompt 中告诉 AI）：
```xml
<tool_call>
<name>execute_sql</name>
<params>
<query>SELECT * FROM conversations LIMIT 10</query>
</params>
</tool_call>
```

关键逻辑：
- 最多解析 20 个 tool call / 单条消息
- 跳过 ``` 代码块内的 tool call（通过计数反引号对判断奇偶）
- 验证每个 tool 的必需参数
- 不支持的 tool name 记录错误并跳过

### execute_sql Tool

位于 `tools/execute-sql.ts`。是当前唯一完整实现的 tool。

安全层次：
1. **黑名单过滤** — DROP/ALTER/CREATE/PRAGMA/ATTACH/DETACH/VACUUM/REINDEX 全部拒绝
2. **付费墙** — 非 SELECT 检查 `useLicenseStore` 的 tier（需 power_pack/pro/support_pack）
3. **用户确认** — 通过 `agent-loop-store.pendingConfirmation` 状态触发 UI 对话框
4. **结果限制** — SELECT 最多返回 1000 行

确认流程：
```
executeSql 设置 store.pendingConfirmation = { sql, resolve }
  → AgentLoopConfirmDialog 组件检测到 → 渲染对话框
  → 用户点确认 → resolve(true) → 继续执行
  → 用户点取消 → resolve(false) → 返回 CANCELLED
```

### AgentLoopEngine

位于 `engine/AgentLoopEngine.ts`。核心循环调度器。

状态流转（通过 agent-loop-store）：
```
idle → waiting_ai → parsing → executing → sending → waiting_ai → ... → idle/paused/error
```

中断机制：
- `AbortController` — 用户点 Stop 时 abort
- 每步操作前调用 `checkAbort()` 检查是否被中断
- 超时/错误进入 paused 状态，用户可 retry

### useAgentTrigger Hook

位于 `useAgentTrigger.ts`。逻辑与 `useSlashCommand` 几乎相同但：
- 触发字符是 `>` 而非 `/`
- 搜索的是 `built-in-registry.ts` 中的内置 prompt 而非用户 prompt
- 接受 `isSlashCommandActive` 参数实现互斥

### AgentLoopFeature（Gemini 入口）

位于 `gemini/enhanced-features/AgentLoopFeature.tsx`。职责：
1. 创建 `GeminiAgentAdapter` 实例
2. 监听编辑器 input 事件，调用 `useAgentTrigger.handleInput`
3. 渲染 `AgentCommandPopup`
4. 用户选择后拼接消息 → 发送 → 启动 `AgentLoopEngine`
5. 渲染 `AgentLoopStatusBar` 和 `AgentLoopConfirmDialog`

当前使用 `slashCommand` 开关作为功能 toggle（暂未添加独立的 agentLoop 设置）。


## 与现有系统的集成点

### 数据库层
- 使用 `@/shared/db` 的 `runQuery(sql)` 和 `runCommand(sql)` 执行 SQL
- 这两个函数通过 message passing 与 db-worker（Web Worker）通信
- Worker 使用 `@subframe7536/sqlite-wasm`，存储在 OPFS 或 IndexedDB

### 付费系统
- `@/shared/lib/license-store.ts` — 管理 license 状态
- `LicenseTier` 类型：`'support_pack' | 'power_pack' | 'pro' | 'none'`
- `isPowerPackUser()` helper 判断是否有写权限
- Agent Loop 付费判断在 `execute-sql.ts` 内部，UI 无法绕过

### 设置系统
- `@/shared/lib/settings-store.ts` — 持久化设置
- TODO: 添加 `agentLoop: { enabled, confirmWrites, maxRounds }` 到 `GeminiEnhancedFeatures`
- 当前暂用 `enhancedFeatures.gemini.slashCommand` 作为功能开关

### SlashCommand 互斥
- `AgentLoopFeature` 通过 MutationObserver 检测 `[data-slash-command-popup]` DOM 判断 slash command 是否活动
- 活动时 `useAgentTrigger` 不响应 `>` 输入
- SlashCommandPopup 需要加 `data-slash-command-popup` attribute（TODO）

## 开发常见操作

### 新增一个 Tool

1. 在 `tools/` 下创建新文件（如 `create-folder.ts`）
2. 导出一个 `async function` 接受 params 返回 string
3. 在 `tools/tool-registry.ts` 的 switch 中添加新 case
4. 在 `engine/ToolCallParser.ts` 的 `SUPPORTED_TOOLS` 和 `REQUIRED_PARAMS` 中注册
5. 在 `prompts/base-prompt.ts` 中添加 tool 文档供 AI 参考

### 新增一个内置 Prompt

1. 在 `prompts/utilities/` 下创建新文件
2. 导出一个 `BuiltInPrompt` 对象（id, title, description, icon, getPromptContent）
3. 在 `prompts/built-in-registry.ts` 中 import 并加入 `BUILT_IN_PROMPTS` 数组

### 支持新平台（如 AI Studio）

1. 创建 `adapters/aistudio-adapter.ts` 实现 `AgentPlatformAdapter`
2. 创建 `aistudio/enhanced-features/AgentLoopFeature.tsx`（参照 Gemini 版本）
3. 在 `AIStudioEnhancedFeatures` 中注册

### 修改 Tool Call 格式

格式定义在两处：
- `prompts/base-prompt.ts` — 告诉 AI 怎么输出
- `engine/ToolCallParser.ts` — 解析逻辑
两处必须同步修改。

## 当前已知限制 / TODO

| 项目 | 状态 | 说明 |
|------|------|------|
| DB Snapshot | 占位 | `snapshot/snapshot-manager.ts` 有接口无实现 |
| sync_conversation_messages | 占位 | 需要实现页面导航 + 滚动抓取 |
| export tool | 占位 | 可复用现有导出功能 |
| settings UI | 未做 | 需在设置面板加 agentLoop 开关/确认/轮次配置 |
| settings migration | 未做 | settings-store version bump + defaults |
| SlashCommand `data-` attr | 未加 | 需给 SlashCommandPopup 加 `data-slash-command-popup` |
| AI Studio 支持 | 未做 | 需写 adapter + entry component |
| Gemini DOM 选择器 | 可能过时 | `model-response` / `.send-button` 等选择器需跟随 Gemini UI 更新 |
| 结果回填格式 | 可优化 | 当前是 Markdown 纯文本，可能影响 Gemini 的理解 |
| 大量结果截断 | 基本实现 | SELECT 1000 行限制，但 JSON 可能仍然很长 |

## 调试技巧

1. 所有日志带 `[AgentLoop]` 前缀，DevTools Console 搜索即可
2. `useAgentLoopStore.getState()` 可在 Console 查看运行时状态
3. 测试 ToolCallParser：直接 import `parseToolCalls` 传入模拟文本
4. 测试 execute_sql：直接调用 `executeSql({ query: '...' })` 观察结果
5. 强制停止循环：`useAgentLoopStore.getState().stop()`
