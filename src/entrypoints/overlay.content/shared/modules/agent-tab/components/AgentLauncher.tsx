/**
 * AgentLauncher — the Agent tab before anything is running.
 *
 * It is no longer a launcher in the sense of a second place to start a task. It had a
 * textarea and a list of skill cards, which made the sidebar an entry point competing
 * with `>` in the chat input: the same action, reached two ways, with the sidebar one
 * having to forward text into the composer and report every way that can fail. The skill
 * list was the same duplication one level down — the `>` picker already lists skills, and
 * the auto entry picks one for you, so choosing here bought nothing and implied the
 * choice mattered.
 *
 * What is left reads top to bottom as one thought: how to start (`LauncherCta`), what to
 * say (`LauncherExamples`), and then the two places you go that are not a task. The
 * destinations sit last because they are only interesting once the first two have been
 * read; workspace leads within them, because looking at files is something you do
 * repeatedly and configuring tools is something you do once.
 *
 * The examples still stage into the chat input, so the entry point stays single — the
 * sidebar fills the composer and hands it back, rather than sending on its own.
 *
 * ## One padding, no outlines
 *
 * The tab owns the horizontal padding (`px-3`) and nothing inside adds a second one.
 * Sections are text on the panel; where a tinted surface is needed it uses `-mx-2 px-2`,
 * so the tint bleeds outward and the content stays on the same left edge as everything
 * above it. Before that rule, each section sat on a filled card with its own `p-3` inside
 * the tab's, and on a panel this narrow the doubled inset cost most of a line's width and
 * read as clutter.
 *
 * Nothing is outlined either — an earlier pass bordered every block and the tab became
 * nested frames a few pixels apart. Same reason the two destinations are full-width rows
 * instead of a two-column grid: side by side, each got about twenty characters of width
 * and both labels wrapped.
 *
 * With no frames left, the sections are told apart by the space between them alone, which
 * is why the column gap is a deliberate `gap-6` rather than the `gap-3` that looked fine
 * while every block still had an edge to hold it in. The two content sections label
 * themselves and keep that label tight against their own content, so the gap here always
 * reads as "new section" rather than as air between a heading and what it introduces.
 */

import React, { useState } from 'react';
import { Bot, ChevronRight, FolderOpen, HelpCircle, Lock, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { UIcon } from '@/shared/components/ui/icon';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAppStore } from '@/shared/lib/store';
import { useLicenseStore } from '@/shared/lib/license-store';
import { navigateToNewChat } from '@/shared/lib/navigation';
import { getAgentEntries, AGENT_AUTO_ID } from '../../agent-loop/agent-entry';
import { agentEventBus } from '../../agent-loop/event-bus';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';
import { getActiveEngine } from '../../agent-loop/engine/engine-registry';
import { useAgentConfigStore } from '../../agent-loop/agent-config-store';
import { WORKSPACE_MCP_ID } from '../../agent-loop/mcp/workspace-mcp';
import { LauncherCta } from './LauncherCta';
import { LauncherExamples } from './LauncherExamples';

interface AgentLauncherProps {
  /** Switch the tab over to the workspace file browser. */
  onOpenWorkspace?: () => void;
}

/** A full-width destination row: icon, label, one line of explanation. */
const DestinationRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}> = ({ icon, label, hint, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    // Same `-mx-2 px-2` band as everything else tinted here: the surface bleeds outward
    // rather than indenting its contents inside the tab's own padding.
    className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2.5 rounded-lg bg-muted/40 px-2 py-2
               text-left transition-colors hover:bg-accent/40"
  >
    <span className="shrink-0 text-primary">{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[13px] font-medium text-foreground">{label}</span>
      <span className="block truncate text-xs text-muted-foreground">{hint}</span>
    </span>
    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
  </button>
);

export const AgentLauncher: React.FC<AgentLauncherProps> = ({ onOpenWorkspace }) => {
  const { t } = useI18n();
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  // Offering a workspace browser while the file tools are switched off would advertise
  // a capability the agent does not currently have.
  const workspaceEnabled = !useAgentConfigStore((s) =>
    s.disabledMcpServers.includes(WORKSPACE_MCP_ID),
  );
  const tier = useLicenseStore((s) => s.tier);
  const canWrite = tier === 'power_pack' || tier === 'pro' || tier === 'support_pack';

  /** null = fine; otherwise why the last attempt didn't reach the chat input */
  const [unavailable, setUnavailable] = useState<
    'no-editor' | 'composer-busy' | 'session-busy' | null
  >(null);

  /**
   * Staging a second task while one is live would replace what the running task has
   * queued in the composer, so the examples go inert rather than looking clickable.
   */
  const status = useAgentLoopStore((s) => s.status);
  const busy = status !== 'idle';

  const stopRunning = () => {
    const engine = getActiveEngine();
    if (engine) engine.stop();
    else useAgentLoopStore.getState().stop();
    setUnavailable(null);
  };

  const autoEntry = getAgentEntries().find((e) => e.id === AGENT_AUTO_ID);
  const entryTitle =
    autoEntry?.title ?? t('agent.entry.autoTitle', { defaultValue: 'Better Sidebar Agent' });

  /**
   * Put an example in the chat input, unsent.
   *
   * Ask the platform feature to stage it; if nothing acknowledges within a moment the
   * chat input isn't reachable (no chat open, or the feature is off) — say so instead of
   * appearing to do nothing.
   */
  const stage = (text: string) => {
    setUnavailable(null);
    if (busy || !autoEntry) {
      setUnavailable('session-busy');
      return;
    }

    let settled = false;
    const offStaged = agentEventBus.once('launcher:staged', () => {
      settled = true;
    });
    const offFailed = agentEventBus.once('launcher:failed', ({ reason }) => {
      settled = true;
      setUnavailable(
        reason === 'composer-busy' || reason === 'session-busy' ? reason : 'no-editor',
      );
    });

    agentEventBus.emit('launcher:run-entry', {
      entryId: autoEntry.id,
      userInput: text,
      autoSend: false,
    });

    setTimeout(() => {
      offStaged();
      offFailed();
      if (!settled) setUnavailable('no-editor');
    }, 1200);
  };

  /**
   * The agent runs through the page's chat input, so there has to be a chat open.
   * Offer that as a one-click action rather than only telling the user about it.
   */
  const handleNewChat = () => {
    setUnavailable(null);
    navigateToNewChat();
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-3">
      {/*
        Title row. What this is and what it may touch both sit behind the question mark:
        the pitch is read once, the safety note is reassurance rather than instruction, and
        neither earns standing space above the thing they describe.
      */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {t('agent.launcher.title', { defaultValue: 'Agent' })}
        </h2>
        <SimpleTooltip
          content={
            <span className="block space-y-1">
              <span className="block">
                {t('agent.launcher.subtitle', {
                  defaultValue: 'Team up with AI to manage your chats, prompts and data.',
                })}
              </span>
              <span className="block opacity-80">
                {t('agent.launcher.safety', {
                  defaultValue:
                    'Only your local database is touched. Changes are confirmed before they run.',
                })}
              </span>
            </span>
          }
        >
          <button
            type="button"
            aria-label={t('agent.launcher.about', { defaultValue: 'About the agent' })}
            className="shrink-0 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </SimpleTooltip>
      </div>

      <LauncherCta entryTitle={entryTitle} onNewChat={handleNewChat} />

      {unavailable && (
        <div className="-mx-2 space-y-2 rounded-lg bg-orange-500/10 px-2 py-2">
          <p className="text-xs text-muted-foreground">
            {unavailable === 'composer-busy'
              ? t('agent.launcher.composerBusy', {
                  defaultValue:
                    'The running task has results waiting in the chat input. Send those first, then try again.',
                })
              : unavailable === 'session-busy'
                ? t('agent.launcher.sessionBusy', {
                    defaultValue:
                      'A task is already running. Finish it, or stop it, before starting another.',
                  })
                : t('agent.launcher.noEditor', {
                    defaultValue: 'Open a chat first — the agent runs through the chat input.',
                  })}
          </p>
          {unavailable === 'session-busy' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 bg-background/60 px-2 text-xs hover:bg-background"
              onClick={stopRunning}
            >
              {t('agent.launcher.stopRunning', { defaultValue: 'Stop the running task' })}
            </Button>
          )}
          {unavailable === 'no-editor' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 bg-background/60 px-2 text-xs hover:bg-background"
              onClick={handleNewChat}
            >
              <UIcon icon="tabler:message-plus" className="h-3 w-3" />
              {t('explorerHeader.newChat')}
            </Button>
          )}
        </div>
      )}

      <LauncherExamples capsuleLabel={entryTitle} onPick={stage} disabled={busy} />

      {/* The two destinations that aren't a task. Workspace first: it gets opened often,
          settings get opened once. */}
      <div className="space-y-1.5">
        {workspaceEnabled && onOpenWorkspace && (
          <DestinationRow
            icon={<FolderOpen className="h-4 w-4" />}
            label={t('agent.launcher.workspace', { defaultValue: 'Workspace' })}
            hint={t('agent.launcher.workspaceHint', {
              defaultValue: 'Files the agent reads and writes',
            })}
            onClick={onOpenWorkspace}
          />
        )}
        <DestinationRow
          icon={<SlidersHorizontal className="h-4 w-4" />}
          label={t('agent.launcher.manage', { defaultValue: 'Skills & tools' })}
          hint={t('agent.launcher.manageHint', { defaultValue: 'What it may do, and when to ask' })}
          onClick={() => setSettingsOpen(true, 'agent')}
        />
      </div>

      {/*
        The read-only note stays on the panel rather than moving into the tooltip with the
        safety copy: it is a limit the user will otherwise discover halfway through a task,
        and it is the one line here that asks them to do something.
      */}
      {!canWrite && (
        <div className="mt-auto flex items-start gap-2 pt-2 text-[11px] leading-relaxed text-muted-foreground">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            {t('agent.launcher.freeTier', {
              defaultValue: 'Free plan is read-only. Upgrade to let the agent make changes.',
            })}
          </span>
        </div>
      )}
    </div>
  );
};
