import React from 'react';
import { useI18n } from '@/shared/hooks/useI18n';
import {
  FolderPlus,
  Edit2,
  Trash2,
  Star,
  StarOff,
  Copy,
  Files,
  Pencil,
} from 'lucide-react';
import type { MenuEntryDef } from '@/entrypoints/overlay.content/shared/components/node-action-bar';
import type { NodeRendererProps } from 'react-arborist';
import type { FolderTreeNodeData } from '../../../../components/folder-tree/types';

interface UsePromptsMenuItemsParams {
  node: NodeRendererProps<FolderTreeNodeData>['node'];
  isFavorite: boolean;
  onDelete: () => void;
  onCreateFolder: (parentId: string) => void;
  onToggleFavorite: (id: string, isFav: boolean) => void;
  onCopy: (e?: React.MouseEvent) => void;
  onDuplicate: () => void;
  onEdit?: (e?: React.MouseEvent) => void;
}

export function usePromptsMenuItems({
  node,
  isFavorite,
  onDelete,
  onCreateFolder,
  onToggleFavorite,
  onCopy,
  onDuplicate,
  onEdit,
}: UsePromptsMenuItemsParams): MenuEntryDef[] {
  const { t } = useI18n();
  const isFile = node.data.type === 'file';
  const items: MenuEntryDef[] = [];

  // Folder-specific
  if (node.data.type === 'folder') {
    items.push({
      type: 'item',
      key: 'new-folder',
      icon: <FolderPlus className="h-4 w-4" />,
      label: t('node.newFolder'),
      onClick: (e) => {
        e?.stopPropagation();
        onCreateFolder(node.data.id);
      },
    });
    items.push({ type: 'separator', key: 'sep-folder-top' });
  }

  // File-specific
  if (isFile) {
    // — Organize —
    items.push({
      type: 'item',
      key: 'toggle-favorite',
      icon: isFavorite
        ? <StarOff className="h-4 w-4" />
        : <Star className="h-4 w-4" />,
      label: isFavorite ? t('node.removeFromFavorites') : t('node.addToFavorites'),
      onClick: () => onToggleFavorite(node.data.id, isFavorite),
    });

    items.push({ type: 'separator', key: 'sep-organize' });

    // — Manage —
    if (onEdit) {
      items.push({
        type: 'item',
        key: 'edit',
        icon: <Pencil className="h-4 w-4" />,
        label: t('prompts.editPrompt'),
        onClick: (e) => onEdit(e),
      });
    }

    items.push({
      type: 'item',
      key: 'copy',
      icon: <Copy className="h-4 w-4" />,
      label: t('prompts.copyContent'),
      onClick: (e) => onCopy(e),
    });

    items.push({
      type: 'item',
      key: 'duplicate',
      icon: <Files className="h-4 w-4" />,
      label: t('node.duplicate'),
      onClick: () => onDuplicate(),
    });

    items.push({
      type: 'item',
      key: 'rename',
      icon: <Edit2 className="h-4 w-4" />,
      label: t('node.rename'),
      onClick: () => node.edit(),
    });

    items.push({ type: 'separator', key: 'sep-file-bottom' });
  }

  // Folder: manage
  if (node.data.type === 'folder') {
    items.push({
      type: 'item',
      key: 'rename',
      icon: <Edit2 className="h-4 w-4" />,
      label: t('node.rename'),
      onClick: () => node.edit(),
    });

    items.push({ type: 'separator', key: 'sep-folder-manage' });
  }

  // Delete (always last)
  items.push({
    type: 'item',
    key: 'delete',
    icon: <Trash2 className="h-4 w-4" />,
    label: t('node.delete'),
    className: 'text-destructive focus:text-destructive',
    onClick: onDelete,
  });

  return items;
}
