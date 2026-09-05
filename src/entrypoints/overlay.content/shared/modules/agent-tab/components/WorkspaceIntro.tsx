/**
 * WorkspaceIntro — three lines above the file tree.
 *
 * The Workspace agent's panel is the file tree, which answers "what is in here" but not
 * "what is this and how do I use it". A user who switches to this agent and sees an empty
 * tree has no way to guess that the way in is typing `>Workspace` in the chat.
 *
 * Deliberately small and permanent rather than a dismissible onboarding card: it is two
 * sentences, it costs one line of vertical space next to a scrollable tree, and a card the
 * user dismissed six months ago is a card they cannot get back when they need it. The
 * details that would make it long — what formats are supported, how editing is approved —
 * sit behind the question mark instead.
 */

import React from 'react';
import { FolderOpen, HelpCircle } from 'lucide-react';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import { useI18n } from '@/shared/hooks/useI18n';
import { listAgents } from '../../agent-loop/agents/registry';

export const WorkspaceIntro: React.FC = () => {
  const { t } = useI18n();
  const agent = listAgents().find((a) => a.id === 'workspace');

  return (
    <div className="shrink-0 px-3 pt-3 pb-1">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <FolderOpen className="h-3.5 w-3.5 text-primary" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {/*
              Names the trigger literally. It is the only way to start this agent, and
              "ask the agent" is advice the user cannot act on without knowing the `>`.
            */}
            {t('agent.workspaceIntro.body', {
              defaultValue:
                'Files here persist across chats and are shared between Gemini and AI Studio. Type > Workspace in the chat input to put this agent to work on them.',
            })}
          </p>
        </div>

        <SimpleTooltip
          content={
            <span className="block space-y-1">
              <span className="block">
                {agent?.description ??
                  t('agent.agents.workspace.description', {
                    defaultValue:
                      'Read, write and edit files and documents in your workspace',
                  })}
              </span>
              <span className="block opacity-80">
                {t('agent.workspaceIntro.detail', {
                  defaultValue:
                    'Text files are read and edited directly. Word documents are read by outline and section. It cannot see your conversations or anything outside this workspace, and every change is confirmed before it runs.',
                })}
              </span>
            </span>
          }
        >
          <button
            type="button"
            aria-label={t('agent.workspaceIntro.about', {
              defaultValue: 'About the workspace',
            })}
            className="mt-0.5 shrink-0 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </SimpleTooltip>
      </div>
    </div>
  );
};
