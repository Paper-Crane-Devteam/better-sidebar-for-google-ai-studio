/**
 * Built-in Skill definitions.
 *
 * Migrated from prompts/utilities/*.ts + built-in-registry.ts.
 * These are immutable — users can only enable/disable them.
 */

import type { Skill } from './types';

export const BUILTIN_SKILLS: Skill[] = [
  {
    id: 'builtin-auto-classify',
    type: 'builtin',
    title: 'Auto-Classify Conversations',
    description: 'Automatically organize conversations into folders and tags based on their titles',
    icon: 'FolderTree',
    promptContent: `## Task: Auto-Classify Conversations

Help the user organize their conversations by:
1. First, query all conversations that are NOT yet classified and NOT soft-deleted. "Not yet classified" means:
   \`WHERE deleted_at IS NULL AND (folder_id IS NULL OR folder_id = '<CONVERSATION_INBOX_ID>')\`
   \`<CONVERSATION_INBOX_ID>\` above is already the real inbox folder ID — copy it verbatim into your SQL. Never look the inbox up by name; its name is localized.
2. Analyze their titles to identify natural categories (e.g., coding, writing, research, casual).
3. Check existing folders and tags to reuse them when appropriate.
4. Propose a classification plan to the user (show which conversations go where).
5. After the user confirms (or if they just say "go ahead"), create the necessary folders/tags and move conversations.

Tips:
- Group related conversations together.
- Use descriptive folder names.
- Create tags for cross-cutting themes (e.g., "project-x", "learning", "work").
- Don't move conversations that are already well-organized.
- Conversations in the inbox are considered unclassified and should be included in the classification.
- Never create, rename or delete an inbox folder.
`,
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-find-empty-chats',
    type: 'builtin',
    title: 'Find Empty Conversations',
    description: 'Find conversations with no synced messages that may need cleanup',
    icon: 'Search',
    promptContent: `## Task: Find Empty Conversations

Help the user identify conversations that have no message records in the database:
1. Query conversations that have zero entries in the messages table.
2. Show the results grouped by platform, including title and creation date.
3. Suggest actions: the user might want to delete these (soft-delete), or sync their messages first.

Note: Empty conversations might just need their messages synced — they aren't necessarily useless.
Present the data and let the user decide what to do.
`,
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-export-chats',
    type: 'builtin',
    title: 'Export Conversations',
    description: 'Query and display conversation data for the user',
    icon: 'Download',
    promptContent: `## Task: Export / Display Conversation Data

Help the user access their conversation data:
1. Ask what they'd like to export (specific conversations, a folder, by date range, etc.).
2. Query the relevant conversations and their messages from the database.
3. Format and display the results in a readable way (markdown, summary, etc.).

Note: The export tool is not yet available, so present data directly in the chat.
You can query messages with: SELECT m.* FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE ...
`,
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-freeform',
    type: 'builtin',
    title: 'Custom Task',
    description: 'Tell the AI what you want to do with your data',
    icon: 'Sparkles',
    promptContent: `## Task: Custom

The user will describe what they want to accomplish. Help them by querying and modifying the database as needed. Always start by understanding the current data state with SELECT queries.
`,
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
  },
];
