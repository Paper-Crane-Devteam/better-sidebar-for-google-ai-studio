/**
 * ToolManagementSection — Collapsible tool enable/disable list.
 */

import React, { useState } from 'react';
import { Switch } from '@/shared/components/ui/switch';
import * as Collapsible from '@radix-ui/react-collapsible';
import { useControlPanelStore } from '../control-panel-store';

const ALL_TOOLS = [
  { name: 'execute_sql', label: 'Execute SQL' },
  { name: 'sync_conversation_messages', label: 'Sync Messages' },
  { name: 'export', label: 'Export' },
  { name: 'complete_task', label: 'Complete Task' },
];

export const ToolManagementSection: React.FC = () => {
  const disabledTools = useControlPanelStore((s) => s.disabledTools);
  const toggleTool = useControlPanelStore((s) => s.toggleTool);
  const [open, setOpen] = useState(false);

  const disabledCount = disabledTools.length;

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className="flex w-full items-center justify-between py-1">
        <span className="text-xs font-medium text-foreground">工具管控</span>
        {disabledCount > 0 && (
          <span className="text-[10px] text-destructive">已禁用 {disabledCount} 个工具</span>
        )}
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="mt-2 space-y-2">
          {ALL_TOOLS.map((tool) => (
            <div key={tool.name} className="flex items-center justify-between">
              <span className="text-xs text-foreground">{tool.label}</span>
              <Switch
                checked={!disabledTools.includes(tool.name)}
                onCheckedChange={() => toggleTool(tool.name)}
              />
            </div>
          ))}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
};
