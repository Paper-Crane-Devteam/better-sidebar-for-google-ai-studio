import { useRef, useState, useEffect } from 'react';
import { TreeApi, NodeApi } from 'react-arborist';
import { useAppStore } from '@/shared/lib/store';
import { NodeData } from '../types';
import { useI18n } from '@/shared/hooks/useI18n';
import { useDeleteHandler } from './useDeleteHandler';

export const STORAGE_KEY = 'AI_STUDIO_EXPANDED_PROMPT_FOLDERS';

export const usePromptsTree = () => {
  const { t } = useI18n();
  const {
    promptFolders,
    prompts,
    movePromptItem,
    renamePromptItem,
    favorites,
    toggleFavorite,
    createPromptFolder,
    ui,
  } = useAppStore();
  const { handleDelete } = useDeleteHandler();
  const { query: searchTerm } = ui.prompts.search;

  const treeRef = useRef<TreeApi<NodeData>>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 300, height: 500 });

  // Load initial state from local storage
  const [initialOpenState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('Failed to load expanded state', e);
      return {};
    }
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const onMove = async ({
    dragIds,
    parentId,
    index,
  }: {
    dragIds: string[];
    parentId: string | null;
    index: number;
  }) => {
    // Only handle single item drag for now
    const id = dragIds[0];
    // Find the item to check its type
    const isFolder = promptFolders.some((f) => f.id === id);
    const type = isFolder ? 'folder' : 'file';

    await movePromptItem(id, parentId, type);
  };

  const onRename = async ({
    id,
    name,
    node,
  }: {
    id: string;
    name: string;
    node: NodeApi<NodeData>;
  }) => {
    const type = node.data.type;
    await renamePromptItem(id, name, type);
  };

  const onDelete = async ({ ids }: { ids: string[] }) => {
    await handleDelete(ids);
  };

  const handleToggle = (id: string) => {
    // Wait for next tick to ensure state is updated in the tree
    setTimeout(() => {
      const isOpen = treeRef.current?.isOpen(id);
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const state = saved ? JSON.parse(saved) : {};

        if (isOpen) {
          state[id] = true;
        } else {
          delete state[id];
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.error('Failed to save expanded state', e);
      }
    }, 0);
  };

  const handleCreateFolder = async (parentId: string) => {
    const newFolderId = await createPromptFolder(t('node.newFolder'), parentId);
    if (newFolderId) {
      treeRef.current?.open(parentId);
      setTimeout(() => {
        treeRef.current?.edit(newFolderId);
      }, 300);
    }
  };

  return {
    treeRef,
    containerRef,
    dimensions,
    folders: promptFolders,
    conversations: prompts,
    favorites,
    searchTerm,
    initialOpenState,
    ui,
    onMove,
    onRename,
    onDelete,
    handleToggle,
    handleCreateFolder,
    toggleFavorite,
    createFolder: createPromptFolder,
  };
};
