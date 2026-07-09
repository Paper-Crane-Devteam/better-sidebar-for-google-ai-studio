import React from 'react';
import {
  Edit,
  FolderPlus,
  FolderInput,
  Pin,
  PinOff,
  Star,
  StarOff,
  Trash2,
  ClipboardCopy,
  Download,
  FileCode,
  MessageSquare,
  Braces,
} from 'lucide-react';
import { useI18n } from '@/shared/hooks/useI18n';
import type { NodeApi } from '../../../../components/folder-tree/types';
import type { FolderTreeNodeData } from '../../../../components/folder-tree/types';
import type { MenuEntryDef } from '../../../../components/node-action-bar';
import obsidianIcon from '@/assets/icons/obsidian.svg';
import notionIcon from '@/assets/icons/notion.svg';

interface UseSnippetMenuItemsParams {
  node: NodeApi<FolderTreeNodeData>;
  isPinned: boolean;
  isFavorite?: boolean;
  onDelete: () => void;
  onCreateFolder: (parentId: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
  onToggleFavorite?: (id: string, isFav: boolean) => void;
  onMoveTo?: () => void;
  onCopy: (e?: React.MouseEvent) => void;
  onEdit?: (e?: React.MouseEvent) => void;
  onExport?: (format: 'markdown' | 'text' | 'json' | 'obsidian' | 'notion') => void;
}

export function useSnippetMenuItems({
  node,
  isPinned,
  isFavorite,
  onDelete,
  onCreateFolder,
  onTogglePin,
  onToggleFavorite,
  onMoveTo,
  onCopy,
  onEdit,
  onExport,
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
    items.push({ type: 'separator', key: 'sep-file' });
  }

  // Favorite toggle for files
  if (isFile && onToggleFavorite) {
    items.push({
      type: 'item',
      key: 'toggle-favorite',
      icon: isFavorite
        ? <StarOff className="h-4 w-4" />
        : <Star className="h-4 w-4" />,
      label: isFavorite ? t('node.removeFromFavorites') : t('node.addToFavorites'),
      onClick: () => onToggleFavorite(node.data.id, !!isFavorite),
    });
  }

  // Move to for files
  if (isFile && onMoveTo) {
    items.push({
      type: 'item',
      key: 'move-to',
      icon: <FolderInput className="h-4 w-4" />,
      label: t('node.moveTo'),
      onClick: () => onMoveTo(),
    });
  }

  if (isFile && (onToggleFavorite || onMoveTo)) {
    items.push({ type: 'separator', key: 'sep-organize' });
  }

  // Export submenu for files
  if (isFile && onExport) {
    items.push({
      type: 'sub',
      key: 'export',
      icon: <Download className="h-4 w-4" />,
      label: t('export.export'),
      contentClassName: 'w-48',
      children: [
        {
          type: 'item' as const,
          key: 'export-text',
          icon: <MessageSquare className="h-4 w-4" />,
          label: t('export.exportAsText'),
          onClick: () => onExport('text'),
        },
        {
          type: 'item' as const,
          key: 'export-md',
          icon: <FileCode className="h-4 w-4" />,
          label: t('export.exportAsMarkdown'),
          onClick: () => onExport('markdown'),
        },
        {
          type: 'item' as const,
          key: 'export-json',
          icon: <Braces className="h-4 w-4" />,
          label: t('export.exportAsJson'),
          onClick: () => onExport('json'),
        },
        { type: 'separator' as const, key: 'sep-export-apps' },
        {
          type: 'item' as const,
          key: 'export-obsidian',
          icon: <img src={obsidianIcon} alt="Obsidian" className="h-4 w-4" />,
          label: t('export.exportToObsidian'),
          onClick: () => onExport('obsidian'),
        },
        {
          type: 'item' as const,
          key: 'export-notion',
          icon: <img src={notionIcon} alt="Notion" className="h-4 w-4" />,
          label: t('export.exportToNotion'),
          onClick: () => onExport('notion'),
        },
      ],
    });
    items.push({ type: 'separator', key: 'sep-export' });
  }

  if (isFolder) {
    items.push({
      type: 'item',
      key: 'newFolder',
      icon: <FolderPlus className="h-4 w-4" />,
      label: t('node.newFolder'),
      onClick: () => onCreateFolder(node.data.id),
    });
    items.push({
      type: 'item',
      key: 'pin',
      icon: isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4 rotate-45" />,
      label: isPinned ? t('node.unpinFromTop') : t('node.pinToTop'),
      onClick: () => onTogglePin(node.data.id, isPinned),
    });
    if (onMoveTo) {
      items.push({
        type: 'item',
        key: 'move-to',
        icon: <FolderInput className="h-4 w-4" />,
        label: t('node.moveTo'),
        onClick: () => onMoveTo(),
      });
    }
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
