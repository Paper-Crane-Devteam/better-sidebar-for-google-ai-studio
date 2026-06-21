import { runQuery, runCommand } from '../index';
import { updateWithTimestamp } from './helpers';
import type { SnippetFolder } from '../../types/db';

export const snippetFolderRepo = {
  create: async (folder: {
    id: string;
    name: string;
    parentId?: string | null;
  }): Promise<void> => {
    await runCommand(
      'INSERT INTO snippet_folders (id, name, parent_id) VALUES (?, ?, ?)',
      [folder.id, folder.name, folder.parentId || null]
    );
  },

  getById: async (id: string): Promise<SnippetFolder | undefined> => {
    const result = await runQuery('SELECT * FROM snippet_folders WHERE id = ?', [id]);
    return result[0] as SnippetFolder | undefined;
  },

  getByParentId: async (parentId: string | null): Promise<SnippetFolder[]> => {
    if (parentId === null) {
      return (await runQuery(
        'SELECT * FROM snippet_folders WHERE parent_id IS NULL ORDER BY order_index ASC, name ASC'
      )) as SnippetFolder[];
    }
    return (await runQuery(
      'SELECT * FROM snippet_folders WHERE parent_id = ? ORDER BY order_index ASC, name ASC',
      [parentId]
    )) as SnippetFolder[];
  },

  getAll: async (): Promise<SnippetFolder[]> => {
    return (await runQuery(
      'SELECT * FROM snippet_folders ORDER BY order_index ASC, name ASC'
    )) as SnippetFolder[];
  },

  update: async (
    id: string,
    updates: Partial<Pick<SnippetFolder, 'name' | 'parent_id' | 'order_index' | 'is_pinned'>>
  ): Promise<void> => {
    await updateWithTimestamp('snippet_folders', id, updates);
  },

  delete: async (id: string): Promise<void> => {
    await runCommand('DELETE FROM snippet_folders WHERE id = ?', [id]);
  },

  deleteMultiple: async (ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await runCommand(`DELETE FROM snippet_folders WHERE id IN (${placeholders})`, ids);
  },
};
