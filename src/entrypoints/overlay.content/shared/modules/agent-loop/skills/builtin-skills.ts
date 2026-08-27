/**
 * Built-in Skill definitions.
 *
 * Migrated from prompts/utilities/*.ts + built-in-registry.ts.
 * These are immutable — users can only enable/disable them.
 *
 * `title` and `description` are i18n keys resolved at display time via `t()`.
 * `titleKey` / `descriptionKey` store the key; the fields are filled at runtime
 * by `skill-registry.ts` so consumers see localized strings.
 */

import type { Skill } from './types';

export const BUILTIN_SKILLS: Skill[] = [
  {
    id: 'builtin-auto-classify',
    type: 'builtin',
    title: 'Auto-Classify Conversations',
    description: 'Automatically organize conversations into folders and tags based on their titles',
    titleKey: 'agent.skills.autoClassify.title',
    descriptionKey: 'agent.skills.autoClassify.description',
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
    titleKey: 'agent.skills.syncMessages.title',
    descriptionKey: 'agent.skills.syncMessages.description',
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
    titleKey: 'agent.skills.export.title',
    descriptionKey: 'agent.skills.export.description',
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
  {
    id: 'builtin-manage-prompts',
    type: 'builtin',
    title: 'Manage Prompt Library',
    description:
      'Author, refactor and organize reusable prompts — including variables and imports',
    titleKey: 'agent.skills.managePrompts.title',
    descriptionKey: 'agent.skills.managePrompts.description',
    icon: 'Wand2',
    promptContent: `## Task: Manage the Prompt Library

The prompt library is \`prompts\` + \`prompt_folders\`. This is the user's own writing, not
captured data, so the bar is higher than for conversations: propose rewrites, keep their
voice, and never mass-edit bodies without showing what changes.

### What makes this module different

- **No \`platform\` column.** Prompts and prompt folders are shared across Gemini, AI Studio,
  ChatGPT and Claude. The platform filter rule above is for \`conversations\` and \`folders\`
  only — adding \`WHERE platform = ...\` here is a SQL error, not a stricter query.
- **Titles are the entire search surface.** A prompt is used by typing \`/\` in the platform's
  input box, which fuzzy-matches **titles only**: top 8, words ANDed, and a word scores far
  higher when it starts the title. Content is never matched. So "Untitled" or "Prompt 2" is
  effectively unreachable, and the front of the title is prime real estate. Fixing this is
  usually the highest-value thing you can do here.
- **\`type\`** is \`'normal'\` or \`'system'\` — a label plus a filter toggle in the sidebar and
  nothing else; both insert identically. Prompts created from the UI default to \`'system'\`.
  Match whatever the siblings in the same folder use.
- **\`icon\`** is a Lucide name from a fixed list: Sparkles, MessageSquare, FileText, Lightbulb,
  BookOpen, Code, Image, Zap, Send, Copy, Star, Heart, Bookmark, PenLine, Bot, User. Anything
  else silently falls back to Sparkles. NULL is fine.
- **\`order_index\` does nothing.** The tree sorts by pinned → favorited → folders first →
  then title or \`updated_at\`. Writing it is wasted work.
- **Favorites** live in \`favorites\` with \`target_type = 'prompt'\` and \`target_id\` = the prompt
  id. The schema comment only names conversations and messages, but \`'prompt'\` is what the
  star in the UI writes. \`UNIQUE(target_id, target_type)\`.
- **\`prompts\` has no \`is_pinned\`** — only \`prompt_folders\` does. Don't try to pin a prompt.
- **Folder deletes cascade.** Foreign keys are ON, so deleting a \`prompt_folders\` row deletes
  its subfolders and every prompt inside. Count them first, say the number, and offer to move
  them out instead.
- **Prompt inbox** = \`prompt_folders.id = '<PROMPT_INBOX_ID>'\` — where "save selection as
  prompt" drops things, so treat it as an unsorted pile. Never create, rename or delete it.
- **There is no FTS table for prompts** and the sidebar search only matches titles, so
  \`content LIKE '%...%'\` is something the user cannot do at all. Lead with it when they are
  hunting for "the prompt where I said ...".

### The template syntax — the reason a prompt is worth keeping

A body may contain three kinds of \`{{...}}\` token, resolved when the user picks the prompt:

| Syntax | Meaning |
| --- | --- |
| \`{{tone}}\` | free-text field in the fill-in form |
| \`{{tone:formal,casual,blunt}}\` | dropdown; **the first option is the default** |
| \`{{@import:Shared Rules}}\` | inlines another prompt's content |

How they actually behave:

- Imports resolve **first** and **recursively**, so an imported prompt's own variables turn
  into fields on the form. The match is on \`prompts.title\`, **exact and case-sensitive**, and
  the first row wins if two prompts share a title. No match leaves the literal text
  \`[not found: Title]\` in the prompt; a cycle leaves \`[circular: Title]\`. Both fail silently —
  nothing warns the user before they send it.
- A token is \`{{\` + anything containing no braces + \`}}\`. There is no escape, so \`{{\` in the
  text is always a variable. Single braces (JSON, code samples) are safe.
- Values are keyed by **name**, but tokens are de-duplicated by **raw text**. Repeating
  \`{{code}}\` gives one field used in both places (good). Writing \`{{lang}}\` in one place and
  \`{{lang:go,rust}}\` in another gives two fields fighting over one value (bad) — declare each
  name once, with its options.
- **An unfilled variable becomes an empty string**, not a leftover placeholder. A template
  that only reads correctly when every field is filled comes out mangled instead of obviously
  incomplete. Keep the sentence around a variable able to survive a blank.

Use that to write templates worth having:

- A closed set of choices belongs in a dropdown, not a text field: one click instead of
  typing, and typos never reach the model.
- The block the user repeats everywhere (role, tone, output format, "answer in Chinese")
  belongs in its own prompt, pulled in with \`{{@import:...}}\`. One edit then reaches every
  prompt that imports it. This is the highest-payoff refactor in this module and the one
  nobody does by hand.
- Put each \`{{...}}\` where its value is used rather than in a header block: the form is
  generated in first-occurrence order, so the reading order of the template is the tab order.

### Writing bodies through SQL

Prompt bodies are multi-line prose full of apostrophes. Two things bite:

- Escape \`'\` as \`''\` inside the SQL string.
- Inside the tool-call JSON, line breaks must be written \`\\n\`. A real newline in the JSON
  string breaks the parse and the entire call is thrown away.

After writing a long body, \`SELECT\` the row back and check it landed the way you meant.

### Good work in this module

- Audit: prompts with empty content, duplicate titles, titles \`/\` cannot find, broken or
  circular imports (\`content LIKE '%{{@import:%'\`, then check each target against the title
  list), and whatever is piled up in the inbox.
- Turn a hardcoded prompt into a template: point out the parts that change run to run, and
  offer the dropdown-vs-text choice per variable.
- Reorganize into folders by job, and rename for slash-discoverability — front-load the word
  the user would actually type.

Report edits as before/after per prompt, then call \`complete_task\`.
`,
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-manage-snippets',
    type: 'builtin',
    title: 'Manage Snippets',
    description:
      'Organize, dedupe and search saved snippets — including their full text',
    titleKey: 'agent.skills.manageSnippets.title',
    descriptionKey: 'agent.skills.manageSnippets.description',
    icon: 'Bookmark',
    promptContent: `## Task: Manage Snippets

\`snippets\` + \`snippet_folders\` hold text the user saved off a page: whole model replies and
highlighted selections. Unlike prompts, this is captured material — it arrives fast, with
machine-made titles, and nobody ever tidies it. Sorting and searching it is the job.

### Where snippets come from, and why they look like that

- A **Save button on hover over a model reply** (Gemini, AI Studio) stores the reply's markdown
  as \`content\` and uses **the user's preceding question as the \`title\`** — stripped of a
  leading "you said", cut at 100 chars, falling back to the first 50 chars of the content. So
  titles are questions: long, and often near-duplicates of each other. Dragging that button
  onto a folder files it there; a plain click sends it to the inbox.
- The **selection toolbar** ("Save as snippet") stores whatever text was highlighted.
- Manual creation in the Snippets tab — the only path that leaves both \`source_*\` fields NULL.
- \`source_url\` is the page URL at capture time; \`source_platform\` is \`'gemini'\` or
  \`'aistudio'\`. A conversation URL on those platforms contains the conversation's
  \`external_id\`, so snippets can usually be traced back:
  \`FROM snippets s JOIN conversations c ON s.source_url LIKE '%' || c.external_id\`.
  Verify that against one sample row before trusting it across the whole table.

### What makes this module different

- **No \`platform\` column.** Snippets and their folders are shared across all platforms; the
  platform filter rule above applies to \`conversations\`/\`folders\`, not here.
- **The sidebar can only search titles**, in memory, and there is no FTS table for snippets.
  \`content LIKE '%...%'\` — plus \`LENGTH(content)\` and \`substr(...)\` — is something the user
  cannot do from the UI at all. That is your main advantage here; reach for it early.
- **Content is long.** A saved reply is routinely thousands of characters. Scan with
  \`substr(content, 1, 500)\`, size things up with \`SELECT COUNT(*), SUM(LENGTH(content))\`, and
  read a row in full only once it is the row that matters.
- **Duplicates are normal.** Saving the same reply twice, or saving a reply and then a
  selection taken out of it, both leave two rows. Match on identical \`content\`, or on
  \`LENGTH(content)\` plus a \`substr\` prefix, and keep the oldest unless told otherwise.
- **\`is_pinned\` works from SQL** and the tree honours it — pinned rows sort to the top of
  their folder. The UI only exposes pinning for folders, so this is a small thing you can do
  that the user cannot.
- **Favorites** live in \`favorites\` with \`target_type = 'snippet'\`.
- **\`order_index\` does nothing**; sorting is pinned → favorited → folders first → title or
  \`updated_at\`.
- **Folder deletes cascade** with foreign keys ON: a \`snippet_folders\` delete takes its
  subfolders and every snippet inside with it. Count and state the number before deleting.
- **Snippet inbox** = \`snippet_folders.id = '<SNIPPET_INBOX_ID>'\`. Anything saved without a
  target lands there — the unsorted queue. Never create, rename or delete it.
- **The \`export\` tool does not handle snippets** — it takes conversation ids only. If the user
  wants files, tell them the right-click Export menu on a snippet offers markdown, text, JSON,
  Obsidian and Notion. Never claim you exported a snippet.
- Reading happens in a **folder-scoped reader drawer**, so a folder behaves like a reading
  list: grouping by topic and keeping titles short is what makes it usable.

### Good work in this module

- Empty the inbox: read titles plus a \`substr\` of each content, propose folders by topic, then
  move in bulk.
- Retitle: the auto-title is the old question. Offer a short descriptive title drawn from the
  content, keeping the original wording wherever it was already good.
- Dedupe, with the counts stated before anything is deleted.
- The content search the sidebar cannot do: "the snippet where the migration steps were".
- Provenance reports: snippets whose source conversation is soft-deleted or was never synced,
  snippets per conversation, or a whole folder condensed into one overview.

Say what changed, per row or per group, then call \`complete_task\`.
`,
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
  },

  {
    id: 'builtin-workspace-agent',
    type: 'builtin',
    title: 'Workspace Agent',
    description: 'Read, write, edit, and search files in your private workspace',
    titleKey: 'agent.skills.workspace.title',
    descriptionKey: 'agent.skills.workspace.description',
    icon: 'FolderOpen',
    promptContent: `## Task: Manage Files in Your Workspace

You are a workspace assistant with a private file workspace where you can read, write, edit, and search text files.

**What the workspace is:**
- A persistent file tree, separate from the user's machine.
- Shared across Gemini and AI Studio (same workspace content on both platforms).
- Survives browser sessions — every file you write stays until explicitly deleted.
- Think of it as your personal scratch pad for notes, drafts, code snippets, plans, logs — anything text the user wants you to keep and work with across conversations.

**How to work with files:**

1. **Start by exploring what exists:** Call \`list_files\` (with no arguments to see the root) or \`glob_files\` to find files by pattern before assuming paths.

2. **Read before you edit:** \`read_file\` returns content with line numbers. Use these line numbers in your mental model — they make it obvious where an edit belongs.

3. **Editing is safer than rewriting:** Use \`edit_file\` to change part of a file. \`old_string\` must match exactly (character-for-character, including whitespace and newlines), so copy the literal text from the last \`read_file\` output — don't paraphrase or fix indentation unless the task is to fix it. The tool refuses ambiguous matches: if \`old_string\` appears twice, include more surrounding lines to make it unique. This is a feature, not a bug — it prevents you from silently editing the wrong location.

4. **Use write_file for new files or full rewrites:** Writing a new file from scratch or replacing 100% of an existing one should be \`write_file\`, not edit. It auto-creates parent directories.

5. **Search to locate things:** \`grep_files\` searches by regex across all files, returning matching lines with their line numbers. Use it to answer "where did I mention X" or "which files contain this function name". Then \`read_file\` with the path and line range to get context.

**File paths:**
- Always relative to the workspace root: \`notes/plan.md\`, not \`/notes/plan.md\` or \`./notes/plan.md\`.
- Forward slashes, even if the user writes backslashes (you normalize them).
- Paths cannot climb above the workspace root (\`../\` is rejected).

**Common workflow patterns:**
- **Note-taking:** User says "remember that X is Y". \`write_file\` it into \`notes/X.md\`, or append to an existing index file with \`edit_file\`.
- **Iterative editing:** User says "change line 42 of main.py to use async". \`read_file main.py\` first (even if you edited it last turn — memory is fallible), locate line 42 in the output, then \`edit_file\` with the exact current text of line 42 in \`old_string\`.
- **Working files across sessions:** User says "continue the draft". \`glob_files *.md\` or \`list_files drafts\`, then \`read_file\` the latest, then propose next steps or \`edit_file\` to add content.
- **Code snippets:** User pastes a function. \`write_file code/snippet-NAME.js\` with a brief filename. If they later say "that function from before", \`grep_files 'function NAME'\` finds it, then \`read_file\` retrieves the whole thing.

**Approvals:**
- File reads and searches run immediately.
- Writes, edits, deletes and moves wait for the user's OK (unless they have auto-approval on).
- When proposing a change, put a human-readable summary in \`change_summary\` so the approval card is useful. Example: "Renames the getUser function to fetchUser in api.ts."

**Finish and report:**
When done, call \`complete_task\` with \`status: "success"\` and a brief \`summary\` of what you changed or found. Show paths and line counts, not full file bodies.

Proceed with the user's request.
`,
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
  },
];
