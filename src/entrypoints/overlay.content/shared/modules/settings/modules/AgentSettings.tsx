/**
 * AgentSettings — Settings sub-page for managing Skills and MCP Servers.
 */

import React, { useState } from 'react';
import { Separator } from '../../../components/ui/separator';
import { Button } from '@/shared/components/ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAgentConfigStore } from '../../agent-loop/agent-config-store';
import { BUILTIN_SKILLS } from '../../agent-loop/skills/builtin-skills';
import { BUILTIN_MCP } from '../../agent-loop/mcp/builtin-mcp';
import type { Skill } from '../../agent-loop/skills/types';
import { SkillEditorDrawer } from './agent/SkillEditorDrawer';
import { SwitchItem } from '../components/SwitchItem';

export const AgentSettings: React.FC = () => {
  const { t } = useI18n();
  const {
    customSkills,
    disabledBuiltinSkills,
    disabledBuiltinMCPs,
    toggleBuiltinSkill,
    toggleBuiltinMCP,
    setCustomSkillEnabled,
    removeCustomSkill,
  } = useAgentConfigStore();

  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const showEditor = isCreating || editingSkill !== null;

  return (
    <div className="space-y-6 relative">
      {/* Skills Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Skills</h3>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setIsCreating(true)}
            disabled={customSkills.length >= 20}
          >
            <Plus className="h-3 w-3" />
            New Skill
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Skills define specialized prompt instructions for the Agent. Built-in skills cannot be deleted.
        </p>
        <Separator />

        <div className="space-y-1 py-2">
          {/* Built-in skills */}
          {BUILTIN_SKILLS.map((skill) => {
            const isDisabled = disabledBuiltinSkills.includes(skill.id);
            return (
              <SwitchItem
                key={skill.id}
                label={skill.title}
                description={skill.description}
                checked={!isDisabled}
                onCheckedChange={() => toggleBuiltinSkill(skill.id)}
              />
            );
          })}

          {/* Custom skills */}
          {customSkills.map((skill) => (
            <SwitchItem
              key={skill.id}
              label={skill.title}
              description={skill.description}
              checked={skill.enabled}
              onCheckedChange={(checked) => setCustomSkillEnabled(skill.id, checked)}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setEditingSkill(skill)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                onClick={() => {
                  if (confirm(`Delete "${skill.title}"?`)) {
                    removeCustomSkill(skill.id);
                  }
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </SwitchItem>
          ))}

          {customSkills.length >= 20 && (
            <p className="text-[10px] text-muted-foreground py-1">
              Maximum 20 custom skills reached.
            </p>
          )}
        </div>
      </div>

      {/* MCP Section */}
      <div className="space-y-2">
        <h3 className="text-lg font-medium">MCP Servers</h3>
        <p className="text-xs text-muted-foreground">
          MCP Servers provide tools that the Agent can use. Disabling a server hides all its tools from the AI.
        </p>
        <Separator />

        <div className="space-y-1 py-2">
          {/* Built-in MCP */}
          <SwitchItem
            label={BUILTIN_MCP.name}
            description={`${BUILTIN_MCP.tools.length} tools — ${BUILTIN_MCP.description}`}
            checked={!disabledBuiltinMCPs.includes(BUILTIN_MCP.id)}
            onCheckedChange={() => toggleBuiltinMCP(BUILTIN_MCP.id)}
          />

          {/* Tool list (expanded) */}
          <div className="ml-8 space-y-0.5">
            {BUILTIN_MCP.tools.map((tool) => (
              <div key={tool.schema.name} className="flex items-center gap-2 py-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                <span className="text-xs text-muted-foreground">{tool.schema.name}</span>
                <span className="text-[10px] text-muted-foreground/60 truncate">
                  — {tool.schema.description.slice(0, 60)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Skill Editor Drawer */}
      {showEditor && (
        <SkillEditorDrawer
          skill={editingSkill || undefined}
          onSave={() => {
            setEditingSkill(null);
            setIsCreating(false);
          }}
          onClose={() => {
            setEditingSkill(null);
            setIsCreating(false);
          }}
        />
      )}
    </div>
  );
};
