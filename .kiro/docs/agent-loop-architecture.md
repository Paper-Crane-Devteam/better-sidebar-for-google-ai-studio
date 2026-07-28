

---

## 目录结构

三块 UI，职责不重叠：

| 位置 | 角色 | 内容 |
|------|------|------|
| 设置 → Agent | 装备库 | Skills CRUD、MCP 开关（低频、跨会话） |
| Agent Tab（侧边栏） | 驾驶舱 | 启动任务、当前进度、需要用户决策的事 |
| 聊天流内（renderer） | 内容 | 工具卡片、结果详情、Agent 定制视图 |

判断准则：**聊天流回答"发生了什么"，Agent Tab 回答"我现在要做什么"。**

```
src/entrypoints/overlay.content/shared/
├── lib/
│   └── quill-editor.ts            # ★ Quill 编辑器操作统一入口
├── features/
│   └── trigger-popup/
│       ├── useTriggerPopup.ts     # 通用触发检测状态机
│       ├── useEditorIntegration.ts # 事件拦截层（import quill-editor）
│       └── PopupFooterHints.tsx
├── modules/
│   ├── agent-loop/                # 引擎 + 领域逻辑
│   │   ├── index.ts               # Public API（barrel）
│   │   ├── types.ts               # AgentLoopStatus / ToolCallResult / AgentEndReason
│   │   ├── agent-loop-store.ts    # 运行时状态（非持久化）
│   │   ├── agent-policy-store.ts  # 执行策略（持久化：autoExecuteReads）
│   │   ├── agent-config-store.ts  # 用户自定义 skill / MCP 开关（持久化）
│   │   ├── execution-policy.ts    # requiresConfirmation / token 估算
│   │   ├── agent-entry.ts         # ★ `>` 列表数据源：auto 条目 + skills
│   │   ├── event-bus.ts           # 类型安全事件总线
│   │   ├── useAgentTrigger.ts     # `>` 前缀检测
│   │   ├── AgentCommandPopup.tsx  # `>` 弹出选择列表
│   │   ├── adapters/              # 平台适配（gemini-adapter 等）
│   │   ├── engine/
│   │   │   ├── AgentLoopEngine.ts # 核心循环
│   │   │   ├── engine-registry.ts # ★ 模块级 engine handle（供 Agent Tab 控制）
│   │   │   ├── ToolCallParser.ts
│   │   │   └── circuit-breaker.ts
│   │   ├── renderer/              # 聊天流内的定制渲染 + 工具卡片
│   │   ├── prompts/               # soul.ts + prompt-assembler.ts
│   │   ├── skills/                # builtin-skills + skill-registry
│   │   ├── mcp/                   # MCP registry + providers（工具真正的注册处）
│   │   └── tools/                 # execute-sql / export / sync / complete-task
│   ├── agent-tab/                 # 侧边栏 Agent Tab（UI 层）
│   │   ├── AgentTab.tsx           # 启动器 or 会话面板（按对话隔离）
│   │   ├── useElapsedTime.ts
│   │   └── components/
│   │       ├── AgentLauncher.tsx          # 空闲态：技能卡 + 自由描述任务
│   │       ├── AgentStatusPanel.tsx       # 会话态容器
│   │       ├── AgentStatusHeader.tsx      # 状态 / 步数 / 耗时 / Stop·Retry
│   │       ├── AgentContinuePrompt.tsx    # awaiting_send 的「继续」CTA
│   │       ├── AgentConfirmation.tsx      # 写操作确认（SQL 折叠）
│   │       ├── AgentInterruptNotice.tsx   # 暂停 / 报错原因
│   │       ├── AgentSessionSummary.tsx    # 结束卡（含 paywall upsell）
│   │       ├── AgentExecutionHistory.tsx  # 步骤条（显示 AI 的 description）
│   │       ├── AgentPolicyControls.tsx    # 读自动 / 写自动开关
│   │       └── AgentInstructionInput.tsx  # 中途给 AI 补充说明
│   └── slash-command/             # `/` snippets（与 `>` 互斥）
```

入口组件：
```
src/entrypoints/overlay.content/gemini/enhanced-features/AgentLoopFeature.tsx
src/entrypoints/overlay.content/gemini/enhanced-features/SlashCommandFeature.tsx
src/entrypoints/overlay.content/gemini/OverlayPanel.tsx   # 渲染 <AgentTab />
```

### 触发符

| 符号 | 归属 | 说明 |
|------|------|------|
| `/` | slash-command | Snippets / prompt 库 |
| `>` | agent-loop | Agent 条目：第一项是 auto（AI 自己选 skill），其余是 skills |

`!` 触发符已移除。它等价于"不预选 skill 的 agent"，却需要第二个 `useEditorIntegration` 实例，
而 `registerBeforeSendHandler` 是模块级单槽，两个实例只有一个能接管发送按钮点击。
现在统一走 `>` + `agent-entry.ts` 的 `AGENT_AUTO_ID`。

---

## 核心执行流程

```
两个启动入口：
  A. 用户输入 ">" → useAgentTrigger → AgentCommandPopup → 选择条目
  B. Agent Tab 点技能卡 → emit('launcher:run-entry') → AgentLoopFeature 监听
       ↓
capsule 写入编辑器（insertCapsuleAtRange 或 appendCapsule）
       ↓ 用户按 Enter / 点发送按钮（入口 B 可 autoSend）
composeAndSend():
  读 capsule 的 data-prompt-id → getAgentEntryById()
  assembleFinalPrompt(soul + skill + tool schemas) → adapter.triggerSend()
       ↓
AgentLoopEngine.start(20, { conversationId, title })
  setActiveEngine(engine)   ← Agent Tab 由此拿到控制权
       ↓ ────────────────────────────────────────────────┐
  status = waiting_ai                                     │
  adapter.observeAIResponseComplete(60s)                  │
       ↓ AI 回复完成                                       │
  status = parsing → parseToolCalls()                     │
       ↓                                                  │
  无 tool call  → stop('complete')                        │
  有 tool call  → status = executing，逐个执行             │
                  写操作 → requiresConfirmation() → 确认   │
       ↓                                                  │
  insertMultipleCapsules() 把结果写回编辑器                 │
       ↓                                                  │
  status = awaiting_send   ← 正常检查点，不是故障           │
  用户按 Enter，或点 Agent Tab 的「继续」(engine.continueNow) │
       ↓                                                  │
  waitForUserSend() resolve → nextRound() ───────────────┘
```

### 状态语义（重要）

`awaiting_send` 与 `paused` 必须分开，UI 依赖这个区分：

| status | 含义 | Tab 呈现 |
|--------|------|----------|
| `awaiting_send` | 每轮正常结束，结果已在输入框待发送 | 「继续」CTA |
| `paused` | 超时 / 断点 / 熔断 / 达上限 | 原因 + Retry / Dismiss |
| `error` | 引擎异常 | 原因 + Retry / Dismiss |

会话结束时 `endReason` 记录原因（`complete` / `user_stop` / `max_rounds` /
`circuit_breaker` / `paywall`），`AgentSessionSummary` 据此决定显示完成卡还是升级引导。

### Agent Tab 如何控制引擎

engine 实例在 `AgentLoopFeature` 里创建，但 Stop / Retry / 继续 的按钮在侧边栏。
两者通过 `engine/engine-registry.ts` 的模块级 handle 连接：

```ts
setActiveEngine(engine);            // AgentLoopFeature 创建时
getActiveEngine()?.stop();          // Tab 的 Stop
getActiveEngine()?.resume();        // Tab 的 Retry（paused | error 可用）
getActiveEngine()?.continueNow();   // Tab 的「继续」→ triggerSend()
```

⚠️ 只改 store 不叫 engine 是无效的：engine 持有自己的 abortController 和
`waitForUserSend()` promise。历史上 Tab 的 Stop 只改 store，引擎会在后台继续跑。

### 工具的两条执行路径

| 路径 | 触发 | 结果去向 |
|------|------|----------|
| 自动（主） | 引擎解析到 tool call 立即执行 | result capsule → `awaiting_send` |
| 手动（辅） | 点消息卡片上的「执行」 | `appendCapsule` 追加到输入框，用户自己发送 |

「执行」按钮只存在于 **custom 渲染视图**（`CustomModelResponse` → `ToolCallWidget`），
原生 DOM 从未注入过工具卡片。

因为两条路径会碰同一个操作，按钮受三重约束：

1. **位置** — 只有最后一条 model response 可执行，历史消息只显示「已执行 / 未执行」
2. **身份** — `executedCalls[fingerprint]` 记录本次会话已执行的调用
   （`buildToolCallFingerprint` = tool name + 排序归一化后的 params）。
   写操作命中即永久锁定；读操作允许「重新执行」
3. **时机** — 引擎处于 `waiting_ai / parsing / executing / sending` 时按钮禁用。
   引擎是执行**完**才写 fingerprint，busy 期间放开点击会有 check-then-act 竞态

⚠️ `executedCalls` 随会话重置，不持久化。刷新页面后同一条写操作理论上能再点一次执行。

### 会话与对话的绑定

store 是全局单例，所以 `start()` 会记下 `sessionConversationId`。
`AgentTab` 只在 session 属于当前对话时显示；离开该对话且已 idle 时自动 `reset()`。

### 手动执行路径（ToolCallWidget）

```
用户在 AI 回复中点击 "执行" 按钮
  → ToolCallWidget.handleRun()
  → executeToolCall(parsed)
  → fillResultToEditor(description || name, result)
      → appendCapsule() — 追加到编辑器末尾，不覆盖已有 capsule
用户可继续点击其他 tool 的"执行"（累加 capsule）
用户按 Enter / 点发送 → 合并所有 result capsule 发送
```

---

## 消息发送的两条路径

### 路径 1: Enter 键

由 `useEditorIntegration` 的 `onKeyDown` handler 拦截（capture 阶段）：

1. 检查 result capsule → 有则合并 + replaceAllContent + triggerSend
2. 检查 prompt capsule（匹配 triggerChar）→ 有则调用 `onBeforeSend`
3. `onBeforeSend` 返回 true → preventDefault，由 adapter 自行发送
4. `onBeforeSend` 返回 false → expandCapsules 展开后让 Gemini 原生发送

### 路径 2: 发送按钮点击

由 `installSendButtonInterceptor()` 注册的 document capture click 拦截：

1. 检测 click target 匹配 `.text-input-field .send-button-container>gem-icon-button>button`
2. 有 prompt capsule → expandCapsules（就地展开，Quill 同步后 Gemini 原生发送）
3. 有 result capsule → preventDefault → 合并 + replaceAllContent + triggerSend

⚠️ **必须在 capture 阶段拦截**，否则 Gemini 的 Angular handler 先执行，读到的是 Quill Delta 里的显示文本而非真实 prompt 内容。

---

## 关键组件详解

### GeminiAgentAdapter

位于 `adapters/gemini-adapter.ts`。调用 `quill-editor.ts` 的方法：
- `getEditor()` → `quillGetEditor()`
- `insertText(text)` → `replaceAllContent(editor, text)`
- `triggerSend()` → `quillTriggerSend()`
- `getCursorPosition()` → `quillGetCursorPosition(editor)`

### useEditorIntegration

位于 `trigger-popup/useEditorIntegration.ts`。事件拦截层：
- 监听 `input`, `keydown`(capture), `blur`, `click`
- MutationObserver 检测编辑器重建（SPA 导航）
- 从 `quill-editor.ts` 导入所有 capsule 操作

### AgentLoopEngine

- `insertResultCapsule()` → 调用 `insertMultipleCapsules(editor, capsuleData[])`
- `waitForUserSend()` → MutationObserver 等 result capsule 从编辑器消失，
  同时监听 `abortController.signal` 的 abort 事件（否则 Stop 之后若页面无变动会一直挂着）
- `addResult()` 会带上 AI 给的 `description`，Agent Tab 用它显示人话步骤
- Circuit breaker: 循环检测 + 连续失败熔断

### ConversationRenderer

- `fillResultToEditor()` → 调用 `appendCapsule(editor, displayText, attrs)`
- 优先用 `parsed.description` 作为显示文本，fallback 到 `parsed.name`
- 显示格式: `Result: {description}` / `结果: {description}`（i18n key: `agentLoop.resultCapsulePrefix`）


---

## 与现有系统的集成点

### 数据库层
- `@/shared/db` 的 `runQuery(sql)` 和 `runCommand(sql)` 通过 message passing 与 Web Worker 通信
- Worker 使用 `@subframe7536/sqlite-wasm`，存储在 OPFS 或 IndexedDB

### 付费系统
- `@/shared/lib/license-store.ts` — `LicenseTier`: `'support_pack' | 'power_pack' | 'pro' | 'none'`
- 免费版只能读；写操作在 `execute-sql.ts` 里拦，返回 `ERROR: PAYWALL - ...`
- 引擎识别到 PAYWALL → `stop('paywall')` → `AgentSessionSummary` 显示升级引导
  （之前 endReason 被丢弃，付费拦截和正常完成在 UI 上没有区别）

### 执行策略（谁需要确认）
`execution-policy.ts` 的 `requiresConfirmation()`：

| 策略 | 触发条件 | 行为 |
|------|----------|------|
| `speed` | `agentLoopStore.speedMode`（会话级） | 全部不问 |
| `confirm_writes` | `agentPolicyStore.autoExecuteReads = true`（默认） | 读自动，写要确认 |
| `confirm_all` | `autoExecuteReads = false` | 全部要确认 |

两个开关的 UI 在 `AgentPolicyControls`；写确认弹窗里的「本次任务全部允许」
就是把 `speedMode` 打开。工具级开关走 MCP（`mcpRegistry.isToolEnabled`），
不要再引入第二套 `disabledTools`。

### i18n
- `agentLoop.resultCapsulePrefix` — Result capsule 显示前缀（en: "Result", zh-CN: "结果"）
  编辑器层用 `i18n.t()` 直接访问（非 React context），import from `@/locale/i18n`
- `agent.*` — Agent Tab 全部文案（launcher / status / continue / confirm / summary…）
  只填了 en、zh-CN、zh-TW，其余语言靠 `fallbackLng: 'en'`；
  组件里一律写 `t(key, { defaultValue })`，缺 key 也不会显示成裸 key

### 设置系统
- 当前暂用 `enhancedFeatures.gemini.slashCommand` 作为功能开关
- TODO: 添加独立的 `agentLoop` 设置

### SlashCommand 互斥
- AgentLoopFeature 通过 MutationObserver 检测 `[data-slash-command-popup]` 判断 slash 是否活动
- `/` 和 `>` 两个 `useEditorIntegration` 实例共存于同一编辑器，通过 `data-trigger` 区分 capsule
- ⚠️ `registerBeforeSendHandler` 是模块级单槽：同一编辑器上再加第三个触发符，
  发送按钮点击只会走最后注册的那个 handler

---

## Gemini DOM 选择器（可能过时）

| 用途 | 选择器 |
|------|--------|
| 编辑器 | `rich-textarea .ql-editor[contenteditable="true"]` |
| 发送按钮 | `.text-input-field .send-button-container>gem-icon-button>button` |
| AI 回复容器 | `model-response .model-response-text` |
| 对话容器 | `infinite-scroller.chat-history` |
| 流式指示器 | `message-actions[hidden]`, `mat-progress-bar` |
| 暗色主题 | `localStorage: Bard-Color-Theme === 'Bard-Dark-Theme'` |

---

## 开发常见操作

### 新增一个 Tool

1. `mcp/providers/` 下创建 provider（schema + execute）
2. 挂到 `mcp/builtin-mcp.ts` 的 `tools` 数组
3. `ToolCallParser.ts` 的 `SUPPORTED_TOOLS` + `REQUIRED_PARAMS` 注册

Prompt 里的工具文档由 `mcp/schema-generator.ts` 自动生成，不用手写。

### 新增一个内置 Skill

1. 在 `skills/builtin-skills.ts` 追加一条 `Skill`
2. 自动出现在 `>` 弹窗、Agent Tab 启动器卡片、设置里的 Skills 列表

### 新增一个 Agent Tab 的启动入口

emit 事件即可，不要直接操作编辑器：

```ts
agentEventBus.emit('launcher:run-entry', { entryId, userInput, autoSend });
```

`AgentLoopFeature` 负责落地（插 capsule、可选自动发送），成功后回 `launcher:staged`，
编辑器不可用时回 `launcher:failed`。启动器据此提示"先打开一个对话"。

### 修改编辑器交互逻辑

**只改 `quill-editor.ts`**。所有消费者（adapter、engine、renderer、useEditorIntegration）都通过它操作编辑器。

### 修改发送按钮选择器

改 `quill-editor.ts` 里的 `SEND_BUTTON_SELECTOR` 常量。`triggerSend()` 和 `installSendButtonInterceptor()` 都引用它。

---

## 调试技巧

1. 所有日志带 `[AgentLoop]` / `[Renderer]` / `[QuillEditor]` 前缀
2. `useAgentLoopStore.getState()` 查看运行时状态
3. 检查 capsule DOM: `document.querySelectorAll('.bs-prompt-capsule, .bs-agent-result-capsule')`
4. 验证 Quill Delta 是否同步: 在 DevTools 里对比 `.ql-editor` 的 innerHTML 和发送的实际内容
5. 强制停止循环: `getActiveEngine()?.stop()`（只调 store 的 `stop()` 停不掉引擎）
6. 测试 capsule 展开: 手动调用 `expandCapsules(editor, 'bs-prompt-capsule')` 看编辑器内容是否变成真实 prompt

---

## 已知限制 / TODO

| 项目 | 状态 | 说明 |
|------|------|------|
| DB Snapshot / 撤销 | 占位 | `snapshot-manager.ts` 全部返回 false；撤销 UI 已移除，等实现后再加回 |
| sync_conversation_messages | 占位 | 需实现页面导航 + 滚动抓取 |
| settings UI | 未做 | 需在设置面板加 agentLoop 独立开关（现复用 slashCommand） |
| AI Studio 支持 | 未做 | 需写 adapter + entry component |
| 自动继续 | 未做 | 现在每轮仍需用户点「继续」/ 按 Enter，没有 autoContinue 开关 |
| `awaiting_send` 期间发普通消息 | 未处理 | result capsule 消失即视为已发送，用户此时另发消息会被当成继续 |
| `slash-command/capsule.ts` | 废弃 | 已无 import，但文件未删除 |
| SlashCommand `data-` attr | 未加 | 需给 SlashCommandPopup 加 `data-slash-command-popup` |
| Gemini DOM 选择器 | 可能过时 | 需跟随 Gemini UI 更新 |
