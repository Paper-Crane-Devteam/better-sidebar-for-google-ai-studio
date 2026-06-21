import { runQuery, runCommand } from '../index';
import { updateWithTimestamp } from './helpers';
import type { Snippet } from '../../types/db';

export const snippetRepo = {
  create: async (
    s: Partial<Snippet> & Pick<Snippet, 'id' | 'title'>
  ): Promise<void> => {
    await runCommand(
      `INSERT INTO snippets (id, title, content, source_url, source_platform, folder_id, order_index, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id,
        s.title,
        s.content || null,
        s.source_url || null,
        s.source_platform || null,
        s.folder_id || null,
        s.order_index || 0,
        s.created_at || Math.floor(Date.now() / 1000),
        s.updated_at || Math.floor(Date.now() / 1000),
      ]
    );
  },

  getById: async (id: string): Promise<Snippet | undefined> => {
    const result = await runQuery('SELECT * FROM snippets WHERE id = ?', [id]);
    return result[0] as Snippet | undefined;
  },

  getByFolderId: async (folderId: string | null): Promise<Snippet[]> => {
    if (folderId === null) {
      return (await runQuery(
        'SELECT * FROM snippets WHERE folder_id IS NULL ORDER BY updated_at DESC'
      )) as Snippet[];
    } else {
      return (await runQuery(
        'SELECT * FROM snippets WHERE folder_id = ? ORDER BY updated_at DESC',
        [folderId]
      )) as Snippet[];
    }
  },

  getAll: async (): Promise<Snippet[]> => {
    return (await runQuery(
      'SELECT * FROM snippets ORDER BY updated_at DESC'
    )) as Snippet[];
  },

  update: async (
    id: string,
    updates: Partial<Pick<Snippet, 'title' | 'content' | 'source_url' | 'source_platform' | 'folder_id' | 'order_index' | 'is_pinned'>>
  ): Promise<void> => {
    await updateWithTimestamp('snippets', id, updates);
  },

  delete: async (id: string): Promise<void> => {
    await runCommand('DELETE FROM snippets WHERE id = ?', [id]);
  },

  deleteMultiple: async (ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await runCommand(`DELETE FROM snippets WHERE id IN (${placeholders})`, ids);
  },

  move: async (id: string, folderId: string | null): Promise<void> => {
    await runCommand(
      'UPDATE snippets SET folder_id = ?, updated_at = unixepoch() WHERE id = ?',
      [folderId, id]
    );
  },

  moveMultiple: async (
    ids: string[],
    folderId: string | null
  ): Promise<void> => {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await runCommand(
      `UPDATE snippets SET folder_id = ?, updated_at = unixepoch() WHERE id IN (${placeholders})`,
      [folderId, ...ids]
    );
  },
};
