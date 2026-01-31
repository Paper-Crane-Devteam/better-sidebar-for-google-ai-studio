import { runQuery, runCommand } from '../index';
import type { Folder } from '../../types/db';

export const folderRepo = {
  create: async (folder: {
    id: string;
    name: string;
    parentId?: string | null;
  }): Promise<void> => {
    await runCommand(
      'INSERT INTO folders (id, name, parent_id) VALUES (?, ?, ?)',
      [folder.id, folder.name, folder.parentId || null]
    );
  },

  getById: async (id: string): Promise<Folder | undefined> => {
    const result = await runQuery('SELECT * FROM folders WHERE id = ?', [id]);
    return result[0] as Folder | undefined;
  },

  getByParentId: async (parentId: string | null): Promise<Folder[]> => {
    if (parentId === null) {
      return (await runQuery(
        'SELECT * FROM folders WHERE parent_id IS NULL ORDER BY order_index ASC, name ASC'
      )) as Folder[];
    }
    return (await runQuery(
      'SELECT * FROM folders WHERE parent_id = ? ORDER BY order_index ASC, name ASC',
      [parentId]
    )) as Folder[];
  },

  getAll: async (): Promise<Folder[]> => {
    return (await runQuery(
      'SELECT * FROM folders ORDER BY order_index ASC, name ASC'
    )) as Folder[];
  },

  update: async (
    id: string,
    updates: Partial<Pick<Folder, 'name' | 'parent_id' | 'order_index'>>
  ): Promise<void> => {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    if (fields.length === 0) return;

    const setClause = fields.map((field) => `${field} = ?`).join(', ');
    await runCommand(
      `UPDATE folders SET ${setClause}, updated_at = unixepoch() WHERE id = ?`,
      [...values, id]
    );
  },

  delete: async (id: string): Promise<void> => {
    await runCommand('DELETE FROM folders WHERE id = ?', [id]);
  },

  deleteMultiple: async (ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await runCommand(`DELETE FROM folders WHERE id IN (${placeholders})`, ids);
  },
};
