import React from 'react';
import {
  ContextMenuContent,
} from '@/entrypoints/overlay.content/shared/components/ui/context-menu';
import { renderMenuItems } from '@/entrypoints/overlay.content/shared/components/node-action-bar';
import { useExplorerMenuItems } from './useExplorerMenuItems';
import { NodeProps } from './types';

interface NodeContextMenuProps extends NodeProps {
  isFavorite: boolean;
  onDelete: () => void;
  onTagToggle: (tagId: string, checked: boolean) => void;
  onColorChange: (color: string | null) => void;
  folderColor: string | null;
  onCreateFolder: (parentId: string) => void;
  onToggleFavorite: (id: string, isFav: boolean) => void;
}

export const NodeContextMenu = ({
  node,
  onCreateFolder,
  onToggleFavorite,
  onDelete,
  onTagToggle,
  onColorChange,
  isFavorite,
  folderColor,
}: NodeContextMenuProps) => {
  const shouldPreventRef = React.useRef(false);

  const menuItems = useExplorerMenuItems({
    node,
    isFavorite,
    folderColor,
    onDelete,
    onTagToggle,
    onColorChange,
    onCreateFolder,
    onToggleFavorite,
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
