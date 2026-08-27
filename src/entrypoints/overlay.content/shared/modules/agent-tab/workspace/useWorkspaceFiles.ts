/**
 * Load one workspace's file tree.
 *
 * Fetches the whole subtree in a single recursive `list`, then builds the nesting in
 * memory. OPFS has no way to ask for "one level plus counts", so lazy per-directory
 * loading would mean a message round trip per expand — for a workspace of notes, one
 * flat fetch is both simpler and faster.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { forWorkspace, type FileEntry } from '@/shared/workspace/client';

export interface TreeNode {
  path: string;
  name: string;
  kind: 'file' | 'directory';
  children: TreeNode[];
}

/**
 * Assemble a nested tree from flat paths.
 *
 * Intermediate directories are synthesised when missing: a recursive list yields them,
 * but a `glob`-shaped result or a truncated page may not, and a file whose parent is
 * absent would otherwise vanish from the tree entirely.
 */
function buildTree(entries: FileEntry[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const byPath = new Map<string, TreeNode>();

  const ensureDir = (path: string): TreeNode | null => {
    if (path === '') return null;
    const existing = byPath.get(path);
    if (existing) return existing;

    const slash = path.lastIndexOf('/');
    const node: TreeNode = {
      path,
      name: path.slice(slash + 1),
      kind: 'directory',
      children: [],
    };
    byPath.set(path, node);

    const parent = slash === -1 ? null : ensureDir(path.slice(0, slash));
    (parent ? parent.children : roots).push(node);
    return node;
  };

  // Directories first so a file never has to create its own parent out of order.
  for (const entry of entries) {
    if (entry.kind === 'directory') ensureDir(entry.path);
  }

  for (const entry of entries) {
    if (entry.kind !== 'file') continue;
    const slash = entry.path.lastIndexOf('/');
    const node: TreeNode = {
      path: entry.path,
      name: entry.path.slice(slash + 1),
      kind: 'file',
      children: [],
    };
    byPath.set(entry.path, node);
    const parent = slash === -1 ? null : ensureDir(entry.path.slice(0, slash));
    (parent ? parent.children : roots).push(node);
  }

  // Directories before files, then alphabetical — the order a file browser reads in.
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) if (node.children.length) sort(node.children);
  };
  sort(roots);

  return roots;
}

export function useWorkspaceFiles(workspaceId: string) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { entries: found } = await forWorkspace(workspaceId).list('', true);
      setEntries(found);
    } catch (e) {
      setError((e as Error).message);
      // Clear on failure: leaving the previous workspace's files on screen under a new
      // name is worse than showing nothing.
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const tree = useMemo(() => buildTree(entries), [entries]);

  return { tree, fileCount: entries.filter((e) => e.kind === 'file').length, loading, error, reload };
}
