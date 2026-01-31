import { runQuery, runCommand } from '../index';
import type { Favorite } from '../../types/db';

export const favoriteRepo = {
  add: async (
    targetId: string,
    targetType: 'conversation' | 'message' | 'prompt',
    note?: string
  ): Promise<void> => {
    await runCommand(
      'INSERT INTO favorites (id, target_id, target_type, note, created_at) VALUES (hex(randomblob(16)), ?, ?, ?, unixepoch())',
      [targetId, targetType, note || null]
    );
  },

  remove: async (
    targetId: string,
    targetType: 'conversation' | 'message' | 'prompt'
  ): Promise<void> => {
    await runCommand(
      'DELETE FROM favorites WHERE target_id = ? AND target_type = ?',
      [targetId, targetType]
    );
  },

  getAll: async (): Promise<Favorite[]> => {
    return (await runQuery(
      'SELECT * FROM favorites ORDER BY created_at DESC'
    )) as Favorite[];
  },

  isFavorite: async (
    targetId: string,
    targetType: 'conversation' | 'message' | 'prompt'
  ): Promise<boolean> => {
    const result = await runQuery(
      'SELECT 1 FROM favorites WHERE target_id = ? AND target_type = ? LIMIT 1',
      [targetId, targetType]
    );
    return result.length > 0;
  },
};
