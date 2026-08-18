/**
 * SessionEndCard — the "that's the end of the task" marker in the conversation.
 *
 * A divider rather than a card: the dock already carries the detailed summary (step
 * counts, failures, upgrade prompts), and repeating it here would give the same
 * information two competing homes.
 *
 * It does own the *primary* undo entry point, though. The dock can be collapsed,
 * dismissed, or left behind by switching conversations, while this sits at the bottom
 * of the transcript — which is where someone looking over what the agent did actually
 * is when they decide they want it reverted.
 *
 * ## Two sizes, because "task" is not always the right word
 *
 * A session that ran one SELECT is not an event worth a full-width rule and a verdict.
 * Read as a first-time user, "Task finished" across the screen after a five-second
 * question reads as the feature having closed on them — so a light session (see
 * `isLightSession`) gets one line of small text instead. Nothing is hidden by the
 * downgrade: light means no writes, no failures and no undo, so there is no control
 * living in the compact form.
 *
 * ## The summary lives here
 *
 * `complete_task`'s `summary` is the AI's own account of what it did, and this is the
 * only place it is shown. The engine files it into the runtime store, but the card that
 * renders it appears only for an "infeasible" verdict and the dock hides itself on a
 * clean finish — so on the happy path the AI wrote a paragraph that went nowhere. Read
 * off the tool call instead of the store, so it also survives a reload.
 *
 * ## The follow-up hint
 *
 * The one thing the divider cannot say by itself is what comes next. A follow-up
 * message keeps the agent going — the AI still has the system prompt, so it answers in
 * tool format and auto-pickup takes over — but nothing on screen suggests that, so
 * people retype `>` or open a new chat. The hint says it once or twice and then gets
 * out of the way for good (`useOnboardingHint`, retired the moment a follow-up is
 * actually picked up).
 */

import React from 'react';
import { CheckCircle2, AlertTriangle, Undo2, RotateCcw, X } from 'lucide-react';
import type { SessionOutcome } from '../helpers/session-end';
import { useI18n } from '@/shared/hooks/useI18n';
import { useOnboardingHint } from '@/shared/lib/onboarding-store';
import { useUndoAvailable, useUndoWasUndone, useUndoAction } from '../../undo';

interface SessionEndCardProps {
  outcome: SessionOutcome;
  /** The AI's own account of what it did. Empty when the call carried none. */
  summary?: string;
  /**
   * Whether this marker owns the undo entry point.
   *
   * A conversation can contain several finished sessions, but the snapshot only ever
   * covers the most recent one — offering "Undo changes" on an older divider would
   * revert work the user never pointed at.
   */
  isLatest?: boolean;
  /**
   * Render the compact form: the session did almost nothing.
   *
   * Passed in rather than derived here because weighing a session means walking the
   * surrounding messages, which only the overlay has.
   */
  light?: boolean;
}

export const SessionEndCard: React.FC<SessionEndCardProps> = ({
  outcome,
  summary = '',
  isLatest = true,
  light = false,
}) => {
  const { t } = useI18n();
  const undoAvailable = useUndoAvailable() && isLatest;
  const undone = useUndoWasUndone() && isLatest;
  const { undoing, runUndo } = useUndoAction();

  // Only the newest marker: the hint is about what to do *now*, and hanging it on
  // every historical divider would turn a one-off tip into wallpaper.
  const hint = useOnboardingHint('agentContinueAfterEnd', 3);
  const showHint = isLatest && !undone && hint.visible;

  const isSuccess = outcome === 'complete';

  const label = {
    complete: t('agent.summary.done', { defaultValue: 'Task finished' }),
    // Distinct from both: the AI got somewhere but not all the way, and the summary
    // right below says how far. Reading that as a plain success is the version that
    // sends people off believing work happened that didn't.
    partial: t('agent.summary.partial', { defaultValue: 'Partly done' }),
    infeasible: t('agent.summary.infeasible', { defaultValue: "Couldn't be done" }),
  }[outcome];

  // Reverted wins over the outcome: the transcript above still describes changes
  // that no longer exist, so "Task finished" alone would read as confirmation.
  const Icon = undone ? RotateCcw : isSuccess ? CheckCircle2 : AlertTriangle;
  const iconColor = undone
    ? 'text-muted-foreground'
    : isSuccess
      ? 'text-success'
      : 'text-warning';

  const text = undone ? t('agent.undo.reverted', { defaultValue: 'Changes reverted' }) : label;

  /**
   * Suppressed once the changes are gone: the summary describes work that has been
   * rolled back, and leaving it under "Changes reverted" reads as a contradiction.
   *
   * Clamped rather than scrolled or truncated, with the full text on hover — a summary
   * is meant to be one to three sentences, and a model that ignores that shouldn't be
   * able to push the rest of the conversation off screen.
   */
  const summaryLine = summary && !undone && (
    <p
      className="mx-auto max-w-prose px-6 text-center text-xs leading-relaxed
                 text-muted-foreground line-clamp-3"
      title={summary}
    >
      {summary}
    </p>
  );

  const followUpHint = showHint && (
    <div className="flex items-center justify-center gap-1.5">
      <span className="text-xs text-muted-foreground/80">
        {t('agent.summary.continueHint', {
          defaultValue: 'Just keep talking to carry on — no need to type > again.',
        })}
      </span>
      <button
        type="button"
        onClick={hint.dismiss}
        aria-label={t('agent.summary.hintDismiss', { defaultValue: 'Got it' })}
        title={t('agent.summary.hintDismiss', { defaultValue: 'Got it' })}
        className="shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors
                   hover:bg-accent/40 hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );

  /**
   * A light session gets a line, not a rule. Same information, a tenth of the volume —
   * and since there is no undo on a light session, no control is lost with the frame.
   */
  if (light) {
    return (
      <div className="my-3 space-y-1">
        <div className="flex items-center justify-center gap-1.5">
          <Icon className={`h-3 w-3 shrink-0 ${iconColor}`} />
          <span className="text-xs text-muted-foreground">{text}</span>
        </div>
        {summaryLine}
        {followUpHint}
      </div>
    );
  }

  return (
    <div className="my-6 space-y-1 py-3">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border/50" />

        <div className="flex items-center gap-2 px-3">
          <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
          <span className="text-xs font-medium text-muted-foreground">{text}</span>

          {undoAvailable && (
            <button
              type="button"
              onClick={runUndo}
              disabled={undoing}
              className="ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-xs
                         font-medium text-[rgb(var(--highlight))] transition-colors
                         hover:bg-[rgb(var(--highlight)/0.1)] disabled:opacity-50"
            >
              <Undo2 className="h-3 w-3" />
              {undoing
                ? t('agent.undo.working', { defaultValue: 'Undoing…' })
                : t('agent.undo.action', { defaultValue: 'Undo changes' })}
            </button>
          )}
        </div>

        <div className="h-px flex-1 bg-border/50" />
      </div>

      {summaryLine}
      {followUpHint}
    </div>
  );
};
