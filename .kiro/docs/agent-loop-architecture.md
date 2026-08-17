

---

## 目录结构

三块 UI，职责不重叠：

| 位置 | 角色 | 内容 |
|------|------|------|
| 设置 → Agent | 装备库 | Skills CRUD、MCP 开关（低频、跨会话） |
| Agent Tab（侧边栏） | 起点 | **只有**「怎么开始一个任务」：技能卡 + 自由描述 |
| Agent Dock（贴输入框） | 决策 | 状态一行 + Stop、批准、继续、check-in、中断、结束卡 |
| 聊天流内（renderer） | 内容 | 工具卡片、结果详情、Agent 定制视图 |

判断准则：**聊天流回答"发生了什么"，Dock 回答"我现在要你做什么"，Tab 回答"怎么开始"。**

⚠️ **Agent Tab 永远是同一个样子。** 以前它在「启动器」和「运行状态面板」之间切换，
于是所有决策都藏在两个前提后面：侧边栏是开的 **且** 停在 Agent tab 上。侧边栏一关，
批准请求压根没有可见的出口，引擎就在后台永远挂着等一个用户看不见的按钮。

Tab 唯一对运行中的让步是**启动器变灰**：`start()` 会清空 store，再点一张技能卡等于
把正在跑的会话无声顶掉。以前靠「整个面板被状态面板替换」挡住了，现在必须显式拒绝。

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
│   │   ├── agent-view-store.ts    # ★ 视图 override（持久化：conversationId → 手动选择）
│   │   ├── agent-policy-store.ts  # 执行策略（持久化：autoRunReads / autoRunWrites）
│   │   ├── agent-config-store.ts  # 用户自定义 skill / MCP 开关（持久化）
│   │   ├── execution-policy.ts    # requiresApproval / shouldAutoSend / getToolRisk
│   │   ├── agent-entry.ts         # ★ `>` 列表数据源：auto 条目 + skills
│   │   ├── event-bus.ts           # 类型安全事件总线
│   │   ├── useAgentTrigger.ts     # `>` 前缀检测
│   │   ├── AgentCommandPopup.tsx  # `>` 弹出选择列表
│   │   ├── adapters/              # 平台适配（gemini-adapter 等）
│   │   │   └── response-wait.ts   # ★ ResponseWaitError：timeout / not_delivered
│   │   ├── engine/
│   │   │   ├── index.ts           # ★ 对外唯一出口，别深引 stages/context
│   │   │   ├── AgentLoopEngine.ts # 状态机 + 生命周期（start/stop/resume/continueNow）
│   │   │   ├── context.ts         # ★ LoopContext：store/事件/abort/熔断的门面
│   │   │   ├── engine-registry.ts # ★ 模块级 engine handle（供 Agent Tab 控制）
│   │   │   ├── stages/            # 一轮的四个阶段，顺序即数据流
│   │   │   │   ├── await-response.ts   # ① 等 AI 回复（静默超时 / 没送到 → 两种结局）
│   │   │   │   ├── parse-response.ts   # ② 解析 tool call / 格式事故 nudge / 无 tool 则结束
│   │   │   │   ├── execute-tools.ts    # ③ 执行 + 熔断 + 记账 + 终止信号
│   │   │   │   ├── approval-gate.ts    # ★ awaiting_approval：等卡片/侧边栏放行
│   │   │   │   └── handoff/            # ④ 结果回传（唯一碰 Quill DOM 的地方）
│   │   │   │       ├── index.ts        #   ResultHandoff：staging → 等发送 → 成功/暂停
│   │   │   │       ├── staging.ts      #   capsule 写入 + 落地校验 + 纯文本降级
│   │   │   │       ├── formatter.ts    #   结果 markdown 拼装 / 切段（互为逆运算）
│   │   │   │       └── send-watcher.ts #   ★ 两步确认送达：离开输入框 + 送达正证据
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
│   │   └── tools/                 # execute-sql / export / sync / complete-task
│   ├── agent-tab/                 # 侧边栏 Agent Tab —— 只有启动器，永不变样
│   │   ├── AgentTab.tsx           # 就是 <AgentLauncher />
│   │   └── components/
│   │       └── AgentLauncher.tsx          # 技能卡 + 自由描述任务（运行中变灰）
│   ├── agent-dock/                # ★ 贴在输入框右上角的决策浮层（页面级）
│   │   ├── AgentDock.tsx          # 可见性 / 自动展开 / 会话与对话绑定
│   │   ├── useComposerAnchor.ts   # 轮询输入框 rect（Angular 会换掉节点）
│   │   └── components/
│   │       ├── AgentDockPill.tsx          # ★ 常驻一行：状态 + Stop + speedMode 撤回
│   │       ├── AgentApproval.tsx          # ★ 批准的第二入口（卡片是主场）
│   │       ├── AgentContinuePrompt.tsx    # awaiting_send 的「继续」CTA
│   │       ├── AgentCheckIn.tsx           # ★ 无人值守 20 轮后的例行 check-in（中性，非故障）
│   │       ├── AgentInterruptNotice.tsx   # 暂停 / 报错原因 + Retry
│   │       ├── AgentSessionSummary.tsx    # 结束卡（含 paywall upsell）
│   │       ├── AgentPolicyControls.tsx    # 读自动 / 写自动 / 自动继续（齿轮里，默认折叠）
│   │       └── AgentInstructionInput.tsx  # 中途给 AI 补充说明
│   └── slash-command/             # `/` snippets（与 `>` 互斥）
```

入口组件：
```
src/entrypoints/overlay.content/gemini/enhanced-features/AgentLoopFeature.tsx  # 渲染 <AgentDock />
src/entrypoints/overlay.content/gemini/enhanced-features/SlashCommandFeature.tsx
src/entrypoints/overlay.content/gemini/OverlayPanel.tsx   # 渲染 <AgentTab />
```

⚠️ `<AgentDock />` 挂在 **AgentLoopFeature**（页面级 shadow DOM）而不是侧边栏里 ——
它得在侧边栏关掉时也在。`hidden={triggerState.isOpen}`：`>` 弹窗锚在输入框的同一个角，
两个浮层抢一个位置比暂时看不见 dock 更糟，而输入 `>` 只发生在空闲态，藏起来是安全的。

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
  adapter.observeAIResponseComplete(30s 静默)              │
       ↓ AI 回复完成（静默超时 → pause + return）           │
② stages/parse-response.ts                                │
  status = parsing → parseToolCalls()                     │
  无 tool call：                                           │
    标签未闭合 / JSON 解析失败                              │
      → claimFormatRetry() 成功 → nudge（每会话仅 1 次）    │
      → 预算用尽 → finish('no_tool_call')                  │
    纯散文 → finish('no_tool_call')  ← 会话直接结束         │
       ↓ 有 tool call                                      │
  shouldAutoSend(toolCalls)  ← 在③之前算，见下文            │
       ↓                                                  │
③ stages/execute-tools.ts                                 │
  status = executing，逐个执行                             │
    熔断：重复调用 / 连续失败 → 'halted'（结果仍要回传）     │
      → holdForRetry(payload) + pauseAndEnd                │
    requiresApproval() → approval-gate（卡片放行）          │
      拒绝 → CANCELLED 段落（带理由）→ 下一个 call          │
    complete_task / PAYWALL → finish() + return           │
       ↓                                                  │
④ stages/handoff/ — ResultHandoff.deliver(payload, auto)   │
  stageResults() 把结果写回编辑器（capsule，失败降级纯文本） │
  store.awaitSend(!autoSend)  ← 正常检查点，不是故障         │
  autoSend ? 引擎自己 triggerSend()   ← autoContinue ∩ 无待批准 │
           : 等用户 Enter / Tab 的「继续」                  │
       ↓                                                  │
  waitForSend() → 'sent' → unattendedStreak 记账 → advanceRound() ┘
                → 'still-staged'（没发出去 / 5min 超时）→ pause
                → 'unconfirmed'（输入框空了但没有任何送达迹象）→ pause
```

### 20 轮上限只管无人值守的轮次

`maxRounds`（20）**不是**总轮数上限，而是**连续无人值守轮数**的上限。引擎里一个字段：

```ts
this.unattendedStreak = autoSend ? this.unattendedStreak + 1 : 0;
...
if (this.unattendedStreak >= ctx.maxRounds) {
  ctx.pause(`The agent has run ${n} steps on its own. Continue?`);
  return;
}
```

理由：这个上限存在的意义是**没人看着时别失控**。用户自己按回车的轮次里本来就有人，
让他每 20 轮清一次「步数上限」是纯摩擦——他自己就是刹车。所以手动模式下这个天花板
压根不存在（计数器涨不起来）。

⚠️ **判定用 `shouldAutoSend` 的结果，不要读那三个开关。** 读开关的话 `speedMode`
会漏：用户在批准提示里点了「本次任务不用再问」，`autoRunWrites` 仍然是 `false`，
但会话从那一刻起完全无人值守——而「别再问了」恰恰是想走开的人最可能点的按钮。
只有看「这一轮实际有没有停下来等过人」才盖得住。

⚠️ **是 `ctx.checkIn()`，不是 `pause` 也不是 `pauseAndEnd`。** 达到上限既不是完成
也不是失败，只是问一句「还继续吗」。以前用 `pauseAndEnd` 广播了 `loop:ended`，
文案却写着 "Continue?" —— 对外宣告结束、UI 上却显示可 Retry 的中断卡，三种说法
互相矛盾。现在 `AgentEndReason` 里已经**没有** `max_rounds` 这个值了。

`checkIn` 走 `store.requestCheckIn(steps)`，写 `checkInSteps` 而**不写**
`errorMessage`。`checkInSteps !== null` 是"这次 pause 是 check-in 而不是故障"的
唯一判据，三个地方读它：

| 组件 | 行为 |
|------|------|
| `AgentCheckIn` | 中性配色 + 眼睛图标 +「跑了 N 步」+「继续 / 就停这」 |
| `AgentInterruptNotice` | `checkInSteps !== null` 时**不渲染**，否则两张卡会叠在一起 |
| `AgentDockPill` | 状态文案换成「等你确认」，而不是「已暂停」 |

⚠️ 一个字段兼两个职责（是不是 check-in + 跑了几步）是故意的：check-in 一定带步数，
拆成 `pauseKind` + `steps` 两个字段只会多一种它们不一致的状态。
⚠️ `store.pause()` 会把 `checkInSteps` 清成 null —— check-in 之后真的出故障了，
显示的必须是故障卡。

⚠️ `resume()` 会把 `unattendedStreak` 归零。用户点「继续」就是明确的「继续跑」，
不归零的话下一轮立刻又停。



### 无 tool call = 会话结束，不是失败

Gemini 是被动的：不给它发消息，它永远不会再说话。而 ④ 只在有结果时才发送。所以
「AI 回了一段散文」这件事，唯一诚实的处理是**结束会话**——若循环继续转，①
会去等一个永远不来的回复，60 秒后超时，用户看到的是一次假报错。

`finish` 而不是 `pause`：pause 会给出 Retry，而 Retry 会重新进 ①，等的还是那个
不存在的回复。

唯一的例外是**格式事故**：`hasUnclosedToolBlock()`（流被切断在标签中间）或
`errors.length > 0`（有 `<bs_agent_tool>` 块但 JSON 解析失败）。这不是模型的决定
而是意外，所以熔断器给每个会话 **1 次** 重发机会（`FORMAT_RETRY_BUDGET`）。
两种事故的 nudge 文案分开：告诉它「你忘了格式」会让它从头重写整个回复，
浪费一轮还可能重跑前半段；告诉它「你被截断了」它只补尾巴。

⚠️ 早期版本把「无 tool call」当成任务完成，导致第一轮就报「Task finished」；
后来改成 nudge 两次再兜成提问。现在两者都不做了 —— 靠 `soul.ts` 把
「没有 tool call 的回复会直接终止任务」写成最硬的一条约束来防。

阶段之间只通过 `LoopContext` 通信；**任何自己已经 pause / finish 过的阶段都返回
一个 stop 型结果**，循环见到就直接 return，不重复判断。

`ResultHandoff` 是唯一有状态的阶段：它记着「已 staged 但还没确认发出」的 payload。
`resume()` 靠这个决定是先补发上一轮结果还是直接进下一轮 —— 少了它，Retry 会去等一个
根本没发出去的消息的回复，表现为卡到 60s 超时。

### 怎么判断「AI 回复完了」

`gemini-adapter.observeAIResponseComplete()`。主信号是**按钮的边沿**,不是电平:

```
每 400ms 采样一次
  按钮 === 'stop'         → sawGenerating = true，续命，return
  没有新一轮 且 没见过 stop 且 按钮 'absent' 且 已过 5s
                          → reject('not_delivered')  ← 压根没送到，等下去没意义
  没有新一轮               → 归零，return（还在看开始等待前的那一轮）
  文本变了                 → 归零，续命，return
  文本没变                 → stableTicks++
                             SETTLE_TICKS(2)：见过 stop，或按钮已消失
                             BLIND_SETTLE_TICKS(5)：按钮读不出来，纯靠文本
tick 开头统一查一次 deadline，超了 reject('timeout')
```

「新一轮」= 存在回复元素 且 文本非空 且 (元素 ≠ baseline 或 文本 ≠ baseline)。

**为什么必须是边沿而不是电平**:引擎是点完发送之后才开始等的,那一瞬间 Gemini 还没把
按钮翻成 stop。所以"按钮读到 send"在任何事情发生之前就是 true —— 按电平判断会立刻
resolve,拿到**上一轮**的回复。

文本采样降级成两个职责:

| 职责 | 怎么做 |
|------|--------|
| 防拿到上一轮 | `baselineElement` / `baselineText`,文本必须和开始等待时不同 |
| 按钮失灵时兜底 | `getSendButtonState()` 是四级降级(`gem-icon-button.stop` → `mat-icon[fonticon]` → `aria-label`/`mattooltip` → 容器 class),Gemini 改一次可能全落空返回 `'unknown'`。这时 `sawGenerating` 一直是 false,判定退化成纯文本稳定,阈值从 2 提到 5(约 2 秒),因为没有权威信号背书,得熬过流式输出中途的停顿 |

### `absent` ≠ `unknown`

`SendButtonState` 有四个值，其中这两个含义**相反**，早期版本把它们并成一个 `'unknown'`：

| 值 | 含义 | 可信度 |
|----|------|--------|
| `stop` | 正在生成 | 权威 |
| `send` | 输入框里有内容，可以发 | 权威 |
| `absent` | DOM 里压根没有这个按钮 | **权威**：Gemini 只在输入框有内容或有回合在跑时才渲染它，所以「没有」= 没在生成 且 没人在输入 |
| `unknown` | 找到按钮了但四级降级全认不出 | **完全不可信**：选择器丢了 |

⚠️ 实测：发送被接受的那一瞬间按钮**直接翻成 stop**，慢网速下也一样，不存在「点完之后按钮短暂消失」的空窗。所以 `absent` 不需要为「刚点完还没起来」留额外的宽限；5 秒的 `IDLE_DELIVERY_GRACE_MS` 只是为了盖住我们自己那次点击和 Angular 的重渲染。

`absent` 在 ① 里有两个用途：

- **加速完成判定**：有新一轮 + 按钮消失 = 回合结束，`stableTicks` 阈值走 2 而不是 5。这条覆盖「我们开始等的时候已经错过 stop 边沿」。
- **判定没送到**：没有新一轮 + 从没见过 stop + 按钮消失 → `reject('not_delivered')`。见下。

### 「AI 没回复」和「消息没送到」是两回事

`observeAIResponseComplete` 用 `ResponseWaitError` 带一个 `kind` 拒绝
（`adapters/response-wait.ts`）：

| kind | 现实 | 文案 / 行为 |
|------|------|------------|
| `timeout` | 有回合在跑（或读不出来），然后静默烧完预算 | 「AI 30 秒没回复」+ Retry |
| `not_delivered` | 页面明确静止且这一轮压根没开始 | 「消息没送到」+ Retry **重发** |

`awaitAIResponse` 返回 `AwaitOutcome`（`response` / `stalled` / `undelivered`），
`not_delivered` **故意不在阶段里 pause** —— 只有引擎知道自己手上还有没有可以重发的
payload，而这决定了话该怎么说、Retry 又该干什么（`engine.reportUndelivered()` →
`handoff.rearmLastDelivered()` → pause）。

⚠️ 别把 `not_delivered` 也说成「AI 没回复」。用户会去 Gemini 那边找问题，而实际上消息
根本没离开输入框；更糟的是 Retry 会重新进 ①，等的还是那个不存在的回复，看起来就是
「点 Retry 没反应」。

边沿之后还要等 2 个采样,是因为**按钮翻转 ≠ 渲染完成**:按钮跟的是流式请求结束,而
Gemini 还要渲染 markdown 和代码块。在翻转那一刻读文本可能拿到没渲染完的尾巴,
然后被当成完整回复解析 —— 这正是历史上「resolve 在半截回复上,里面没 tool call,
第一轮就报 Task finished」那个 bug。

⚠️ **超时是"静默"预算,不是整轮预算。** 任何证明这一轮还活着的迹象(文本在变、
按钮读到 stop)都会把 deadline 往后推。所以 Pro 开 thinking 想十分钟再写五分钟完全
没问题。原来是 60s 整轮硬超时,长回复会在**正常生成中途**被掐掉并报"AI 响应超时",
那是 bug 不是设计。

⚠️ **但超时不能删。** 完成信号真的可能永远不来:Gemini 报错/限流时压根不会有回合
完成;`getSendButtonState()` 退化成 `unknown` 且回复元素也拿不到时同理。没有超时的话
引擎会永远停在 `waiting_ai` 转圈,用户只能点 Stop 而且不知道为什么。

⚠️ **为什么是轮询而不是 MutationObserver。** 要判断的是"文本不再变化",而"什么都没
发生"MutationObserver 天生观测不到,必须有时钟。既然时钟是刚需,顺手在同一个 tick 里
读按钮成本是零。而且历史上试过 debounced MutationObserver:Gemini 流式输出中途会停顿
超过 500ms,debounce 一到就误判成完成。另外按钮节点会被 Angular **整个换掉**,
observer 绑上去就成了聋子,还得再起个定时器检查绑的是不是当前节点 —— 绕回定时器。

已删的死代码:`STREAMING_VETO_TICKS` 常量、`adapter.isStreaming()`(实现就是
`getSendButtonState() === 'stop'`,在原来的判定里上一行已经 return 过,条件恒为
false;唯一的外部消费者是已删掉的 ask-user-gate)。需要这个信号直接用
`getSendButtonState()`。

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
| 引擎自动继续（`autoSend`） | on | 给 DOM 留渲染时间，同时避免固定节奏被风控 |
| 用户按 Enter / 点发送 / 点「继续」 | off | 用户已经表达意图，额外延迟只会像卡住 |

这个按钮状态同时也是 ① 判断回复完成的主信号，见上文。

⚠️ 「无 tool call」不等于任务完成。协议要求以 `complete_task` 结束，所以没有工具调用
只说明 AI 忘了格式或在闲聊 —— 早期版本把它当成 complete，导致任务第一轮就报「Task finished」。

### 怎么确认「消息真的送到了」——两步，不是一步

`send-watcher.ts` 的 `waitForSend()` 返回 `SendOutcome`：

```
① 等 payload 离开输入框     MutationObserver（编辑器 + 父节点，SPA 会换掉编辑器）
     ↓ 没离开 → 'still-staged'
② 等送达的正证据（最多 4s）  按钮读到 'stop'  或  user-query 条数变多
     ↓ 都没有 → 'unconfirmed'
   'sent'
```

⚠️ **只有第①步是不够的**，这是历史上最贵的一个 bug。输入框变空**也是**消息被悄悄丢掉
时的样子：staging 自己打自己、SPA 导航重建编辑器、Gemini 报错清空输入。只看第①步会把
这些全判成成功，`pending` 被清掉、轮次照常推进，然后 ① 去等一个不存在的回复，30 秒后
报「AI 没回复」，而 Retry 会再等 30 秒。

⚠️ **两个证据里 `countUserTurns()` 更硬。** 按钮的 `stop` 是瞬时的，回合结束就没了；
而 `<user-query>` 只可能因为消息真的落地才出现，而且**不会消失**。所以它对「答得太快，
我们看的时候已经结束了」同样成立。`adapter.countUserTurns()` 是接口方法，用
`document.querySelectorAll('user-query')` 而不是在滚动容器里查 —— 容器会被 SPA 换掉，
查不到会被读成「零条」，也就是一次不存在的失败。

⚠️ **送达 ≠ 会有回答。** Gemini 可以收下消息然后什么都不产出（限流、错误 toast）。
所以 `ResultHandoff` 除了 `pending` 还留了一份 `lastDelivered`，`rearmLastDelivered()`
把它放回 `pending`，这才让「没送到」那一档的 Retry 真的会重发。第 1 轮没有这份东西
（那是用户自己发的 prompt，handoff 没见过），文案会退化成「自己在输入框重发一次」。

### 状态语义（重要）

`awaiting_send` 必须和 `paused` 分开，UI 依赖这个区分。
另外 `awaitingUserSend` 把 `awaiting_send` 又切成两半 —— **每一轮都会经过这个状态**，
包括引擎自己发的那些，所以只看 status 的 UI 会在无人值守的整个跑动过程中每轮闪一次
「要你按回车」：

| status | 含义 | Dock 呈现 |
|--------|------|----------|
| `awaiting_approval` | 某个 tool call 等你放行 | 卡片高亮 + Dock 里一份 |
| `awaiting_send` + `awaitingUserSend` | 每轮正常结束，结果在输入框等**你**发 | 「继续」CTA |
| `awaiting_send` + `!awaitingUserSend` | 同上，但引擎马上自己点发送 | **什么都不显示** |
| `paused` + `checkInSteps !== null` | 无人值守跑够 20 轮，例行 check-in | 中性卡 + 继续 / 就停这 |
| `paused` | 超时 / 断点 / 熔断 | 原因 + Retry / Dismiss |
| `error` | 引擎异常 | 原因 + Retry / Dismiss |

会话结束时 `endReason` 记录原因（`complete` / `infeasible` / `user_stop` /
`circuit_breaker` / `paywall` / `no_tool_call`），
`AgentSessionSummary` 据此决定显示完成卡、"做不到"说明还是升级引导。
注意里面**没有** `max_rounds` —— 见下文，那是 check-in 不是结束。

### 一轮回复只有两种合法结尾

| 结尾 | 工具 | 引擎行为 |
|------|------|----------|
| 继续干活 | 任意工具 | 执行 → 结果回传 |
| 结束 | `complete_task`（`status`: success / partial / infeasible） | `finish()` |

没有第三种。AI 需要用户判断时唯一的出路是 `complete_task('infeasible')` 把缺什么
说清楚 —— 那会留在结束卡上，用户看得到。

⚠️ 曾经有过 `ask_user`（`awaiting_user` 状态 + 三路 race + bonusRounds + 侧边栏
问答面板 + 散文提问兜底），整套删掉了。它要求引擎在等回复的同时观测「用户是不是
直接在聊天框答了」，为此背了 `carryOver`（问题前已产出但没送出的结果）、
`observed`（回复已经生成完，① 的 baseline 会等一个已发生的回合）、
以及提问不占 `maxRounds` 的额度豁免 —— 三个机制都只为这一条路径存在。

### 写确认这一条闸

`requiresApproval()` 是唯一的用户闸门：宿主发起，问的是"这条操作允许落地吗"，
用户可以关（`autoRunReads` / `autoRunWrites` / `speedMode`）。

拒绝时 AI 拿到的是带理由的 `CANCELLED:` 段落，并附一句"不要原样重试" ——
只回一个 `CANCELLED:` 的话，AI 最可能原样再发一次然后撞上 `checkRepeatedToolCall`。

### 没有 token 估算，也没有耗时统计

都删掉了。`tokenEstimation` / `estimateTokens` / `formatTokenCount` 从来没有任何 UI
在读，是纯死代码；耗时（`sessionStartedAt` + `useElapsedTime` + `tool:executed` 的
`durationMs`）除了在 header 上跳个秒数没有别的用途。

⚠️ 别顺手删 `ToolCallResult.timestamp` / `ExecutedCall.timestamp` —— 那两个是**记录
顺序**用的，`AgentSessionSummary` 靠 history 顺序倒着找最后一条 `complete_task`。

### UI 如何控制引擎

engine 实例在 `AgentLoopFeature` 里创建，Stop / Retry / 继续 的按钮在 Dock 里。
两者通过 `engine/engine-registry.ts` 的模块级 handle 连接：

```ts
setActiveEngine(engine);            // AgentLoopFeature 创建时
getActiveEngine()?.stop();          // Dock 的 Stop
getActiveEngine()?.resume();        // Dock 的 Retry（paused | error 可用）
getActiveEngine()?.continueNow();   // Dock 的「继续」→ triggerSend()
```

批准是唯一的例外：决定通过 `pendingApproval.resolve(decision)` 回给引擎，不走
engine 方法。

⚠️ 只改 store 不叫 engine 是无效的：engine 持有自己的 abortController 和
`waitForUserSend()` promise。历史上 Stop 只改 store，引擎会在后台继续跑。

### Dock 什么时候出现、什么时候自己展开

```
可见 = (status !== 'idle' || endReason !== null)   ← 有会话
       且 会话属于当前对话
       且 不在 `>` 弹窗打开时
展开 = 有待决策 ? 用户没手动折叠 : 齿轮打开
```

⚠️ 箭头按钮的行为跟着上面这条分叉：有决策时它折叠决策，没有决策时它开关那组开关。
两种情况都接 `collapsed` 的话，整个跑动过程里它是个死控件 —— 没有待决策，点几次都不出东西。

⚠️ **不能做成「只有待决策才出现」。** `speedMode`（「本次任务别再问了」）一开，就再也
不会有任何东西需要决策 —— 那 Stop 和「撤回 speedMode」的入口会一起消失，跑飞了没法刹车。
所以常驻一行 `AgentDockPill`，Stop 和那个闪电图标都在上面，不在折叠区里。

⚠️ **自动展开靠 `decisionKey` 而不是布尔量。** 用布尔量的话：批准完一个写操作、下一个
接着问，dock 仍然是折叠的，一个活着的问题被藏在收起的箭头后面。key 里带上
`pendingApproval.fingerprint` / `checkInSteps`，换了一个决策就重新展开。

⚠️ **dock 在两次会话之间是 `return null` 而不是卸载**，所以 `settingsOpen` / `collapsed`
得自己清，否则下一个任务开场就带着上一次拉开的抽屉。

⚠️ 步骤列表（原 `AgentExecutionHistory`）**已删除**。它和聊天流里的工具卡片是同一份信息，
而卡片长在那条 SQL 旁边、带真实输出、刷新还在（`tool-outcomes.ts` 从对话里读回来），
侧边栏那份是内存里的、刷新就没。`AgentCheckIn` 里原来写「往下看看」的文案也跟着改成指向聊天流。

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

### 历史卡片的状态从对话里读回来，不落盘

`executedCalls` 只认识**当前这个 tab 里正在跑的会话**：`start()` 会清空它，刷新页面也没了。
所以以前打开旧对话，每张卡片都写着「未执行」—— 而那次调用的输出就在下面一条消息里。

真正的历史记录是**结果消息本身**。④ 把结果作为一条真实的 user 消息发回给 AI
（`<bs_agent_result>` … `### label` … body），所以对话 DOM 就是持久层。比落盘一份账本好两点：
覆盖得到在别的浏览器里跑过、或者这个功能上线之前的会话；而且它带着真实输出而不只是一个 boolean。

```
renderer/helpers/tool-outcomes.ts   ← engine/stages/handoff/formatter.ts 的逆运算
  parseToolResults()    拆出 ### 段落
  deriveToolOutcomes()  把 model 轮的 tool calls 和下一条 user 消息的段落对齐
```

对齐规则：**先按 label，位置只作兜底**。label 就是 `description || name`，和
`formatter.section()` 写 header 用的是同一个表达式，正常都能命中。但 description 是 AI 写的，
可能重复；而且这一轮可能多出一条不属于任何 call 的 `### ⚠️ Loop Warning` 段落 ——
纯按位置的话它后面全部错一位，所以只在**条数相等**时才信位置。

对不上就是 `null`（显示「未执行」）。在一个真的跑过的调用上写「未执行」，比在一个没跑过的
调用上写「已执行」要小的谎。

卡片的取值顺序是 `executedCalls[fingerprint] ?? derivedOutcome`：账本是第一手的，而且知道
那些结果从没进过消息的调用；其余情况由对话回答，刷新之后它是唯一的来源。

⚠️ `formatResults` 的语法常量（`RESULTS_HEADER` / `SECTION_SEPARATOR` /
`PARSE_ERRORS_HEADER` / `USER_INSTRUCTION_HEADER`）从 `formatter.ts` **import**，不要重打一遍。
两头一漂，症状是所有卡片悄悄退回「未执行」。

⚠️ `isolateSections()` 要先切掉 `## User Instruction` 前缀块和 `## Parse Errors` 尾块。
直接对整个 payload 按分隔符 split 会把它们当成伪段落，条数一变，位置兜底就跟着错。

⚠️ 成功/失败用 `body.startsWith('ERROR:' / 'CANCELLED:')` 判，不要用多行搜索 —— 查询自己的
输出里完全可以出现 ERROR 这个词，只有第一行是判词。递进错误提示是**追加在结果后面**的，
所以前缀不受影响。

⚠️ 卡片只存在于 **custom 渲染视图**，用户可以中途切回 Gemini 原生渲染；而且长回复里
卡片会被滚出屏幕。所以 `AgentApproval` 在 Dock 里留了第二份，同一个 `resolve`，谁先答
谁算。不然切回原生视图就找不到批准的地方，引擎会一直挂着。

⚠️ 这一份**曾经在侧边栏**，那是最差的位置：侧边栏可以整个关掉，也可能停在别的 tab 上，
两种情况下批准都无处可答。Dock 贴着输入框，永远在。

⚠️ 审批门在**引擎**里，不在工具里。以前 `execute-sql` 自己调
`requestUserConfirmation` —— 工具去开 UI，而且请求里只有 SQL 字符串，没有任何东西
能说清"这是哪一次调用"，所以批准只能是一个转述式的独立弹窗，没法长在卡片上。

### 会话与对话的绑定

store 是全局单例，所以 `start()` 会记下 `sessionConversationId`。
`AgentDock` 只在 session 属于当前对话时显示；离开该对话且已 idle 时自动 `reset()`。
新对话里启动的会话一开始没有 id（`null` 视为属于当前对话），发出第一条消息拿到 id 后
由 `attachSessionConversation()` 认领 —— 结束之后也要认领，否则一个没绑定的会话会
跟着用户出现在每个对话里。

### 用哪个视图：推导出来的，不是记下来的

`viewMode`（运行时 store）是**现在屏幕上是什么**；`agent-view-store` 的
`overrides[conversationId]` 是**用户手动选过什么**。两者分开，因为默认值是推导的：

```ts
desired = override ?? (hasAgentContent || isRunning ? 'custom' : 'original')
```

`hasAgentContent` 直接看当前对话 DOM 里有没有 prompt marker / tool call / tool result。
所以刷新页面、切回旧对话都会自动进 Agent 视图 —— 依据就在页面上，常见情况什么都不用记。

⚠️ 以前是「conversationId 变化且 idle → 强制 original」。刷新（null → id）和打开旧对话
走的是同一条路径，于是**每次**都得手动点一下切换按钮，哪怕页面里明摆着是 agent 对话。

⚠️ 只有「用户亲手覆盖」才落盘。在一个 agent 对话上切回原生视图是关于**这个对话**的
决定，下次刷新又跳回去会像按钮没生效。所以 override 一条一条按对话存，只在点按钮时写。

⚠️ `hasAgentContent` 必须进 effect 的依赖：mount 时它是 false，DOM 解析完（一两个 tick 后）
才变 true。

⚠️ **清 override 在 `agent-loop-store.start()` 里，不在组件的 effect 里。** 之前那条
「给我看原生 DOM」是为了读历史，现在要跑任务了，它就过期了。放在 `start()` 里是因为
那儿本来就已经在设 `viewMode: 'custom'` —— 同一个决定放一处。写成组件里的第二个 effect
会和「应用 override」那个 effect 抢同一帧，视图先闪一下 original 再跳回 custom。

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

### 工具失败：错误必须回到 AI 手里

失败的 tool result 和成功的走**完全同一条路**——拼成 `### 段落` 进 `results`，
经 ④ 回传给 AI。`getProgressiveErrorGuidance()` 还会按连续失败次数追加递进提示
（第 1 次「分析错误换个写法」，第 2 次「查 sqlite_master 确认表名」，第 3 次
「必须换方法」）。这是 agent 能自我纠错的唯一机制。

⚠️ 唯一的例外是熔断硬停（连续 6 **轮**失败 / 同一调用 5 次），而这里曾经有个 bug：
`breakCircuit()` 把攒好的 `results` **直接丢掉**然后 pause。后果是双重的——AI 永远
不知道错在哪，而且 `resume()` 看到 `handoff.hasPending() === false` 就直接进 ①，
去等一个**根本没发出去的消息**的回复，静默超时 30 秒后再 pause。用户看到的就是
「SQL 失败 → 卡住 → 点 Retry 没反应」。

现在的形状：

```
③ 返回 { kind: 'halted', results, reason }   ← 区别于 'ended'（complete/paywall，不欠东西）
     ↓
引擎 handoff.holdForRetry(payload)          ← 只记住，不写进输入框
     ↓
ctx.pauseAndEnd(reason, 'circuit_breaker')
     ↓ 用户点 Retry
resume() → hasPending() → resend()          ← 此时才 stage + 发送
        → advanceRound() → 继续跑
```

⚠️ `holdForRetry` **故意不碰输入框**。写进去的话，循环已经 paused 而输入框里躺着
一段文本，用户很自然会按回车——消息发出去了，但没有引擎在等那个回复。`resend()`
自己会在需要时补 stage（`if (!isStagedInEditor()) stageResults(...)`）。

⚠️ `resume()` 会 `breaker.reset()`。用户是看过问题才点的 Retry，不重置的话下一次
失败立刻又触发硬停，Retry 只买到一次工具调用。`maxRounds` 仍然兜着上限，而且每次都
要人点一下，不存在失控。

⚠️ 失败预算按**轮**算,不按调用算(`beginRound()` + `roundFailureCounted`)。一次回复
最多 5 条 SQL,列名猜错的话会一起失败——那是**一个**错误看了五遍,AI 还没机会读到
任何一条。按调用算的话,一个误解就能在第一轮把整个预算烧光(旧的硬阈值是 4,四条
全错当场熔断)。阈值 6 给了 5 轮递进提示的空间,`getProgressiveErrorGuidance` 才有
机会真的起作用。⚠️ 成功时除了归零计数,还要清掉 `roundFailureCounted` —— 否则
「失败→成功→失败」这一轮里第二次失败会被当成"已经算过了"而完全不计数。

⚠️ `executeToolCall()` 用 try/catch 兜住**所有**异常并转成 `ERROR: ...` 字符串。
工具如果抛异常而不是返回 ERROR，异常会一路冲到引擎顶层的 catch，`ctx.fail()`
把会话打成 `error` 且没有 pending，Retry 又是同一个挂法——一个失败的步骤不该有这种
杀伤力。`execute-sql` 自己 catch 了，但别的 provider 不保证。

### 拒绝要带理由

只回一个 `CANCELLED:`，AI 不知道为什么，最可能原样再试一次然后撞上
`checkRepeatedToolCall`。所以 `ApprovalDecision` 是 `{ approved, scope, reason? }`
而不是 boolean，理由会拼进回传给 AI 的 `CANCELLED:` 段落里，并附一句
"不要重试同一条语句，改方案或者 complete_task('infeasible')"。

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

### 谁按发送 —— `shouldAutoSend()`

两个**独立**的输入取交集，都说 yes 才自动发：

| 输入 | 尺度 | 问的是 |
|------|------|--------|
| `autoContinue`（持久化，默认开） | 长期偏好 | 我愿不愿意让它无人值守地跑 |
| 本轮有没有调用需要批准 | 单轮事实 | 这一轮有没有东西已经停下来问过我 |

```ts
export function shouldAutoSend(toolCalls: ParsedToolCall[]): boolean {
  if (!isUnattendedAllowed()) return false;                    // 长期偏好
  return !toolCalls.some((call) => requiresApproval(call));    // 本轮事实
}
```

混合轮次（两条 SELECT 加一条 UPDATE）只有一次发送机会，规则是**只要有一个需要批准
就交给用户**——"我刚点完批准它就自己发出去了"比多按一次回车更让人意外。

⚠️ **必须是交集，不能是替代。** `autoSend = autoContinue` 单独用会让开关和批准闸门
互相矛盾：手动批准了一个写操作，结果照样自己飞出去。取交集之后，这个开关只可能让事情
**更手动**，不可能更自动。曾经有一版因为看着像重复把 `autoContinue` 删了，是误判——
它补的是推导覆盖不到的需求：**想盯着每一步再放行，但不想为每条 SELECT 点一次确认**。
打开读批准是重得多的闸门，表达不了这个。

⚠️ `shouldAutoSend` 必须在 ③ **之前**算。`requiresApproval` 会读
`approveRestOfRound`，而③执行到一半时用户可能点了「本轮全部执行」把它设成 true；
事后再问，一个被用户逐条走过的轮次会被判成无人值守然后自己发出去。

⚠️ 格式事故的 nudge 走 `isUnattendedAllowed()`（只看长期偏好）——它是我们自己的
消息，没有"本轮"可看，但「关掉就是每次都我按回车」这个承诺对它也得成立。

工具级开关走 MCP（`mcpRegistry.isToolEnabled`），不要再引入第二套 `disabledTools`。

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
| 用户消息轮次 | `user-query`（送达证据，见「两步确认送达」） |
| 对话容器 | `infinite-scroller.chat-history` |
| 生成中 | `gem-icon-button.send-button.stop`（`aria-busy` / `message-actions[hidden]` 在当前版本不存在，已删） |
| 静止（没在生成、输入框空） | 发送按钮**整个不在 DOM 里** → `getSendButtonState() === 'absent'` |
| 暗色主题 | `localStorage: Bard-Color-Theme === 'Bard-Dark-Theme'` |

---

## 开发常见操作

### 新增一个 Tool

1. `mcp/providers/` 下创建 provider（schema + execute）
2. 挂到 `mcp/builtin-mcp.ts` 的 `tools` 数组
3. `engine/parser/tool-schema.ts` 的 `SUPPORTED_TOOLS` + `REQUIRED_PARAMS` 注册
4. 如果它是控制循环而不是干活的（像 `complete_task`），加进 `ENGINE_ONLY_TOOLS`
   —— 否则消息卡片上会出现批准按钮，而这类工具没有什么可批准的

Prompt 里的工具文档由 `mcp/schema-generator.ts` 自动生成，不用手写。schema 的
`description` 就是 AI 唯一读到的说明，协议约束也写在那儿。

⚠️ 光加 schema 不足以让 AI 用它 —— Gemini 对长 prompt 尾部的遵循度不稳。所以
真正的硬约束写在 `soul.ts` 的「How a Response Must End」里，而不是塞在 schema
描述末尾。现在没有运行时 nudge 兜底了（除了格式事故那一次），prompt 是唯一的防线。

### 新增一个内置 Skill

1. 在 `skills/builtin-skills.ts` 追加一条 `Skill`
2. 自动出现在 `>` 弹窗、Agent Tab 启动器卡片、设置里的 Skills 列表

### 新增一个启动入口

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
3.5. 手动放行挂起的批准: `useAgentLoopStore.getState().pendingApproval?.resolve({ approved: true, scope: 'once' })`
4. 验证 Quill Delta 是否同步: 在 DevTools 里对比 `.ql-editor` 的 innerHTML 和发送的实际内容
5. 强制停止循环: `getActiveEngine()?.stop()`（只调 store 的 `stop()` 停不掉引擎）
6. 测试 capsule 展开: 手动调用 `expandCapsules(editor, 'bs-prompt-capsule')` 看编辑器内容是否变成真实 prompt

---

## 已知限制 / TODO

| 项目 | 状态 | 说明 |
|------|------|------|
| DB Snapshot / 撤销 | 占位 | `snapshot-manager.ts` 全部返回 false；撤销 UI 已移除，等实现后再加回 |
| sync_conversation_messages | 已做 | `tools/sync/`：job 存 `chrome.storage.local`，每次页面加载由 `resumeSyncRun()` 续跑；滚动目标是 `chat-window infinite-scroller`（同 SmartScrollbar），往上滚到高度不再变为止。选不到该元素时降级为 `no-scroller`，只录打开时那一页，entry 记 `partial`。未在真实长对话上验证过 |
| handoff 工具 | 已做 | `HANDOFF_TOOLS`（目前只有 sync）：调用成功即结束 session，因为页面会被导航走。approval 强制要问一次，见 `requiresApproval()` |
| settings UI | 未做 | 需在设置面板加 agentLoop 独立开关（现复用 slashCommand）；`AgentPolicyControls` 那三个持久开关按理也该搬过去，现在暂居 Dock 的齿轮里 |
| AI Studio 支持 | 未做 | 需写 adapter + entry component |
| 自动继续 | 已做 | `autoContinue` 开关（默认开）∩ 本轮批准情况，见 `shouldAutoSend()` |
| `awaiting_send` 期间发普通消息 | 未处理 | capsule 消失 + 出现新的 user 轮次即视为已发送，用户此时另发消息会被当成继续 |
| 送达确认 | 已做 | 两步：离开输入框 + `stop` 按钮或 `user-query` 增加，见上文 |
| 手动发送等待 5min 上限 | 未处理 | `autoSend: false` 时 `waitForSend()` 仍有 5 分钟超时，用户离开太久会 pause（可 Retry 补发，不丢数据） |
| ① 的超时 | 已做 | 改成 30s **静默**超时（原来是 60s 整轮硬超时，会误杀长回复）。见下文 |
| `slash-command/capsule.ts` | 废弃 | 已无 import，但文件未删除 |
| SlashCommand `data-` attr | 未加 | 需给 SlashCommandPopup 加 `data-slash-command-popup` |
| Gemini DOM 选择器 | 可能过时 | 需跟随 Gemini UI 更新 |
