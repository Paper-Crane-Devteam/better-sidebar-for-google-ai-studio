import { useState, useRef, useEffect } from 'react';
import {
  ChevronRight,
  Code2,
  Heading,
  Search,
  Circle,
  MapPin,
  List,
  Image,
  Table2,
  Link2,
  Sigma,
  Copy,
  ChevronsUpDown,
  ChevronsDownUp,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils/utils';
import { useI18n } from '@/shared/hooks/useI18n';
import { useOutline } from './useOutline';
import { OverflowTooltip } from '@/shared/components/ui/overflow-tooltip';
import { toast } from '@/shared/lib/toast';
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

  const expandAll = () => setCollapsedSections(new Set());
  const collapseAll = () => {
    const allIds = new Set(sections.map((s) => s.id));
    setCollapsedSections(allIds);
  };
  const isAllCollapsed = sections.length > 0 && collapsedSections.size === sections.length;

  // ── Toolbar (always visible) ─────────────────────────────────────
  const toolbar = (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-border/30">
      {/* Filter chips — only show filters that have content */}
      <FilterChips filter={filter} onFilterChange={setFilter} stats={stats} />
      <div className="flex-1" />
      {/* Expand/Collapse all */}
      {sections.length > 0 && (
        <button
          onClick={isAllCollapsed ? expandAll : collapseAll}
          className="p-1 rounded-md transition-colors text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          title={isAllCollapsed ? t('outline.expandAll') : t('outline.collapseAll')}
        >
          {isAllCollapsed
            ? <ChevronsUpDown className="h-3.5 w-3.5" />
            : <ChevronsDownUp className="h-3.5 w-3.5" />
          }
        </button>
      )}
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
  stats,
}: {
  filter: OutlineFilter;
  onFilterChange: (f: OutlineFilter) => void;
  stats: { headings: number; codeBlocks: number; images: number; tables: number; links: number; math: number };
}) {
  const { t } = useI18n();
  const filters: { key: OutlineFilter; label: string; icon?: React.ReactNode; count: number }[] = [
    { key: 'all', label: t('outline.filterAll'), count: -1 }, // always show
    { key: 'headings', label: t('outline.filterHeadings'), icon: <Heading className="h-3 w-3" />, count: stats.headings },
    { key: 'code', label: t('outline.filterCode'), icon: <Code2 className="h-3 w-3" />, count: stats.codeBlocks },
  ];

  // Only show filters that have content (except 'all' which always shows)
  const visibleFilters = filters.filter((f) => f.count === -1 || f.count > 0);

  return (
    <div className="flex items-center gap-1">
      {visibleFilters.map(({ key, label, icon, count }) => (
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
          {count > 0 && (
            <span className="text-[9px] opacity-60">{count}</span>
          )}
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
  const { t } = useI18n();
  const hasChildren = section.children.length > 0;

  const handleCopyQuery = (e: React.MouseEvent) => {
    e.stopPropagation();
    const content = section.userQueryFull || section.userQuery;
    navigator.clipboard.writeText(content);
    toast.success(t('toast.copiedToClipboard'), 1000);
  };

  const handleCopyResponse = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (section.modelContent) {
      navigator.clipboard.writeText(section.modelContent);
      toast.success(t('toast.copiedToClipboard'), 1000);
    }
  };

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
          'group/section flex items-center gap-1 px-2 py-1 rounded-md relative',
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

        {/* Query text with overflow tooltip */}
        <OverflowTooltip
          content={section.userQueryFull || section.userQuery}
          placement="right"
          className={cn(
            'text-xs leading-snug truncate flex-1',
            isActive
              ? 'text-primary font-medium'
              : 'text-foreground/80 group-hover/section:text-foreground',
          )}
        >
          {section.userQuery}
        </OverflowTooltip>

        {isActive && (
          <MapPin className="h-3 w-3 text-primary shrink-0 opacity-70" />
        )}

        {/* Hover action buttons */}
        <div
          className="invisible group-hover/section:visible flex items-center gap-1 shrink-0 ml-1"
          data-tooltip-suppress
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleCopyQuery}
            className="h-4 w-4 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
            title={t('outline.copyQuery')}
          >
            <Copy className="h-3 w-3" />
          </button>
          {section.modelContent && (
            <button
              onClick={handleCopyResponse}
              className="h-4 w-4 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
              title={t('outline.copyResponse')}
            >
              <Copy className="h-3 w-3 text-purple-400" />
            </button>
          )}
        </div>
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

// ─── Outline Node Item (heading/code/image/table/link/math) ───────────

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
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const content = node.rawContent || node.label;
    if (content) {
      navigator.clipboard.writeText(content);
      toast.success(t('toast.copiedToClipboard'), 1000);
    }
  };

  return (
    <div>
      <div
        onClick={() => navigable && onNavigate(messageId)}
        className={cn(
          'group/node flex items-center gap-1 px-2 py-1 rounded-md relative',
          'transition-colors duration-100',
          navigable
            ? 'cursor-pointer hover:bg-accent/40'
            : 'cursor-default opacity-50',
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
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

        <OverflowTooltip
          content={node.label}
          placement="right"
          className={cn(
            'text-xs leading-snug truncate flex-1',
            node.type === 'heading'
              ? 'text-foreground/90 font-medium'
              : 'text-muted-foreground group-hover/node:text-foreground',
          )}
        >
          {node.label}
        </OverflowTooltip>

        {node.meta && node.type === 'code-block' && (
          <span className="text-[10px] px-1 py-px rounded bg-muted/50 text-muted-foreground/70 font-mono shrink-0">
            {node.meta}
          </span>
        )}

        {/* Hover copy button */}
        <div
          className="invisible group-hover/node:visible flex items-center shrink-0 ml-1"
          data-tooltip-suppress
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleCopy}
            className="h-4 w-4 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
            title={t('outline.copy')}
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
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
            node.meta === 'h1'
              ? 'text-red-500'
              : node.meta === 'h2'
                ? 'text-blue-500'
                : node.meta === 'h3'
                  ? 'text-green-500'
                  : 'text-orange-400',
          )}
        />
      );
    case 'code-block':
      return <Code2 className="h-3 w-3 shrink-0 text-purple-500" />;
    case 'image':
      return <Image className="h-3 w-3 shrink-0 text-pink-500" />;
    case 'table':
      return <Table2 className="h-3 w-3 shrink-0 text-cyan-500" />;
    case 'link':
      return <Link2 className="h-3 w-3 shrink-0 text-blue-400" />;
    case 'math':
      return <Sigma className="h-3 w-3 shrink-0 text-amber-500" />;
    default:
      return <Circle className="h-2 w-2 shrink-0 text-muted-foreground/30" />;
  }
}
