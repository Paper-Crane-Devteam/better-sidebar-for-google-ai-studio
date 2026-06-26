import type { BuiltInPrompt } from '../../types';

export const autoClassifyPrompt: BuiltInPrompt = {
  id: 'builtin-auto-classify',
  title: 'Auto-Classify Conversations',
  description: 'Automatically organize conversations into folders and tags based on their titles',
  icon: 'FolderTree',
  getPromptContent: () => `## Task: Auto-Classify Conversations

Help the user organize their conversations by:
1. First, query all conversations that are NOT yet classified — this includes conversations with folder_id IS NULL AND conversations in the Inbox folder — and NOT soft-deleted.
2. Analyze their titles to identify natural categories (e.g., coding, writing, research, casual).
3. Check existing folders and tags to reuse them when appropriate.
4. Propose a classification plan to the user (show which conversations go where).
5. After the user confirms (or if they just say "go ahead"), create the necessary folders/tags and move conversations.

Tips:
- Group related conversations together.
- Use descriptive folder names.
- Create tags for cross-cutting themes (e.g., "project-x", "learning", "work").
- Don't move conversations that are already well-organized.
- Conversations in the Inbox are considered unclassified and should be included in the classification.
`,
};
