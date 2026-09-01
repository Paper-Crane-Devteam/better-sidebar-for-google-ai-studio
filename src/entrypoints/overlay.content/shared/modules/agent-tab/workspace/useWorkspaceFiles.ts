/**
 * Load one workspace's file tree, shaped for the shared `FolderTree`.
 *
 * Fetches the whole subtree in a single recursive `list`, then builds the nesting in
 * memory. OPFS has no way to ask for "one level plus counts", so lazy per-directory
 * loading would mean a message round trip per expand — for a workspace of notes, one
 * flat fetch is both simpler and faster.
 *
 * ## The path is the id
 *
 * `FolderTreeNodeData.id` holds the full workspace path. Everything downstream — move,
 * rename, delete, download — needs the path and nothing else, so any other id would be
 * a lookup table standing between the tree and every operation on it.
 *
 * It does mean ids are not stable across a rename: renaming `notes/` changes the id of
 * every file beneath it. Two consequences, both accepted. react-arborist's persisted
 * expand state is keyed by id, so a renamed folder comes back collapsed and the old
 * keys linger in localStorage as dead weight. Neither is worth a second identity scheme
 * that would have to be kept in sync with the filesystem it describes.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { forWorkspace, type FileEntry } from '@/shared/workspace/client';
import { isProbablyBinary } from '@/shared/workspace/file-kinds';
import type { FolderTreeNodeData } from '../../../components/folder-tree';

/** What each node carries in `data`, for the row renderer and the menus. */
export interface WorkspaceNodeData {
  path: string;
  kind: 'file' | 'directory';
  /** Bytes; absent for directories. */
  size?: number;
  /** Epoch millis of last write; absent for directories. */
  modified?: number;
  /** Guessed from the extension. Only drives the icon and a hint. */
  isBinary: boolean;
}

/** The parent path of a workspace path. '' for a top-level entry. */
function parentOf(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? '' : path.slice(0, slash);
}

/**
 * Assemble a nested tree from flat paths.
 *
 * Intermediate directories are synthesised when missing: a recursive list yields them,
 * but a truncated page may not, and a file whose parent is absent would otherwise
 * vanish from the tree entirely.
 *
 * Directories get `children: []` and files get no `children` key at all. That is what
 * react-arborist reads to decide what is a leaf, and it is also what stops a file from
 * accepting a drop.
 */
function buildTree(entries: FileEntry[]): FolderTreeNodeData[] {
  const roots: FolderTreeNodeData[] = [];
  const byPath = new Map<string, FolderTreeNodeData>();

  const ensureDir = (path: string): FolderTreeNodeData | null => {
    if (path === '') return null;
    const existing = byPath.get(path);
    if (existing) return existing;

    const node: FolderTreeNodeData = {
      id: path,
      name: path.slice(path.lastIndexOf('/') + 1),
      type: 'folder',
      children: [],
      data: { path, kind: 'directory', isBinary: false } satisfies WorkspaceNodeData,
    };
    byPath.set(path, node);

    const parent = ensureDir(parentOf(path));
    (parent ? parent.children! : roots).push(node);
    return node;
  };

  // Directories first, so a file never has to create its own parent out of order.
  for (const entry of entries) {
    if (entry.kind === 'directory') ensureDir(entry.path);
  }

  for (const entry of entries) {
    if (entry.kind !== 'file') continue;
    const node: FolderTreeNodeData = {
      id: entry.path,
      name: entry.path.slice(entry.path.lastIndexOf('/') + 1),
      type: 'file',
      data: {
        path: entry.path,
        kind: 'file',
        size: entry.size,
        modified: entry.modified,
        isBinary: isProbablyBinary(entry.path),
      } satisfies WorkspaceNodeData,
    };
    byPath.set(entry.path, node);
    const parent = ensureDir(parentOf(entry.path));
    (parent ? parent.children! : roots).push(node);
  }

  sortNodes(roots);
  return roots;
}

/** Directories before files, then alphabetical — the order a file browser reads in. */
function sortNodes(nodes: FolderTreeNodeData[]) {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
  for (const node of nodes) if (node.children?.length) sortNodes(node.children);
}

/**
 * Drop everything that does not match, keeping folders that still contain a match.
 *
 * Matches on the file's own name rather than its full path: typing "notes" to have every
 * file under `notes/` survive reads as a bug, because the folder is already visible
 * above them. Folder names are matched too, and a matching folder keeps its whole
 * subtree — that is the one case where the path does carry the intent.
 */
function filterTree(nodes: FolderTreeNodeData[], term: string): FolderTreeNodeData[] {
  const out: FolderTreeNodeData[] = [];

  for (const node of nodes) {
    const selfMatches = node.name.toLowerCase().includes(term);

    if (node.type === 'file') {
      if (selfMatches) out.push(node);
      continue;
    }

    if (selfMatches) {
      out.push(node);
      continue;
    }

    const children = filterTree(node.children ?? [], term);
    if (children.length > 0) out.push({ ...node, children });
  }

  return out;
}

export interface UseWorkspaceFilesResult {
  /** Ready for `FolderTree`, already filtered by `searchTerm`. */
  data: FolderTreeNodeData[];
  /**
   * Every directory, as `{ id, parent_id }`.
   *
   * `useFolderTree` needs this to tell whether a dragged id is a folder. It expects the
   * SQL row shape the other trees pass, so the two keys are named to match rather than
   * to describe a path.
   */
  folders: Array<{ id: string; parent_id: string | null }>;
  fileCount: number;
  /** Total bytes across every file, for the header hint. */
  totalBytes: number;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useWorkspaceFiles(
  workspaceId: string,
  searchTerm = '',
): UseWorkspaceFilesResult {
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

  const data = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return term ? filterTree(tree, term) : tree;
  }, [tree, searchTerm]);

  const folders = useMemo(
    () =>
      entries
        .filter((e) => e.kind === 'directory')
        .map((e) => ({ id: e.path, parent_id: parentOf(e.path) || null })),
    [entries],
  );

  const { fileCount, totalBytes } = useMemo(() => {
    let count = 0;
    let bytes = 0;
    for (const entry of entries) {
      if (entry.kind !== 'file') continue;
      count++;
      bytes += entry.size ?? 0;
    }
    return { fileCount: count, totalBytes: bytes };
  }, [entries]);

  return { data, folders, fileCount, totalBytes, loading, error, reload };
}
