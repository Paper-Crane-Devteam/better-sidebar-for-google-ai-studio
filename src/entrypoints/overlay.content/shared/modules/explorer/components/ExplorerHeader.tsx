import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useAppStore } from '@/shared/lib/store';
import { Button } from '@/shared/components/ui/button';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import {
  MessageSquarePlus,
  FolderPlus,
  ArrowDownAZ,
  Clock,
  ListChecks,
  Cloud,
  Loader2,
  Crosshair,
  Search,
  X,
  MoreHorizontal,
  Tags,
  MessageSquare,
  Image as ImageIcon,
  LayoutGrid,
  Star,
  Gem,
  NotebookText,
} from 'lucide-react';
import { Icon } from '@iconify/react';
import { debounce } from 'lodash';
import { SidePanelMenu } from '@/entrypoints/overlay.content/shared/components/menu/SidePanelMenu';
import { useModalStore } from '@/shared/lib/modal';
import { GDriveSyncSection } from '@/entrypoints/overlay.content/shared/components/GDriveSyncSection';
import type { FilterState, ExplorerTypeFilter } from '../../../types/filter';
import { useI18n } from '@/shared/hooks/useI18n';
import { BatchToolbar } from './batch/BatchToolbar';
import { usePegasusStore } from '@/shared/lib/pegasus-store';
import { SectionHeader } from './SectionHeader';

interface ExplorerHeaderProps {
  onNewFolder: () => void;
  onCollapseAll: () => void;
  onLocateCurrent: () => void;
  onSelectAll: () => void;
  onNewChat: () => void;
  newChatButton?: React.ReactNode;
  filter: FilterState<ExplorerTypeFilter>;
  filterTypes?: ExplorerTypeFilter[];
  menuActions?: {
    onViewHistory?: () => void;
    onSwitchToOriginalUI?: () => void;
    handleScanLibrary?: () => void;
  };
  isChatsSectionExpanded: boolean;
  onToggleChatsSection: () => void;
}

export const ExplorerHeader = ({
  onNewFolder,
  onCollapseAll,
  onLocateCurrent,
  onSelectAll,
  onNewChat,
  newChatButton,
  filter,
  filterTypes = ['all', 'conversation', 'text-to-image'],
  menuActions,
  isChatsSectionExpanded,
  onToggleChatsSection,
}: ExplorerHeaderProps) => {
  const { t } = useI18n();
  const {
    ui,
    setExplorerSortOrder,
    setExplorerViewMode,
    setExplorerBatchMode,
  } = useAppStore();

  const { sortOrder, viewMode } = ui.explorer;
  const { isBatchMode } = ui.explorer.batch;
  const { gdriveSyncing } = usePegasusStore();

  // Local search state with debounce
  const [localQuery, setLocalQuery] = useState(filter.search.query);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  useEffect(() => {
    setLocalQuery(filter.search.query);
  }, [filter.search.query]);

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      filter.search.setQuery(value);
      if (value) {
        filter.search.setIsOpen(true);
      }
    }, 350),
    [filter.search.setQuery, filter.search.setIsOpen],
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalQuery(value);
    debouncedSearch(value);
  };

  const handleClearSearch = () => {
    setLocalQuery('');
    filter.search.setQuery('');
    filter.search.setIsOpen(false);
    searchInputRef.current?.focus();
  };

  const handleSort = () => {
    const newOrder = sortOrder === 'alpha' ? 'date' : 'alpha';
    setExplorerSortOrder(newOrder);
  };

  const handleToggleViewMode = () => {
    const newMode = viewMode === 'tree' ? 'timeline' : 'tree';
    setExplorerViewMode(newMode);
  };

  // Type filter cycling
  const handleTypeToggle = () => {
    const currentIndex = filterTypes.indexOf(filter.type.value as ExplorerTypeFilter);
    const nextIndex = (currentIndex + 1) % filterTypes.length;
    filter.type.setValue(filterTypes[nextIndex]);
  };

  const getTypeTitle = () => {
    switch (filter.type.value) {
      case 'conversation': return t('tooltip.filterConversations');
      case 'text-to-image': return t('tooltip.filterImages');
      case 'gem': return t('tooltip.filterGems');
      case 'notebook': return t('tooltip.filterNotebooks');
      default: return t('tooltip.filterAll');
    }
  };

  // Check if any extra filter is active
  const hasActiveExtraFilters =
    filter.tags.selected.length > 0 ||
    filter.type.value !== 'all' ||
    filter.onlyFavorites.value;

  // CHATS section header actions: batch, locate, collapse
  const chatsSectionActions = (
    <>
      <SimpleTooltip content={t('batch.batchSelection')}>
        <Button
          variant="ghost"
          size="icon"
          className={`h-5 w-5 ${isBatchMode ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setExplorerBatchMode(!isBatchMode)}
        >
          <ListChecks className="h-3.5 w-3.5" />
        </Button>
      </SimpleTooltip>

      <SimpleTooltip content={t('menu.locateCurrent')}>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-muted-foreground hover:text-foreground"
          onClick={() => onLocateCurrent()}
        >
          <Crosshair className="h-3.5 w-3.5" />
        </Button>
      </SimpleTooltip>

      <SimpleTooltip content={t('menu.collapseAll')}>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-muted-foreground hover:text-foreground"
          onClick={() => onCollapseAll()}
        >
          <Icon icon="codicon:collapse-all" className="h-3.5 w-3.5" />
        </Button>
      </SimpleTooltip>
    </>
  );

  return (
    <div className="flex flex-col bg-background">
      {/* Row 1: Library title | cloud, (divider), sort, new folder, menu */}
      <div className="px-3 py-2 flex items-center justify-between">
        <h1 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground/70">
          {t('explorerHeader.library')}
        </h1>

        <div className="flex items-center gap-1">
          <SimpleTooltip content={gdriveSyncing ? t('data.gdriveAutoSyncing') : t('data.gdriveSync')}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => {
                useModalStore.getState().open({
                  type: 'info',
                  title: t('data.gdriveSync'),
                  content: (
                    <div className="py-2">
                      <GDriveSyncSection hideTitle={true} />
                    </div>
                  ),
                  modalClassName: 'max-w-md',
                });
              }}
            >
              {gdriveSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Cloud className="h-4 w-4" />
              )}
            </Button>
          </SimpleTooltip>

          <div className="h-4 w-[1px] bg-border mx-1" />

          <SimpleTooltip
            content={
              sortOrder === 'alpha'
                ? t('menu.sortByDate')
                : t('menu.sortAlphabetically')
            }
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleSort}
            >
              {sortOrder === 'alpha' ? (
                <ArrowDownAZ className="h-4 w-4" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
            </Button>
          </SimpleTooltip>

          {viewMode !== 'timeline' && (
            <SimpleTooltip content={t('menu.newFolder')}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={onNewFolder}
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
            </SimpleTooltip>
          )}

          <SidePanelMenu
            onToggleViewMode={handleToggleViewMode}
            viewMode={viewMode}
            menuActions={menuActions}
          />
        </div>
      </div>

      {/* New Chat CTA row */}
      {newChatButton}

      {/* CHATS collapsible section header */}
      <SectionHeader
        title={t('explorerHeader.chats')}
        isExpanded={isChatsSectionExpanded}
        onToggle={onToggleChatsSection}
        actions={chatsSectionActions}
      />

      {/* Collapsible content: inline search + more filters */}
      {isChatsSectionExpanded && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Search row with "..." button */}
          <div className="px-3 py-1 flex items-center gap-1">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                ref={searchInputRef}
                value={localQuery}
                onChange={handleSearchChange}
                placeholder={t('tooltip.search')}
                className="flex h-7 w-full rounded-sm border border-border/60 bg-transparent pl-7 pr-7 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    handleClearSearch();
                  }
                }}
              />
              {localQuery && (
                <button
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-sm cursor-pointer border-none bg-transparent"
                  onClick={handleClearSearch}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* More filters toggle */}
            <SimpleTooltip content={t('explorerHeader.moreFilters')}>
              <Button
                variant={hasActiveExtraFilters || moreFiltersOpen ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => setMoreFiltersOpen(!moreFiltersOpen)}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </SimpleTooltip>
          </div>

          {/* Expandable filter options (tags, type, favorites) */}
          {moreFiltersOpen && (
            <div className="px-3 py-1 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-100">
              <SimpleTooltip content={t('tooltip.filterByTags')}>
                <Button
                  variant={filter.tags.isOpen || filter.tags.selected.length > 0 ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => filter.tags.setIsOpen(!filter.tags.isOpen)}
                >
                  <Tags className="h-4 w-4" />
                </Button>
              </SimpleTooltip>

              <SimpleTooltip content={getTypeTitle()}>
                <Button
                  variant={filter.type.value === 'all' ? 'ghost' : 'secondary'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleTypeToggle}
                >
                  {filter.type.value === 'all' && <LayoutGrid className="h-4 w-4" />}
                  {filter.type.value === 'conversation' && <MessageSquare className="h-4 w-4" />}
                  {filter.type.value === 'text-to-image' && <ImageIcon className="h-4 w-4" />}
                  {filter.type.value === 'gem' && <Gem className="h-4 w-4" />}
                  {filter.type.value === 'notebook' && <NotebookText className="h-4 w-4" />}
                </Button>
              </SimpleTooltip>

              <SimpleTooltip content={t('tooltip.filterFavorites')}>
                <Button
                  variant={filter.onlyFavorites.value ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => filter.onlyFavorites.setValue(!filter.onlyFavorites.value)}
                >
                  <Star className={`h-4 w-4 ${filter.onlyFavorites.value ? 'fill-current' : ''}`} />
                </Button>
              </SimpleTooltip>
            </div>
          )}

          {/* Batch toolbar */}
          {isBatchMode && (
            <BatchToolbar onSelectAll={onSelectAll} />
          )}
        </div>
      )}
    </div>
  );
};
