/**
 * AgentLauncher — what you see in the Agent tab before anything is running.
 *
 * Replaces the old empty state, which only told you to type `>` in the chat
 * input and offered "Configure Agent" as its most prominent action. This is a
 * launcher: pick a skill, or describe a task, and it stages the agent in the
 * chat input for you.
 */

import React, { useState } from 'react';
import { Bot, Lock, Send, Settings, ShieldCheck } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { UIcon } from '@/shared/components/ui/icon';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAppStore } from '@/shared/lib/store';
import { useLicenseStore } from '@/shared/lib/license-store';
import { getAgentEntries, AGENT_AUTO_ID } from '../../agent-loop/agent-entry';
import { agentEventBus } from '../../agent-loop/event-bus';

/** lucide names stored on skills → iconify names used by UIcon */
const ICON_FALLBACK = 'lucide:sparkles';

function iconName(icon: string): string {
  if (!icon) return ICON_FALLBACK;
  // Skills store PascalCase lucide names ("FolderTree")
  const kebab = icon.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return `lucide:${kebab}`;
}

export const AgentLauncher: React.FC = () => {
  const { t } = useI18n();
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const tier = useLicenseStore((s) => s.tier);
  const canWrite = tier === 'power_pack' || tier === 'pro' || tier === 'support_pack';

  const [task, setTask] = useState('');
  const [unavailable, setUnavailable] = useState(false);

  const entries = getAgentEntries();
  const autoEntry = entries.find((e) => e.id === AGENT_AUTO_ID);
  const skillEntries = entries.filter((e) => e.id !== AGENT_AUTO_ID);

  /**
   * Ask the platform feature to stage the entry. If nothing acknowledges within
   * a moment, the chat input isn't reachable (no chat open, or the feature is
   * turned off) — say so instead of failing silently.
   */
  const run = (entryId: string, userInput?: string, autoSend = false) => {
    setUnavailable(false);

    let settled = false;
    const offStaged = agentEventBus.once('launcher:staged', () => {
      settled = true;
    });
    const offFailed = agentEventBus.once('launcher:failed', () => {
      settled = true;
      setUnavailable(true);
    });

    agentEventBus.emit('launcher:run-entry', { entryId, userInput, autoSend });

    setTimeout(() => {
      offStaged();
      offFailed();
      if (!settled) setUnavailable(true);
    }, 1200);
  };

  const handleSubmitTask = () => {
    if (!task.trim() || !autoEntry) return;
    run(autoEntry.id, task, true);
    setTask('');
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-4">
      {/* Intro */}
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">
            {t('agent.launcher.title', { defaultValue: 'Agent' })}
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t('agent.launcher.subtitle', {
              defaultValue: 'Let the AI work directly on your conversation data.',
            })}
          </p>
        </div>
      </div>

      {/* Free-form task */}
      <div className="mb-4">
        <div className="relative">
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value.slice(0, 500))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmitTask();
              }
            }}
            rows={2}
            placeholder={t('agent.launcher.placeholder', {
              defaultValue: 'Describe what you want to get done...',
            })}
            className="w-full resize-none rounded-md border border-border/60 bg-muted/30 px-3 py-2 pr-8
                       text-xs text-foreground placeholder:text-muted-foreground
                       focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button
            type="button"
            onClick={handleSubmitTask}
            disabled={!task.trim()}
            aria-label={t('agent.launcher.run', { defaultValue: 'Run' })}
            className="absolute right-2 top-2 rounded p-1 text-muted-foreground
                       hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <Send className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Skill cards */}
      <div className="mb-4 space-y-1">
        <span className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('agent.launcher.skills', { defaultValue: 'Or start with a skill' })}
        </span>
        <div className="space-y-1">
          {skillEntries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => run(entry.id)}
              className="flex w-full items-start gap-3 rounded-md bg-muted/30 px-3 py-2
                         text-left transition-colors hover:bg-accent/40"
            >
              <UIcon icon={iconName(entry.icon)} className="mt-1 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-foreground">{entry.title}</div>
                <div className="line-clamp-2 text-xs text-muted-foreground">
                  {entry.description}
                </div>
              </div>
            </button>
          ))}
        </div>
        <p className="px-1 pt-1 text-xs text-muted-foreground">
          {t('agent.launcher.stageHint', {
            defaultValue: 'Adds it to the chat input so you can add details before sending.',
          })}
        </p>
      </div>

      {unavailable && (
        <p className="mb-4 rounded-md bg-orange-500/10 px-3 py-2 text-xs text-muted-foreground">
          {t('agent.launcher.noEditor', {
            defaultValue: 'Open a chat first — the agent runs through the chat input.',
          })}
        </p>
      )}

      {/* Safety / tier note */}
      <div className="mt-auto space-y-2 pt-4">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-1 h-3 w-3 shrink-0" />
          <span>
            {t('agent.launcher.safety', {
              defaultValue:
                'Only your local database is touched. Changes are confirmed before they run.',
            })}
          </span>
        </div>

        {!canWrite && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Lock className="mt-1 h-3 w-3 shrink-0" />
            <span>
              {t('agent.launcher.freeTier', {
                defaultValue: 'Free plan is read-only. Upgrade to let the agent make changes.',
              })}
            </span>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="h-3 w-3" />
          {t('agent.launcher.manage', { defaultValue: 'Manage skills & tools' })}
        </Button>
      </div>
    </div>
  );
};
