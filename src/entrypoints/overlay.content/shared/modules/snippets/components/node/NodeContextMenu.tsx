import React from 'react';
import {
  ContextMenuContent,
} from '@/entrypoints/overlay.content/shared/components/ui/context-menu';
import { renderMenuItems } from '@/entrypoints/overlay.content/shared/components/node-action-bar';
import { useSnippetMenuItems } from './useSnippetMenuItems';
import type { NodeApi } from '../../../../components/folder-tree/types';
import type { FolderTreeNodeData } from '../../../../components/folder-tree/types';

interface NodeContextMenuProps {
  node: NodeApi<FolderTreeNodeData>;
  onCreateFolder: (parentId: string) => void;
  onDelete: () => void;
  onCopy: (e?: React.MouseEvent) => void;
  onEditSnippet?: (e?: React.MouseEvent) => void;
  isFavorite?: boolean;
  isPinned?: boolean;
  onToggleFavorite?: (id: string, isFav: boolean) => void;
  onTogglePin?: (id: string, isPinned: boolean) => void;
  onMoveTo?: () => void;
}

export const NodeContextMenu = ({
  node,
  onCreateFolder,
  onDelete,
  onCopy,
  onEditSnippet,
  isFavorite,
  isPinned,
  onToggleFavorite,
  onTogglePin,
  onMoveTo,
}: NodeContextMenuProps) => {
  const shouldPreventRef = React.useRef(false);

  const menuItems = useSnippetMenuItems({
    node,
    isPinned: !!isPinned,
    isFavorite: !!isFavorite,
    onDelete,
    onCreateFolder,
    onTogglePin: onTogglePin ?? (() => {}),
    onToggleFavorite,
    onMoveTo,
    onCopy,
    onEdit: onEditSnippet,
  });

  return (
    <ContextMenuContent
      className="w-48"
      onCloseAutoFocus={(e) => {
        if (shouldPreventRef.current) {
          e.preventDefault();
          shouldPreventRef.current = false;
        }
      }}
    >
      {renderMenuItems(menuItems, 'context')}
    </ContextMenuContent>
  );
};
