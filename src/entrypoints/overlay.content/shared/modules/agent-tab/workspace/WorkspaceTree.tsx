/**
 * WorkspaceTree — the file list, read-only.
 *
 * Its own small tree rather than the shared `FolderTree`: that one is built around SQL
 * rows joined by `folder_id`, with drag-and-drop, batch selection and rename wired into
 * the app store. OPFS nesting is already implied by the path strings, and none of the
 * mutation surface applies to a read-only view — adapting it would mean feeding it fake
 * rows to switch most of its behaviour off.
 *
 * Directories start expanded. A workspace holds notes, not a source tree, so the useful
 * default is seeing everything.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Folder } from 'lucide-react';
import { cn } from '@/shared/lib/utils/utils';
import type { TreeNode } from './useWorkspaceFiles';

interface WorkspaceTreeProps {
  nodes: TreeNode[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
}

export const WorkspaceTree: React.FC<WorkspaceTreeProps> = ({
  nodes,
  selectedPath,
  onSelectFile,
}) => (
  <div className="py-1">
    {nodes.map((node) => (
      <TreeRow
        key={node.path}
        node={node}
        depth={0}
        selectedPath={selectedPath}
        onSelectFile={onSelectFile}
      />
    ))}
  </div>
);

interface TreeRowProps {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
}

const TreeRow: React.FC<TreeRowProps> = ({ node, depth, selectedPath, onSelectFile }) => {
  const [expanded, setExpanded] = useState(true);
  const isDir = node.kind === 'directory';
  const isSelected = !isDir && node.path === selectedPath;

  return (
    <>
      <button
        type="button"
        // A directory row toggles; a file row opens it. Both are buttons so keyboard
        // navigation reaches every entry.
        onClick={() => (isDir ? setExpanded((v) => !v) : onSelectFile(node.path))}
        aria-expanded={isDir ? expanded : undefined}
        className={cn(
          'flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs',
          'hover:bg-accent/40',
          isSelected && 'bg-primary/10 text-primary hover:bg-primary/15',
        )}
        // Indentation by inline padding rather than nested containers: a deep path would
        // otherwise build a stack of wrappers that each clip the hover background.
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isDir ? (
          <>
            {expanded ? (
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            <Folder className="h-3 w-3 shrink-0 text-muted-foreground" />
          </>
        ) : (
          // Files line up with their siblings' folder icons, past the chevron column.
          <>
            <span className="w-3 shrink-0" />
            <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
          </>
        )}
        <span className={cn('truncate', isDir && 'text-foreground/80')}>{node.name}</span>
      </button>

      {isDir &&
        expanded &&
        node.children.map((child) => (
          <TreeRow
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelectFile={onSelectFile}
          />
        ))}
    </>
  );
};
