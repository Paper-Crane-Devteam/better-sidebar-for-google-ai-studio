import React, { useRef, useEffect, useState } from 'react';
import { Eraser, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils/utils';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import { useI18n } from '@/shared/hooks/useI18n';
import { useConversationMessagesStore } from '@/shared/lib/conversation-messages-store';
import { deleteStaleMessages } from '@/shared/lib/delete-stale-messages';
import { toast } from '@/shared/lib/toast';

/** How long the button stays armed before falling back to its idle state. */
const ARM_TIMEOUT = 4000;

interface Props {
  /** Whether the host scrollbar is in its wide panel state (affects padding only). */
  expanded: boolean;
}

/**
 * Cleanup affordance for stale message rows, rendered in the SmartScrollbar header.
 *
 * Appears only when the current conversation has rows the platform no longer
 * acknowledges — turns left behind by a re-edit + regenerate from before that path
 * started deleting the branch it replaced. `shared/lib/stale-messages.ts` explains
 * how they are identified and why the diff is deliberately bounded; this component
 * only renders what that detection found.
 *
 * Two-step by design: the first click arms it, the second deletes. The rows are
 * dead branches, so nothing the user can still reach is at stake, but this sits on
 * a bar they click constantly and a stray hit should not quietly delete data.
 */
export const StaleCleanupButton: React.FC<Props> = ({ expanded }) => {
  const { t } = useI18n();
  const staleIds = useConversationMessagesStore((s) => s.staleIds);
  const conversationDbId = useConversationMessagesStore((s) => s.conversationDbId);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const count = staleIds.length;

  // Disarm whenever the button goes away or the conversation changes
  useEffect(() => {
    setArmed(false);
  }, [conversationDbId, count === 0]);

  useEffect(
    () => () => {
      if (armTimer.current) clearTimeout(armTimer.current);
    },
    [],
  );

  if (count === 0 || !conversationDbId) return null;

  const arm = () => {
    setArmed(true);
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setArmed(false), ARM_TIMEOUT);
  };

  const handleClick = async () => {
    if (busy) return;
    if (!armed) {
      arm();
      return;
    }

    if (armTimer.current) clearTimeout(armTimer.current);
    setArmed(false);
    setBusy(true);
    // Snapshot: the store slice is cleared as part of a successful delete
    const ids = [...staleIds];
    try {
      const removed = await deleteStaleMessages(conversationDbId, ids);
      toast.success(t('smartScrollbar.staleCleaned', { count: removed }));
    } catch (e) {
      console.error('SmartScrollbar: stale cleanup failed', e);
      toast.error(t('smartScrollbar.staleCleanupFailed'));
    } finally {
      setBusy(false);
    }
  };

  const label = busy
    ? t('smartScrollbar.staleCleaning')
    : armed
      ? t('smartScrollbar.staleConfirm', { count })
      : t('smartScrollbar.staleFound', { count });

  return (
    <SimpleTooltip content={label} side="left" sideOffset={8} delayDuration={100}>
      <button
        onClick={handleClick}
        disabled={busy}
        aria-label={label}
        className={cn(
          'flex items-center justify-center shrink-0',
          'transition-colors duration-150',
          expanded ? 'px-3 py-2' : 'p-2 self-center',
          armed
            ? 'text-destructive hover:bg-destructive/10'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
        )}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <span className="relative flex items-center">
            <Eraser className="h-4 w-4 shrink-0" />
            {!armed && (
              <span
                className={cn(
                  'absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full',
                  'bg-amber-500',
                )}
              />
            )}
          </span>
        )}
      </button>
    </SimpleTooltip>
  );
};
