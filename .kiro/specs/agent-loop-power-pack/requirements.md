# Requirements Document

## Introduction

Agent Loop 是 Better Sidebar 插件的 Power Pack（付费）新功能。该功能允许用户在 Gemini Web App 中通过 `>` 前缀触发内置 prompt，启动一个多轮自动执行循环（Agent Loop）。AI 可通过特殊 tag 标记的 tool 调用操作插件的本地 SQLite 数据库，实现对话管理、分类、导出等自动化任务。插件自动解析 AI 输出中的 tool 调用、执行操作、将结果回填并继续对话，直到任务完成。

## Glossary

- **Agent_Loop**: 多轮自动执行循环。AI 输出 tool 调用 → 插件执行 → 结果回填 → 继续对话，循环直至无 tool 调用
- **Built_In_Prompt**: 内置 prompt，用户不可编辑，通过 `>` 前缀触发，包含 AI 对话风格、table schema、tool 列表、交互注意事项
- **Tool_Call_Tag**: AI 输出中用于标记 tool 调用的特殊 XML-like tag（如 `<tool_call>...</tool_call>`）
- **DOM_Parser**: 动态解析 Gemini 页面 DOM 以检测 AI 输出中 Tool_Call_Tag 的模块
- **Trigger_Prefix**: `>` 字符前缀，用于触发内置 prompt 列表（区别于 `/` 触发用户自定义 prompt）
- **Power_Pack**: 付费功能层级，解锁 Agent_Loop 等高级功能
- **DB_Snapshot**: 数据库快照备份，在变更操作前自动创建，用于数据回退
- **Execution_Result**: tool 执行后的结果数据，以文本形式回填到用户对话框
- **SQLite_WASM_DB**: 基于 @subframe7536/sqlite-wasm 的本地 SQLite 数据库，存储对话、文件夹、标签等数据
- **Gemini_Platform**: Google Gemini Web App (gemini.google.com)

## Requirements

### Requirement 1: 触发前缀检测

**User Story:** As a Power Pack 用户, I want to 输入 `>` 前缀触发内置 prompt 列表, so that 我可以快速启动 Agent Loop 任务。

#### Acceptance Criteria

1. WHEN 用户在 Gemini 输入框中键入 `>` 字符且该字符位于行首或前方仅有空白字符, THE Trigger_Prefix 检测器 SHALL 显示 Built_In_Prompt 选择列表，列表最多展示 8 条条目
2. WHILE Built_In_Prompt 选择列表处于显示状态, THE Trigger_Prefix 检测器 SHALL 响应键盘上下箭头键循环移动高亮选中项，并在用户按下 Enter 或 Tab 键时确认当前高亮项为选择结果
3. WHEN 用户继续在 `>` 后输入文字, THE Trigger_Prefix 检测器 SHALL 以大小写不敏感的方式将输入拆分为空格分隔的关键词，仅显示标题中包含全部关键词的 Built_In_Prompt 条目
4. IF 用户在 `>` 后输入的过滤文字无任何匹配结果, THEN THE Trigger_Prefix 检测器 SHALL 关闭 Built_In_Prompt 选择列表
5. WHEN 用户在已有的 `/` 斜杠命令 prompt 列表中, THE Trigger_Prefix 检测器 SHALL 不显示任何 Built_In_Prompt 条目（内置 prompt 与用户自定义 prompt 完全隔离）
6. WHILE 用户正在使用 `/` 斜杠命令模式, THE Trigger_Prefix 检测器 SHALL 忽略 `>` 字符输入，保持斜杠命令模式不切换
7. WHILE Built_In_Prompt 选择列表处于显示状态, IF 用户按下 Escape 键或输入框失去焦点, THEN THE Trigger_Prefix 检测器 SHALL 关闭 Built_In_Prompt 选择列表并保留输入框中已输入的文本

### Requirement 2: 内置 Prompt 管理

**User Story:** As a 开发者, I want to 管理内置 prompt 的定义和内容, so that AI 获得正确的上下文来操作插件数据。

#### Acceptance Criteria

1. THE Built_In_Prompt 系统 SHALL 包含一个 base prompt，内容包括：AI 对话风格指令、SQLite_WASM_DB 的完整 table schema（conversations、messages、folders、tags、conversation_tags、favorites、gems、notebooks 及其全部字段定义）、可用 tool 列表及每个 tool 的名称与参数说明、交互注意事项
2. THE Built_In_Prompt 系统 SHALL 包含至少 3 个 utility prompt（包括"自动分类对话"、"查找无消息记录的对话"、"导出对话"），每个 utility prompt 以 base prompt 完整内容作为前缀并在其后追加该任务的具体指令
3. WHEN 用户通过 `>` 前缀选择一个 Built_In_Prompt 并输入具体需求, THE Built_In_Prompt 系统 SHALL 按照 [base prompt] + [utility prompt 任务指令] + [用户输入文本] 的固定顺序拼接为一条完整消息，总长度不超过 30000 字符，并发送给 Gemini AI
4. THE Built_In_Prompt 系统 SHALL 在 base prompt 内容中定义 Tool_Call_Tag 的格式规范，规范包括：标签起止标记符号、tool 名称字段、参数键值对结构，使 AI 的所有 tool 调用输出均使用该统一格式
5. IF 合并后的完整消息超过 30000 字符, THEN THE Built_In_Prompt 系统 SHALL 截断用户输入部分至限制以内，并向用户显示输入被截断的提示信息
6. THE Built_In_Prompt 系统 SHALL 将内置 prompt 标记为不可见，使其不出现在用户的常规 prompt 列表中，仅通过 `>` 前缀触发可用

### Requirement 3: Tool 调用解析

**User Story:** As a 插件系统, I want to 从 AI 输出中解析 tool 调用, so that 可以自动执行对应操作。

#### Acceptance Criteria

1. WHEN AI 消息的 DOM 节点在 500ms 内无新增子节点变化, THE DOM_Parser SHALL 判定该消息输出完成并扫描该消息 DOM 中所有匹配 Tool_Call_Tag 格式的元素
2. WHEN DOM_Parser 检测到一个或多个合法 Tool_Call_Tag, THE DOM_Parser SHALL 从每个 tool 调用元素中提取 tool 名称和参数键值对，并返回包含所有合法调用的有序列表，单条消息最多解析 20 个 tool 调用
3. IF Tool_Call_Tag 缺少 tool 名称、或其必需参数（execute_sql 需要 `query`；sync_conversation_messages 需要 `conversation_ids`；export 需要 `ids` 和 `format`）缺失, THEN THE DOM_Parser SHALL 跳过该 tool 调用，不将其纳入 tool 调用列表，并在 Execution_Result 中记录包含 tool 名称与缺失字段的错误描述
4. IF Tool_Call_Tag 位于 `<code>` 或 `<pre>` 元素内部, THEN THE DOM_Parser SHALL 忽略该元素，不将其视为可执行的 tool 调用
5. IF 所有检测到的 Tool_Call_Tag 均不合法或均位于代码块内, THEN THE DOM_Parser SHALL 返回空的 tool 调用列表，Agent_Loop 视为本轮无 tool 调用而停止循环
6. THE DOM_Parser SHALL 支持解析以下 tool 类型：execute_sql、sync_conversation_messages、export，遇到未识别的 tool 名称时按 Criterion 3 的错误处理逻辑跳过并记录

### Requirement 4: execute_sql Tool

**User Story:** As a AI Agent, I want to 执行 SQL 语句操作本地数据库, so that 可以查询和修改对话管理数据。

#### Acceptance Criteria

1. WHEN execute_sql 接收到 SELECT 类型的 SQL 语句, THE execute_sql 执行器 SHALL 在 SQLite_WASM_DB 上执行查询并返回最多 1000 行的结果集作为 Execution_Result，若实际结果超过 1000 行则截断并在 Execution_Result 中附加截断提示
2. WHEN execute_sql 接收到非 SELECT 类型的 DML 语句（INSERT、UPDATE、DELETE）, THE execute_sql 执行器 SHALL 先展示包含待执行 SQL 语句内容的确认对话框，等待用户确认后再执行
3. WHERE 用户在设置中关闭了"变更确认"选项, THE execute_sql 执行器 SHALL 仅对非 SELECT 的 DML 语句跳过确认对话框直接执行（SELECT 语句始终直接执行，不受此设置影响）
4. IF execute_sql 执行过程中发生 SQL 错误, THEN THE execute_sql 执行器 SHALL 将错误信息作为 Execution_Result 返回给 AI
5. WHEN execute_sql 成功执行非 SELECT 语句, THE execute_sql 执行器 SHALL 在 Execution_Result 中包含受影响的行数
6. IF execute_sql 接收到 DDL 语句（DROP、ALTER、CREATE）或危险操作语句（PRAGMA、ATTACH、DETACH）, THEN THE execute_sql 执行器 SHALL 拒绝执行并在 Execution_Result 中返回错误信息指明该语句类型不允许执行
7. IF 用户在确认对话框中点击取消, THEN THE execute_sql 执行器 SHALL 不执行该 SQL 语句，并在 Execution_Result 中返回指明用户已取消执行的信息

### Requirement 5: sync_conversation_messages Tool

**User Story:** As a AI Agent, I want to 同步指定对话的消息记录, so that 数据库中包含完整的对话内容供后续分析。

#### Acceptance Criteria

1. WHEN sync_conversation_messages 接收到包含 1 至 50 个对话 external_id 的数组, THE sync_conversation_messages 执行器 SHALL 依次导航至 gemini.google.com/app/{external_id} 打开每个对应的 Gemini 对话页面
2. WHILE sync_conversation_messages 正在处理某个对话, THE sync_conversation_messages 执行器 SHALL 反复滚动页面直至连续两次滚动后未出现新消息或达到 120 秒超时，并将所有已加载的消息（role、content、message_type、order_index、timestamp）写入 SQLite_WASM_DB 的 messages 表
3. IF 某条消息的 id 已存在于 messages 表中, THEN THE sync_conversation_messages 执行器 SHALL 跳过该消息而不重复插入
4. WHEN sync_conversation_messages 完成所有对话的同步, THE sync_conversation_messages 执行器 SHALL 返回包含成功对话数、失败对话数、新增消息总数的同步结果摘要作为 Execution_Result
5. IF sync_conversation_messages 处理某个对话 ID 时页面导航失败或对话不存在（页面返回 404 或无消息容器）, THEN THE sync_conversation_messages 执行器 SHALL 在 Execution_Result 的失败列表中记录该 external_id 及失败原因，并继续处理下一个对话
6. IF 单个对话的滚动加载达到 120 秒超时, THEN THE sync_conversation_messages 执行器 SHALL 将已加载的消息写入数据库，并在 Execution_Result 中将该对话标记为部分同步

### Requirement 6: export Tool

**User Story:** As a AI Agent, I want to 导出指定对话, so that 用户可以获得对话数据文件。

#### Acceptance Criteria

1. WHEN export 接收到对话 ID 数组（最多 50 个）和导出类型参数（Markdown、Plain Text 或 JSON 三选一）, THE export 执行器 SHALL 为每个有效对话 ID 生成对应格式的导出文件，并通过浏览器下载触发文件保存到用户系统
2. WHEN export 完成导出, THE export 执行器 SHALL 返回 Execution_Result，包含每个对话 ID 的导出状态（成功时包含文件名和文件大小，失败时包含失败原因）
3. IF export 处理某个对话 ID 时该对话在数据库中不存在, THEN THE export 执行器 SHALL 在 Execution_Result 中将该 ID 标注为导出失败并注明"对话不存在"，同时继续处理数组中其余对话 ID 的导出
4. IF export 处理某个对话 ID 时该对话存在但无已同步的消息记录, THEN THE export 执行器 SHALL 在 Execution_Result 中将该 ID 标注为导出失败并注明"无消息数据，需先执行 sync_conversation_messages"
5. WHEN export 接收到包含多个对话 ID 的数组且多个对话导出成功, THE export 执行器 SHALL 为每个对话分别生成独立的导出文件并逐一触发下载

### Requirement 7: 自动执行循环

**User Story:** As a Power Pack 用户, I want to Agent Loop 自动执行多轮对话, so that 复杂任务无需手动干预即可完成。

#### Acceptance Criteria

1. WHEN 一轮中所有 tool 调用均已返回结果（无论成功或失败）, THE Agent_Loop SHALL 将所有 Execution_Result 按调用顺序格式化为文本，程序化插入 Gemini Quill 编辑器并触发发送按钮点击
2. WHEN AI 的新一轮回复流式传输完成且回复内容中不包含任何 Tool_Call_Tag, THE Agent_Loop SHALL 停止自动执行循环，将控制权归还用户
3. WHILE Agent_Loop 正在运行, THE Agent_Loop SHALL 在界面上展示非阻塞式执行状态指示器，显示当前轮次编号（如"第 3/20 轮"）和当前正在执行的 tool 名称
4. WHEN 用户点击"停止"按钮, THE Agent_Loop SHALL 等待当前正在执行的 tool 调用完成后停止循环，不再自动发送下一轮消息，并将已收集的结果展示给用户
5. IF Agent_Loop 连续执行达到 20 轮, THEN THE Agent_Loop SHALL 自动暂停循环并展示提示询问用户是否继续执行（防止无限循环）
6. IF 在等待 AI 回复过程中超过 60 秒未检测到回复完成，或发生网络错误、Gemini 速率限制错误, THEN THE Agent_Loop SHALL 暂停自动循环，向用户展示错误指示信息，并提供"重试"与"停止"选项
7. WHEN 用户在循环暂停状态下点击"重试", THE Agent_Loop SHALL 重新发送上一轮的 Execution_Result 并恢复自动执行循环

### Requirement 8: 数据库快照与回退

**User Story:** As a 用户, I want to 数据库操作前自动创建快照, so that 意外数据损坏时可以回退。

#### Acceptance Criteria

1. WHEN Agent_Loop 即将执行第一条写操作类型（INSERT、UPDATE、DELETE、DROP、ALTER）的 SQL 语句, THE DB_Snapshot 管理器 SHALL 在该语句执行前阻塞执行队列并创建当前数据库的完整快照（通过 db.dump() 导出二进制），快照创建完成后方可继续执行原 SQL 操作
2. THE DB_Snapshot 管理器 SHALL 在设置界面中按创建时间倒序展示快照列表，每条记录包含创建时间（精确到秒）和触发原因（触发的 SQL 语句摘要，最长 120 字符）
3. THE DB_Snapshot 管理器 SHALL 保留最多 10 个快照，当快照数量达到上限时，自动删除最早的快照后再创建新快照
4. WHEN 用户在设置界面中选择某个快照并确认回退操作, THE DB_Snapshot 管理器 SHALL 使用该快照的二进制数据通过 IMPORT 流程恢复 SQLite_WASM_DB，恢复完成后自动刷新当前页面以重新加载数据（不支持自动回退，必须由用户主动触发）
5. IF 快照创建过程中发生存储写入失败（包括 OPFS 或 IndexedDB 空间不足）, THEN THE DB_Snapshot 管理器 SHALL 中止快照创建，向用户展示错误提示说明存储空间不足，并提供两个选项：清理旧快照后重试、或跳过快照直接执行原 SQL 操作
6. IF 用户触发回退操作但恢复过程失败（文件写入错误或数据损坏）, THEN THE DB_Snapshot 管理器 SHALL 保留当前数据库状态不变，并向用户展示包含失败原因的错误信息

### Requirement 9: 付费墙控制

**User Story:** As a 产品负责人, I want to 区分免费和付费功能访问, so that Power Pack 有明确的商业价值。

#### Acceptance Criteria

1. THE 付费墙 SHALL 允许免费用户触发 `>` 前缀、查看 Built_In_Prompt 列表、并执行只读操作（SELECT 查询），使其可预览 AI 生成的查询计划但不可执行写入
2. IF 免费用户尝试执行写入操作（INSERT、UPDATE、DELETE）, THEN THE 付费墙 SHALL 阻止操作执行，并在 500 毫秒内展示升级提示对话框，该对话框须包含被阻止的功能名称及 Power_Pack 解锁后可获得的能力说明
3. IF 免费用户尝试使用 sync_conversation_messages 或 export tool, THEN THE 付费墙 SHALL 阻止操作执行，并展示升级提示对话框，该对话框须包含被阻止的功能名称及 Power_Pack 解锁后可获得的能力说明
4. WHERE 用户已订阅 Power_Pack, THE 付费墙 SHALL 解锁写入操作（INSERT、UPDATE、DELETE）、sync_conversation_messages 及 export tool 的完整执行权限
5. IF 付费墙在执行操作前无法在 5 秒内验证订阅状态, THEN THE 付费墙 SHALL 阻止该操作执行，并向用户展示提示信息指明订阅状态无法验证且建议稍后重试
6. WHEN 用户的 Power_Pack 订阅到期或被撤销, THE 付费墙 SHALL 在下一次写入操作尝试时恢复免费用户限制，已保存的数据不受影响

### Requirement 10: 平台限制

**User Story:** As a 用户, I want to 明确了解功能支持范围, so that 我不会在不支持的平台上尝试使用。

#### Acceptance Criteria

1. WHILE detectPlatform() 返回的当前平台不是 Platform.GEMINI, THE Agent_Loop SHALL 不初始化且不渲染任何 Agent Loop 相关 UI 组件（包括 `>` 前缀检测器、Agent Loop 面板、状态指示器）
2. WHEN 用户在非 Gemini_Platform（即 Platform 为 AI_STUDIO、CHATGPT、CLAUDE 或 UNKNOWN）上输入 `>` 字符作为消息开头, THE 系统 SHALL 将其作为普通文本字符处理，不触发任何 Agent Loop 行为或弹出界面
3. IF sync_conversation_messages tool 在 Platform 不为 GEMINI 的平台上被调用, THEN THE 系统 SHALL 拒绝执行并返回错误信息，错误信息中应指明该功能仅在 Gemini 平台上支持
4. THE 系统 SHALL 通过 detectPlatform() 函数（基于 window.location.hostname 匹配 PLATFORM_CONFIG 中的 hostname 字段）在内容脚本加载时确定当前平台，并在 Agent Loop 相关模块初始化之前完成平台判断
