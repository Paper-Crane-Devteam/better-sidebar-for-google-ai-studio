import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { useConversationNodes } from './useConversationNodes';
import { cn } from '@/shared/lib/utils/utils';
import { OverflowTooltip } from '@/shared/components/ui/overflow-tooltip';

export const SmartScrollbar: React.FC = () => {
  const { nodes, activeNodeId, scrollToNode } = useConversationNodes();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const expandedRef = useRef<HTMLDivElement>(null);
  const collapsedRef = useRef<HTMLDivElement>(null);
  const activeNodeRef = useRef<HTMLDivElement>(null);

  // Track whether the user has manually scrolled inside each list.
  // Resets only on conversation switch.
  const userScrolledExpandedRef = useRef(false);
  const userScrolledCollapsedRef = useRef(false);
  const prevNodesLenRef = useRef(nodes.length);

  // Reset scroll flags when conversation changes (nodes go to 0 then rebuild)
  useEffect(() => {
    if (nodes.length === 0 && prevNodesLenRef.current > 0) {
      userScrolledExpandedRef.current = false;
      userScrolledCollapsedRef.current = false;
    }
    prevNodesLenRef.current = nodes.length;
  }, [nodes.length]);

  const handleExpandedScroll = useCallback(() => {
    userScrolledExpandedRef.current = true;
  }, []);

  const handleCollapsedScroll = useCallback(() => {
    userScrolledCollapsedRef.current = true;
  }, []);

  // Scroll to bottom instantly on first expand/hover per conversation
  useEffect(() => {
    if (!isHovered && !isExpanded) return;

    requestAnimationFrame(() => {
      if (isExpanded && expandedRef.current && !userScrolledExpandedRef.current) {
        expandedRef.current.scrollTop = expandedRef.current.scrollHeight;
      }
      if (!isExpanded && isHovered && collapsedRef.current && !userScrolledCollapsedRef.current) {
        collapsedRef.current.scrollTop = collapsedRef.current.scrollHeight;
      }
    });
  }, [isHovered, isExpanded]);

  // Auto-scroll the collapsed sidebar to keep active node visible
  useEffect(() => {
    if (activeNodeRef.current && collapsedRef.current && !isExpanded) {
      const container = collapsedRef.current;
      const activeEl = activeNodeRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();

      if (
        activeRect.top < containerRect.top ||
        activeRect.bottom > containerRect.bottom
      ) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [activeNodeId, isExpanded]);

  if (nodes.length === 0) return null;

  const truncateText = (text: string, maxLen: number) => {
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen) + '…';
  };

  return (
    <div
      className={cn(
        'fixed right-0 top-1/2 -translate-y-1/2 z-[999998]',
        'flex flex-col items-end',
        'transition-all duration-300 ease-out',
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main Container */}
      <div
        className={cn(
          'flex flex-col',
          'transition-all duration-300 ease-out',
          isExpanded
            ? 'w-[300px] max-h-[70vh]'
            : isHovered
              ? 'w-[220px] max-h-[60vh]'
              : 'w-[40px] max-h-[60vh]',
        )}
      >
        {/* Header - Toggle Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'flex items-center gap-2.5 px-3 py-2.5',
            'rounded-tl-xl rounded-tr-none',
            'border border-r-0 border-border/30',
            'bg-background/80 backdrop-blur-xl',
            'text-muted-foreground hover:text-foreground',
            'transition-all duration-200',
            'hover:bg-accent/50',
            'shadow-lg shadow-black/5',
          )}
          title={isExpanded ? 'Collapse outline' : 'Expand outline'}
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          {(isExpanded || isHovered) && (
            <span className="text-[16px] font-semibold truncate flex-1 text-left animate-in fade-in duration-200">
              {isExpanded ? 'Conversation Outline' : `${nodes.length} messages`}
            </span>
          )}
          {(isExpanded || isHovered) &&
            (isExpanded ? (
              <ChevronUp className="h-3 w-3 shrink-0" />
            ) : (
              <ChevronDown className="h-3 w-3 shrink-0" />
            ))}
        </button>

        {/* Expanded: Full outline view — always mounted, hidden when not expanded */}
        <div
          ref={expandedRef}
          onScroll={handleExpandedScroll}
          className={cn(
            'flex-1 overflow-y-auto overflow-x-hidden',
            'border border-r-0 border-t-0 border-border/30',
            'bg-background/80 backdrop-blur-xl',
            'rounded-bl-xl',
            'shadow-lg shadow-black/5',
            'custom-scrollbar',
            'transition-all duration-300',
            !isExpanded && 'hidden',
          )}
        >
          <div className="py-2.5">
            {nodes.map((node, index) => (
              <div
                key={node.id}
                onClick={() => node.inDom && scrollToNode(node.id)}
                className={cn(
                  'group flex items-start gap-3 px-3.5 py-2.5 mx-1.5 rounded-lg',
                  'transition-all duration-150',
                  node.inDom
                    ? 'cursor-pointer hover:bg-accent/60'
                    : 'cursor-default opacity-40',
                  node.inDom && node.id === activeNodeId
                    ? 'bg-primary/10 text-primary'
                    : node.inDom
                      ? 'text-muted-foreground hover:text-foreground'
                      : 'text-muted-foreground',
                )}
              >
                {/* Index Circle */}
                <div
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold mt-0.5',
                    'transition-colors duration-150',
                    node.inDom && node.id === activeNodeId
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                      : 'bg-muted/60 text-muted-foreground group-hover:bg-muted',
                  )}
                >
                  {index + 1}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm leading-relaxed',
                      node.inDom && node.id === activeNodeId
                        ? 'font-semibold'
                        : 'font-medium',
                    )}
                  >
                    {truncateText(node.content, 80)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Collapsed: Mini scrollbar with dots/nodes — always mounted, hidden when expanded */}
        <div
          ref={collapsedRef}
          onScroll={handleCollapsedScroll}
          className={cn(
            'flex-1 overflow-y-auto overflow-x-hidden',
            'border border-r-0 border-t-0 border-border/30',
            'bg-background/80 backdrop-blur-xl',
            'rounded-bl-xl',
            'shadow-lg shadow-black/5',
            'custom-scrollbar',
            'transition-all duration-300',
            isExpanded && 'hidden',
          )}
        >
          <div className="flex flex-col items-center py-2.5 gap-1">
            {nodes.map((node) => (
              <div
                key={node.id}
                ref={node.id === activeNodeId ? activeNodeRef : null}
                onClick={() => node.inDom && scrollToNode(node.id)}
                className={cn(
                  'group relative flex items-center justify-center',
                  'transition-all duration-200',
                  node.inDom ? 'cursor-pointer' : 'cursor-default opacity-40',
                  isHovered ? 'w-full px-2.5 py-1.5' : 'p-1.5',
                )}
              >
                {isHovered ? (
                  /* Hovered: show truncated text with overflow tooltip */
                  <div
                    className={cn(
                      'flex items-center gap-2 w-full rounded-md px-2 py-1',
                      'transition-all duration-150',
                      node.inDom && 'hover:bg-accent/60',
                      node.inDom && node.id === activeNodeId ? 'bg-primary/10' : '',
                    )}
                  >
                    <div
                      className={cn(
                        'h-1.5 w-1.5 rounded-full shrink-0',
                        'transition-all duration-200',
                        node.inDom && node.id === activeNodeId
                          ? 'bg-primary scale-125 shadow-sm shadow-primary/40'
                          : 'bg-muted-foreground/40 group-hover:bg-muted-foreground/70',
                      )}
                    />
                    <OverflowTooltip
                      content={node.content}
                      placement="left"
                      offset={24}
                      className={cn(
                        'text-sm',
                        'animate-in fade-in slide-in-from-right-2 duration-200',
                        node.inDom && node.id === activeNodeId
                          ? 'text-primary font-semibold'
                          : 'text-muted-foreground group-hover:text-foreground',
                      )}
                      tooltipClassName="text-sm"
                    >
                      {truncateText(node.content, 25)}
                    </OverflowTooltip>
                  </div>
                ) : (
                  /* Default: minimal dots */
                  <div className="relative">
                    <div
                      className={cn(
                        'rounded-full transition-all duration-200',
                        node.inDom && node.id === activeNodeId
                          ? 'h-3 w-3 bg-primary shadow-md shadow-primary/30'
                          : node.inDom
                            ? 'h-1.5 w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60 hover:scale-150'
                            : 'h-1.5 w-1.5 bg-muted-foreground/15',
                      )}
                    />
                    {/* Active indicator glow */}
                    {node.inDom && node.id === activeNodeId && (
                      <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
