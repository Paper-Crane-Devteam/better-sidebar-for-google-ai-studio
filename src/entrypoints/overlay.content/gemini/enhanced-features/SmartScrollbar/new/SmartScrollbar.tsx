import React, { useRef, useEffect } from 'react';
import { cn } from '@/shared/lib/utils/utils';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import { useConversationNodes } from './useConversationNodes';
import type { ConversationNode } from './types';

/**
 * Maximum visible height for the dot container (px).
 * If dots exceed this, the container scrolls internally.
 */
const MAX_HEIGHT = 320;

/**
 * New SmartScrollbar — a minimal vertical dot bar that sits to the right
 * of the native browser scrollbar. Each dot represents a user message.
 *
 * Design:
 * - Transparent background with a subtle border, fully rounded (pill shape)
 * - Small padding, compact dots
 * - Hover on a dot → tooltip with message preview (no panel)
 * - Active dot is highlighted (no pulse/ping animation, no shadow)
 * - When conversation hasn't loaded (0 nodes but on a conversation page) → disabled state
 * - No outline/headings feature
 * - Scrollable internally if too many dots
 */
export const SmartScrollbar: React.FC = () => {
  const { nodes, activeNodeId, scrollToNode } = useConversationNodes();
  const userNodes = nodes.filter((n) => n.role === 'user');
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // If there are absolutely no nodes, the feature is hidden
  // (not on a conversation page or truly empty)
  const isOnConversationPage = nodes.length > 0 || isConversationUrl();
  const isDisabled = isOnConversationPage && userNodes.length === 0;

  // Auto-scroll the dot container so the active dot stays visible
  useEffect(() => {
    if (!activeRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const el = activeRef.current;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    if (elRect.top < containerRect.top || elRect.bottom > containerRect.bottom) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeNodeId]);

  // Don't render at all if not on a conversation page
  if (!isOnConversationPage) return null;

  return (
    <div
      className={cn(
        'fixed right-5 top-1/2 -translate-y-1/2 z-[38]',
        'flex flex-col items-center',
        'border border-border/40 rounded-full',
        'bg-transparent',
        'py-5 px-3',
        'overflow-visible',
        'transition-opacity duration-200',
        isDisabled && 'opacity-40 pointer-events-none',
      )}
      style={{ maxHeight: `${MAX_HEIGHT}px` }}
    >
      <div
        ref={containerRef}
        className={cn(
          'flex flex-col items-center gap-[12px]',
          'overflow-y-auto overflow-x-hidden',
        )}
        style={{
          maxHeight: `${MAX_HEIGHT - 40}px`, // account for py-5
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE
        }}
      >
        {isDisabled ? (
          // Placeholder dots for disabled/loading state
          <DisabledDots />
        ) : (
          userNodes.map((node) => {
            const isActive = node.inDom && node.id === activeNodeId;
            return (
              <DotItem
                key={node.id}
                node={node}
                isActive={isActive}
                scrollToNode={scrollToNode}
                activeRef={isActive ? activeRef : undefined}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

// ── Sub-components ──────────────────────────────────────────────────

interface DotItemProps {
  node: ConversationNode;
  isActive: boolean;
  scrollToNode: (id: string) => void;
  activeRef?: React.Ref<HTMLDivElement>;
}

const DotItem: React.FC<DotItemProps> = ({
  node,
  isActive,
  scrollToNode,
  activeRef,
}) => {
  const truncated = truncateText(node.content, 50);

  return (
    <SimpleTooltip content={truncated} side="left" sideOffset={10} delayDuration={100}>
      <div
        ref={activeRef}
        onClick={() => node.inDom && scrollToNode(node.id)}
        className={cn(
          'rounded-full transition-all duration-150',
          node.inDom ? 'cursor-pointer' : 'cursor-default opacity-30',
          isActive
            ? 'h-[16px] w-[16px] bg-primary'
            : node.inDom
              ? 'h-[14px] w-[14px] bg-muted-foreground/40 hover:bg-muted-foreground/80 hover:scale-[1.3]'
              : 'h-[14px] w-[14px] bg-muted-foreground/20',
        )}
      />
    </SimpleTooltip>
  );
};

/** Placeholder dots shown while conversation is loading */
const DisabledDots: React.FC = () => (
  <>
    {Array.from({ length: 3 }).map((_, i) => (
      <div
        key={i}
        className="h-[14px] w-[14px] rounded-full bg-muted-foreground/20"
      />
    ))}
  </>
);

// ── Utilities ───────────────────────────────────────────────────────

function truncateText(text: string, maxLen: number) {
  return text.length <= maxLen ? text : text.substring(0, maxLen) + '…';
}

/** Check if the current URL looks like a Gemini conversation page */
function isConversationUrl(): boolean {
  const path = globalThis.location?.pathname || '';
  return /\/app\/[a-zA-Z0-9_-]+/.test(path) || /\/gem\/[^/]+\/[a-zA-Z0-9_-]+/.test(path);
}
