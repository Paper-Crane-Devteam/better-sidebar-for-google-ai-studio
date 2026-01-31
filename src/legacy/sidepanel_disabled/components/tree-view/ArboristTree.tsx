import React, { useMemo, useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Tree, TreeApi, NodeApi, NodeRendererProps } from 'react-arborist';
import { useAppStore } from '@/shared/lib/store';
import { Folder as FolderIcon, FileText, ChevronRight, ChevronDown, Edit2, Trash2, FolderOpen } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';

interface NodeData {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children?: NodeData[];
  data?: any;
}

interface ArboristTreeProps {
  onSelect: (item: any) => void;
  width?: number;
  height?: number;
  sortOrder: 'alpha' | 'date';
}

export interface ArboristTreeHandle {
  collapseAll: () => void;
  edit: (id: string) => void;
}

const STORAGE_KEY = 'AI_STUDIO_EXPANDED_FOLDERS';

export const ArboristTree = forwardRef<ArboristTreeHandle, ArboristTreeProps>(({ onSelect, sortOrder }, ref) => {
  const { folders, conversations, moveItem, renameItem, deleteItem } = useAppStore();
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

  useImperativeHandle(ref, () => ({
    collapseAll: () => {
      treeRef.current?.closeAll();
      // Clear storage when collapsing all
      localStorage.removeItem(STORAGE_KEY);
    },
    edit: (id: string) => {
        treeRef.current?.edit(id);
    }
  }));

  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);
  
  // Transform data into tree structure
  const data = useMemo(() => {
    const folderMap = new Map<string, NodeData>();
    
    // Create folder nodes
    folders.forEach(f => {
      folderMap.set(f.id, {
        id: f.id,
        name: f.name,
        type: 'folder',
        children: [],
        data: f
      });
    });

    const rootNodes: NodeData[] = [];

    // Add conversations
    conversations.forEach(c => {
      const item: NodeData = {
        id: c.id,
        name: c.title || 'Untitled',
        type: 'file',
        data: c
      };

      if (c.folder_id && folderMap.has(c.folder_id)) {
        folderMap.get(c.folder_id)!.children!.push(item);
      } else {
        rootNodes.push(item);
      }
    });

    // Build hierarchy
    folders.forEach(f => {
      const node = folderMap.get(f.id)!;
      if (f.parent_id && folderMap.has(f.parent_id)) {
        folderMap.get(f.parent_id)!.children!.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    // Sort function
    const sortNodes = (nodes: NodeData[]) => {
      nodes.sort((a, b) => {
        // Always keep folders on top
        if (a.type !== b.type) {
           return a.type === 'folder' ? -1 : 1;
        }
        
        // Sorting logic based on sortOrder
        if (sortOrder === 'date') {
            // For folders, we fallback to alpha for now as we don't have created_at
            if (a.type === 'folder') {
                return a.name.localeCompare(b.name);
            }
            
            // For files (conversations), use updated_at or created_at
            // Newest first (descending)
            let dateA = a.data?.updated_at || a.data?.created_at || 0;
            let dateB = b.data?.updated_at || b.data?.created_at || 0;

            // Normalize seconds to milliseconds if needed (heuristic: if < 100 billion)
            // 2024 in seconds is ~1.7e9, in ms is ~1.7e12
            if (dateA > 0 && dateA < 100000000000) dateA *= 1000;
            if (dateB > 0 && dateB < 100000000000) dateB *= 1000;

            return dateB - dateA;
        }
        
        // Default alpha
        return a.name.localeCompare(b.name);
      });
      nodes.forEach(node => {
        if (node.children) sortNodes(node.children);
      });
    };

    sortNodes(rootNodes);
    return rootNodes;
  }, [folders, conversations, sortOrder]);

  const onMove = async ({ dragIds, parentId, index }: { dragIds: string[]; parentId: string | null; index: number }) => {
    // Only handle single item drag for now
    const id = dragIds[0];
    // Find the item to check its type
    const isFolder = folders.some(f => f.id === id);
    const type = isFolder ? 'folder' : 'file';
    
    await moveItem(id, parentId, type);
  };

  const onRename = async ({ id, name, node }: { id: string; name: string; node: NodeApi<NodeData> }) => {
    const type = node.data.type;
    await renameItem(id, name, type);
  };

  const onDelete = async ({ ids }: { ids: string[] }) => {
     for (const id of ids) {
         const isFolder = folders.some(f => f.id === id);
         const type = isFolder ? 'folder' : 'file';
         await deleteItem(id, type);
     }
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

  return (
    <div ref={containerRef} className="h-full w-full">
      <Tree
        ref={treeRef}
        data={data}
        onMove={onMove}
        onRename={onRename}
        onDelete={onDelete}
        onSelect={onSelect}
        onToggle={handleToggle}
        width={dimensions.width}
        height={dimensions.height}
        indent={24}
        rowHeight={36}
        openByDefault={false}
        initialOpenState={initialOpenState}
      >
        {Node}
      </Tree>
    </div>
  );
});

const Node = ({ node, style, dragHandle }: NodeRendererProps<NodeData>) => {
  const [newName, setNewName] = useState(node.data.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local state when node name changes externally or editing starts
  useEffect(() => {
     setNewName(node.data.name);
  }, [node.data.name, node.isEditing]);

  useEffect(() => {
    if (node.isEditing && inputRef.current) {
      inputRef.current.select();
    }
  }, [node.isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    node.submit(newName);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    node.toggle();
  }

  const FolderIconComponent = node.isOpen ? FolderOpen : FolderIcon;

  return (
    <div
      style={style}
      ref={dragHandle}
      role="button"
      tabIndex={0}
      className={cn(
        "flex items-center gap-2 px-2 cursor-pointer hover:bg-accent/50 group relative pr-14 h-full",
        node.isSelected && "bg-accent",
        node.willReceiveDrop && "bg-blue-100/50 border border-blue-400 rounded-sm"
      )}
      onClick={() => node.toggle()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            node.toggle();
        }
      }}
    >
      <div 
        role="button"
        tabIndex={0}
        className="w-4 h-4 flex items-center justify-center shrink-0 text-muted-foreground"
        onClick={handleToggle}
        onKeyDown={(e) => {
             if (e.key === 'Enter' || e.key === ' ') {
                handleToggle(e as any);
             }
        }}
      >
        {node.data.type === 'folder' && (
             node.isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
        )}
      </div>

      <div className="w-4 h-4 flex items-center justify-center shrink-0 text-muted-foreground">
         {node.data.type === 'folder' ? (
             <FolderIconComponent className="w-4 h-4 text-blue-400" />
         ) : (
             <FileText className="w-4 h-4" />
         )}
      </div>

      {node.isEditing ? (
        <form onSubmit={handleSubmit} className="flex-1 min-w-0">
             <input
                ref={inputRef}
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={60}
                onBlur={() => {
                  node.submit(newName);
                  // Ensure we exit editing mode if submit doesn't automatically do it (it usually does)
                }}
                className="w-full bg-background border border-blue-500 rounded-sm h-7 px-1 text-sm outline-none shadow-sm"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    node.reset();
                  }
                }}
             />
        </form>
      ) : (
        <span className="truncate text-sm flex-1 select-none">
          {node.data.name}
        </span>
      )}
        
      {/* Hover Actions */}
      <div className="hidden group-hover:flex items-center gap-1 absolute right-1 backdrop-blur-sm rounded-sm">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {
              e.stopPropagation();
              node.edit();
          }}>
              <Edit2 className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => {
              e.stopPropagation();
              // use tree api to delete
              node.tree.delete(node.id);
          }}>
              <Trash2 className="h-3 w-3" />
          </Button>
      </div>
    </div>
  );
};
