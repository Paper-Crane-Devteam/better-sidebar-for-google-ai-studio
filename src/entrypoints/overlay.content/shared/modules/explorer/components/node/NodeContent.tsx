import React from 'react';
import { Info } from 'lucide-react';
import { NodeProps } from './types';
import { FolderTreeNodeContent } from '../../../../components/folder-tree';

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
  folderColor?: string | null;
  newName: string;
  setNewName: (name: string) => void;
  hoverRef?: React.RefObject<HTMLElement | null>;
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
  folderColor,
  newName,
  setNewName,
  hoverRef,
}: NodeContentProps) => {
  const isFile = node.data.type === 'file';
  const description = isFile ? (node.data.data?.description || '') : '';
  const hasDescription = description.length > 0;

  // Build enriched tooltip content: title + description
  const tooltipContent = hasDescription ? (
    <div className="space-y-1">
      <div className="font-medium">{node.data.name}</div>
      <div className="text-[10px] opacity-80">{description}</div>
    </div>
  ) : undefined;

  // Info icon indicator when description exists
  const nameAddon = hasDescription ? (
    <Info className="shrink-0 w-3 h-3 text-muted-foreground/60" />
  ) : undefined;

  return (
    <FolderTreeNodeContent
      node={node}
      folderIcon={folderIcon}
      fileIcon={null}
      toggleIcon={toggleIcon}
      handleToggle={handleToggle}
      folderColor={folderColor}
      hoverRef={hoverRef}
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
      nameAddon={nameAddon}
      tooltipContent={tooltipContent}
      forceShowTooltip={hasDescription}
    />
  );
};
