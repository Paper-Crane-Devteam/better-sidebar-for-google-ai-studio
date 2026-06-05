import type { BuiltInPrompt } from '../../types';

export const exportChatsPrompt: BuiltInPrompt = {
  id: 'builtin-export-chats',
  title: 'Export Conversations',
  description: 'Query and display conversation data for the user',
  icon: 'Download',
  getPromptContent: () => `## Task: Export / Display Conversation Data

Help the user access their conversation data:
1. Ask what they'd like to export (specific conversations, a folder, by date range, etc.).
2. Query the relevant conversations and their messages from the database.
3. Format and display the results in a readable way (markdown, summary, etc.).

Note: The export tool is not yet available, so present data directly in the chat.
You can query messages with: SELECT m.* FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE ...
`,
};
