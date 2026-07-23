# Requirements Document

## Introduction

将现有 Agent Loop 功能重构为 Soul + Skill + MCP 的三层可扩展架构。Soul 是写死的系统 base prompt（用户不可见不可改）；Skill 是用户可管理的"能力卡片"，对应现有的 agent commands，每个 skill 包含专属 prompt 和可用工具声明；MCP 是工具执行层，将现有硬编码工具抽象为标准化的 tool provider。用户通过编辑器内的触发词激活 agent 模式，AI 根据任务自动选取和激活合适的 skill，执行对应工具链。侧边栏新增 Agent Tab，以渐进式 UI 呈现 skill 和 MCP 管理功能。

## Glossary

- **Soul**: 系统级 base prompt，定义 agent 的核心身份、行为规范和工具使用协议，写死在代码中，用户不可见不可修改
- **Skill**: 用户可管理的能力单元，包含专属 prompt 模板和工具访问声明，对应一个具体的工作场景（如"分类对话"、"导出数据"）
- **MCP**: Model Context Protocol 工具执行层，提供标准化的 tool provider 接口，所有实际工具调用通过 MCP 层执行
- **Agent_Tab**: 侧边栏新增的标签页，用于管理 skill 和 MCP 配置
- **Trigger_Phrase**: 用户在编辑器中输入的触发内容，用于激活 agent 模式并注入完整 prompt 上下文
- **Progressive_Disclosure**: 渐进式 UI 设计原则，高频功能默认外露，低频/高级功能折叠隐藏
- **Skill_Activation**: AI 在循环中根据任务语义自动选择并加载对应 skill 的过程
- **Built_In_Skill**: 系统内置的 skill，不可删除但可禁用
- **Custom_Skill**: 用户自定义创建的 skill

## Requirements


### Requirement 1: Agent 模式触发机制

**User Story:** 作为用户，我希望在 Gemini 编辑器中通过简单的触发方式激活 agent 模式，以便快速进入 AI 辅助工作流，且不与 Gemini 原生功能冲突。

#### Acceptance Criteria

1. WHEN 用户在编辑器中输入 `>` 字符作为行首第一个字符，THE 系统 SHALL 显示 agent 命令弹出列表（保持现有 `>` 前缀触发行为不变）
2. WHEN 用户从弹出列表中选择一个 skill 并确认（Enter/Tab/点击），THE 系统 SHALL 在编辑器中插入一个 prompt capsule，其隐藏内容包含 Soul prompt + 已激活 skill 列表 + 可用 MCP 工具列表的完整上下文
3. WHEN 用户在 capsule 后继续输入任务描述并发送消息，THE 系统 SHALL 将 capsule 隐藏内容展开为完整 prompt 拼接用户输入，发送给 AI
4. IF Gemini 原生 `@` 功能处于激活状态（如 @mention 弹窗可见），THEN THE 系统 SHALL 不拦截任何键盘输入，让 Gemini 原生行为优先
5. THE 弹出列表 SHALL 展示所有可用 skill（内置 + 自定义），每项显示 skill 标题、图标和简短描述，支持键盘上下选择和模糊搜索过滤
6. WHEN 用户选择 "Custom Task"（自由模式）时，THE 系统 SHALL 插入包含 Soul + 全部 MCP 工具列表的 capsule，不限定任何特定 skill


### Requirement 2: Soul 层 — 系统 Base Prompt

**User Story:** 作为开发者，我希望有一个不可修改的核心 prompt 层定义 agent 的行为规范和工具使用协议，以便确保 agent 在所有场景下遵循一致的执行规范。

#### Acceptance Criteria

1. THE Soul prompt SHALL 定义 agent 的核心身份、工具调用格式规范（XML tag 格式）、错误处理策略和循环终止条件，作为每次 agent 消息的固定前缀
2. THE Soul prompt SHALL 包含动态注入区域，用于在运行时插入当前已激活的 skill 描述和可用 MCP 工具的 schema 列表
3. THE Soul prompt 内容 SHALL 仅存在于源代码中（`prompts/soul.ts`），不通过任何 UI 暴露给用户查看或修改
4. WHEN 用户发送 agent 消息时，THE 系统 SHALL 始终将 Soul prompt 作为最高优先级前缀注入，任何 skill prompt 内容附加在 Soul 之后
5. THE Soul prompt SHALL 包含 skill 选择指令，告知 AI 在接收到用户任务后，如果当前上下文未指定 skill，应调用 `activate_skill` 工具来激活最匹配的 skill


### Requirement 3: Skill 层 — 能力单元管理

**User Story:** 作为用户，我希望能查看、创建和管理 skill（能力卡片），以便自定义 agent 的专项工作能力。

#### Acceptance Criteria

1. THE 系统 SHALL 提供内置 skill 集合（对应现有 built-in prompts：auto-classify、find-empty-chats、export-chats、free-form），内置 skill 不可删除但可禁用
2. WHEN 用户创建自定义 skill，THE 系统 SHALL 要求填写：标题（必填，最长 50 字符）、描述（必填，最长 200 字符）、prompt 内容（必填，最长 5000 字符）、图标（可选，默认 Sparkles）
3. THE 自定义 skill 数据 SHALL 持久化存储在 chrome.storage.local 中，页面重载后恢复
4. WHEN 用户编辑已有 skill，THE 系统 SHALL 支持修改标题、描述、prompt 内容和图标，保存后立即生效于下一次 agent 触发
5. WHEN 用户删除自定义 skill，THE 系统 SHALL 显示确认弹窗后移除该 skill，已使用该 skill 的历史会话不受影响
6. WHEN AI 在循环中调用 `activate_skill` 工具并传入 skill ID，THE 系统 SHALL 将对应 skill 的 prompt 内容追加到当前上下文中，供 AI 获得专项任务指导
7. THE 系统 SHALL 支持最多 20 个自定义 skill，达到上限时创建入口显示提示并阻止新建


### Requirement 4: MCP 层 — 工具执行抽象

**User Story:** 作为开发者，我希望将现有硬编码工具抽象为标准化的 MCP tool provider 接口，以便未来支持动态注册外部工具和第三方集成。

#### Acceptance Criteria

1. THE 系统 SHALL 将现有工具（execute_sql、sync_conversation_messages、export、complete_task）重构为 MCP tool provider 格式，每个工具暴露标准化的 schema（name、description、parameters JSON Schema、execute function）
2. THE 系统 SHALL 提供一个 `activate_skill` 元工具，该工具不属于任何特定 MCP provider，而是由引擎内置处理，用于 AI 在循环中动态激活 skill
3. THE MCP 工具注册表 SHALL 在 Soul prompt 的动态区域中生成可用工具的 schema 描述，供 AI 了解每个工具的名称、功能和参数格式
4. WHEN 某个 MCP Server 被用户禁用，THE 系统 SHALL 不将该 MCP 下任何工具的 schema 写入 prompt，使 AI 无法感知这些工具的存在，且执行时返回禁用提示
5. THE MCP 层 SHALL 替代现有 control-panel-store 的 disabledTools 机制，工具的启用/禁用改为通过其所属 MCP Server 的 enabled 状态整体控制
6. THE MCP 工具 schema 格式 SHALL 遵循以下结构：`{ name: string, description: string, parameters: { type: 'object', properties: Record<string, { type, description }>, required: string[] } }`


### Requirement 5: Agent Tab — 实时运行状态面板

**User Story:** 作为用户，我希望在侧边栏有一个专属的 Agent 标签页来查看当前 agent 对话的实时运行状态，且视觉风格体现 premium 品质感，区别于其他普通 tab。

#### Acceptance Criteria

1. THE 侧边栏 SHALL 新增一个 "Agent" 标签按钮（图标使用 Bot 或 Cpu），位于 Prompts 标签之后，点击后显示 Agent Tab 内容区域
2. THE Agent Tab SHALL 与其他 tab 有视觉差异化：使用微妙的渐变背景或品牌色点缀、更大的信息密度间距、精致的动画效果，营造 premium 工具面板的氛围
3. WHILE 当前对话为 agent 对话（存在正在运行或已完成的 agent loop session），THE Agent Tab SHALL 显示实时运行状态面板，包含：当前状态指示器（idle/running/paused/error）、轮次进度（Round X/N）、当前执行的工具名称、已激活的 skill 名称、Token 估算
4. WHILE agent loop 正在运行，THE Agent Tab SHALL 实时更新执行历史列表（每次 tool 执行完毕追加一条记录），并提供 Stop 按钮和 Pause 按钮
5. WHILE 存在 Pending Confirmation（写操作确认），THE Agent Tab SHALL 在状态面板中内联展示确认区域（SQL 预览 + Approve/Reject 按钮），替代原有的全屏确认弹窗
6. WHILE 当前对话不是 agent 对话（普通对话或新对话），THE Agent Tab SHALL 显示空状态视图：居中的 Agent 图标 + 标题 "Agent Mode" + 简短引导文案（如"在输入框中输入 > 启动 Agent"）+ 可选的快捷启动按钮
7. THE Agent Tab 的运行时控制功能（极速模式、断点暂停、指令注入、执行历史）SHALL 完全替代现有的 AgentLoopStatusBar + AgentLoopControlPanel Popover 组合
8. WHEN agent loop 结束后（status 变为 idle），THE Agent Tab SHALL 保留最后一次 session 的执行历史供查看，直到新的 agent loop 开始或用户切换对话


### Requirement 6: Skill 与 MCP 配置入口（Settings 子页面）

**User Story:** 作为用户，我希望在设置面板中管理 Skill 和 MCP 配置，以便将高级配置功能收纳在统一的设置区域，不干扰 Agent Tab 的运行状态视图。

#### Acceptance Criteria

1. THE 设置面板 SHALL 新增一个 "Agent" 设置子页面（与 Theme、Data 等平级），包含 Skills 管理区域和 MCP 管理区域
2. THE Skills 管理区域 SHALL 以列表形式展示所有 skill（内置 + 自定义），每行显示图标、标题、描述摘要和启用/禁用开关，提供"新建 Skill"按钮
3. THE MCP 管理区域 SHALL 以列表形式展示所有 MCP Server，每行显示名称、工具数量摘要和启用/禁用开关
4. WHEN 用户在编辑器中输入 `>` 触发 agent 命令弹窗时，THE 弹窗列表 SHALL 仅展示 skill 标题 + 图标 + 描述，不暴露 MCP 配置细节
5. THE Agent 设置子页面中 Skills 列表的排序 SHALL 将内置 skill 置顶，自定义 skill 按创建时间倒序排列
6. WHILE Agent Tab 处于空状态视图，THE 空状态 SHALL 提供"配置 Agent"链接按钮，点击后跳转到设置面板的 Agent 子页面


### Requirement 7: Skill 编辑器

**User Story:** 作为用户，我希望能通过直观的编辑界面创建和修改 skill 的 prompt 内容和配置，以便无需了解底层格式即可定义 agent 能力。

#### Acceptance Criteria

1. WHEN 用户在设置面板的 Agent 子页面中点击"新建 Skill"或已有 skill 的"编辑"按钮，THE 系统 SHALL 以 Drawer（从右侧滑入）形式展示编辑器，覆盖当前设置视图
2. THE 编辑器 SHALL 包含以下字段：标题输入（text input）、描述输入（text input）、图标选择器（预设图标网格）、Prompt 内容（多行 textarea，支持 monospace 字体）
3. WHEN 用户点击"保存"按钮，THE 系统 SHALL 校验必填字段后持久化保存，关闭 Drawer 并刷新 skill 列表
4. WHEN 用户点击"取消"按钮或按 Escape 键，THE 系统 SHALL 丢弃所有未保存修改并关闭 Drawer
5. IF 用户修改了内容后尝试关闭 Drawer（取消或 Escape），THEN THE 系统 SHALL 显示确认弹窗询问是否放弃修改
6. THE Prompt 内容 textarea SHALL 提供占位示例文本，展示推荐的 prompt 编写格式（如 `## Task: Your task name\n\nDescribe what this skill does...`）


### Requirement 8: StatusBar 废弃 — 状态功能迁入 Agent Tab

**User Story:** 作为用户，我希望所有 agent 运行控制集中在 Agent Tab 中，不再需要底部浮动的 StatusBar 和 Popover 面板。

#### Acceptance Criteria

1. THE Agent Tab 的运行状态面板 SHALL 完全覆盖现有 AgentLoopStatusBar 的所有功能：状态指示（idle/running/paused/error）、轮次显示、Stop/Retry 按钮
2. THE Agent Tab SHALL 完全覆盖现有 AgentLoopControlPanel Popover 的所有功能：极速模式开关、断点暂停设置、写操作内联确认、执行历史查看、中途指令注入、Token 估算显示
3. WHEN 重构完成后，THE 系统 SHALL 移除 AgentLoopStatusBar 组件的渲染（不再在编辑器区域底部显示浮动状态条）
4. THE AgentLoopStatusBar 和 AgentLoopControlPanel 组件文件 SHALL 标记为 deprecated 并保留源码，待确认无回退需求后再删除
5. WHEN agent loop 需要用户注意（如 Pending Confirmation 到达或发生错误），且用户当前不在 Agent Tab，THE 侧边栏 Agent 图标 SHALL 显示通知标记（红色圆点或数字 badge）以引导用户切换到 Agent Tab


### Requirement 9: 向后兼容与迁移策略

**User Story:** 作为现有用户，我希望升级后不丢失已有体验，现有的 agent 工作流能平滑过渡到新架构。

#### Acceptance Criteria

1. THE 现有 4 个 built-in prompts（auto-classify、find-empty-chats、export-chats、free-form）SHALL 自动迁移为 Built_In_Skill，保持相同的标题、描述、图标和功能
2. THE 现有 `>` 触发行为和 AgentCommandPopup 交互方式 SHALL 保持不变，用户无感知升级
3. THE 现有 `base-prompt.ts` 内容 SHALL 迁移到 Soul 层（`prompts/soul.ts`），工具描述部分改为动态生成
4. THE 现有 `tool-registry.ts` 的 switch-case 路由 SHALL 重构为 MCP provider 注册模式，但执行结果格式保持不变，不影响 ConversationRenderer 的解析
5. IF 用户的 chrome.storage.local 中存在旧格式的 control-panel 数据（disabledTools），THEN THE 系统 SHALL 兼容读取旧格式并在首次加载时迁移为新格式

### Requirement 10: Agent Tab 视觉差异化与 Premium 感

**User Story:** 作为用户，我希望 Agent Tab 的视觉风格明显区别于其他标签页，传达"高级 AI 工具面板"的品质感。

#### Acceptance Criteria

1. THE Agent Tab SHALL 使用区别于其他 tab 的视觉语言：微妙的品牌色渐变背景（如从透明到 primary/5 的渐变）、状态指示器使用 glow 效果或脉冲动画
2. WHILE agent loop 正在运行，THE Agent Tab SHALL 在状态区域显示呼吸式脉冲动画（subtle pulse），传达"正在工作中"的感知
3. THE 执行历史列表中每条成功记录 SHALL 使用绿色状态点，失败记录使用红色状态点，当前正在执行的 tool 使用旋转加载图标
4. THE Agent Tab 的空状态视图 SHALL 使用居中大图标（半透明）+ 品牌渐变文字标题，视觉上比普通 tab 的空状态更精致
5. WHEN 用户从其他 tab 切换到 Agent Tab，THE 切换 SHALL 使用与其他 tab 相同的过渡方式（保持一致性），但 Tab 内部内容可使用更丰富的入场动画（如 fade-in + slight scale）

