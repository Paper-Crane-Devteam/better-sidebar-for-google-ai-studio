

---

## 目录结构

```
src/entrypoints/overlay.content/shared/
├── lib/
│   └── quill-editor.ts            # ★ Quill 编辑器操作统一入口
├── modules/
│   ├── trigger-popup/
│   │   ├── index.ts               # Barrel export
│   │   ├── types.ts               # EditorIntegrationConfig, TriggerPopupItem 等
│   │   ├── useTriggerPopup.ts     # 通用触发检测状态机
│   │   ├── useEditorIntegration.ts # 事件拦截层（import quill-editor）
│   │   └── PopupFooterHints.tsx   # 弹窗底部快捷键提示
│   ├── agent-loop/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── agent-loop-store.ts    # Zustand 运行时状态（非持久化）
│   │   ├── event-bus.ts           # 类型安全事件总线
│   │   ├── useAgentTrigger.ts     # > 前缀检测 hook
│   │   ├── AgentCommandPopup.tsx  # > 弹出选择列表
│   │   ├── AgentLoopStatusBar.tsx
│   │   ├── AgentLoopConfirmDialog.tsx
│   │   ├── adapters/
│   │   │   ├── types.ts           # AgentPlatformAdapter 接口
│   │   │   ├── adapter-factory.ts
│   │   │   └── gemini-adapter.ts  # 调用 quill-editor helper
│   │   ├── engine/
│   │   │   ├── AgentLoopEngine.ts # 核心循环（调用 insertMultipleCapsules）
│   │   │   ├── ToolCallParser.ts
│   │   │   └── circuit-breaker.ts
│   │   ├── renderer/
│   │   │   ├── ConversationRenderer.tsx  # DOM Observer + React Shadow widgets
│   │   │   ├── renderer-styles.ts
│   │   │   ├── constants.ts
│   │   │   └── components/
│   │   │       ├── ToolCallWidget.tsx    # 手动执行按钮（调用 appendCapsule）
│   │   │       ├── StreamingToolWidget.tsx
│   │   │       └── PromptWidget.tsx
│   │   ├── prompts/
│   │   │   ├── base-prompt.ts
│   │   │   ├── built-in-registry.ts
│   │   │   └── utilities/
│   │   └── tools/
│   │       ├── tool-registry.ts
│   │       ├── execute-sql.ts
│   │       └── complete-task.ts
│   └── slash-command/
│       ├── useSlashCommand.ts     # / 前缀检测
│       ├── SlashCommandPopup.tsx
│       └── capsule.ts            # ⚠️ 废弃，不再 import（保留未删除）
```

入口组件：
```
src/entrypoints/overlay.content/gemini/enhanced-features/AgentLoopFeature.tsx
src/entrypoints/overlay.content/gemini/enhanced-features/SlashCommandFeature.tsx
```

---

## 核心执行流程

```
用户输入 ">" → useAgentTrigger 检测 → AgentCommandPopup 弹出
       ↓ 用户选择 prompt（Enter/Tab/点击）
insertCapsuleAtRange() — execCommand + rAF 包裹 <strong>
       ↓ 用户按 Enter 或点发送按钮
onBeforeSend / sendButtonInterceptor:
  读取 capsule 的 data-prompt-content → 拼接完整消息
  adapter.insertText(fullMessage) → adapter.triggerSend()
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
  insertMultipleCapsules() — 结果作为 result capsule    │
       ↓ 用户按 Enter 发送                              │
  useEditorIntegration Enter handler:                   │
    合并 result capsule → replaceAllContent → triggerSend │
       ↓                                               │
  nextRound() → 回到顶部 ─────────────────────────────┘
```

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
- `waitForUserSend()` → MutationObserver 等 result capsule 从编辑器消失
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
- Agent Loop 写操作付费判断在 `execute-sql.ts` 内部

### i18n
- `agentLoop.resultCapsulePrefix` — Result capsule 显示前缀（en: "Result", zh-CN: "结果"）
- 直接用 `i18n.t()` 访问（非 React context），import from `@/locale/i18n`

### 设置系统
- 当前暂用 `enhancedFeatures.gemini.slashCommand` 作为功能开关
- TODO: 添加独立的 `agentLoop` 设置

### SlashCommand 互斥
- AgentLoopFeature 通过 MutationObserver 检测 `[data-slash-command-popup]` 判断 slash 是否活动
- 两个 `useEditorIntegration` 实例共存于同一编辑器，通过 `data-trigger` 区分各自的 capsule

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

1. `tools/` 下创建文件，导出 async function
2. `tool-registry.ts` 添加 case
3. `ToolCallParser.ts` 的 `SUPPORTED_TOOLS` + `REQUIRED_PARAMS` 注册
4. `base-prompt.ts` 添加 tool 文档

### 新增一个内置 Prompt

1. `prompts/utilities/` 下创建文件
2. 导出 `BuiltInPrompt` 对象
3. `built-in-registry.ts` 注册

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
5. 强制停止循环: `useAgentLoopStore.getState().stop()`
6. 测试 capsule 展开: 手动调用 `expandCapsules(editor, 'bs-prompt-capsule')` 看编辑器内容是否变成真实 prompt

---

## 已知限制 / TODO

| 项目 | 状态 | 说明 |
|------|------|------|
| `slash-command/capsule.ts` | 废弃 | 已无 import，但文件未删除 |
| settings UI | 未做 | 需在设置面板加 agentLoop 独立开关 |
| AI Studio 支持 | 未做 | 需写 adapter + entry component |
| Gemini DOM 选择器 | 可能过时 | 需跟随 Gemini UI 更新 |
| SlashCommand `data-` attr | 未加 | 需给 SlashCommandPopup 加 `data-slash-command-popup` |
| DB Snapshot | 占位 | `snapshot-manager.ts` 有接口无实现 |
| sync_conversation_messages | 占位 | 需实现页面导航 + 滚动抓取 |
