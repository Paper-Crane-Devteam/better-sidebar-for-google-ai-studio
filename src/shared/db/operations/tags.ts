import { runQuery, runCommand } from '../index';
import type { Tag } from '../../types/db';

export const tagRepo = {
  create: async (name: string, color?: string): Promise<string> => {
    const idResult = await runQuery('SELECT hex(randomblob(16)) as id');
    const id = idResult[0].id;

    await runCommand(
      'INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, unixepoch())',
      [id, name, color || null]
    );
    return id;
  },

  getAll: async (): Promise<Tag[]> => {
    return (await runQuery('SELECT * FROM tags ORDER BY name ASC')) as Tag[];
  },

  getById: async (id: string): Promise<Tag | undefined> => {
    const result = await runQuery('SELECT * FROM tags WHERE id = ?', [id]);
    return result[0] as Tag | undefined;
  },

  update: async (
    id: string,
    updates: Partial<Pick<Tag, 'name' | 'color'>>
  ): Promise<void> => {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    if (fields.length === 0) return;

    const setClause = fields.map((field) => `${field} = ?`).join(', ');
    await runCommand(`UPDATE tags SET ${setClause} WHERE id = ?`, [
      ...values,
      id,
    ]);
  },

  delete: async (id: string): Promise<void> => {
    await runCommand('DELETE FROM tags WHERE id = ?', [id]);
  },
};
