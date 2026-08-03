import React from 'react';
import { useI18n } from '@/shared/hooks/useI18n';
import {
  Eye,
  FolderPlus,
  Edit2,
  Trash2,
  Star,
  StarOff,
  Copy,
  Files,
  Pencil,
  Pin,
  PinOff,
} from 'lucide-react';
import type { MenuEntryDef } from '@/entrypoints/overlay.content/shared/components/node-action-bar';
import type { NodeRendererProps } from 'react-arborist';
import type { FolderTreeNodeData } from '../../../../components/folder-tree/types';

interface UsePromptsMenuItemsParams {
  node: NodeRendererProps<FolderTreeNodeData>['node'];
  isFavorite: boolean;
  isPinned: boolean;
  onDelete: () => void;
  onCreateFolder: (parentId: string) => void;
  onToggleFavorite: (id: string, isFav: boolean) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
  onCopy: (e?: React.MouseEvent) => void;
  onDuplicate: () => void;
  onEdit?: (e?: React.MouseEvent) => void;
  onPreview?: (e?: React.MouseEvent) => void;
}

export function usePromptsMenuItems({
  node,
  isFavorite,
  isPinned,
  onDelete,
  onCreateFolder,
  onToggleFavorite,
  onTogglePin,
  onCopy,
  onDuplicate,
  onEdit,
  onPreview,
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
    items.push({
      type: 'item',
      key: 'toggle-pin',
      icon: isPinned
        ? <PinOff className="h-4 w-4" />
        : <Pin className="h-4 w-4 rotate-45" />,
      label: isPinned ? t('node.unpinFromTop') : t('node.pinToTop'),
      onClick: () => onTogglePin(node.data.id, isPinned),
    });
    items.push({ type: 'separator', key: 'sep-folder-top' });
  }

  // File-specific
  if (isFile) {
    // — View —
    if (onPreview) {
      items.push({
        type: 'item',
        key: 'view',
        icon: <Eye className="h-4 w-4" />,
        label: t('prompts.viewPrompt'),
        onClick: () => onPreview?.(),
      });
    }

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
