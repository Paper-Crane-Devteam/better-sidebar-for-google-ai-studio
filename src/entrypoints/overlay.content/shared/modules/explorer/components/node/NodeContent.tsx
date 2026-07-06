import React, { useMemo } from 'react';
import { Info } from 'lucide-react';
import dayjs from 'dayjs';
import { NodeProps } from './types';
import { FolderTreeNodeContent } from '../../../../components/folder-tree';
import { useAppStore } from '@/shared/lib/store';
import { useI18n } from '@/shared/hooks/useI18n';

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
  const { t } = useI18n();
  const { tags, conversationTags } = useAppStore();
  const isFile = node.data.type === 'file';
  const description = isFile ? (node.data.data?.description || '') : '';
  const hasDescription = description.length > 0;

  // Get tags for this conversation
  const itemTags = useMemo(() => {
    if (!isFile) return [];
    const tagIds = conversationTags
      .filter((ct) => ct.conversation_id === node.data.id)
      .map((ct) => ct.tag_id);
    return tags.filter((tag) => tagIds.includes(tag.id));
  }, [isFile, node.data.id, conversationTags, tags]);

  // Get timestamps
  const createdAt = isFile ? node.data.data?.created_at : null;
  const lastActiveAt = isFile ? node.data.data?.last_active_at : null;

  const hasTags = itemTags.length > 0;
  const hasTimestamps = !!(createdAt || lastActiveAt);
  const hasExtraInfo = hasDescription || hasTags || hasTimestamps;

  // Format timestamp: normalize seconds to ms if needed (same heuristic as TimelineView)
  const formatTs = (ts: number) => {
    const normalized = ts > 0 && ts < 100000000000 ? ts * 1000 : ts;
    return dayjs(normalized).format('lll');
  };

  // Build enriched tooltip content with render function to access overflow state
  const tooltipContent = isFile && hasExtraInfo
    ? (isOverflowing: boolean) => (
        <div className="flex flex-col gap-1">
          {isOverflowing && (
            <div className="font-medium">{node.data.name}</div>
          )}
          {hasTags && (
            <div className="flex flex-wrap gap-1">
              {itemTags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-1 rounded text-[10px] leading-4 font-medium"
                  style={
                    tag.color
                      ? {
                          backgroundColor: `${tag.color}33`,
                          color: tag.color,
                        }
                      : {
                          backgroundColor: 'rgb(var(--muted) / 0.5)',
                          color: 'inherit',
                        }
                  }
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
          {hasDescription && (
            <div className="text-[10px] opacity-80">{description}</div>
          )}
          {hasTimestamps && (
            <div className={`flex flex-col gap-0 text-[10px] opacity-60${(isOverflowing || hasTags || hasDescription) ? ' pt-1 border-t border-current/10' : ''}`}>
              {createdAt && (
                <span>{t('node.createdAt')}: {formatTs(createdAt)}</span>
              )}
              {lastActiveAt && (
                <span>{t('node.lastActiveAt')}: {formatTs(lastActiveAt)}</span>
              )}
            </div>
          )}
        </div>
      )
    : undefined;

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
      forceShowTooltip={hasExtraInfo}
    />
  );
};
