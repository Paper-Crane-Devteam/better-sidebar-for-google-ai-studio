import { runQuery, runCommand } from '../index';

export const rawSql = {
  execute: async (sql: string): Promise<any[]> => {
    if (sql.trim().toLowerCase().startsWith('select')) {
      return await runQuery(sql);
    } else {
      await runCommand(sql);
      return [];
    }
  },
};
