import { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { List } from 'lucide-react';
import { useI18n } from '@/shared/hooks/useI18n';
import { useOutline } from './useOutline';
import { FilterChips } from './components/FilterChips';
import { OutlineSectionItem } from './components/OutlineSectionItem';

export interface OutlineContentHandle {
  collapseAll: () => void;
  scrollToActive: () => void;
}

/**
 * Outline content rendered inside the collapsible Explorer section.
 * VSCode-style tree with headings, code blocks, and click-to-navigate.
 */
export const OutlineContent = forwardRef<OutlineContentHandle>((_, ref) => {
  const { t } = useI18n();
  const {
    sections,
    activeMessageId,
    filter,
    setFilter,
    searchQuery,
    scrollToMessage,
    isLoading,
    stats,
    isOnConversation,
  } = useOutline();

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const activeRef = useRef<HTMLDivElement>(null!);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  // Expose imperative methods to parent via ref
  useImperativeHandle(ref, () => ({
    collapseAll: () => {
      const allIds = new Set(sections.map((s) => s.id));
      setCollapsedSections(allIds);
    },
    scrollToActive: () => {
      if (activeRef.current) {
        activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
  }), [sections]);

  // ── Toolbar ──────────────────────────────────────────────────────
  const toolbar = (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-border/30">
      <FilterChips filter={filter} onFilterChange={setFilter} stats={stats} />
      <div className="flex-1" />
      {stats.turns > 0 && (
        <span className="text-[10px] text-muted-foreground/60 tabular-nums ml-1">
          {stats.turns}
        </span>
      )}
    </div>
  );

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
});

OutlineContent.displayName = 'OutlineContent';
