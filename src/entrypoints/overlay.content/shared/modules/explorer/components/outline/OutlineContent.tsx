import { useState, useRef, useEffect } from 'react';
import {
  ChevronRight,
  Code2,
  Heading,
  Search,
  Circle,
  MapPin,
  List,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils/utils';
import { useI18n } from '@/shared/hooks/useI18n';
import { useOutline } from './useOutline';
import type { OutlineNode, OutlineFilter, OutlineSection } from './types';

/**
 * Outline content rendered inside the collapsible Explorer section.
 * VSCode-style tree with headings, code blocks, and click-to-navigate.
 */
export const OutlineContent = () => {
  const { t } = useI18n();
  const {
    sections,
    activeMessageId,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    scrollToMessage,
    isLoading,
    stats,
    isOnConversation,
  } = useOutline();

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLDivElement>(null!);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  // ── Toolbar (always visible) ─────────────────────────────────────
  const toolbar = (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-border/30">
      {/* Filter chips */}
      <FilterChips filter={filter} onFilterChange={setFilter} />
      <div className="flex-1" />
      {/* Search toggle */}
      <button
        onClick={() => setShowSearch(!showSearch)}
        className={cn(
          'p-1 rounded-md transition-colors',
          showSearch
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
        )}
      >
        <Search className="h-3.5 w-3.5" />
      </button>
      {/* Stats badge */}
      {stats.turns > 0 && (
        <span className="text-[10px] text-muted-foreground/60 tabular-nums ml-0.5">
          {stats.turns}
        </span>
      )}
    </div>
  );

  // ── Search input ─────────────────────────────────────────────────
  const searchBar = showSearch ? (
    <div className="px-2 py-1 border-b border-border/30">
      <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/40 border border-border/40">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('outline.searchPlaceholder')}
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  ) : null;

  // ── Empty / not-on-conversation states ───────────────────────────
  if (!isOnConversation) {
    return (
      <div className="flex flex-col">
        {toolbar}
        <div className="flex flex-col items-center justify-center py-6 px-4 text-center text-muted-foreground min-h-[80px]">
          <List className="h-5 w-5 mb-2 opacity-40" />
          <p className="text-xs">{t('outline.placeholder')}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col">
        {toolbar}
        <div className="flex items-center justify-center py-6 min-h-[80px]">
          <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="flex flex-col">
        {toolbar}
        {searchBar}
        <div className="flex flex-col items-center justify-center py-6 px-4 text-center text-muted-foreground min-h-[80px]">
          <List className="h-5 w-5 mb-2 opacity-40" />
          <p className="text-xs">
            {searchQuery ? t('outline.noResults') : t('outline.empty')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col">
      {toolbar}
      {searchBar}

      {/* Outline tree */}
      <div className="overflow-y-auto custom-scrollbar max-h-[350px]">
        <div className="py-1">
          {sections.map((section) => (
            <OutlineSectionItem
              key={section.id}
              section={section}
              isActive={section.userMessageId === activeMessageId}
              isCollapsed={collapsedSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
              onNavigate={scrollToMessage}
              activeRef={
                section.userMessageId === activeMessageId ? activeRef : undefined
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Filter Chips ─────────────────────────────────────────────────────

function FilterChips({
  filter,
  onFilterChange,
}: {
  filter: OutlineFilter;
  onFilterChange: (f: OutlineFilter) => void;
}) {
  const { t } = useI18n();
  const filters: { key: OutlineFilter; label: string; icon?: React.ReactNode }[] = [
    { key: 'all', label: t('outline.filterAll') },
    { key: 'headings', label: t('outline.filterHeadings'), icon: <Heading className="h-3 w-3" /> },
    { key: 'code', label: t('outline.filterCode'), icon: <Code2 className="h-3 w-3" /> },
  ];

  return (
    <div className="flex items-center gap-1">
      {filters.map(({ key, label, icon }) => (
        <button
          key={key}
          onClick={() => onFilterChange(key)}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
            'transition-colors duration-100 whitespace-nowrap',
            filter === key
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
          )}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Section Item (user turn) ─────────────────────────────────────────

function OutlineSectionItem({
  section,
  isActive,
  isCollapsed,
  onToggle,
  onNavigate,
  activeRef,
}: {
  section: OutlineSection;
  isActive: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
  onNavigate: (messageId: string) => void;
  activeRef?: React.RefObject<HTMLDivElement>;
}) {
  const hasChildren = section.children.length > 0;

  return (
    <div
      ref={activeRef}
      className={cn(
        'mx-1 rounded-md transition-colors duration-100',
        isActive && 'bg-primary/5',
      )}
    >
      {/* User question row */}
      <div
        className={cn(
          'group flex items-center gap-1 px-2 py-1 rounded-md',
          section.userInDom
            ? 'cursor-pointer hover:bg-accent/50'
            : 'cursor-default opacity-50',
        )}
        onClick={() => section.userInDom && onNavigate(section.userMessageId)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-accent/80"
          >
            <ChevronRight
              className={cn(
                'h-3 w-3 transition-transform duration-150',
                !isCollapsed && 'rotate-90',
                isActive ? 'text-primary' : 'text-muted-foreground/50',
              )}
            />
          </button>
        ) : (
          <div className="flex h-5 w-5 shrink-0 items-center justify-center">
            <div
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                isActive ? 'bg-primary' : 'bg-muted-foreground/30',
              )}
            />
          </div>
        )}

        {/* Turn badge */}
        <span
          className={cn(
            'text-[10px] font-bold shrink-0 w-4 text-center',
            isActive ? 'text-primary' : 'text-muted-foreground/60',
          )}
        >
          {section.turnIndex}
        </span>

        {/* Query text */}
        <span
          className={cn(
            'text-xs leading-snug truncate flex-1',
            isActive
              ? 'text-primary font-medium'
              : 'text-foreground/80 group-hover:text-foreground',
          )}
        >
          {section.userQuery}
        </span>

        {isActive && (
          <MapPin className="h-3 w-3 text-primary shrink-0 opacity-70" />
        )}
      </div>

      {/* Children */}
      {hasChildren && !isCollapsed && (
        <div className="ml-4 border-l border-border/25 pl-2 mb-1">
          {section.children.map((node) => (
            <OutlineNodeItem
              key={node.id}
              node={node}
              onNavigate={onNavigate}
              messageId={section.modelMessageId || section.userMessageId}
              navigable={section.modelInDom}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Outline Node Item (heading/code) ─────────────────────────────────

function OutlineNodeItem({
  node,
  onNavigate,
  messageId,
  navigable,
  depth = 0,
}: {
  node: OutlineNode;
  onNavigate: (messageId: string) => void;
  messageId: string;
  navigable: boolean;
  depth?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        onClick={() => navigable && onNavigate(messageId)}
        className={cn(
          'group flex items-center gap-1 px-2 py-1 rounded-md',
          'transition-colors duration-100',
          navigable
            ? 'cursor-pointer hover:bg-accent/40'
            : 'cursor-default opacity-50',
        )}
        style={{ paddingLeft: `${6 + depth * 12}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-accent/60"
          >
            <ChevronRight
              className={cn(
                'h-2.5 w-2.5 transition-transform duration-100 text-muted-foreground/40',
                isExpanded && 'rotate-90',
              )}
            />
          </button>
        ) : (
          <div className="w-4 shrink-0" />
        )}

        {getNodeIcon(node)}

        <span
          className={cn(
            'text-[11px] leading-snug truncate flex-1',
            node.type === 'heading'
              ? 'text-foreground/90 font-medium'
              : 'text-muted-foreground group-hover:text-foreground',
          )}
        >
          {node.label}
        </span>

        {node.meta && node.type === 'code-block' && (
          <span className="text-[9px] px-1 py-px rounded bg-muted/50 text-muted-foreground/70 font-mono shrink-0">
            {node.meta}
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <OutlineNodeItem
              key={child.id}
              node={child}
              onNavigate={onNavigate}
              messageId={messageId}
              navigable={navigable}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getNodeIcon(node: OutlineNode) {
  switch (node.type) {
    case 'heading':
      return (
        <Heading
          className={cn(
            'h-3 w-3 shrink-0',
            node.meta === 'h2'
              ? 'text-blue-500'
              : node.meta === 'h3'
                ? 'text-green-500'
                : 'text-orange-400',
          )}
        />
      );
    case 'code-block':
      return <Code2 className="h-3 w-3 shrink-0 text-purple-500" />;
    default:
      return <Circle className="h-2 w-2 shrink-0 text-muted-foreground/30" />;
  }
}
