/**
 * AgentSettings — Settings sub-page for managing Skills and MCP Servers.
 */

import React from 'react';
import { Separator } from '../../../components/ui/separator';
import { Button } from '@/shared/components/ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useI18n } from '@/shared/hooks/useI18n';
import { modal } from '@/shared/lib/modal';
import { useAgentConfigStore } from '../../agent-loop/agent-config-store';
import { BUILTIN_SKILLS } from '../../agent-loop/skills/builtin-skills';
import { BUILTIN_MCP } from '../../agent-loop/mcp/builtin-mcp';
import { WORKSPACE_MCP, WORKSPACE_MCP_ID } from '../../agent-loop/mcp/workspace-mcp';
import { DOCUMENT_MCP, DOCUMENT_MCP_ID } from '../../agent-loop/mcp/document-mcp';
import { syncMCPEnabledState } from '../../agent-loop/mcp/setup';
import { openSkillEditorModal } from './agent/SkillEditorModal';
import { SwitchItem } from '../components/SwitchItem';

export const AgentSettings: React.FC = () => {
  const { t } = useI18n();
  const {
    customSkills,
    disabledBuiltinSkills,
    disabledMcpServers,
    toggleBuiltinSkill,
    toggleMcpServer,
    setCustomSkillEnabled,
    removeCustomSkill,
  } = useAgentConfigStore();

  const workspaceEnabled = !disabledMcpServers.includes(WORKSPACE_MCP_ID);
  const documentsEnabled = !disabledMcpServers.includes(DOCUMENT_MCP_ID);

  /**
   * The registry keeps its own `enabled` flag, and prompt assembly reads the
   * registry rather than the store — so flipping the switch has to push the change
   * through, or the tools stay in the prompt until the next page load.
   */
  const handleToggleWorkspace = () => {
    toggleMcpServer(WORKSPACE_MCP_ID);
    syncMCPEnabledState();
  };

  const handleToggleDocuments = () => {
    toggleMcpServer(DOCUMENT_MCP_ID);
    syncMCPEnabledState();
  };

  const handleDeleteSkill = async (id: string, title: string) => {
    const confirmed = await modal.confirmDelete({
      title: t('agent.settings.deleteSkillTitle'),
      content: t('agent.settings.deleteSkillContent', { title }),
    });
    if (confirmed) removeCustomSkill(id);
  };

  return (
    <div className="space-y-6 relative">
      {/* Skills Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">{t('agent.settings.skillsTitle')}</h3>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => openSkillEditorModal()}
            disabled={customSkills.length >= 20}
          >
            <Plus className="h-3 w-3" />
            {t('agent.settings.newSkill')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('agent.settings.skillsDescription')}
        </p>
        <Separator />

        <div className="space-y-1 py-2">
          {/* Built-in skills — resolve i18n keys for title/description */}
          {BUILTIN_SKILLS.map((skill) => {
            const isDisabled = disabledBuiltinSkills.includes(skill.id);
            const localizedTitle = skill.titleKey
              ? t(skill.titleKey, { defaultValue: skill.title })
              : skill.title;
            const localizedDesc = skill.descriptionKey
              ? t(skill.descriptionKey, { defaultValue: skill.description })
              : skill.description;
            return (
              <SwitchItem
                key={skill.id}
                label={localizedTitle}
                description={localizedDesc}
                checked={!isDisabled}
                onCheckedChange={() => toggleBuiltinSkill(skill.id)}
              />
            );
          })}

          {/* Custom skills — user-typed text, no i18n */}
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
                onClick={() => openSkillEditorModal(skill)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                onClick={() => handleDeleteSkill(skill.id, skill.title)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </SwitchItem>
          ))}

          {customSkills.length >= 20 && (
            <p className="text-[10px] text-muted-foreground py-1">
              {t('agent.settings.maxSkills')}
            </p>
          )}
        </div>
      </div>

      {/* MCP Section */}
      <div className="space-y-2">
        <h3 className="text-lg font-medium">{t('agent.settings.mcpTitle')}</h3>
        <p className="text-xs text-muted-foreground">
          {t('agent.settings.mcpDescription')}
        </p>
        <Separator />

        <div className="space-y-1 py-2">
          {/* Built-in MCP — always on, it powers the Agent's core tools */}
          <div className="flex items-center justify-between py-2 px-2 rounded hover:bg-accent/30">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">
                {t('agent.mcp.builtin.name', { defaultValue: BUILTIN_MCP.name })}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {t('agent.settings.mcpToolCount', { count: BUILTIN_MCP.tools.length })} — {t('agent.mcp.builtin.description', { defaultValue: BUILTIN_MCP.description })}
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-accent/60 px-2 py-1 text-[10px] font-medium text-muted-foreground">
              {t('agent.settings.alwaysOn')}
            </span>
          </div>

          {/* Tool list (expanded) */}
          <div className="ml-8 space-y-1">
            {BUILTIN_MCP.tools.map((tool) => (
              <div key={tool.schema.name} className="flex items-center gap-2 py-1">
                <div className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                <span className="text-xs text-muted-foreground">{tool.schema.name}</span>
                <span className="text-[10px] text-muted-foreground/60 truncate">
                  — {t(`agent.mcp.tools.${tool.schema.name}`, { defaultValue: tool.schema.description.slice(0, 60) })}
                </span>
              </div>
            ))}
          </div>

          {/* Workspace MCP — optional, seven tool schemas is real prompt cost */}
          <div className="pt-2">
            <SwitchItem
              label={t('agent.mcp.workspace.name', { defaultValue: WORKSPACE_MCP.name })}
              description={`${t('agent.settings.mcpToolCount', { count: WORKSPACE_MCP.tools.length })} — ${t('agent.mcp.workspace.description', { defaultValue: WORKSPACE_MCP.description })}`}
              checked={workspaceEnabled}
              onCheckedChange={handleToggleWorkspace}
            />

            {workspaceEnabled && (
              <div className="ml-8 space-y-1">
                {WORKSPACE_MCP.tools.map((tool) => (
                  <div key={tool.schema.name} className="flex items-center gap-2 py-1">
                    <div className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                    <span className="text-xs text-muted-foreground">{tool.schema.name}</span>
                    <span className="text-[10px] text-muted-foreground/60 truncate">
                      — {tool.schema.description.slice(0, 60)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/*
            Documents MCP — its own switch rather than part of the workspace one.

            The workspace holds the file either way; this decides whether the agent can
            look *inside* an Office document. Someone using the workspace for notes and
            source files never needs it, and a schema is prompt cost on every round.
          */}
          <div className="pt-2">
            <SwitchItem
              label={t('agent.mcp.documents.name', { defaultValue: DOCUMENT_MCP.name })}
              description={`${t('agent.settings.mcpToolCount', { count: DOCUMENT_MCP.tools.length })} — ${t('agent.mcp.documents.description', { defaultValue: DOCUMENT_MCP.description })}`}
              checked={documentsEnabled}
              onCheckedChange={handleToggleDocuments}
            />

            {documentsEnabled && (
              <div className="ml-8 space-y-1">
                {DOCUMENT_MCP.tools.map((tool) => (
                  <div key={tool.schema.name} className="flex items-center gap-2 py-1">
                    <div className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                    <span className="text-xs text-muted-foreground">{tool.schema.name}</span>
                    <span className="text-[10px] text-muted-foreground/60 truncate">
                      — {t(`agent.mcp.tools.${tool.schema.name}`, { defaultValue: tool.schema.description.slice(0, 60) })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
