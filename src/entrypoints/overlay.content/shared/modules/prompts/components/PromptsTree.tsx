import React, { useMemo, forwardRef, useImperativeHandle, useState, useCallback, useRef } from 'react';
import { useAppStore } from '@/shared/lib/store';
import { Node } from './node';
import { PendingPromptNode } from './node/PendingPromptNode';
import {
  FolderTree,
  FolderTreeHandle,
  FolderTreeNodeData,
  NodeRendererProps,
} from '../../../components/folder-tree';
import { ArboristTreeHandle } from '../types';
import { useI18n } from '@/shared/hooks/useI18n';
import { useDeleteHandler } from '../hooks/useDeleteHandler';
import { STORAGE_KEY } from '../hooks/usePromptsTree';

export type { ArboristTreeHandle } from '../types';

const PENDING_PROMPT_NODE_ID = '__pending_new_prompt__';

interface PromptsTreeProps {
  onSelect: (item: any) => void;
  onPreview: (prompt: any) => void;
  onEdit: (prompt: any) => void;
}

export const PromptsTree = forwardRef<ArboristTreeHandle, PromptsTreeProps>(
  ({ onSelect, onPreview, onEdit }, ref) => {
    const { t } = useI18n();
    const {
      promptFolders,
      prompts,
      favorites,
      movePromptItem,
      renamePromptItem,
      createPromptFolder,
      createPrompt,
      ui,
    } = useAppStore();
    const { handleDelete } = useDeleteHandler();
    const { sortOrder, typeFilter, onlyFavorites } = ui.prompts;
    const { query: searchTerm } = ui.prompts.search;

    const folderTreeRef = React.useRef<FolderTreeHandle>(null);

    // Pending new prompt state — only folderId triggers tree rebuild
    const [pendingFolderId, setPendingFolderId] = useState<string | null>(null);
    const pendingTitleRef = useRef('');
    const [pendingTitle, setPendingTitle] = useState('');

    const handleCreateInFolder = useCallback((folderId: string) => {
      pendingTitleRef.current = '';
      setPendingTitle('');
      setPendingFolderId(folderId);
      folderTreeRef.current?.open?.(folderId);
      setTimeout(() => {
        folderTreeRef.current?.select(PENDING_PROMPT_NODE_ID);
      }, 50);
    }, []);

    const handlePendingTitleChange = useCallback((title: string) => {
      pendingTitleRef.current = title;
      setPendingTitle(title);
    }, []);

    const handlePendingCommit = useCallback(() => {
      const title = pendingTitleRef.current.trim();
      if (title && pendingFolderId) {
        createPrompt(title, '', 'system', 'Bot', pendingFolderId);
      }
      pendingTitleRef.current = '';
      setPendingTitle('');
      setPendingFolderId(null);
    }, [pendingFolderId, createPrompt]);

    const handlePendingCancel = useCallback(() => {
      pendingTitleRef.current = '';
      setPendingTitle('');
      setPendingFolderId(null);
    }, []);

    useImperativeHandle(ref, () => ({
      collapseAll: () => folderTreeRef.current?.collapseAll(),
      edit: (id: string) => folderTreeRef.current?.edit(id),
      select: (id: string) => folderTreeRef.current?.select(id),
      selectAll: () => {
        const { setPromptsBatchSelection } = useAppStore.getState();
        const getAllIds = (nodes: FolderTreeNodeData[]): string[] => {
          let ids: string[] = [];
          nodes.forEach((node) => {
            ids.push(node.id);
            if (node.children) ids = ids.concat(getAllIds(node.children));
          });
          return ids;
        };
        setPromptsBatchSelection(getAllIds(data));
      },
      open: (id: string) => folderTreeRef.current?.open?.(id),
    }));

    const data = useMemo(() => {
      const folderMap = new Map<string, FolderTreeNodeData>();

      promptFolders.forEach((f) => {
        folderMap.set(f.id, {
          id: f.id,
          name: f.name,
          type: 'folder',
          children: [],
          data: f,
        });
      });

      const rootNodes: FolderTreeNodeData[] = [];
      let filteredPrompts = prompts;

      if (typeFilter !== 'all') {
        filteredPrompts = filteredPrompts.filter((c) => {
          const type = c.type || 'normal';
          return type === typeFilter;
        });
      }

      if (onlyFavorites) {
        const favoriteIds = new Set(
          favorites
            .filter((f) => f.target_type === 'prompt')
            .map((f) => f.target_id),
        );
        filteredPrompts = filteredPrompts.filter((c) => favoriteIds.has(c.id));
      }

      filteredPrompts.forEach((c) => {
        const item: FolderTreeNodeData = {
          id: c.id,
          name: c.title || t('common.untitled'),
          type: 'file',
          data: c,
        };

        if (c.folder_id && folderMap.has(c.folder_id)) {
          folderMap.get(c.folder_id)!.children!.push(item);
        } else {
          rootNodes.push(item);
        }
      });

      promptFolders.forEach((f) => {
        const node = folderMap.get(f.id);
        if (!node) return;

        if (f.parent_id && folderMap.has(f.parent_id)) {
          folderMap.get(f.parent_id)!.children!.push(node);
        } else {
          rootNodes.push(node);
        }
      });

      const favoriteIds = new Set(
        favorites
          .filter((f) => f.target_type === 'prompt')
          .map((f) => f.target_id),
      );

      const sortNodes = (nodes: FolderTreeNodeData[]) => {
        nodes.sort((a, b) => {
          // Pinned items always come first
          const isAPinned = a.data?.is_pinned ? 1 : 0;
          const isBPinned = b.data?.is_pinned ? 1 : 0;
          if (isAPinned !== isBPinned) return isBPinned - isAPinned;

          const isAFav = favoriteIds.has(a.id);
          const isBFav = favoriteIds.has(b.id);
          if (isAFav && !isBFav) return -1;
          if (!isAFav && isBFav) return 1;
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;

          if (sortOrder === 'date') {
            if (a.type === 'folder') return a.name.localeCompare(b.name);
            let dateA = a.data?.updated_at || a.data?.created_at || 0;
            let dateB = b.data?.updated_at || b.data?.created_at || 0;
            if (dateA > 0) dateA *= 1000;
            if (dateB > 0) dateB *= 1000;
            return dateB - dateA;
          }
          return a.name.localeCompare(b.name);
        });
        nodes.forEach((node) => {
          if (node.children) sortNodes(node.children);
        });
      };

      sortNodes(rootNodes);
      return rootNodes;
    }, [promptFolders, prompts, sortOrder, favorites, typeFilter, onlyFavorites, t]);

    // Inject pending prompt node into the tree data if active
    const treeData = useMemo(() => {
      if (!pendingFolderId) return data;

      const pendingNode: FolderTreeNodeData = {
        id: PENDING_PROMPT_NODE_ID,
        name: '',
        type: 'file',
        data: { isPendingPrompt: true },
      };

      const injectPending = (nodes: FolderTreeNodeData[]): FolderTreeNodeData[] => {
        return nodes.map((node) => {
          if (node.type === 'folder' && node.id === pendingFolderId) {
            return {
              ...node,
              children: [pendingNode, ...(node.children || [])],
            };
          }
          if (node.children) {
            return { ...node, children: injectPending(node.children) };
          }
          return node;
        });
      };

      return injectPending(data);
    }, [data, pendingFolderId]);

    return (
      <FolderTree
        ref={folderTreeRef}
        data={treeData}
        storageKey={STORAGE_KEY}
        folders={promptFolders}
        searchTerm={searchTerm}
        onSelect={onSelect}
        onMoveItem={async (id, parentId, type) => {
          await movePromptItem(id, parentId, type);
        }}
        onRenameItem={async (id, name, type) => {
          await renamePromptItem(id, name, type);
        }}
        onDeleteItems={async (ids) => {
          await handleDelete(ids);
        }}
        onCreateFolder={async (name, parentId) => {
          return createPromptFolder(name, parentId);
        }}
        renderNode={(props: NodeRendererProps<FolderTreeNodeData>) => {
          // Render pending prompt inline entry
          if (props.node.data.id === PENDING_PROMPT_NODE_ID && pendingFolderId) {
            return (
              <PendingPromptNode
                style={props.style}
                title={pendingTitle}
                onTitleChange={handlePendingTitleChange}
                onCommit={handlePendingCommit}
                onCancel={handlePendingCancel}
              />
            );
          }
          return (
            <Node
              {...props}
              onPreview={onPreview}
              onEdit={onEdit}
              onCreateInFolder={handleCreateInFolder}
            />
          );
        }}
      />
    );
  },
);
