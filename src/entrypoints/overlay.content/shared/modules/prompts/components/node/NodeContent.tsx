import React from 'react';
import { NodeProps } from './types';
import { FolderTreeNodeContent } from '../../../../components/folder-tree';
import { PromptIconDisplay } from '../../lib/prompt-icons';
import { useAppStore } from '@/shared/lib/store';

interface NodeContentProps extends NodeProps {
  isBatchMode: boolean;
  isBatchSelected: boolean;
  isBatchIndeterminate?: boolean;
  onToggleBatchSelection: () => void;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  folderIcon: React.ReactNode;
  fileIcon: React.ReactNode;
  toggleIcon: React.ReactNode;
  handleToggle: (e: React.MouseEvent) => void;
  newName: string;
  setNewName: (name: string) => void;
  hoverRef?: React.RefObject<HTMLElement | null>;
  tooltipContent?: React.ReactNode | ((isOverflowing: boolean) => React.ReactNode);
  forceShowTooltip?: boolean;
}

export const NodeContent = ({
  node,
  isBatchMode,
  isBatchSelected,
  isBatchIndeterminate,
  onToggleBatchSelection,
  isFavorite,
  onToggleFavorite,
  folderIcon,
  fileIcon,
  toggleIcon,
  handleToggle,
  newName,
  setNewName,
  hoverRef,
  tooltipContent,
  forceShowTooltip,
}: NodeContentProps) => {
  const isFile = node.data.type === 'file';
  const searchQuery = useAppStore((state) => state.ui.prompts.search.query);

  let displayFileIcon = fileIcon;
  if (isFile && node.data.data?.icon) {
    displayFileIcon = (
      <PromptIconDisplay
        name={node.data.data.icon}
        className="h-4 w-4 shrink-0 text-muted-foreground"
      />
    );
  }

  return (
    <FolderTreeNodeContent
      node={node}
      folderIcon={folderIcon}
      fileIcon={displayFileIcon}
      toggleIcon={toggleIcon}
      handleToggle={handleToggle}
      batchMode={
        isBatchMode
          ? {
              enabled: true,
              selected: isBatchSelected,
              indeterminate: isBatchIndeterminate,
              onToggle: onToggleBatchSelection,
            }
          : undefined
      }
      newName={newName}
      setNewName={setNewName}
      namePrefix={undefined}
      isPinned={!isFile && !!node.data.data?.is_pinned}
      searchQuery={searchQuery}
      hoverRef={hoverRef}
      tooltipContent={tooltipContent}
      forceShowTooltip={forceShowTooltip}
    />
  );
};
