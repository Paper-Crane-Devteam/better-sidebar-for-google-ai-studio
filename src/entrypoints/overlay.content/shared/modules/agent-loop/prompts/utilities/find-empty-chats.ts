import type { BuiltInPrompt } from '../../types';

export const findEmptyChatsPrompt: BuiltInPrompt = {
  id: 'builtin-find-empty-chats',
  title: 'Find Empty Conversations',
  description: 'Find conversations with no synced messages that may need cleanup',
  icon: 'Search',
  getPromptContent: () => `## Task: Find Empty Conversations

Help the user identify conversations that have no message records in the database:
1. Query conversations that have zero entries in the messages table.
2. Show the results grouped by platform, including title and creation date.
3. Suggest actions: the user might want to delete these (soft-delete), or sync their messages first.

Note: Empty conversations might just need their messages synced — they aren't necessarily useless.
Present the data and let the user decide what to do.
`,
};
