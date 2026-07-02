import React from 'react';
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
} from 'lucide-react';
import { Icon } from '@iconify/react';
import { SidePanelMenu } from '@/entrypoints/overlay.content/shared/components/menu/SidePanelMenu';
import { useModalStore } from '@/shared/lib/modal';
import { GDriveSyncSection } from '@/entrypoints/overlay.content/shared/components/GDriveSyncSection';
import { FilterActions } from '../../../components/FilterActions';
import type { FilterState, ExplorerTypeFilter } from '../../../types/filter';
import { useI18n } from '@/shared/hooks/useI18n';
import { BatchToolbar } from './batch/BatchToolbar';
import { SplitIconButton, type SplitDropdownItem } from '@/shared/components/ui/split-icon-button';
import { usePegasusStore } from '@/shared/lib/pegasus-store';
import { SectionHeader } from './SectionHeader';

interface ExplorerHeaderProps {
  onNewFolder: () => void;
  onCollapseAll: () => void;
  onSelectAll: () => void;
  onNewChat: () => void;
  newChatDropdownItems?: SplitDropdownItem[];
  filter: FilterState<ExplorerTypeFilter>;
  filterTypes?: ExplorerTypeFilter[];
  extraHeaderButtons?: React.ReactNode;
  visibleFilters?: ('search' | 'tags' | 'type' | 'favorites')[];
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
  onSelectAll,
  onNewChat,
  newChatDropdownItems,
  filter,
  filterTypes,
  extraHeaderButtons,
  visibleFilters,
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

  const handleSort = () => {
    const newOrder = sortOrder === 'alpha' ? 'date' : 'alpha';
    setExplorerSortOrder(newOrder);
  };

  const handleToggleViewMode = () => {
    const newMode = viewMode === 'tree' ? 'timeline' : 'tree';
    setExplorerViewMode(newMode);
  };

  // Action buttons for the CHATS section header: sort, batch, collapse
  const chatsSectionActions = (
    <>
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
          className="h-5 w-5 text-muted-foreground hover:text-foreground"
          onClick={() => handleSort()}
        >
          {sortOrder === 'alpha' ? (
            <ArrowDownAZ className="h-3.5 w-3.5" />
          ) : (
            <Clock className="h-3.5 w-3.5" />
          )}
        </Button>
      </SimpleTooltip>

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
      {/* Row 1: EXPLORER title + sync + three-dot menu */}
      <div className="px-3 pt-2 pb-1 flex items-center justify-between border-b">
        <h1 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          {t('explorerHeader.library')}
        </h1>

        <div className="flex items-center gap-0.5">
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

          <SidePanelMenu
            onToggleViewMode={handleToggleViewMode}
            viewMode={viewMode}
            menuActions={menuActions}
          />
        </div>
      </div>

      {/* Row 2: CHATS collapsible section header with batch/collapse/sort */}
      <SectionHeader
        title={t('explorerHeader.chats')}
        isExpanded={isChatsSectionExpanded}
        onToggle={onToggleChatsSection}
        actions={chatsSectionActions}
      />

      {/* Collapsible content: filter row + addon bars */}
      {isChatsSectionExpanded && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Row 3: Filter toggles + new folder + new chat */}
          <div className="px-3 py-1.5 flex items-center justify-between border-b border-border/30">
            <div className="flex-1 mr-2">
              <FilterActions
                filter={filter}
                availableTypes={filterTypes}
                visibleFilters={visibleFilters}
              />
            </div>
            <div className="flex items-center gap-0.5">
              {viewMode !== 'timeline' && (
                <SimpleTooltip content={t('menu.newFolder')}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={onNewFolder}
                  >
                    <FolderPlus className="h-4 w-4" />
                  </Button>
                </SimpleTooltip>
              )}
              <SplitIconButton
                icon={<MessageSquarePlus className="h-4 w-4" />}
                tooltip={t('tooltip.newChat')}
                onClick={onNewChat}
                dropdownItems={newChatDropdownItems}
              />
              {extraHeaderButtons}
            </div>
          </div>

          {/* Batch toolbar addon */}
          {isBatchMode && (
            <BatchToolbar onSelectAll={onSelectAll} />
          )}
        </div>
      )}
    </div>
  );
};
