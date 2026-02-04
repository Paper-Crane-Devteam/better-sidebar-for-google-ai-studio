import React, { useState, useEffect } from 'react';
import { Folder as FolderIcon, FileText, ChevronRight, ChevronDown, FolderOpen, Star, Calendar, Image } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import { navigate } from '@/shared/lib/navigation';
import { useAppStore } from '@/shared/lib/store';
import { modal } from '@/shared/lib/modal';
import { useI18n } from '@/shared/hooks/useI18n';
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@/entrypoints/overlay.content/aistudio/components/ui/context-menu';

import { NodeProps } from './types';
import { NodeContent } from './NodeContent';
import { NodeContextMenu } from './NodeContextMenu';
import { useDeleteHandler } from '../../hooks/useDeleteHandler';

export const Node = ({ node, style, dragHandle, tree, preview }: NodeProps) => {
  const { t } = useI18n();
  const {
    deleteItem,
    conversationTags,
    addTagToConversation,
    removeTagFromConversation,
    ui,
    toggleExplorerBatchSelection,
    favorites,
    toggleFavorite,
    createFolder,
  } = useAppStore();
  const { handleDelete: deleteHandler } = useDeleteHandler();
  const [newName, setNewName] = useState(node.data.name);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);

  const isFavorite = favorites.some(
    (f) => f.target_id === node.data.id && f.target_type === 'conversation'
  );
  const { isBatchMode, selectedIds: batchSelectedIds } = ui.explorer.batch;
  const isBatchSelected = batchSelectedIds.includes(node.data.id);

  const handleCreateFolder = async (parentId: string) => {
    const newFolderId = await createFolder(t('node.newFolder'), parentId);
    if (newFolderId) {
      tree.open(parentId);
      setTimeout(() => {
        tree.edit(newFolderId);
      }, 300);
    }
  };

  useEffect(() => {
    setNewName(node.data.name);
  }, [node.data.name, node.isEditing]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    node.toggle();
  };

  const handleDelete = async () => {
    await deleteHandler([node.data.id]);
  };

  const handleTagToggle = async (tagId: string, checked: boolean) => {
    let targetIds = [node.data.id];
    if (node.isSelected && node.tree.selectedIds.size > 1) {
      targetIds = Array.from(node.tree.selectedIds).filter((id) => {
        const n = node.tree.get(id);
        return n && n.data.type === 'file';
      });
    }

    const shouldAdd = checked;

    for (const id of targetIds) {
      const hasTag = conversationTags.some(
        (ct) => ct.conversation_id === id && ct.tag_id === tagId
      );

      if (shouldAdd) {
        if (!hasTag) await addTagToConversation(id, tagId);
      } else {
        if (hasTag) await removeTagFromConversation(id, tagId);
      }
    }
  };

  const isTimeGroup = node.data.data?.isTimeGroup;
  const FolderIconComponent = isTimeGroup
    ? Calendar
    : node.isOpen
    ? FolderOpen
    : FolderIcon;

  const isFile = node.data.type === 'file';
  const url = isFile
    ? node.data.data?.external_url.replace('https://aistudio.google.com', '')
    : undefined;

  const toggleIcon =
    node.data.type === 'folder' ? (
      node.isOpen ? (
        <ChevronDown className="w-3 h-3" />
      ) : (
        <ChevronRight className="w-3 h-3" />
      )
    ) : null;

  const folderIcon = (
    <FolderIconComponent className="w-4 h-4 text-foreground/70" />
  );
  const fileIcon =
    node.data.data?.type === 'text-to-image' ? (
      <Image className="w-4 h-4" />
    ) : (
      <FileText className="w-4 h-4" />
    );

  const innerContent = (
    <>
      <NodeContent
        node={node}
        style={style}
        dragHandle={dragHandle}
        onToggleFavorite={(e) => {
          e.stopPropagation();
          e.preventDefault();
          toggleFavorite(node.data.id, 'conversation', isFavorite);
        }}
        isBatchMode={isBatchMode}
        isBatchSelected={isBatchSelected}
        onToggleBatchSelection={() =>
          toggleExplorerBatchSelection(node.data.id)
        }
        isFavorite={isFavorite}
        folderIcon={folderIcon}
        fileIcon={fileIcon}
        toggleIcon={toggleIcon}
        handleToggle={handleToggle}
        tree={tree}
        preview={preview}
        newName={newName}
        setNewName={setNewName}
      />
      {/* Hover Actions */}
      <div
        className={cn(
          'hidden group-hover:flex items-center gap-1 absolute right-2',
          isContextMenuOpen && 'flex'
        )}
      >
        {isFile && !isFavorite && !isBatchMode && (
          <SimpleTooltip content={t('tooltip.addToFavorites')}>
            <div
              role="button"
              className="h-5 w-5 flex items-center justify-center rounded-sm hover:bg-muted/50 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                toggleFavorite(node.data.id, 'conversation', isFavorite);
              }}
            >
              <Star className="h-3.5 w-3.5" />
            </div>
          </SimpleTooltip>
        )}
      </div>
    </>
  );

  const commonClasses = cn(
    'flex items-center gap-1.5 px-1 cursor-pointer hover:bg-accent/50 group relative pr-2 h-full text-foreground no-underline outline-none text-density',
    isFile && !isFavorite && 'group-hover:pr-8',
    (node.isSelected || isBatchSelected) && 'bg-accent',
    node.willReceiveDrop && 'bg-accent/50 border border-primary/40 rounded-sm',
    isContextMenuOpen && 'bg-accent/50',
    isContextMenuOpen && isFile && !isFavorite && 'pr-8'
  );

  const content = (
    <div
      style={style}
      ref={dragHandle}
      role="button"
      tabIndex={0}
      className={commonClasses}
      onContextMenu={(e) => {
        if (isBatchMode) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onClick={(e) => {
        if (isBatchMode) {
          e.preventDefault();
          toggleExplorerBatchSelection(node.data.id);
          return;
        }

        if (url) {
          e.preventDefault();
          node.select();
          navigate(url);
        } else {
          node.select();
          node.toggle();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (isBatchMode) {
            toggleExplorerBatchSelection(node.data.id);
            return;
          }

          if (url) {
            navigate(url);
          } else {
            node.toggle();
          }
        }
      }}
    >
      {innerContent}
    </div>
  );

  return (
    <ContextMenu onOpenChange={setIsContextMenuOpen}>
      <ContextMenuTrigger asChild disabled={isTimeGroup || isBatchMode}>
        {content}
      </ContextMenuTrigger>
      {!isTimeGroup && !isBatchMode && (
        <NodeContextMenu
          node={node}
          onToggleFavorite={(id: string, isFav: boolean) =>
            toggleFavorite(id, 'conversation', isFav)
          }
          onCreateFolder={handleCreateFolder}
          onDelete={handleDelete}
          onTagToggle={handleTagToggle}
          isFavorite={isFavorite}
          style={style}
          dragHandle={dragHandle}
          tree={tree}
          preview={preview}
        />
      )}
    </ContextMenu>
  );
};
