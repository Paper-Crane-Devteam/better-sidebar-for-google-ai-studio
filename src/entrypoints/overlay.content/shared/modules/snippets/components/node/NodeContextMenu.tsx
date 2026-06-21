import React from 'react';
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/entrypoints/overlay.content/shared/components/ui/context-menu';
import {
  Copy,
  Edit,
  FolderPlus,
  Trash2,
  ClipboardCopy,
} from 'lucide-react';
import { useI18n } from '@/shared/hooks/useI18n';
import type { NodeApi } from '../../../../components/folder-tree/types';
import type { FolderTreeNodeData } from '../../../../components/folder-tree/types';

interface NodeContextMenuProps {
  node: NodeApi<FolderTreeNodeData>;
  onCreateFolder: (parentId: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onCopy: (e?: React.MouseEvent) => void;
  onEditSnippet?: (e?: React.MouseEvent) => void;
}

export const NodeContextMenu = ({
  node,
  onCreateFolder,
  onDelete,
  onDuplicate,
  onCopy,
  onEditSnippet,
}: NodeContextMenuProps) => {
  const { t } = useI18n();
  const isFile = node.data.type === 'file';
  const isFolder = node.data.type === 'folder';

  return (
    <ContextMenuContent className="w-48">
      {isFile && onEditSnippet && (
        <ContextMenuItem onClick={onEditSnippet}>
          <Edit className="mr-2 h-4 w-4" />
          {t('common.edit')}
        </ContextMenuItem>
      )}
      {isFile && (
        <ContextMenuItem onClick={onCopy}>
          <ClipboardCopy className="mr-2 h-4 w-4" />
          {t('snippets.copyContent')}
        </ContextMenuItem>
      )}
      {isFile && (
        <ContextMenuItem onClick={onDuplicate}>
          <Copy className="mr-2 h-4 w-4" />
          {t('snippets.duplicate')}
        </ContextMenuItem>
      )}
      {isFile && <ContextMenuSeparator />}
      {isFolder && (
        <ContextMenuItem onClick={() => onCreateFolder(node.data.id)}>
          <FolderPlus className="mr-2 h-4 w-4" />
          {t('menu.newFolder')}
        </ContextMenuItem>
      )}
      <ContextMenuItem onClick={() => node.edit()}>
        <Edit className="mr-2 h-4 w-4" />
        {t('snippets.rename')}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={onDelete} className="text-destructive">
        <Trash2 className="mr-2 h-4 w-4" />
        {t('common.delete')}
      </ContextMenuItem>
    </ContextMenuContent>
  );
};
