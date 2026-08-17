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
    title: 'Sync Missing Messages',
    description:
      'Find conversations whose messages were never recorded, then sync their content',
    icon: 'RefreshCw',
    promptContent: `## Task: Sync Conversations With No Messages

A conversation only gets its messages recorded while the user has it open. Anything
they haven't visited since installing the extension is in the database as a title with
no content — which is what makes search and export come up short. This skill finds
those conversations and fills them in with \`sync_conversation_messages\`.

This is not a cleanup task. Do not propose deleting anything unless the user asks.

1. Count them FIRST, with no LIMIT. One run can only carry 50 conversations, so the
   list you fetch in step 2 is a page, not the total — reporting "50 conversations need
   syncing" when there are 300 is a wrong answer, and the user has no way to tell.

   \`\`\`sql
   SELECT COUNT(*) AS total
   FROM conversations c
   WHERE c.deleted_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id)
   \`\`\`

   Keep the platform filter from the platform rules above in both queries, and skip
   soft-deleted rows.

2. Then fetch the batch to sync — the most recently active ones first:

   \`\`\`sql
   SELECT c.external_id, c.title, datetime(c.last_active_at, 'unixepoch') AS last_active
   FROM conversations c
   WHERE c.deleted_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id)
   ORDER BY c.last_active_at DESC
   LIMIT 50
   \`\`\`

3. Report the total from step 1, and say plainly how much of it this run covers:
   "共 300 个没有消息记录，这轮同步最近的 50 个，剩下的可以再跑一次". If the total is
   zero, say so and call \`complete_task\`.

4. Explain what syncing involves, in plain language, BEFORE you call the tool. The user
   needs to know all of this:
   - the tab will leave this conversation and open each one in turn, scrolling its
     history to load the older messages
   - it takes roughly 10–30 seconds per conversation, and they should leave the tab alone
   - this agent session ends when the sync starts — you will not be able to report back
   - the tab returns here when it finishes, with a summary toast

5. Then call \`sync_conversation_messages\` with the \`external_id\` values, as the LAST
   tool call in that response (nothing after it will run):

   \`\`\`
   <bs_agent_tool>
   {"name": "sync_conversation_messages", "description": "同步 12 个空对话的消息", "params": {"conversation_ids": ["c_abc123", "c_def456"]}}
   </bs_agent_tool>
   \`\`\`

   \`conversation_ids\` is a real JSON array, exactly as above. Writing it as a quoted
   string (\`"conversation_ids": "[...]"\`) leaves the inner quotes unescaped and the
   whole call is thrown away.

Notes:
- Max 50 per run — that cap is the tool's, not the user's problem, so never present a
  batch of 50 as if it were the whole job.
- \`conversation_ids\` takes \`conversations.external_id\` (the id in the conversation
  URL), not the internal \`id\`.
- If the user only wanted to see the list, skip the sync and call \`complete_task\`.
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
    promptContent: `## Task: Export Conversations

Help the user download their conversations as files:
1. Work out which conversations they mean — by title, folder, tag, date range, or the one they
   are looking at. Use \`execute_sql\` to find the \`id\` values.
2. Call \`export\` with those ids. Pass every id in a single call rather than one call each.
3. If they named a format, pass it. If they did not, leave \`format\` out — the extension asks
   them with its own picker. Never ask about the format yourself; a question ends the task.
4. Report which files were downloaded, and mention anything that was skipped.

Notes:
- Several formats at once is fine: \`format\` accepts a list.
- \`separate_files: "true"\` gives one file per conversation inside a zip; the default merges
  them into a single file.
- A conversation with no synced messages cannot be exported — its content only reaches the
  database after it has been opened in the browser. Say which ones need opening.
`,
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
  },
];
