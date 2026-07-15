# Implementation Plan: Agent Loop Control Panel

## Overview

实现 Agent Loop Control Panel，将现有 StatusBar 改造为 Popover Trigger，点击后展开控制面板。分 13 个任务按依赖关系递进完成。

## Tasks

- [ ] 1. 安装 `@radix-ui/react-popover` 依赖，创建 `control-panel-store.ts`（持久化 store，字段: autoExecuteReads, disabledTools）
  - Requirements: R2, R6
  - Files: `package.json`, `src/entrypoints/overlay.content/shared/modules/agent-loop/control-panel-store.ts`

- [ ] 2. 扩展 `agent-loop-store.ts` 新增运行时字段（speedMode, breakpointRound, tokenEstimation, pendingInstruction, panelOpen, speedModeWarningShown）和对应 actions，修改 start()/stop() 重置逻辑
  - Requirements: R7, R8, R9, R4, R10
  - Files: `src/entrypoints/overlay.content/shared/modules/agent-loop/agent-loop-store.ts`, `src/entrypoints/overlay.content/shared/modules/agent-loop/types.ts`

- [ ] 3. 创建 `control-panel/utils.ts` 工具函数：estimateTokens、formatTokenCount、isWriteOperation、getConfirmationStrategy、requiresConfirmation
  - Requirements: R9, R2, R3, R7
  - Files: `src/entrypoints/overlay.content/shared/modules/agent-loop/control-panel/utils.ts`

- [ ] 4. 修改 Engine：断点检查（runLoop 开头）、黑名单门控（tool-registry）、确认策略替换（execute-sql）、指令注入（formatResults）、token 统计
  - Requirements: R8, R6, R2, R3, R4, R7, R9
  - Files: `src/entrypoints/overlay.content/shared/modules/agent-loop/engine/AgentLoopEngine.ts`, `src/entrypoints/overlay.content/shared/modules/agent-loop/tools/tool-registry.ts`, `src/entrypoints/overlay.content/shared/modules/agent-loop/tools/execute-sql.ts`

- [ ] 5. 创建 PanelHeader 组件：显示标题、Round 指示器、断点标记、Speed Mode 徽章、Token 估算
  - Requirements: R1, R7, R8, R9
  - Files: `src/entrypoints/overlay.content/shared/modules/agent-loop/control-panel/PanelHeader.tsx`

- [ ] 6. 创建 ConfirmationSection 组件：内联显示 pending SQL、Approve/Reject 按钮、长 SQL 截断展开
  - Requirements: R3
  - Files: `src/entrypoints/overlay.content/shared/modules/agent-loop/control-panel/ConfirmationSection.tsx`

- [ ] 7. 创建 SettingsSection 组件：自动执行开关、极速模式开关（含风险确认弹窗）、断点轮次输入
  - Requirements: R2, R7, R8
  - Files: `src/entrypoints/overlay.content/shared/modules/agent-loop/control-panel/SettingsSection.tsx`

- [ ] 8. 创建 ToolManagementSection 组件：Collapsible 工具列表 + Switch 开关
  - Requirements: R6
  - Files: `src/entrypoints/overlay.content/shared/modules/agent-loop/control-panel/ToolManagementSection.tsx`

- [ ] 9. 创建 ExecutionHistorySection 组件：Collapsible 历史列表（倒序、可展开详情）+ 撤销按钮
  - Requirements: R5, R10
  - Files: `src/entrypoints/overlay.content/shared/modules/agent-loop/control-panel/ExecutionHistorySection.tsx`

- [ ] 10. 创建 InstructionInput 组件：多行 textarea（Enter 发送 / Shift+Enter 换行 / 2000 字符限制 / 成功提示）
  - Requirements: R4
  - Files: `src/entrypoints/overlay.content/shared/modules/agent-loop/control-panel/InstructionInput.tsx`

- [ ] 11. 创建 AgentLoopControlPanel 根组件 + ControlPanelContent 布局组件 + barrel export
  - Requirements: R1
  - Files: `src/entrypoints/overlay.content/shared/modules/agent-loop/control-panel/AgentLoopControlPanel.tsx`, `src/entrypoints/overlay.content/shared/modules/agent-loop/control-panel/ControlPanelContent.tsx`, `src/entrypoints/overlay.content/shared/modules/agent-loop/control-panel/index.ts`

- [ ] 12. 集成到 AgentLoopFeature：替换 StatusBar+ConfirmDialog 为 ControlPanel，修改 StatusBar 为 forwardRef + cursor-pointer，标记旧 ConfirmDialog deprecated
  - Requirements: R1, R3, R7
  - Files: `src/entrypoints/overlay.content/gemini/enhanced-features/AgentLoopFeature.tsx`, `src/entrypoints/overlay.content/shared/modules/agent-loop/AgentLoopStatusBar.tsx`, `src/entrypoints/overlay.content/shared/modules/agent-loop/AgentLoopConfirmDialog.tsx`, `src/entrypoints/overlay.content/shared/modules/agent-loop/index.ts`

- [ ] 13. Event Bus 扩展 + Token 统计监听：新增 control:* 事件类型，在 ControlPanel 中监听 ai:response-received 和 tool:executed 更新 token
  - Requirements: R9
  - Files: `src/entrypoints/overlay.content/shared/modules/agent-loop/event-bus.ts`

## Task Dependency Graph

```json
{
  "waves": [
    [1, 2],
    [3],
    [4, 13],
    [5, 6, 7, 8, 9, 10],
    [11],
    [12]
  ]
}
```

Tasks 1-2 并行 → Task 3 → Tasks 4+13 并行 → Tasks 5-10 并行 → Task 11 → Task 12

## Notes

- Task 4 是最复杂的，涉及 3 个文件的逻辑修改
- Tasks 5-10 之间无依赖，可以并行开发
- 需要先运行 `npm install @radix-ui/react-popover` 后才能开始 Task 11
- 旧的 `AgentLoopConfirmDialog` 保留但标记 deprecated，不立即删除以防回退
