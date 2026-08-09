

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
│   │   ├── agent-policy-store.ts  # 执行策略（持久化：autoRunReads / autoRunWrites / autoContinue）
│   │   ├── agent-config-store.ts  # 用户自定义 skill / MCP 开关（持久化）
│   │   ├── execution-policy.ts    # requiresApproval / getToolRisk / token 估算
│   │   ├── agent-entry.ts         # ★ `>` 列表数据源：auto 条目 + skills
│   │   ├── event-bus.ts           # 类型安全事件总线
│   │   ├── useAgentTrigger.ts     # `>` 前缀检测
│   │   ├── AgentCommandPopup.tsx  # `>` 弹出选择列表
│   │   ├── adapters/              # 平台适配（gemini-adapter 等）
│   │   ├── engine/
│   │   │   ├── index.ts           # ★ 对外唯一出口，别深引 stages/context
│   │   │   ├── AgentLoopEngine.ts # 状态机 + 生命周期（start/stop/resume/continueNow）
│   │   │   ├── context.ts         # ★ LoopContext：store/事件/abort/熔断的门面
│   │   │   ├── engine-registry.ts # ★ 模块级 engine handle（供 Agent Tab 控制）
│   │   │   ├── stages/            # 一轮的四个阶段，顺序即数据流
│   │   │   │   ├── await-response.ts   # ① 等 AI 回复（超时 → pause）
│   │   │   │   ├── parse-response.ts   # ② 解析 tool call / nudge / 散文提问兜底
│   │   │   │   ├── execute-tools.ts    # ③ 执行 + 熔断 + 记账 + 终止信号
│   │   │   │   ├── approval-gate.ts    # ★ awaiting_approval：等卡片/侧边栏放行
│   │   │   │   ├── ask-user-gate.ts    # ★ awaiting_user：三路 race（Tab / 聊天框 / abort）
│   │   │   │   └── handoff/            # ④ 结果回传（唯一碰 Quill DOM 的地方）
│   │   │   │       ├── index.ts        #   ResultHandoff：staging → 等发送 → 成功/暂停
│   │   │   │       ├── staging.ts      #   capsule 写入 + 落地校验 + 纯文本降级
│   │   │   │       ├── formatter.ts    #   结果 markdown 拼装 / 切段（互为逆运算）
│   │   │   │       └── send-watcher.ts #   观测「已发出」：MutationObserver + abort
│   │   │   ├── guards/
│   │   │   │   ├── circuit-breaker.ts  # 重复调用 / 连续失败 / 无进展
│   │   │   │   └── abort.ts            # AbortToken + AbortError
│   │   │   └── parser/
│   │   │       ├── index.ts            # parseToolCalls
│   │   │       ├── tool-schema.ts      # ★ SUPPORTED_TOOLS / REQUIRED_PARAMS
│   │   │       └── fallbacks.ts        # Gemini 吞格式时的兜底解析
│   │   ├── renderer/              # 聊天流内的定制渲染 + 工具卡片
│   │   ├── prompts/               # soul.ts + prompt-assembler.ts
│   │   ├── skills/                # builtin-skills + skill-registry
│   │   ├── mcp/                   # MCP registry + providers（工具真正的注册处）
│   │   └── tools/                 # execute-sql / export / sync / ask-user / complete-task
│   ├── agent-tab/                 # 侧边栏 Agent Tab（UI 层）
│   │   ├── AgentTab.tsx           # 启动器 or 会话面板（按对话隔离）
│   │   ├── useElapsedTime.ts
│   │   └── components/
│   │       ├── AgentLauncher.tsx          # 空闲态：技能卡 + 自由描述任务
│   │       ├── AgentStatusPanel.tsx       # 会话态容器
│   │       ├── AgentStatusHeader.tsx      # 状态 / 步数 / 耗时 / Stop·Retry
│   │       ├── AgentContinuePrompt.tsx    # awaiting_send 的「继续」CTA
│   │       ├── AgentUserPrompt.tsx        # ★ awaiting_user：问题 + 选项 + 自由输入
│   │       ├── AgentApproval.tsx          # ★ 批准的侧边栏镜像（卡片够不着时的退路）
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
① stages/await-response.ts                                │
  status = waiting_ai                                     │
  adapter.observeAIResponseComplete(60s)                  │
       ↓ AI 回复完成（超时 → pause + return）              │
② stages/parse-response.ts                                │
  status = parsing → parseToolCalls()                     │
  无 tool call  → circuitBreaker.recordNoToolResponse()   │
                  nudge（第 1 次，文案含 ask_user 三选一）  │
                  截断（未闭合标签）→ 专用 nudge            │
                  第 2 次 → 散文当问题 → ask-user-gate     │
       ↓ 有 tool call                                      │
③ stages/execute-tools.ts                                 │
  status = executing，逐个执行                             │
    熔断：重复调用 / 连续失败 → pauseAndEnd                 │
    requiresApproval() → approval-gate（卡片放行）          │
      拒绝 → CANCELLED 段落（带理由）→ 下一个 call          │
    ask_user → 跳过其后调用 → ask-user-gate                │
    complete_task / PAYWALL → finish() + return           │
       ↓                                                  │
③.5 stages/ask-user-gate.ts（仅当有问题时）                │
  status = awaiting_user，三路 race：                      │
    Tab 回答   → 答案进 ④ 的 payload                       │
    聊天框回答 → 已送达，跳过 ④ 直接 advanceRound          │
    abort     → return                                    │
  grantBonusRound()：提问不占 maxRounds                    │
       ↓                                                  │
④ stages/handoff/ — ResultHandoff.deliver()               │
  stageResults() 把结果写回编辑器（capsule，失败降级纯文本） │
  status = awaiting_send  ← 正常检查点，不是故障            │
  autoContinue ? 引擎自己 triggerSend()                    │
               : 等用户 Enter / Tab 的「继续」              │
       ↓                                                  │
  waitForSend() → true → ctx.advanceRound() ─────────────┘
                → false（没发出去 / 5min 超时）→ pause
```

阶段之间只通过 `LoopContext` 通信；**任何自己已经 pause / finish 过的阶段都返回
一个 stop 型结果**，循环见到就直接 return，不重复判断。

`ResultHandoff` 是唯一有状态的阶段：它记着「已 staged 但还没确认发出」的 payload。
`resume()` 靠这个决定是先补发上一轮结果还是直接进下一轮 —— 少了它，Retry 会去等一个
根本没发出去的消息的回复，表现为卡到 60s 超时。

### 发送按钮：send 与 stop 是同一个按钮

Gemini 用同一个按钮承担「发送」和「停止生成」，class 和 disabled 状态都一样，
只能靠 `mat-icon` 文本 / `aria-label` / 容器 class 区分 —— 见 `getSendButtonState()`。
生成中点它 = 掐掉这一轮回答，而不是发消息，这会让 agent loop 直接丢一整轮。

所以 `triggerSend()` 有三层保护：

1. 等 150ms 让 Quill 把输入变更 flush 进 Delta
2. 轮询等按钮离开 stop 态（`waitForSendState`，上限 120s）
3. `humanDelay` 时随机停 0.8–2s，**点击前再查一次状态** —— 这段延迟里图标完全可能翻回 stop

返回值是「有没有真的点下去」。被拒绝时引擎会 pause 并说明原因，而不是继续空等回复。

| 调用方 | humanDelay | 原因 |
|--------|-----------|------|
| 引擎自动继续（autoContinue） | on | 给 DOM 留渲染时间，同时避免固定节奏被风控 |
| 用户按 Enter / 点发送 / 点「继续」 | off | 用户已经表达意图，额外延迟只会像卡住 |

`isStreaming()` 也把按钮状态作为最强信号：按钮是 stop 就一定没生成完，这一票
没有 grace 上限；DOM 启发式（`aria-busy`、`message-actions[hidden]` 等）可能
锁在过期节点上，所以只允许否决有限轮次（`STREAMING_VETO_TICKS`）。

⚠️ 「无 tool call」不等于任务完成。协议要求以 `complete_task` 结束，所以没有工具调用
只说明 AI 忘了格式或在闲聊 —— 早期版本把它当成 complete，导致任务第一轮就报「Task finished」。

### 状态语义（重要）

两个"等用户"的状态都必须和 `paused` 分开，UI 依赖这个区分：

| status | 含义 | Tab 呈现 |
|--------|------|----------|
| `awaiting_approval` | 某个 tool call 等你放行 | 卡片高亮 + 侧边栏镜像 |
| `awaiting_send` | 每轮正常结束，结果已在输入框待发送 | 「继续」CTA |
| `awaiting_user` | AI 调了 `ask_user`，等一个只有人能给的决策 | 问题 + 选项 + 自由输入 |
| `paused` | 超时 / 断点 / 熔断 / 达上限 | 原因 + Retry / Dismiss |
| `error` | 引擎异常 | 原因 + Retry / Dismiss |

会话结束时 `endReason` 记录原因（`complete` / `infeasible` / `user_stop` /
`max_rounds` / `circuit_breaker` / `paywall`），`AgentSessionSummary` 据此决定显示
完成卡、"做不到"说明还是升级引导。

### 一轮回复只有三种合法结尾

| 结尾 | 工具 | 引擎行为 |
|------|------|----------|
| 继续干活 | 任意工具 | 执行 → 结果回传 |
| 要用户决策 | `ask_user` | `awaiting_user`，本轮不回传直到拿到答案 |
| 结束 | `complete_task`（`status`: success / partial / infeasible） | `finish()` |

其余情况都是故障，由 nudge 兜。⚠️ 尤其注意**散文提问**：AI 在回复末尾问"要执行吗？"
而没有 tool call 时，用户根本没有回答的通道 —— nudge 文案会点名 `ask_user`，
第二次仍不改就把那段回复整体当成问题交给用户，而不是报"AI 卡住了"。

### ask_user 与写确认是两条正交的闸

两者会同时存在，这是设计意图，不是重复：

| | 谁发起 | 问什么 | 能否关 |
|---|---|---|---|
| `ask_user` | AI | 该做什么（选哪个方案） | 不能 |
| `requiresApproval` | 宿主 | 这条操作允许落地吗 | 能（`autoRunReads` / `autoRunWrites` / `speedMode`） |

⚠️ `ask_user` 对执行策略**零影响**，不设任何"已批准"标记去放行后续写操作 ——
否则 AI 问的和实际发出的 SQL 不一致时就成了安全洞。用户觉得被问两遍时的出路是
批准提示里的「本次任务不用再问」。`AgentApproval` 在本会话问过问题后会加一句
说明，让两层可辨识。

### 提问的预算

- `ask_user` 轮**不占 `maxRounds`**（`ctx.grantBonusRound()`）：有人在环，不存在
  失控烧 token，占额度只会让 AI 问两次就没预算干正事
- 因此另设 `MAX_ASK_USER_PER_SESSION = 5` 作为刹车，超了工具返回 ERROR 让 AI
  自己决断或 `complete_task('infeasible')`
- 熔断对 `ask_user` 单独用阈值 2（通用是 3/5）：params 完全相同说明它没读用户的回答

### Agent Tab 如何控制引擎

engine 实例在 `AgentLoopFeature` 里创建，但 Stop / Retry / 继续 的按钮在侧边栏。
两者通过 `engine/engine-registry.ts` 的模块级 handle 连接：

```ts
setActiveEngine(engine);            // AgentLoopFeature 创建时
getActiveEngine()?.stop();          // Tab 的 Stop
getActiveEngine()?.resume();        // Tab 的 Retry（paused | error 可用）
getActiveEngine()?.continueNow();   // Tab 的「继续」→ triggerSend()
```

`awaiting_user` 是唯一的例外：答案通过 `pendingQuestion.resolve(answer)` 回给引擎
（和 `pendingConfirmation` 同一套路），不走 engine 方法。但**「Stop task」按钮仍必须
叫 `engine.stop()`** —— 只 resolve(null) 会让引擎继续跑下一轮。

⚠️ 只改 store 不叫 engine 是无效的：engine 持有自己的 abortController 和
`waitForUserSend()` promise。历史上 Tab 的 Stop 只改 store，引擎会在后台继续跑。

### 只有一条执行路径：引擎执行，卡片批准

**引擎是唯一执行工具的东西。** 消息卡片上的按钮不执行任何东西 —— 它是引擎那个
`await` 的回答入口。

```
execute-tools 逐个处理 tool call
  requiresApproval(call)?
    否 → 直接执行
    是 → stages/approval-gate.ts
           status = awaiting_approval
           store.pendingApproval = { fingerprint, toolName, params, risk, remaining, resolve }
           ↓ 等 resolve（卡片 / 侧边栏 / abort）
         批准 → 执行
         拒绝 → 生成 CANCELLED 段落（带用户理由）回传，继续下一个 call
```

卡片靠 `pendingApproval.fingerprint === 自己的 fingerprint` 判断"轮到我了"，
所以批准就发生在你正在读的那条 SQL 旁边。

批准范围三档，在提问那一刻选，不是设置项：

| 范围 | 效果 | 存哪 |
|------|------|------|
| `once` | 只这一条 | — |
| `round` | 本次回复剩下的都放行 | `approveRestOfRound`（`nextRound()` 清零） |
| `task` | 本次任务全放行 | `speedMode`（会话级） |

`round` 这档是必需的：一次回复经常带好几条 SELECT，一条条批是会让人干脆把整个
保护关掉的那种摩擦。

**之前是两条路径**：引擎自动执行，以及卡片上的「执行」按钮自己跑一遍工具、把结果
`appendCapsule` 到输入框让用户手动发送。为了让两条路不撞同一个操作，需要
`executedCalls` 指纹账本做去重、引擎 busy 时禁用按钮、而且仍有 check-then-act
竞态（引擎是执行**完**才写指纹）。合成一条之后这些全部消失，
`renderer/helpers/tool-executor.ts` 整个删掉。

`executedCalls` 保留但降级为**纯展示** —— 卡片用它显示「已执行 / 执行失败 / 已拒绝」。

⚠️ 卡片只存在于 **custom 渲染视图**，用户可以中途切回 Gemini 原生渲染。所以
`AgentApproval` 在侧边栏留了一份镜像，同一个 `resolve`，谁先答谁算。不然切回去
就找不到批准的地方，引擎会一直挂着。

⚠️ 审批门在**引擎**里，不在工具里。以前 `execute-sql` 自己调
`requestUserConfirmation` —— 工具去开 UI，而且请求里只有 SQL 字符串，没有任何东西
能说清"这是哪一次调用"，所以批准只能是一个转述式的独立弹窗，没法长在卡片上。

### 会话与对话的绑定

store 是全局单例，所以 `start()` 会记下 `sessionConversationId`。
`AgentTab` 只在 session 属于当前对话时显示；离开该对话且已 idle 时自动 `reset()`。

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

- `ToolCallWidget` 不执行任何东西，只负责显示状态和承接批准
  （`pendingApproval.fingerprint` 匹配时亮起）
- 结果 capsule 由引擎的 `stages/handoff/staging.ts` 写入，
  显示格式 `Result: {description}`（i18n key: `agentLoop.resultCapsulePrefix`）


---

## 与现有系统的集成点

### 拒绝要带理由

`ask_user` 被拒时 AI 拿到的是用户的完整回答，能改方案；执行层如果只回一个
`CANCELLED:`，AI 不知道为什么，最可能原样再试一次然后撞上 `checkRepeatedToolCall`。
所以 `ApprovalDecision` 是 `{ approved, scope, reason? }` 而不是 boolean，
理由会拼进回传给 AI 的 `CANCELLED:` 段落里，并附一句"不要重试同一条语句"。

### 数据库层
- `@/shared/db` 的 `runQuery(sql)` 和 `runCommand(sql)` 通过 message passing 与 Web Worker 通信
- Worker 使用 `@subframe7536/sqlite-wasm`，存储在 OPFS 或 IndexedDB

### 付费系统
- `@/shared/lib/license-store.ts` — `LicenseTier`: `'support_pack' | 'power_pack' | 'pro' | 'none'`
- 免费版只能读；写操作在 `execute-sql.ts` 里拦，返回 `ERROR: PAYWALL - ...`
- 引擎识别到 PAYWALL → `stop('paywall')` → `AgentSessionSummary` 显示升级引导
  （之前 endReason 被丢弃，付费拦截和正常完成在 UI 上没有区别）

### 执行策略（谁需要批准）

`execution-policy.ts` 的 `requiresApproval()`，从宽到窄依次短路：

```
speedMode（本次任务全放行，会话级）
  → approveRestOfRound（本轮全放行，每轮清零）
    → getToolRisk(call) === 'write' ? !autoRunWrites : !autoRunReads
```

两个持久化开关，一个工具类别一个：

| 开关 | 默认 | 管什么 |
|------|------|--------|
| `autoRunReads` | 开 | 查询不用问 |
| `autoRunWrites` | **关** | 改数据不用问（撤销还是占位实现，所以默认关） |

`getToolRisk()` 只把**修改数据的 SQL** 算作 write。`export` / `sync` 有副作用但不动
数据库，压在写开关下面只会训练用户去打开它。

之前是 `autoExecuteReads` 一个布尔加会话级 `speedMode` 硬凑三态：关掉"自动运行读操作"
实际是**所有**操作都要确认，而 `speedMode` 会盖掉它、开关却还显示关着。
`agent-policy-store` 有 v0→v1 迁移把老值映射过来（老的 `false` → 两个都关）。

工具级开关走 MCP（`mcpRegistry.isToolEnabled`），不要再引入第二套 `disabledTools`。

### i18n
- `agent.ask.*` — awaiting_user 的问题面板
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
3. `engine/parser/tool-schema.ts` 的 `SUPPORTED_TOOLS` + `REQUIRED_PARAMS` 注册
4. 如果它是控制循环而不是干活的（像 `ask_user` / `complete_task`），加进
   `ENGINE_ONLY_TOOLS` —— 否则消息卡片上会出现一个「执行」按钮，手动点会制造一个
   没有引擎在等的悬空状态

Prompt 里的工具文档由 `mcp/schema-generator.ts` 自动生成，不用手写。schema 的
`description` 就是 AI 唯一读到的说明，协议约束（比如"必须是本轮最后一个调用"）
也写在那儿。

⚠️ 光加 schema 不足以让 AI 用它。真正起作用的是三层叠加：schema 文档 +
`soul.ts` 的硬约束 + **运行时 nudge 点名**。第三层最关键 —— Gemini 对长 prompt
尾部的遵循度不稳，但在失败当场被告知"你可以调 X"几乎必然照做。

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
3.5. 手动回答挂起的问题: `useAgentLoopStore.getState().pendingQuestion?.resolve('执行')`
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
| 自动继续 | 已做 | `agentPolicyStore.autoContinue`（持久化，默认开）→ 引擎每轮自己点发送；关掉则停在 `awaiting_send` 等用户 |
| `awaiting_send` 期间发普通消息 | 未处理 | result capsule 消失即视为已发送，用户此时另发消息会被当成继续 |
| `awaiting_user` 期间在聊天框回答 | 已做 | `ask-user-gate` 观测按钮翻回 stop（主）或最后一条回复文本变化并稳定（备）；备用路径会把已完成的回复直接交给 ② 解析，因为 ① 的 baseline 会等一个已经发生过的回合 |
| `awaiting_user` 遇到刷新 | 未处理 | `pendingQuestion` 不持久化，等待可能长达几十分钟，刷新概率比其他状态高得多；问题还在聊天记录里但引擎已死，用户答了没人接。计划：`sessionStorage` 存 `{ conversationId, round, question }`，Tab 启动时提示 |
| `slash-command/capsule.ts` | 废弃 | 已无 import，但文件未删除 |
| SlashCommand `data-` attr | 未加 | 需给 SlashCommandPopup 加 `data-slash-command-popup` |
| Gemini DOM 选择器 | 可能过时 | 需跟随 Gemini UI 更新 |
