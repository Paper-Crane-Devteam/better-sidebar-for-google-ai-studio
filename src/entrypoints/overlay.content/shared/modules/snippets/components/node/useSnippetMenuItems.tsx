import React from 'react';
import {
  Copy,
  Edit,
  FolderPlus,
  Pin,
  PinOff,
  Trash2,
  ClipboardCopy,
} from 'lucide-react';
import { useI18n } from '@/shared/hooks/useI18n';
import type { NodeApi } from '../../../../components/folder-tree/types';
import type { FolderTreeNodeData } from '../../../../components/folder-tree/types';
import type { MenuEntryDef } from '../../../../components/node-action-bar';

interface UseSnippetMenuItemsParams {
  node: NodeApi<FolderTreeNodeData>;
  isPinned: boolean;
  onDelete: () => void;
  onCreateFolder: (parentId: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
  onCopy: (e?: React.MouseEvent) => void;
  onDuplicate: () => void;
  onEdit?: (e?: React.MouseEvent) => void;
}

export function useSnippetMenuItems({
  node,
  isPinned,
  onDelete,
  onCreateFolder,
  onTogglePin,
  onCopy,
  onDuplicate,
  onEdit,
}: UseSnippetMenuItemsParams): MenuEntryDef[] {
  const { t } = useI18n();
  const isFile = node.data.type === 'file';
  const isFolder = node.data.type === 'folder';

  const items: MenuEntryDef[] = [];

  if (isFile && onEdit) {
    items.push({
      type: 'item',
      key: 'edit',
      icon: <Edit className="h-4 w-4" />,
      label: t('common.edit'),
      onClick: () => onEdit?.(),
    });
  }

  if (isFile) {
    items.push({
      type: 'item',
      key: 'copy',
      icon: <ClipboardCopy className="h-4 w-4" />,
      label: t('snippets.copyContent'),
      onClick: () => onCopy?.(),
    });
    items.push({
      type: 'item',
      key: 'duplicate',
      icon: <Copy className="h-4 w-4" />,
      label: t('snippets.duplicate'),
      onClick: () => onDuplicate(),
    });
    items.push({ type: 'separator', key: 'sep-file' });
  }

  if (isFolder) {
    items.push({
      type: 'item',
      key: 'newFolder',
      icon: <FolderPlus className="h-4 w-4" />,
      label: t('menu.newFolder'),
      onClick: () => onCreateFolder(node.data.id),
    });
    items.push({
      type: 'item',
      key: 'pin',
      icon: isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4 rotate-45" />,
      label: isPinned ? t('node.unpinFromTop') : t('node.pinToTop'),
      onClick: () => onTogglePin(node.data.id, isPinned),
    });
  }

  items.push({
    type: 'item',
    key: 'rename',
    icon: <Edit className="h-4 w-4" />,
    label: t('snippets.rename'),
    onClick: () => node.edit(),
  });

  items.push({ type: 'separator', key: 'sep-delete' });

  items.push({
    type: 'item',
    key: 'delete',
    icon: <Trash2 className="h-4 w-4" />,
    label: t('common.delete'),
    onClick: onDelete,
    className: 'text-destructive',
  });

  return items;
}
