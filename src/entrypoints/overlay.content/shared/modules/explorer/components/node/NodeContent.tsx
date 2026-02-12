import React from 'react';
import { NodeProps } from './types';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import { Star } from 'lucide-react';
import { BatchSelectionCheckbox } from '../batch/BatchSelectionCheckbox';
import { cn } from '@/shared/lib/utils';
import { RenameForm } from './RenameForm';

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
}: NodeContentProps) => {
  const isTimeGroup = node.data.data?.isTimeGroup;
  const isFile = node.data.type === 'file';

  return (
    <>
      {isBatchMode && (
        <BatchSelectionCheckbox
          checked={isBatchSelected}
          indeterminate={isBatchIndeterminate}
          onChange={onToggleBatchSelection}
          className="ml-1"
        />
      )}

      <div
        role="button"
        tabIndex={0}
        className={cn(
          'w-4 h-4 flex items-center justify-center shrink-0 text-muted-foreground',
          isFile && isBatchMode && 'hidden'
        )}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleToggle(e as any);
          }
        }}
      >
        {toggleIcon}
      </div>

      <div className="w-4 h-4 flex items-center justify-center shrink-0 text-muted-foreground">
        {node.data.type === 'folder' ? folderIcon : fileIcon}
      </div>
      {/* {node.data.type === 'folder' && (
        <div className="w-4 h-4 flex items-center justify-center shrink-0 text-muted-foreground">
          {folderIcon}
        </div>
      )} */}

      <div className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden justify-between">
        {node.isEditing ? (
          <RenameForm node={node} newName={newName} setNewName={setNewName} />
        ) : isFile ? (
          <SimpleTooltip content={node.data.name}>
            <span className="truncate text-sm select-none">
              {node.data.name}
            </span>
          </SimpleTooltip>
        ) : (
          <span className="truncate text-sm select-none">{node.data.name}</span>
        )}
        {isFavorite && (
          <div
            role="button"
            className="h-5 w-5 shrink-0 flex items-center justify-center rounded-md hover:bg-muted/50 transition-colors"
            onClick={onToggleFavorite}
          >
            <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
          </div>
        )}
      </div>
    </>
  );
};
