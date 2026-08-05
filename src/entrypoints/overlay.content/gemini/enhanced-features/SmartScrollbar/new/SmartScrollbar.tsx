import React, { useRef, useEffect, useState } from 'react';
import { List } from 'lucide-react';
import { cn } from '@/shared/lib/utils/utils';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import { useConversationNodes } from './useConversationNodes';
import type { ConversationNode } from './types';
import { Z_INDEX } from '@/shared/lib/z-index';
import { useI18n } from '@/shared/hooks/useI18n';

/**
 * Maximum visible height for the dot container (px).
 * If dots exceed this, the container scrolls internally.
 */
const MAX_DOT_HEIGHT = 320;

/**
 * Max height for the expanded outline panel.
 */
const MAX_PANEL_HEIGHT = 420;

/**
 * New SmartScrollbar — a minimal vertical dot bar that sits to the right
 * of the viewport. Each dot represents a user message.
 *
 * Interaction:
 * - Top: an outline icon button
 * - Click icon → expands from right-to-left into a wider panel showing
 *   truncated user questions. Hover shows full text, click navigates.
 * - Click icon again → collapses back to dot mode.
 * - The right edge stays anchored in both states.
 */
export const SmartScrollbar: React.FC = () => {
  const { nodes, activeNodeId, scrollToNode } = useConversationNodes();
  const { t } = useI18n();
  const userNodes = nodes.filter((n) => n.role === 'user');
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  // If there are absolutely no nodes, the feature is hidden
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

  // Hide when fewer than 3 model responses
  const modelNodeCount = nodes.filter((n) => n.role === 'model').length;
  if (!isOnConversationPage || modelNodeCount < 3) return null;

  return (
    <div
      className={cn(
        'fixed right-4 top-1/2 -translate-y-1/2',
        'flex flex-col items-end',
      )}
      style={{ zIndex: Z_INDEX.SMART_SCROLLBAR }}
    >
      <div
        className={cn(
          'flex flex-col',
          'border border-border/40 rounded-xl',
          'bg-background/80 backdrop-blur-xl',
          'shadow-lg shadow-black/5',
          // Only the width animates; height snaps instantly
          'transition-[width] duration-300 ease-out origin-right',
          'overflow-hidden',
          expanded ? 'w-[240px]' : 'w-8',
          isDisabled && 'opacity-40 pointer-events-none',
        )}
        style={{
          maxHeight: expanded ? `${MAX_PANEL_HEIGHT}px` : `${MAX_DOT_HEIGHT}px`,
        }}
      >
        {/* Outline toggle icon */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            'flex items-center gap-2 shrink-0',
            'transition-colors duration-150',
            'hover:bg-accent/60',
            expanded ? 'px-3 py-2 border-b border-border/30' : 'p-2 self-center',
          )}
        >
          <List className="h-4 w-4 shrink-0 text-muted-foreground" />
          {expanded && (
            <span className="text-xs font-medium text-muted-foreground truncate animate-in fade-in duration-200">
              {t('smartScrollbar.topics')}
            </span>
          )}
        </button>

        {/* Content area */}
        {expanded ? (
          /* Expanded: list of user questions */
          <div
            ref={containerRef}
            className={cn(
              'flex flex-col',
              'overflow-y-auto overflow-x-hidden',
              'py-1',
            )}
            style={{
              maxHeight: `${MAX_PANEL_HEIGHT - 40}px`,
              scrollbarWidth: 'thin',
            }}
          >
            {isDisabled ? (
              <DisabledPlaceholder />
            ) : (
              userNodes.map((node, index) => {
                const isActive = node.inDom && node.id === activeNodeId;
                return (
                  <OutlineItem
                    key={node.id}
                    node={node}
                    index={index}
                    isActive={isActive}
                    scrollToNode={scrollToNode}
                    activeRef={isActive ? activeRef : undefined}
                  />
                );
              })
            )}
          </div>
        ) : (
          /* Collapsed: dot indicators */
          <div
            ref={containerRef}
            className={cn(
              'flex flex-col items-center gap-0',
              'overflow-y-auto overflow-x-visible',
              'py-1',
            )}
            style={{
              maxHeight: `${MAX_DOT_HEIGHT - 40}px`,
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {isDisabled ? (
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
  return (
    <SimpleTooltip content={node.content} side="left" sideOffset={8} delayDuration={100}>
      <div
        ref={activeRef}
        onClick={() => node.inDom && scrollToNode(node.id)}
        className={cn(
          'group flex items-center justify-center',
          'h-4 w-6 rounded-full',
          'transition-all duration-150',
          node.inDom ? 'cursor-pointer' : 'cursor-default',
        )}
      >
        <div
          className={cn(
            'rounded-full transition-all duration-150',
            !node.inDom && 'opacity-30',
            isActive
              ? 'h-[10px] w-[10px] bg-primary'
              : node.inDom
                ? 'h-2 w-2 bg-muted-foreground/40 group-hover:bg-muted-foreground/80'
                : 'h-2 w-2 bg-muted-foreground/20',
          )}
        />
      </div>
    </SimpleTooltip>
  );
};

interface OutlineItemProps {
  node: ConversationNode;
  index: number;
  isActive: boolean;
  scrollToNode: (id: string) => void;
  activeRef?: React.Ref<HTMLDivElement>;
}

const OutlineItem: React.FC<OutlineItemProps> = ({
  node,
  index,
  isActive,
  scrollToNode,
  activeRef,
}) => {
  // Clean up whitespace for display (CSS handles truncation)
  const displayText = node.content.replace(/\s+/g, ' ').trim();

  const item = (
    <div
      ref={activeRef}
      onClick={() => node.inDom && scrollToNode(node.id)}
      className={cn(
        // Fixed row pitch: keeps the panel height independent of the
        // animating width, so expanding doesn't reflow (no height flicker)
        'group flex items-center h-8 shrink-0 mx-1',
        node.inDom ? 'cursor-pointer' : 'cursor-default opacity-50',
      )}
    >
      {/* Inner block is 28px tall, leaving 4px of breathing room inside
          the 32px row without changing the overall list height */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 h-7 w-full min-w-0',
          'rounded-md transition-colors duration-150',
          isActive
            ? 'bg-primary/10 text-foreground'
            : 'group-hover:bg-accent/60 text-muted-foreground group-hover:text-foreground',
        )}
      >
        {/* Index indicator */}
        <span
          className={cn(
            'shrink-0 text-[10px] font-medium w-4 text-center rounded',
            isActive ? 'text-primary' : 'text-muted-foreground/60',
          )}
        >
          {index + 1}
        </span>
        {/* Content preview — single line, ellipsis on overflow */}
        <span
          className={cn(
            'text-xs truncate min-w-0',
            isActive && 'font-medium',
          )}
        >
          {displayText}
        </span>
      </div>
    </div>
  );

  return (
    <SimpleTooltip
      content={node.content}
      side="left"
      sideOffset={8}
      delayDuration={300}
    >
      {item}
    </SimpleTooltip>
  );
};

/** Placeholder dots shown while conversation is loading */
const DisabledDots: React.FC = () => (
  <>
    {Array.from({ length: 3 }).map((_, i) => (
      <div
        key={i}
        className="h-2 w-2 rounded-full bg-muted-foreground/20 my-1"
      />
    ))}
  </>
);

/** Placeholder for expanded panel while loading */
const DisabledPlaceholder: React.FC = () => (
  <div className="px-3 py-2 text-xs text-muted-foreground/40">
    Loading...
  </div>
);

// ── Utilities ───────────────────────────────────────────────────────

/** Check if the current URL looks like a Gemini conversation page */
function isConversationUrl(): boolean {
  const path = globalThis.location?.pathname || '';
  return /\/app\/[a-zA-Z0-9_-]+/.test(path) || /\/gem\/[^/]+\/[a-zA-Z0-9_-]+/.test(path);
}


