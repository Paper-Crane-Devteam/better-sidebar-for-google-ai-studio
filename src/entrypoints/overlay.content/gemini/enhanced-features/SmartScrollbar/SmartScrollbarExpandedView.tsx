import React, { useState } from 'react';
import { ChevronRight, Circle } from 'lucide-react';
import { cn } from '@/shared/lib/utils/utils';
import type { ConversationNode } from './types';

interface Props {
  nodes: ConversationNode[];
  activeNodeId: string | null;
  scrollToNode: (id: string) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  activeNodeRef: React.RefObject<HTMLDivElement>;
  visible: boolean;
}

/** A user node paired with headings from its following model response */
interface OutlineItem {
  node: ConversationNode;
  headings: string[];
}

function truncateText(text: string, maxLen: number) {
  return text.length <= maxLen ? text : text.substring(0, maxLen) + '…';
}

/**
 * Build outline items: each user message paired with ### headings
 * extracted from the immediately following model response.
 */
function buildOutlineItems(nodes: ConversationNode[]): OutlineItem[] {
  const items: OutlineItem[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.role !== 'user') continue;

    // Look ahead for the next model node
    const next = nodes[i + 1];
    const headings =
      next?.role === 'model' && next.headings?.length ? next.headings : [];

    items.push({ node, headings });
  }
  return items;
}

export const SmartScrollbarExpandedView: React.FC<Props> = ({
  nodes,
  activeNodeId,
  scrollToNode,
  containerRef,
  activeNodeRef,
  visible,
}) => {
  const outlineItems = buildOutlineItems(nodes);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex-1 overflow-y-auto overflow-x-hidden',
        'border border-r-0 border-t-0 border-border/30',
        'bg-background/80 backdrop-blur-xl',
        'rounded-bl-xl',
        'shadow-lg shadow-black/5',
        'custom-scrollbar',
        !visible && 'hidden',
      )}
    >
      <div className="py-2">
        {outlineItems.map(({ node, headings }, index) => {
          const isActive = node.inDom && node.id === activeNodeId;
          const hasHeadings = headings.length > 0;
          const isExpanded = !collapsedIds.has(node.id);

          return (
            <div
              key={node.id}
              className={cn(
                'mx-1.5 rounded-lg transition-all duration-150',
                node.inDom && 'hover:bg-accent/60',
                isActive && 'bg-primary/10',
              )}
            >
              {/* User question row */}
              <div
                ref={isActive ? activeNodeRef : null}
                onClick={() => node.inDom && scrollToNode(node.id)}
                className={cn(
                  'group flex items-start gap-2 px-3 py-2 rounded-lg',
                  node.inDom
                    ? 'cursor-pointer'
                    : 'cursor-default opacity-40',
                  isActive
                    ? 'text-primary'
                    : node.inDom
                      ? 'text-muted-foreground hover:text-foreground'
                      : 'text-muted-foreground',
                )}
              >
                {/* Expand chevron or index number */}
                {hasHeadings ? (
                  <button
                    onClick={(e) => toggleExpand(node.id, e)}
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded mt-0.5',
                      'hover:bg-accent/80 transition-colors duration-150',
                    )}
                  >
                    <ChevronRight
                      className={cn(
                        'h-3.5 w-3.5 transition-transform duration-200',
                        isExpanded && 'rotate-90',
                        isActive
                          ? 'text-primary'
                          : 'text-muted-foreground/60',
                      )}
                    />
                  </button>
                ) : (
                  <div
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-0.5',
                      'transition-colors duration-150',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                        : 'bg-muted/60 text-muted-foreground group-hover:bg-muted',
                    )}
                  >
                    {index + 1}
                  </div>
                )}

                {/* Question text */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-[13px] leading-relaxed',
                      isActive ? 'font-semibold' : 'font-medium',
                    )}
                  >
                    {truncateText(node.content, 72)}
                  </p>
                </div>
              </div>

              {/* Collapsible headings outline */}
              {hasHeadings && isExpanded && (
                <div className="ml-[26px] mb-0.5">
                  {headings.map((heading, i) => (
                    <div
                      key={`${node.id}-h-${i}`}
                      onClick={() => node.inDom && scrollToNode(node.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-[5px] rounded-md',
                        'animate-in fade-in slide-in-from-top-1 duration-200',
                        node.inDom
                          ? 'cursor-pointer'
                          : 'cursor-default opacity-40',
                        isActive
                          ? 'text-primary'
                          : 'text-foreground/70',
                      )}
                    >
                      <Circle className="h-2 w-2 shrink-0 fill-current" />
                      <span className="text-[13px] leading-snug truncate">
                        {truncateText(heading, 36)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
