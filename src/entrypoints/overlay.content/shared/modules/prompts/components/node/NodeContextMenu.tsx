import React from 'react';
import {
  ContextMenuContent,
} from '@/entrypoints/overlay.content/shared/components/ui/context-menu';
import { renderMenuItems } from '@/entrypoints/overlay.content/shared/components/node-action-bar';
import { usePromptsMenuItems } from './usePromptsMenuItems';
import { NodeProps } from './types';

interface NodeContextMenuProps extends NodeProps {
  isFavorite: boolean;
  onDelete: () => void;
  onCreateFolder: (parentId: string) => void;
  onToggleFavorite: (id: string, isFav: boolean) => void;
  onCopy: (e?: React.MouseEvent) => void;
  onDuplicate: () => void;
  onEditPrompt?: (e?: React.MouseEvent) => void;
}

export const NodeContextMenu = ({
  node,
  onCreateFolder,
  onToggleFavorite,
  onDelete,
  isFavorite,
  onCopy,
  onDuplicate,
  onEditPrompt,
}: NodeContextMenuProps) => {
  const shouldPreventRef = React.useRef(false);

  const menuItems = usePromptsMenuItems({
    node,
    isFavorite,
    onDelete,
    onCreateFolder,
    onToggleFavorite,
    onCopy,
    onDuplicate,
    onEdit: onEditPrompt,
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
