import type { BuiltInPrompt } from '../../types';

export const exportChatsPrompt: BuiltInPrompt = {
  id: 'builtin-export-chats',
  title: 'Export Conversations',
  description: 'Query and display conversation data for the user',
  icon: 'Download',
  getPromptContent: () => `## Task: Export Conversations

Help the user download their conversations as files:
1. Find the conversation ids with execute_sql (by title, folder, tag or date range).
2. Call the export tool with all of those ids in one call.
3. Leave the format parameter out when the user did not name one — the extension asks them.
`,
};
