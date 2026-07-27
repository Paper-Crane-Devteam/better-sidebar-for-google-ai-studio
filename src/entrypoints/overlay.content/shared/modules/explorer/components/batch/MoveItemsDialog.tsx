import React, { useCallback, useMemo } from 'react';
import { useAppStore } from '@/shared/lib/store';
import { FolderPicker } from '@/shared/components/FolderPicker';
import { Folder } from 'lucide-react';
import { useI18n } from '@/shared/hooks/useI18n';

interface MoveItemsDialogProps {
  onSelect: (folderId: string | null) => void;
  selectedIds: string[];
  initialSelectedId?: string | null;
}

export const MoveItemsDialog = ({ onSelect, selectedIds, initialSelectedId }: MoveItemsDialogProps) => {
  const folders = useAppStore((state) => state.folders);
  const createFolder = useAppStore((state) => state.createFolder);
  const { t } = useI18n();

  const handleCreateFolder = useCallback(
    (name: string, parentId: string | null) => createFolder(name, parentId),
    [createFolder],
  );

  // Build the full path for the currently selected folder
  // Only relevant when initialSelectedId is a non-null string (i.e. previously configured)
  const currentPath = useMemo(() => {
    if (!initialSelectedId) return null;
    const folderMap = new Map(folders.map((f) => [f.id, f]));
    const target = folderMap.get(initialSelectedId);
    if (!target) return 'deleted'; // folder was deleted
    const parts: string[] = [];
    let current: typeof target | undefined = target;
    while (current) {
      parts.unshift(current.name);
      current = current.parent_id ? folderMap.get(current.parent_id) : undefined;
    }
    return parts.join(' / ');
  }, [initialSelectedId, folders]);

  // Show hint only when a folder was previously set but has been deleted
  const showDeletedHint = initialSelectedId && currentPath === 'deleted';

  return (
    <div className="flex flex-col gap-2">
      {initialSelectedId && currentPath && currentPath !== 'deleted' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
          <Folder className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {t('defaultFolder.currentLabel')}{currentPath}
          </span>
        </div>
      )}
      {showDeletedHint && (
        <div className="flex items-center gap-2 text-sm text-destructive/80 px-1">
          <Folder className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {t('defaultFolder.folderDeleted')}
          </span>
        </div>
      )}
      <FolderPicker
        folders={folders}
        onSelect={onSelect}
        selectedIds={selectedIds}
        initialSelectedId={showDeletedHint ? null : initialSelectedId}
        onCreateFolder={handleCreateFolder}
      />
    </div>
  );
};
