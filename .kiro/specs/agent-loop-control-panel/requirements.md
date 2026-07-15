# Requirements Document

## Introduction

Agent Loop Control Panel（Agent 循环控制面板）是现有 Agent Loop 模块的增强型运行时控制界面。它以从 StatusBar 向上展开的轻量 Popover 形式呈现，为用户提供执行策略配置、写操作确认、中途指令注入、执行历史查看、工具管控、速度模式、断点暂停、Token 估算和撤销能力。该面板替代当前的全屏确认弹窗，提供非阻塞、始终可达的交互体验。

## Glossary

- **Control_Panel**: 从 StatusBar 向上展开的 Popover 面板，承载所有运行时控制功能
- **StatusBar**: 现有的浮动状态条组件（AgentLoopStatusBar），显示轮次与状态
- **Agent_Loop_Engine**: 核心循环引擎，管理多轮 AI 工具调用执行
- **Auto_Execute_Mode**: 自动执行模式，读操作无需确认自动执行
- **Speed_Mode**: 极速模式，所有操作（含写操作）均自动批准执行
- **Write_Operation**: 数据修改操作（如 INSERT、UPDATE、DELETE SQL 语句）
- **Read_Operation**: 非数据修改操作（如 SELECT 查询）
- **Pending_Confirmation**: 等待用户确认的写操作请求
- **User_Instruction**: 用户在循环执行过程中输入的中途指导指令
- **Execution_History**: 当前会话中已执行工具的记录列表
- **Tool_Whitelist**: 允许执行的工具集合
- **Tool_Blacklist**: 禁止执行的工具集合
- **Breakpoint_Round**: 用户设定的自动暂停轮次
- **Token_Estimation**: 当前会话的 Token 用量近似估算
- **Snapshot**: 数据库快照，用于撤销恢复

## Requirements

### Requirement 1: 面板 UI 展示与交互

**User Story:** 作为用户，我希望在 Agent Loop 运行时通过点击 StatusBar 展开一个轻量面板，以便随时查看和控制循环执行行为。

#### Acceptance Criteria

1. WHEN 用户点击 StatusBar，THE Control_Panel SHALL 以 Popover 形式从 StatusBar 上方展开显示，展开动画时长不超过 200ms
2. WHEN Control_Panel 处于展开状态且用户点击面板外部区域，THE Control_Panel SHALL 关闭面板
3. WHEN Control_Panel 处于展开状态且用户按下 Escape 键，THE Control_Panel SHALL 关闭面板并将焦点返回至 StatusBar
4. THE Control_Panel SHALL 使用 Radix UI Popover 原语实现，遵循 8px 网格间距系统，z-index 为 99999（高于 StatusBar 的 99998）
5. WHILE Agent_Loop_Engine 状态为 idle，THE Control_Panel SHALL 仅显示设置项（自动执行开关、工具管控、断点设置），隐藏运行时信息
6. WHILE Agent_Loop_Engine 状态为 waiting_ai、parsing、executing 或 sending，THE Control_Panel SHALL 显示完整运行时信息（状态、历史、确认区域、输入框）及设置项
7. WHILE Agent_Loop_Engine 状态为 paused 或 error，THE Control_Panel SHALL 显示运行时信息（状态、历史）及设置项，并突出显示暂停原因或错误消息
8. IF 视口宽度小于 480px，THEN THE Control_Panel SHALL 将面板宽度设为视口宽度减去 32px（两侧各 16px 边距），最小宽度为 320px
9. IF 视口宽度大于或等于 480px，THEN THE Control_Panel SHALL 以固定宽度 480px 显示面板

### Requirement 2: 自动执行开关

**User Story:** 作为用户，我希望能够切换是否对读操作自动执行，以便在需要时对所有操作进行逐一确认。

#### Acceptance Criteria

1. THE Control_Panel SHALL 显示一个"自动执行"开关，首次安装时默认为开启状态，后续状态通过 chrome.storage.local 持久化并在页面重新加载后恢复
2. WHILE 自动执行开关为开启状态，THE Agent_Loop_Engine SHALL 对 Read_Operation 自动执行而无需用户确认
3. WHILE 自动执行开关为开启状态，THE Agent_Loop_Engine SHALL 对 Write_Operation 弹出内联确认请求
4. WHILE 自动执行开关为关闭状态，THE Agent_Loop_Engine SHALL 对所有操作（含读和写）均弹出内联确认请求
5. WHEN 用户切换自动执行开关，THE Agent_Loop_Engine SHALL 从下一个待执行的操作开始按新状态执行，已在执行中的操作不受影响
6. WHILE Speed_Mode 为开启状态，THE Agent_Loop_Engine SHALL 忽略自动执行开关的状态，所有操作均自动批准执行
7. IF chrome.storage.local 持久化写入失败，THEN THE Control_Panel SHALL 在开关旁显示错误提示，并保持开关在当前会话中的内存状态有效

### Requirement 3: 内联写操作确认

**User Story:** 作为用户，我希望写操作确认在控制面板内完成而非全屏遮罩，以便不打断我对整体对话的视野。

#### Acceptance Criteria

1. WHEN 存在 Pending_Confirmation，THE Control_Panel SHALL 在面板内以等宽字体显示待确认 SQL 语句预览（最大高度 200px，溢出可滚动）、Approve 按钮和 Reject 按钮
2. WHEN 用户点击 Approve 按钮，THE Control_Panel SHALL 执行该写操作、清除确认区域并将执行结果发送给 AI 继续循环
3. WHEN 用户点击 Reject 按钮，THE Control_Panel SHALL 取消该写操作、清除确认区域并向 AI 反馈操作被用户拒绝
4. WHILE 存在 Pending_Confirmation，THE Control_Panel SHALL 以不超过 300ms 的展开动画自动展开面板（若当前为收起状态）
5. IF Pending_Confirmation 的 SQL 语句超过 500 字符，THEN THE Control_Panel SHALL 截断显示前 500 字符并提供展开查看完整内容的按钮
6. THE Control_Panel SHALL 替代现有的 AgentLoopConfirmDialog 全屏遮罩弹窗，不再渲染 fixed inset-0 的遮罩层
7. IF 用户点击 Approve 后写操作执行失败，THEN THE Control_Panel SHALL 在确认区域显示错误提示信息并将失败结果反馈给 AI 继续循环

### Requirement 4: 用户中途指令输入

**User Story:** 作为用户，我希望在循环执行过程中向 AI 发送指令来改变执行方向，以便在不终止循环的前提下引导 AI 行为。

#### Acceptance Criteria

1. THE Control_Panel SHALL 在面板底部显示一个支持多行输入的文本输入框，placeholder 为"输入指令引导 AI..."，最大输入长度为 2000 字符
2. WHEN 用户在输入框中输入文本并按 Enter 键（非 Shift+Enter），THE Control_Panel SHALL 将 User_Instruction 作为附加上下文前置注入到下一轮 AI 消息的 capsule 内容中
3. WHEN 用户按下 Shift+Enter，THE Control_Panel SHALL 在输入框中插入换行而不触发发送
4. WHEN User_Instruction 被成功注入，THE Control_Panel SHALL 清空输入框并显示持续 2 秒的发送成功提示
5. IF User_Instruction 注入失败，THEN THE Control_Panel SHALL 保留输入框中的文本内容并显示错误提示告知用户指令未能发送
6. WHILE Agent_Loop_Engine 状态为 idle，THE Control_Panel SHALL 禁用指令输入框
7. IF 用户输入文本达到 2000 字符上限，THEN THE Control_Panel SHALL 阻止继续输入并在输入框附近显示字符数已达上限的提示

### Requirement 5: 执行历史

**User Story:** 作为用户，我希望查看当前会话中已执行的所有工具调用记录，以便追踪 AI 的执行路径和结果。

#### Acceptance Criteria

1. THE Control_Panel SHALL 在面板中显示可折叠的 Execution_History 区域，每条记录包含工具名称、相对执行时间（如"5秒前"）和成功/失败状态图标
2. THE Control_Panel SHALL 按时间倒序排列执行历史，最新记录在顶部，可见区域最多显示 50 条记录并支持滚动查看更早的记录
3. WHEN 用户点击某条历史记录，THE Control_Panel SHALL 展开显示该次执行的详细结果内容；IF 结果内容超过 300 字符，THEN THE Control_Panel SHALL 截断显示并提供"查看完整内容"按钮
4. WHILE Execution_History 为空，THE Control_Panel SHALL 显示"暂无执行记录"的占位提示
5. THE Control_Panel SHALL 显示当前轮次（currentRound）的工具调用数量统计（如"本轮已执行 3 个工具"）
6. WHEN 用户点击 Execution_History 区域的折叠按钮，THE Control_Panel SHALL 收起历史列表仅显示区域标题，再次点击恢复展开状态

### Requirement 6: 工具白名单与黑名单

**User Story:** 作为用户，我希望能禁用特定危险工具，以便限制 AI 在循环中可调用的工具范围。

#### Acceptance Criteria

1. THE Control_Panel SHALL 在可折叠的"工具管控"区域显示所有已注册工具的列表，每个工具旁有启用/禁用 Switch 开关
2. IF Agent_Loop_Engine 尝试执行一个已被禁用的工具，THEN THE Agent_Loop_Engine SHALL 跳过该工具的实际执行，并在执行结果中返回"工具 [tool_name] 已被用户禁用，请使用其他方式完成任务"的明确提示
3. WHEN 用户重新启用某个工具，THE Agent_Loop_Engine SHALL 从下一次调用开始恢复对该工具的正常执行
4. THE Control_Panel SHALL 首次安装时默认启用所有工具，用户的禁用选择通过 chrome.storage.local 持久化并在页面重新加载后恢复
5. WHEN 用户点击"工具管控"区域的折叠按钮，THE Control_Panel SHALL 收起工具列表仅显示区域标题和已禁用工具数量摘要（如"已禁用 2 个工具"）

### Requirement 7: 极速模式

**User Story:** 作为用户，我希望一键开启极速模式以自动批准所有操作，以便在信任 AI 输出时获得最快的执行速度。

#### Acceptance Criteria

1. THE Control_Panel SHALL 显示一个"极速模式"开关
2. WHILE Speed_Mode 为开启状态，THE Agent_Loop_Engine SHALL 自动批准所有操作（包括 Write_Operation），无需用户确认
3. WHILE Speed_Mode 为开启状态，THE Control_Panel SHALL 显示视觉指示器（高亮边框或专属图标），且 StatusBar SHALL 同步显示区别于正常状态的视觉样式（如不同背景色），以提醒用户当前处于无确认模式
4. WHEN 用户首次在当前会话中开启 Speed_Mode，THE Control_Panel SHALL 显示风险提示弹窗，用户确认后方可启用；同一会话内后续开关切换不再重复显示该提示
5. IF 用户在风险提示弹窗中选择取消，THEN THE Control_Panel SHALL 保持 Speed_Mode 为关闭状态且不改变当前执行行为
6. WHEN Speed_Mode 开启时存在 Pending_Confirmation，THE Control_Panel SHALL 自动批准该确认
7. WHEN Agent_Loop_Engine 状态变为 idle，THE Control_Panel SHALL 自动关闭 Speed_Mode 并恢复正常确认流程

### Requirement 8: 断点暂停

**User Story:** 作为用户，我希望设定一个轮次断点使循环到达该轮次时自动暂停，以便在关键节点检查执行状态。

#### Acceptance Criteria

1. THE Control_Panel SHALL 提供一个数字输入框，允许用户设置 Breakpoint_Round（取值范围为当前轮次 + 1 至 maxRounds 的整数），输入不在有效范围内的值时输入框显示校验错误且不保存设置
2. WHEN Agent_Loop_Engine 到达用户设定的 Breakpoint_Round，THE Agent_Loop_Engine SHALL 在该轮次开始处理前暂停循环，在 StatusBar 显示"已到达断点轮次"，并在 Control_Panel 显示"继续执行"按钮
3. WHEN 用户点击"继续执行"按钮，THE Agent_Loop_Engine SHALL 从暂停的轮次恢复循环执行，并清除断点设置
4. WHEN 用户清空断点设置，THE Agent_Loop_Engine SHALL 恢复正常运行不在任何轮次自动暂停
5. WHILE 断点轮次已设置，THE Control_Panel SHALL 在轮次指示器旁显示断点标记，标注目标轮次编号
6. IF 用户设置的 Breakpoint_Round 小于或等于当前轮次，THEN THE Control_Panel SHALL 拒绝该输入并在输入框下方显示提示信息表明断点必须大于当前轮次

### Requirement 9: Token 用量估算

**User Story:** 作为用户，我希望查看当前会话的近似 Token 消耗，以便监控成本和上下文窗口使用情况。

#### Acceptance Criteria

1. THE Control_Panel SHALL 显示当前会话累计 Token_Estimation，统计范围包括 AI 回复文本、工具调用结果、用户指令和基础 Prompt，基于字符数近似计算（英文及非中文字符按 4 字符/token、中文字符按 2 字符/token 逐字符分别估算后求和）
2. WHEN 新的一轮执行完成（Agent_Loop_Engine 完成一次完整的工具调用并收到结果），THE Control_Panel SHALL 更新 Token_Estimation 数值以反映该轮新增的所有文本内容
3. THE Control_Panel SHALL 以紧凑格式显示 Token 数：小于 1000 时显示原始数字（如"~800 tokens"），1000 至 999999 时显示 k 单位保留一位小数（如"~2.3k tokens"），1000000 及以上时显示 M 单位保留一位小数（如"~1.2M tokens"）
4. WHEN 新会话开始时，THE Control_Panel SHALL 将 Token_Estimation 重置为 0 并显示"~0 tokens"

### Requirement 10: 撤销上一步操作

**User Story:** 作为用户，我希望能撤销 AI 最后执行的工具操作，以便在发现错误时快速回退。

#### Acceptance Criteria

1. WHILE 存在已创建的 Snapshot 且 Execution_History 不为空，THE Control_Panel SHALL 显示"撤销上一步"按钮
2. WHEN 用户点击"撤销上一步"按钮，THE Control_Panel SHALL 恢复到最近的 Snapshot 状态，从 Execution_History 中移除最后一条记录，并向 Agent_Loop_Engine 注入一条系统消息通知 AI 该操作已被撤销、相关状态不再有效
3. IF 不存在可用 Snapshot，THEN THE Control_Panel SHALL 禁用撤销按钮并显示 tooltip 说明"无可用快照"
4. WHEN 撤销操作成功执行，THE Control_Panel SHALL 显示持续 3 秒的成功提示
5. IF Snapshot 恢复过程失败，THEN THE Control_Panel SHALL 保留当前状态不变，并显示错误消息指示恢复失败原因
6. WHILE Execution_History 中最后一条记录对应的工具为非数据库写操作（如 export、complete-task），THE Control_Panel SHALL 禁用"撤销上一步"按钮并显示 tooltip 说明"该操作不可撤销"
