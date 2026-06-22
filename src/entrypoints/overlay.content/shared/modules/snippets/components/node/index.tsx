import React, { useState, useEffect } from 'react';
import {
  Folder as FolderIcon,
  FileText,
  ChevronRight,
  ChevronDown,
  Eye,
  Copy,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils/utils';
import { useAppStore } from '@/shared/lib/store';
import { useI18n } from '@/shared/hooks/useI18n';
import {
  ContextMenuTrigger,
} from '@/entrypoints/overlay.content/shared/components/ui/context-menu';
import { ExclusiveContextMenu } from '@/entrypoints/overlay.content/shared/components/ui/exclusive-context-menu';

import { FolderTreeNodeContent } from '../../../../components/folder-tree';
import { NodeContextMenu } from './NodeContextMenu';
import { useDeleteHandler } from '../../hooks/useDeleteHandler';

import { toast } from '@/shared/lib/toast';
import { NodeActionBar } from '@/entrypoints/overlay.content/shared/components/node-action-bar';
import type { ActionButtonDef } from '@/entrypoints/overlay.content/shared/components/node-action-bar';
import { useSnippetMenuItems } from './useSnippetMenuItems';
import type { NodeRendererProps } from '../../../../components/folder-tree/types';
import type { FolderTreeNodeData } from '../../../../components/folder-tree/types';

interface SnippetNodeProps extends NodeRendererProps<FolderTreeNodeData> {
  onPreview?: (snippet: any) => void;
  onEdit?: (snippet: any) => void;
}

export const SnippetNode = ({
  node,
  style,
  dragHandle,
  tree,
  preview,
  onPreview,
  onEdit,
}: SnippetNodeProps) => {
  const { t } = useI18n();
  const {
    ui,
    toggleSnippetsBatchSelection,
    createSnippetFolder,
  } = useAppStore();
  const { handleDelete: deleteHandler } = useDeleteHandler();
  const [newName, setNewName] = useState(node.data.name);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { isBatchMode, selectedIds: batchSelectedIds } = ui.snippets.batch;
  const isBatchSelected = batchSelectedIds.includes(node.data.id);

  const handleCreateFolder = async (parentId: string) => {
    const newFolderId = await createSnippetFolder(t('sidebar.newFolder'), parentId);
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

  const isFile = node.data.type === 'file';

  const toggleIcon =
    node.data.type === 'folder' ? (
      node.isOpen ? (
        <ChevronDown className="w-3 h-3" />
      ) : (
        <ChevronRight className="w-3 h-3" />
      )
    ) : null;

  const folderIcon = <FolderIcon className="w-4 h-4 text-foreground/80" />;
  const fileIcon = <FileText className="w-4 h-4" />;

  const handleView = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (onPreview) {
      onPreview(node.data.data);
    }
  };

  const handleEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (onEdit) {
      onEdit(node.data.data);
    }
  };

  const handleCopy = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    const content = node.data.data.content || '';
    if (content) {
      navigator.clipboard.writeText(content);
      toast.success(t('snippets.copiedToClipboard'), 1000);
    }
  };

  const handleDuplicate = async () => {
    const { title, content, source_url, source_platform, folder_id } = node.data.data;
    await useAppStore.getState().createSnippet(
      `${title} (copy)`,
      content || '',
      source_url,
      source_platform,
      folder_id,
    );
  };

  const menuItems = useSnippetMenuItems({
    node,
    isPinned: !!node.data.data?.is_pinned,
    onDelete: handleDelete,
    onCreateFolder: handleCreateFolder,
    onTogglePin: (id: string, isPinned: boolean) =>
      useAppStore.getState().togglePin(id, 'snippet_folders', isPinned),
    onCopy: handleCopy,
    onDuplicate: handleDuplicate,
    onEdit: onEdit ? handleEdit : undefined,
  });

  const isMenuActive = isContextMenuOpen || isDropdownOpen;

  const quickActions: ActionButtonDef[] = [];
  if (isFile && onPreview) {
    quickActions.push({
      icon: <Eye className="h-3.5 w-3.5" />,
      tooltip: t('snippets.viewSnippet'),
      onClick: handleView,
    });
  }
  if (isFile) {
    quickActions.push({
      icon: <Copy className="h-3.5 w-3.5" />,
      tooltip: t('snippets.copyContent'),
      onClick: handleCopy,
    });
  }

  const innerContent = (
    <>
      <FolderTreeNodeContent
        node={node}
        folderIcon={folderIcon}
        fileIcon={fileIcon}
        toggleIcon={toggleIcon}
        handleToggle={handleToggle}
        batchMode={isBatchMode ? {
          enabled: true,
          selected: isBatchSelected,
          indeterminate: false,
          onToggle: () => toggleSnippetsBatchSelection(node.data.id),
        } : undefined}
        newName={newName}
        setNewName={setNewName}
      />
      {/* Action bar with three-dot menu – hidden while renaming */}
      {!isBatchMode && !node.isEditing && (
        <NodeActionBar
          actions={quickActions}
          menuItems={menuItems}
          forceVisible={isMenuActive}
          onDropdownOpenChange={setIsDropdownOpen}
        />
      )}
    </>
  );

  const commonClasses = cn(
    'flex items-center gap-1.5 px-1 cursor-pointer group relative pr-2 h-full no-underline outline-none text-density rounded-sm font-medium text-foreground/80',
    !node.isEditing && (isFile ? 'group-hover:pr-14' : 'group-hover:pr-8'),
    !((node.isSelected && !isFile) || isBatchSelected) && 'hover:bg-accent/50',
    ((node.isSelected && !isFile) || isBatchSelected) && 'node-item-selected',
    !isFile && node.data.data?.is_pinned && 'node-item-pinned',
    node.willReceiveDrop && 'bg-accent/50 border border-primary/40 rounded-sm',
    isMenuActive && 'bg-accent/50',
    isMenuActive && (isFile ? 'pr-14' : 'pr-8'),
    isMenuActive && 'node-menu-active',
  );

  const content = (
    <div
      style={style}
      className={cn(
        'outline-none',
        'h-[calc(100%-2px)] w-[calc(100%-4px)] mx-auto mt-[1px]',
      )}
      onPointerEnter={() => {
        if (!isFile) {
          (window as any).__snippetDropTargetFolderId = node.data.id;
        }
      }}
      onPointerLeave={() => {
        if (!isFile && (window as any).__snippetDropTargetFolderId === node.data.id) {
          (window as any).__snippetDropTargetFolderId = null;
        }
      }}
    >
      <div
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
            toggleSnippetsBatchSelection(node.data.id);
            return;
          }

          if (isFile) {
            // View on click for snippet files
            if (onPreview) onPreview(node.data.data);
            return;
          }

          node.select();
          if (node.data.type === 'folder') {
            node.toggle();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (isBatchMode) {
              toggleSnippetsBatchSelection(node.data.id);
              return;
            }
            if (node.data.type === 'folder') {
              node.toggle();
            }
          }
        }}
      >
        {innerContent}
      </div>
    </div>
  );

  return (
    <ExclusiveContextMenu onOpenChange={setIsContextMenuOpen}>
      <ContextMenuTrigger asChild disabled={isBatchMode}>
        {content}
      </ContextMenuTrigger>
      {!isBatchMode && (
        <NodeContextMenu
          node={node}
          onCreateFolder={handleCreateFolder}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onCopy={handleCopy}
          onEditSnippet={onEdit ? handleEdit : undefined}
        />
      )}
    </ExclusiveContextMenu>
  );
};
