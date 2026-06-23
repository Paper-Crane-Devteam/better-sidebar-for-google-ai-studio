import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import {
  FolderPlus,
  ListCollapse,
  ListChecks,
  Plus,
  ArrowDownAZ,
  Clock,
  Cloud,
  Loader2,
  X,
  Trash2,
  FolderInput,
  CheckSquare,
} from 'lucide-react';
import { SidePanelMenu } from '@/entrypoints/overlay.content/shared/components/menu/SidePanelMenu';
import { FilterActions } from '../../../components/FilterActions';
import { GDriveSyncSection } from '@/entrypoints/overlay.content/shared/components/GDriveSyncSection';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAppStore } from '@/shared/lib/store';
import { useModalStore } from '@/shared/lib/modal';
import { usePegasusStore } from '@/shared/lib/pegasus-store';
import { modal } from '@/shared/lib/modal';
import { SnippetMoveDialog } from './SnippetMoveDialog';
import type { FilterState, ExplorerTypeFilter } from '../../../types/filter';

interface SnippetsHeaderProps {
  onNewFolder: () => void;
  onCollapseAll: () => void;
  onSelectAll: () => void;
  onNewSnippet: () => void;
  filter: FilterState<ExplorerTypeFilter>;
  menuActions?: {
    onViewHistory?: () => void;
    onSwitchToOriginalUI?: () => void;
  };
}

export const SnippetsHeader = ({
  onNewFolder,
  onCollapseAll,
  onSelectAll,
  onNewSnippet,
  filter,
  menuActions,
}: SnippetsHeaderProps) => {
  const { t } = useI18n();
  const {
    ui,
    setSnippetsSortOrder,
    setSnippetsBatchMode,
    setSnippetsBatchSelection,
    deleteSnippetItems,
    moveSnippetItems,
  } = useAppStore();

  const { sortOrder } = ui.snippets;
  const { isBatchMode, selectedIds } = ui.snippets.batch;
  const { gdriveSyncing } = usePegasusStore();

  const handleSort = () => {
    const newOrder = sortOrder === 'alpha' ? 'date' : 'alpha';
    setSnippetsSortOrder(newOrder);
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;

    const confirmed = await modal.confirm({
      title: t('batch.deleteConfirmTitle', { count: selectedIds.length }),
      content: t('batch.deleteConfirmMessage'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
    });

    if (confirmed) {
      await deleteSnippetItems(selectedIds);
      setSnippetsBatchSelection([]);
      setSnippetsBatchMode(false);
    }
  };

  const handleBatchMove = async () => {
    if (selectedIds.length === 0) return;

    let targetFolderId: string | null = null;

    const confirmed = await modal.confirm({
      title: t('batch.moveTitle'),
      content: (
        <SnippetMoveDialog
          selectedIds={selectedIds}
          onSelect={(id) => (targetFolderId = id)}
        />
      ),
      modalClassName: 'max-w-xl',
      confirmText: t('common.move'),
      cancelText: t('common.cancel'),
    });

    if (confirmed) {
      const state = useAppStore.getState();
      const filesToMove = selectedIds.filter(id =>
        state.snippets.some(s => s.id === id),
      );
      await moveSnippetItems(filesToMove, targetFolderId);
      setSnippetsBatchSelection([]);
      setSnippetsBatchMode(false);
    }
  };

  return (
    <div className="flex flex-col border-b bg-background">
      {/* Row 1: Title + actions */}
      <div className="px-3 pt-2 pb-1 flex items-center justify-between">
        <h1 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          {t('tabs.snippets')}
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
              className={`h-7 w-7 ${isBatchMode ? 'bg-primary/15 text-primary' : ''}`}
              onClick={() => setSnippetsBatchMode(!isBatchMode)}
            >
              <ListChecks className="h-4 w-4" />
            </Button>
          </SimpleTooltip>

          <SidePanelMenu menuActions={menuActions} />
        </div>
      </div>

      {/* Row 2: FilterActions (search, favorites) + New Folder, New Snippet */}
      <div className="px-3 pb-2 pt-1 flex items-center justify-between">
        <div className="flex-1 mr-2">
          <FilterActions
            filter={filter}
            visibleFilters={['search', 'favorites']}
          />
        </div>
        <div className="flex items-center gap-1">
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
          <SimpleTooltip content={t('snippets.createSnippet')}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onNewSnippet}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </SimpleTooltip>
        </div>
      </div>

      {/* Row 3: Batch toolbar (conditional) */}
      {isBatchMode && (
        <div className="px-3 py-1.5 flex items-center justify-between border-t bg-muted/30">
          <span className="text-xs text-muted-foreground">
            {selectedIds.length > 0
              ? t('batch.selectedCount', { count: selectedIds.length })
              : t('batch.selectItems')}
          </span>
          <div className="flex items-center gap-1">
            <SimpleTooltip content={t('batch.selectAll')}>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSelectAll}>
                <CheckSquare className="h-4 w-4" />
              </Button>
            </SimpleTooltip>

            <div className="w-[1px] h-4 bg-border mx-0.5" />

            <SimpleTooltip content={t('batch.deleteSelected')}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                disabled={selectedIds.length === 0}
                onClick={handleBatchDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </SimpleTooltip>

            <SimpleTooltip content={t('batch.moveSelected')}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={selectedIds.length === 0}
                onClick={handleBatchMove}
              >
                <FolderInput className="h-4 w-4" />
              </Button>
            </SimpleTooltip>

            <div className="w-[1px] h-4 bg-border mx-0.5" />

            <SimpleTooltip content={t('batch.exitBatchMode')}>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSnippetsBatchMode(false)}>
                <X className="h-4 w-4" />
              </Button>
            </SimpleTooltip>
          </div>
        </div>
      )}
    </div>
  );
};
