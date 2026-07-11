import { useState, useRef, useEffect } from 'react';
import {
  Search,
  List,
  ChevronsUpDown,
  ChevronsDownUp,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils/utils';
import { useI18n } from '@/shared/hooks/useI18n';
import { useOutline } from './useOutline';
import { FilterChips } from './components/FilterChips';
import { OutlineSectionItem } from './components/OutlineSectionItem';

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

  // ── Toolbar ──────────────────────────────────────────────────────
  const toolbar = (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-border/30">
      <FilterChips filter={filter} onFilterChange={setFilter} stats={stats} />
      <div className="flex-1" />
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
      {stats.turns > 0 && (
        <span className="text-[10px] text-muted-foreground/60 tabular-nums ml-1">
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

  // ── Empty / loading states ───────────────────────────────────────
  if (!isOnConversation) {
    return (
      <div className="flex flex-col h-full">
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
      <div className="flex flex-col h-full">
        {toolbar}
        <div className="flex items-center justify-center py-6 min-h-[80px]">
          <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="flex flex-col h-full">
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
    <div ref={containerRef} className="flex flex-col h-full min-h-0">
      {toolbar}
      {searchBar}

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
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
