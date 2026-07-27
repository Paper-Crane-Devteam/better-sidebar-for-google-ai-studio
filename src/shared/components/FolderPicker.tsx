import React, { useCallback, useMemo, useState } from 'react';
import { TreeView, PendingNewFolder } from '@/shared/components/ui/tree-view';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { cn } from '@/shared/lib/utils/utils';
import { Folder, FolderPlus } from 'lucide-react';
import { useI18n } from '@/shared/hooks/useI18n';
import { Button } from '@/shared/components/ui/button';

interface FolderItem {
  id: string;
  name: string;
  parent_id?: string | null;
}

interface FolderPickerProps {
  folders: FolderItem[];
  onSelect: (folderId: string | null) => void;
  selectedIds?: string[]; // IDs to exclude (e.g. prevent moving folder into itself)
  initialSelectedId?: string | null;
  className?: string;
  /** Called to create a new folder. Returns the new folder id or null. */
  onCreateFolder?: (name: string, parentId: string | null) => Promise<string | null>;
}

export const FolderPicker = ({
  folders,
  onSelect,
  selectedIds = [],
  initialSelectedId = null,
  className,
  onCreateFolder,
}: FolderPickerProps) => {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [pendingParentId, setPendingParentId] = useState<string | null | undefined>(undefined);

  const treeData = useMemo(() => {
    const folderMap = new Map<string, any>();
    const rootNodes: any[] = [];

    folders.forEach((f) => {
      if (selectedIds.includes(f.id)) return;
      folderMap.set(f.id, {
        id: f.id,
        name: f.name,
        type: 'folder' as const,
        children: [],
        data: f,
      });
    });

    folders.forEach((f) => {
      const node = folderMap.get(f.id);
      if (!node) return;
      if (f.parent_id && folderMap.has(f.parent_id)) {
        folderMap.get(f.parent_id).children.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    return rootNodes;
  }, [folders, selectedIds]);

  const handleSelect = (item: any) => {
    setSelectedId(item.id);
    onSelect(item.id);
  };

  const handleStartCreate = () => {
    // Insert pending node under selected folder, or root if nothing selected
    setPendingParentId(selectedId);
  };

  const handleConfirmCreate = useCallback(async (name: string) => {
    if (!onCreateFolder) return;
    const parentId = pendingParentId === undefined ? null : pendingParentId;
    const newId = await onCreateFolder(name, parentId);
    setPendingParentId(undefined);
    if (newId) {
      setSelectedId(newId);
      onSelect(newId);
    }
  }, [onCreateFolder, pendingParentId, onSelect]);

  const handleCancelCreate = useCallback(() => {
    setPendingParentId(undefined);
  }, []);

  const pendingNewFolder: PendingNewFolder | null =
    pendingParentId !== undefined
      ? { parentId: pendingParentId, onConfirm: handleConfirmCreate, onCancel: handleCancelCreate }
      : null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {onCreateFolder && (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 self-start"
          onClick={handleStartCreate}
          disabled={pendingParentId !== undefined}
        >
          <FolderPlus className="h-4 w-4" />
          {t('moveItemsDialog.createFolder')}
        </Button>
      )}
      <div className="min-h-[300px] max-h-[80vh] w-full border rounded-md">
        <ScrollArea className="h-full w-full p-2">
          {/* Root level option */}
          <div
            className={cn(
              'flex items-center gap-2 py-1 px-2 rounded-sm hover:bg-accent cursor-pointer text-sm w-full mb-1',
              selectedId === null && 'bg-accent',
            )}
            onClick={() => {
              setSelectedId(null);
              onSelect(null);
            }}
          >
            <Folder className="h-4 w-4 text-muted-foreground" />
            <span>{t('moveItemsDialog.rootLevel')}</span>
          </div>
          <TreeView
            items={treeData}
            onSelect={handleSelect}
            selectedId={selectedId}
            pendingNewFolder={pendingNewFolder}
          />
        </ScrollArea>
      </div>
    </div>
  );
};
