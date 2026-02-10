import React from 'react';
import { useAppStore } from '@/shared/lib/store';
import { useSettingsStore } from '@/shared/lib/settings-store';
import { Button } from '@/shared/components/ui/button';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import { MessageSquarePlus, FolderPlus, ListCollapse, ArrowDownAZ, Clock, ListChecks } from 'lucide-react';
import { SidePanelMenu } from '@/entrypoints/overlay.content/aistudio/components/menu/SidePanelMenu';
import { FilterActions } from '../../../components/FilterActions';
import type { FilterState, ExplorerTypeFilter } from '../../../types/filter';
import { useI18n } from '@/shared/hooks/useI18n';
import { BatchToolbar } from './batch/BatchToolbar';

interface ExplorerHeaderProps {
  onNewFolder: () => void;
  onCollapseAll: () => void;
  onNewChat: () => void;
  filter: FilterState<ExplorerTypeFilter>;
}

export const ExplorerHeader = ({
  onNewFolder,
  onCollapseAll,
  onNewChat,
  filter,
}: ExplorerHeaderProps) => {
  const { t } = useI18n();
  const { ui, setExplorerSortOrder, setExplorerViewMode, setExplorerBatchMode } = useAppStore();

  const { sortOrder, viewMode } = ui.explorer;
  const { isBatchMode } = ui.explorer.batch;

  const handleSort = () => {
    const newOrder = sortOrder === 'alpha' ? 'date' : 'alpha';
    setExplorerSortOrder(newOrder);
  };

  const handleToggleViewMode = () => {
    const newMode = viewMode === 'tree' ? 'timeline' : 'tree';
    setExplorerViewMode(newMode);
  };

  return (
    <div className="flex flex-col border-b bg-background">
      <div className="px-3 pt-2 pb-1 flex items-center justify-between">
        <h1 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          {t('explorerHeader.library')}
        </h1>

        <div className="flex items-center gap-0.5">
          {isBatchMode ? (
            <BatchToolbar />
          ) : (
            <>
              <SimpleTooltip content={t('menu.collapseAll')}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onCollapseAll}
                >
                  <ListCollapse className="h-4 w-4" />
                </Button>
              </SimpleTooltip>

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
                  className="h-7 w-7"
                  onClick={handleSort}
                >
                  {sortOrder === 'alpha' ? (
                    <ArrowDownAZ className="h-4 w-4" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                </Button>
              </SimpleTooltip>

              <SimpleTooltip content={t('batch.batchSelection')}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setExplorerBatchMode(true)}
                >
                  <ListChecks className="h-4 w-4" />
                </Button>
              </SimpleTooltip>

              <SidePanelMenu
                onToggleViewMode={handleToggleViewMode}
                viewMode={viewMode}
              />
            </>
          )}
        </div>
      </div>

      <div className="px-3 pb-2 pt-1 flex items-center justify-between">
        <div className="flex-1 mr-2">
          <FilterActions filter={filter} />
        </div>
        <div className="flex items-center gap-1">
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
          <SimpleTooltip content={t('tooltip.newChat')}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onNewChat}
            >
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          </SimpleTooltip>
        </div>
      </div>
    </div>
  );
};
