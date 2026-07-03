import React from 'react';
import {
  ContextMenuContent,
} from '@/entrypoints/overlay.content/shared/components/ui/context-menu';
import { renderMenuItems } from '@/entrypoints/overlay.content/shared/components/node-action-bar';
import { useExplorerMenuItems } from './useExplorerMenuItems';
import { NodeProps } from './types';
import { isInboxFolder } from '@/shared/constants/inbox';

interface NodeContextMenuProps extends NodeProps {
  isFavorite: boolean;
  isPinned?: boolean;
  onDelete: () => void;
  onTagToggle: (tagId: string, checked: boolean) => void;
  onColorChange: (color: string | null) => void;
  folderColor: string | null;
  onCreateFolder: (parentId: string) => void;
  onToggleFavorite: (id: string, isFav: boolean) => void;
  onTogglePin?: (id: string, isPinned: boolean) => void;
}

export const NodeContextMenu = ({
  node,
  onCreateFolder,
  onToggleFavorite,
  onDelete,
  onTagToggle,
  onColorChange,
  isFavorite,
  isPinned,
  folderColor,
  onTogglePin,
}: NodeContextMenuProps) => {
  const shouldPreventRef = React.useRef(false);

  const isFolder = node.data.type === 'folder';
  const isInbox = isFolder && isInboxFolder(node.data.id);

  const menuItems = useExplorerMenuItems({
    node,
    isFavorite,
    folderColor,
    isPinned: isPinned ?? !!node.data.data?.is_pinned,
    isInbox,
    onDelete,
    onTagToggle,
    onColorChange,
    onCreateFolder,
    onToggleFavorite,
    onTogglePin: onTogglePin ?? (() => {}),
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
