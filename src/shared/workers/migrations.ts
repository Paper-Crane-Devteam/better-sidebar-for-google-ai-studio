/**
 * Database migrations — executed once per DB open inside the web worker.
 */

export const runMigrations = async (db: any) => {
  console.log('Worker: Checking for migrations...');

  // Helper to check if a column exists in a table
  const hasColumn = async (
    table: string,
    column: string,
  ): Promise<boolean> => {
    const columns = await db.run(`PRAGMA table_info(${table})`);
    return columns.some((col: any) => col.name === column);
  };

  // Individual migration wrapper — keeps one failure from cascading into the rest.
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      console.error(`Worker: Migration "${name}" failed:`, err);
    }
  };

  // Helper: ensure the _migrations metadata table exists and check/mark one-time migrations.
  const ensureMigrationsTable = async () => {
    await db.run(`
      CREATE TABLE IF NOT EXISTS _migrations (
        key TEXT PRIMARY KEY,
        executed_at INTEGER DEFAULT (unixepoch())
      )
    `);
  };

  const hasMigrationRun = async (key: string): Promise<boolean> => {
    const rows = await db.run('SELECT 1 FROM _migrations WHERE key = ?', [key]);
    return rows.length > 0;
  };

  const markMigrationDone = async (key: string) => {
    await db.run('INSERT OR IGNORE INTO _migrations (key) VALUES (?)', [key]);
  };

  try {

    // These early migrations predate the `step` wrapper and ran bare inside the
    // outer try, so a single failure jumped straight to the catch and silently
    // skipped every migration below — including the ones that add `is_pinned`.
    // That is how two profiles in the same install end up with different
    // columns, which then breaks restoring a backup from one into the other.
    // Wrapping them contains a failure to this group.
    await step('legacy column migrations', async () => {

    // Migration: Add order_index to messages if missing
    if (!(await hasColumn('messages', 'order_index'))) {
      console.log('Worker: Migrating messages table - adding order_index');
      await db.run(
        'ALTER TABLE messages ADD COLUMN order_index INTEGER DEFAULT 0',
      );
    }

    // Migration: Add message_type to messages if missing
    if (!(await hasColumn('messages', 'message_type'))) {
      console.log('Worker: Migrating messages table - adding message_type');
      await db.run(
        "ALTER TABLE messages ADD COLUMN message_type TEXT DEFAULT 'text'",
      );
    }

    // Migration: Add order_index to conversations if missing
    if (!(await hasColumn('conversations', 'order_index'))) {
      console.log('Worker: Migrating conversations table - adding order_index');
      await db.run(
        'ALTER TABLE conversations ADD COLUMN order_index INTEGER DEFAULT 0',
      );
    }

    // Migration: Add prompt_metadata to conversations if missing
    if (!(await hasColumn('conversations', 'prompt_metadata'))) {
      console.log(
        'Worker: Migrating conversations table - adding prompt_metadata',
      );
      await db.run('ALTER TABLE conversations ADD COLUMN prompt_metadata TEXT');
    }

    // Migration: Add type to conversations if missing
    if (!(await hasColumn('conversations', 'type'))) {
      console.log('Worker: Migrating conversations table - adding type');
      await db.run(
        "ALTER TABLE conversations ADD COLUMN type TEXT DEFAULT 'conversation'",
      );
    }

    // Migration: Add platform to conversations if missing
    if (!(await hasColumn('conversations', 'platform'))) {
      console.log('Worker: Migrating conversations table - adding platform');
      await db.run(
        "ALTER TABLE conversations ADD COLUMN platform TEXT DEFAULT 'aistudio'",
      );
    }

    // Always ensure platform index exists (moved out of SCHEMA to avoid startup errors on old DBs)
    await db.run(
      'CREATE INDEX IF NOT EXISTS idx_conversations_platform ON conversations(platform)',
    );

    // Migration: Add order_index to folders if missing
    if (!(await hasColumn('folders', 'order_index'))) {
      console.log('Worker: Migrating folders table - adding order_index');
      await db.run(
        'ALTER TABLE folders ADD COLUMN order_index INTEGER DEFAULT 0',
      );
    }

    // Migration: Add platform to folders if missing
    if (!(await hasColumn('folders', 'platform'))) {
      console.log('Worker: Migrating folders table - adding platform');
      await db.run(
        "ALTER TABLE folders ADD COLUMN platform TEXT DEFAULT 'aistudio'",
      );
    }

    // Migration: Add deleted_at to conversations if missing (soft deletion)
    if (!(await hasColumn('conversations', 'deleted_at'))) {
      console.log(
        'Worker: Migrating conversations table - adding deleted_at for soft deletion',
      );
      await db.run(
        'ALTER TABLE conversations ADD COLUMN deleted_at INTEGER DEFAULT NULL',
      );
      await db.run(
        'CREATE INDEX IF NOT EXISTS idx_conversations_deleted ON conversations(deleted_at)',
      );
    }

    // Migration: Add color to folders if missing
    if (!(await hasColumn('folders', 'color'))) {
      console.log('Worker: Migrating folders table - adding color');
      await db.run('ALTER TABLE folders ADD COLUMN color TEXT');
    }

    // Migration: Add gem_id to conversations if missing
    if (!(await hasColumn('conversations', 'gem_id'))) {
      console.log('Worker: Migrating conversations table - adding gem_id');
      await db.run('ALTER TABLE conversations ADD COLUMN gem_id TEXT');
    }
    await db.run(
      'CREATE INDEX IF NOT EXISTS idx_conversations_gem_id ON conversations(gem_id)',
    );

    // Migration: Create gems table if missing
    const gemsTableExists = await db.run(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='gems'",
    );
    if (gemsTableExists.length === 0) {
      console.log('Worker: Creating gems table');
      await db.run(`
        CREATE TABLE IF NOT EXISTS gems (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          external_id TEXT UNIQUE,
          external_url TEXT,
          icon_url TEXT,
          description TEXT,
          platform TEXT DEFAULT 'gemini',
          order_index INTEGER DEFAULT 0,
          is_pinned INTEGER DEFAULT 0,
          is_deleted INTEGER DEFAULT 0,
          created_at INTEGER DEFAULT (unixepoch()),
          updated_at INTEGER DEFAULT (unixepoch())
        )
      `);
      await db.run(
        'CREATE INDEX IF NOT EXISTS idx_gems_platform ON gems(platform)',
      );
    }

    // Migration: Add is_deleted to gems if missing (soft deletion)
    if (await hasColumn('gems', 'id') && !(await hasColumn('gems', 'is_deleted'))) {
      console.log('Worker: Migrating gems table - adding is_deleted for soft deletion');
      await db.run(
        'ALTER TABLE gems ADD COLUMN is_deleted INTEGER DEFAULT 0',
      );
    }

    }); // end legacy column migrations

    // Migration: Add notebook_id to conversations if missing
    await step('add notebook_id to conversations', async () => {
      if (!(await hasColumn('conversations', 'notebook_id'))) {
        console.log('Worker: Migrating conversations table - adding notebook_id');
        await db.run('ALTER TABLE conversations ADD COLUMN notebook_id TEXT');
      }
      await db.run(
        'CREATE INDEX IF NOT EXISTS idx_conversations_notebook_id ON conversations(notebook_id)',
      );
    });

    // Migration: Create notebooks table if missing
    await step('create notebooks table', async () => {
      const notebooksTableExists = await db.run(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='notebooks'",
      );
      if (notebooksTableExists.length === 0) {
        console.log('Worker: Creating notebooks table');
        await db.run(`
          CREATE TABLE IF NOT EXISTS notebooks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            external_id TEXT UNIQUE,
            external_url TEXT,
            icon_url TEXT,
            description TEXT,
            platform TEXT DEFAULT 'gemini',
            order_index INTEGER DEFAULT 0,
            is_pinned INTEGER DEFAULT 0,
            is_deleted INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (unixepoch()),
            updated_at INTEGER DEFAULT (unixepoch())
          )
        `);
        await db.run(
          'CREATE INDEX IF NOT EXISTS idx_notebooks_platform ON notebooks(platform)',
        );
      }
    });

    // Same reasoning as the group above: these ran bare, and because they sit
    // ahead of the `is_pinned` migrations, a failure here was enough to leave a
    // profile without those columns.
    await step('timestamp column migrations', async () => {

    // Migration: Add updated_at to favorites if missing
    if (!(await hasColumn('favorites', 'updated_at'))) {
      console.log('Worker: Migrating favorites table - adding updated_at');
      await db.run(
        'ALTER TABLE favorites ADD COLUMN updated_at INTEGER',
      );
      // Backfill from created_at
      await db.run('UPDATE favorites SET updated_at = COALESCE(created_at, unixepoch())');
    }

    // Migration: Add updated_at to tags if missing
    if (!(await hasColumn('tags', 'updated_at'))) {
      console.log('Worker: Migrating tags table - adding updated_at');
      await db.run(
        'ALTER TABLE tags ADD COLUMN updated_at INTEGER',
      );
      // Backfill from created_at
      await db.run('UPDATE tags SET updated_at = COALESCE(created_at, unixepoch())');
    }

    // Migration: Add updated_at to conversation_tags if missing
    if (!(await hasColumn('conversation_tags', 'updated_at'))) {
      console.log('Worker: Migrating conversation_tags table - adding updated_at');
      await db.run(
        'ALTER TABLE conversation_tags ADD COLUMN updated_at INTEGER',
      );
      // Backfill from created_at
      await db.run('UPDATE conversation_tags SET updated_at = COALESCE(created_at, unixepoch())');
    }

    // Migration: Add last_active_at to conversations if missing
    if (!(await hasColumn('conversations', 'last_active_at'))) {
      console.log('Worker: Migrating conversations table - adding last_active_at');
      await db.run(
        'ALTER TABLE conversations ADD COLUMN last_active_at INTEGER',
      );
      // Backfill from existing updated_at (which previously held the business timestamp)
      await db.run('UPDATE conversations SET last_active_at = COALESCE(updated_at, unixepoch())');
    }

    }); // end timestamp column migrations

    // Migration: Add description to conversations if missing
    await step('add description to conversations', async () => {
      if (!(await hasColumn('conversations', 'description'))) {
        console.log('Worker: Migrating conversations table - adding description');
        await db.run(
          "ALTER TABLE conversations ADD COLUMN description TEXT DEFAULT ''",
        );
      }
    });

    // Migration: Add is_pinned to folders if missing
    await step('add is_pinned to folders', async () => {
      if (!(await hasColumn('folders', 'is_pinned'))) {
        console.log('Worker: Migrating folders table - adding is_pinned');
        await db.run(
          'ALTER TABLE folders ADD COLUMN is_pinned INTEGER DEFAULT 0',
        );
      }
    });

    // Migration: Add is_pinned to prompt_folders if missing
    await step('add is_pinned to prompt_folders', async () => {
      if (!(await hasColumn('prompt_folders', 'is_pinned'))) {
        console.log('Worker: Migrating prompt_folders table - adding is_pinned');
        await db.run(
          'ALTER TABLE prompt_folders ADD COLUMN is_pinned INTEGER DEFAULT 0',
        );
      }
    });

    // Migration: Add is_pinned to gems if missing
    await step('add is_pinned to gems', async () => {
      if (!(await hasColumn('gems', 'is_pinned'))) {
        console.log('Worker: Migrating gems table - adding is_pinned');
        await db.run(
          'ALTER TABLE gems ADD COLUMN is_pinned INTEGER DEFAULT 0',
        );
      }
    });

    // Migration: Add is_pinned to notebooks if missing
    await step('add is_pinned to notebooks', async () => {
      if (!(await hasColumn('notebooks', 'is_pinned'))) {
        console.log('Worker: Migrating notebooks table - adding is_pinned');
        await db.run(
          'ALTER TABLE notebooks ADD COLUMN is_pinned INTEGER DEFAULT 0',
        );
      }
    });
    // Migration: Create snippet_folders table if missing
    await step('create snippet_folders table', async () => {
      const tableExists = await db.run(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='snippet_folders'",
      );
      if (tableExists.length === 0) {
        console.log('Worker: Creating snippet_folders table');
        await db.run(`
          CREATE TABLE IF NOT EXISTS snippet_folders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            parent_id TEXT,
            order_index INTEGER DEFAULT 0,
            is_pinned INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (unixepoch()),
            updated_at INTEGER DEFAULT (unixepoch()),
            FOREIGN KEY(parent_id) REFERENCES snippet_folders(id) ON DELETE CASCADE
          )
        `);
        await db.run(
          'CREATE INDEX IF NOT EXISTS idx_snippet_folders_parent ON snippet_folders(parent_id)',
        );
      }
    });

    // Migration: Create snippets table if missing
    await step('create snippets table', async () => {
      const tableExists = await db.run(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='snippets'",
      );
      if (tableExists.length === 0) {
        console.log('Worker: Creating snippets table');
        await db.run(`
          CREATE TABLE IF NOT EXISTS snippets (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT,
            source_url TEXT,
            source_platform TEXT,
            folder_id TEXT,
            order_index INTEGER DEFAULT 0,
            is_pinned INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (unixepoch()),
            updated_at INTEGER DEFAULT (unixepoch()),
            FOREIGN KEY(folder_id) REFERENCES snippet_folders(id) ON DELETE CASCADE
          )
        `);
        await db.run(
          'CREATE INDEX IF NOT EXISTS idx_snippets_folder ON snippets(folder_id)',
        );
      }
    });

    // Migration: Add default_folder_id to gems if missing
    await step('add default_folder_id to gems', async () => {
      if (!(await hasColumn('gems', 'default_folder_id'))) {
        console.log('Worker: Migrating gems table - adding default_folder_id');
        await db.run(
          'ALTER TABLE gems ADD COLUMN default_folder_id TEXT',
        );
      }
    });
    // Migration: Add default_folder_id to notebooks if missing
    await step('add default_folder_id to notebooks', async () => {
      if (!(await hasColumn('notebooks', 'default_folder_id'))) {
        console.log('Worker: Migrating notebooks table - adding default_folder_id');
        await db.run(
          'ALTER TABLE notebooks ADD COLUMN default_folder_id TEXT',
        );
      }
    });

    // Migration: Migrate legacy conversation inbox folders to deterministic IDs
    await step('migrate legacy conversation inbox folders', async () => {
      const legacyFolders = await db.run(`
        SELECT * FROM folders 
        WHERE id NOT LIKE '__default_sync_folder__%' 
          AND name IN ('Inbox', 'Imported', '收件箱', 'Bandeja de entrada', 'Входящие', 'Caixa de entrada', '受信トレイ', '收件匣')
      `);

      for (const folder of legacyFolders) {
        const platform = folder.platform || 'aistudio';
        const inboxId = `__default_sync_folder__${platform}`;

        // Check if the deterministic inbox folder already exists
        const exists = await db.run('SELECT 1 FROM folders WHERE id = ?', [inboxId]);
        if (exists.length === 0) {
          // Create the deterministic inbox folder copying properties from the legacy folder
          await db.run(
            `INSERT INTO folders (id, name, parent_id, platform, color, order_index, is_pinned, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              inboxId,
              folder.name,
              folder.parent_id || null,
              platform,
              folder.color || null,
              folder.order_index ?? 0,
              folder.is_pinned ?? 0,
              folder.created_at ?? Math.floor(Date.now() / 1000),
              folder.updated_at ?? Math.floor(Date.now() / 1000),
            ],
          );
        }

        // Re-parent conversations and subfolders, and update gem/notebook defaults
        await db.run('UPDATE conversations SET folder_id = ? WHERE folder_id = ?', [inboxId, folder.id]);
        await db.run('UPDATE folders SET parent_id = ? WHERE parent_id = ?', [inboxId, folder.id]);
        
        if (await hasColumn('gems', 'default_folder_id')) {
          await db.run('UPDATE gems SET default_folder_id = ? WHERE default_folder_id = ?', [inboxId, folder.id]);
        }
        if (await hasColumn('notebooks', 'default_folder_id')) {
          await db.run('UPDATE notebooks SET default_folder_id = ? WHERE default_folder_id = ?', [inboxId, folder.id]);
        }

        // Delete the legacy folder
        await db.run('DELETE FROM folders WHERE id = ?', [folder.id]);
        console.log(`Worker: Migrated legacy conversation inbox ${folder.id} to ${inboxId}`);
      }
    });

    // Migration: Migrate legacy snippet inbox folders to deterministic IDs
    await step('migrate legacy snippet inbox folders', async () => {
      const snippetInboxId = '__snippet_inbox__';
      const legacySnippetFolders = await db.run(`
        SELECT * FROM snippet_folders 
        WHERE id != ? 
          AND name IN ('Inbox', '收件箱', 'Входящие', 'Caixa de entrada', '收件匣', '受信トレイ', 'Bandeja de entrada')
      `, [snippetInboxId]);

      for (const folder of legacySnippetFolders) {
        // Check if deterministic snippet inbox already exists
        const exists = await db.run('SELECT 1 FROM snippet_folders WHERE id = ?', [snippetInboxId]);
        if (exists.length === 0) {
          await db.run(
            `INSERT INTO snippet_folders (id, name, parent_id, order_index, is_pinned, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              snippetInboxId,
              folder.name,
              folder.parent_id || null,
              folder.order_index ?? 0,
              folder.is_pinned ?? 0,
              folder.created_at ?? Math.floor(Date.now() / 1000),
              folder.updated_at ?? Math.floor(Date.now() / 1000),
            ],
          );
        }

        // Re-parent snippets and subfolders
        await db.run('UPDATE snippets SET folder_id = ? WHERE folder_id = ?', [snippetInboxId, folder.id]);
        await db.run('UPDATE snippet_folders SET parent_id = ? WHERE parent_id = ?', [snippetInboxId, folder.id]);

        // Delete the legacy folder
        await db.run('DELETE FROM snippet_folders WHERE id = ?', [folder.id]);
        console.log(`Worker: Migrated legacy snippet inbox ${folder.id} to ${snippetInboxId}`);
      }
    });

    /**
     * Migration: agent session / tool call ledger.
     *
     * What the agent did is our own bookkeeping, and it had no home: it was encoded
     * into the prose sent back to the AI (`### label`, an `ERROR:` prefix) and parsed
     * out of the conversation again on every read. That round trip is what made a
     * reloaded page fall back to guessing which result belonged to which call.
     *
     * Deliberately *not* a copy of the messages. The conversation stays the record of
     * what was said; these tables only hold what cannot be re-derived from it —
     * whether a call ran, and whether its result ever reached the AI.
     *
     * Not in SYNC_TABLES either, for the same reason `messages` isn't: result bodies
     * are large and private. A conversation opened on another machine has no rows
     * here and falls back to reading the transcript.
     */
    await step('create agent ledger tables', async () => {
      await db.run(`
        CREATE TABLE IF NOT EXISTS agent_sessions (
          id TEXT PRIMARY KEY,
          conversation_id TEXT,
          title TEXT,
          skill_id TEXT,
          status TEXT DEFAULT 'running',
          end_reason TEXT,
          rounds INTEGER DEFAULT 0,
          started_at INTEGER DEFAULT (unixepoch()),
          ended_at INTEGER
        )
      `);
      await db.run(
        'CREATE INDEX IF NOT EXISTS idx_agent_sessions_conversation ON agent_sessions(conversation_id)',
      );

      await db.run(`
        CREATE TABLE IF NOT EXISTS agent_tool_calls (
          id TEXT PRIMARY KEY,
          session_id TEXT,
          conversation_id TEXT,
          join_key TEXT NOT NULL,
          round INTEGER DEFAULT 0,
          order_index INTEGER DEFAULT 0,
          tool_name TEXT,
          description TEXT,
          params TEXT,
          is_write INTEGER DEFAULT 0,
          status TEXT NOT NULL,
          result_body TEXT,
          delivered INTEGER DEFAULT 0,
          created_at INTEGER DEFAULT (unixepoch()),
          updated_at INTEGER DEFAULT (unixepoch())
        )
      `);
      // The card looks a call up by conversation + key; the recovery check looks for
      // undelivered rows in a conversation. Both are covered by this pair.
      await db.run(
        'CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_lookup ON agent_tool_calls(conversation_id, join_key)',
      );
      await db.run(
        'CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_session ON agent_tool_calls(session_id, round, order_index)',
      );
    });

    /**
     * Which workspace a conversation is bound to.
     *
     * A conversation picks a workspace once — on its first successful workspace tool
     * call — and is locked to it from then on. The lock has to survive a reload and
     * still be there tomorrow, which rules out memory; and it is keyed by conversation,
     * which rules out a plain preference: `chrome.storage` would need its own
     * conversation → workspace map, i.e. this column with extra steps.
     *
     * Nullable, and null is the common case — only conversations that actually touched
     * a file carry a value. `hasColumn` makes the step safe to re-run.
     */
    await step('add workspace_id to agent_sessions', async () => {
      if (await hasColumn('agent_sessions', 'workspace_id')) return;
      console.log('Worker: Migrating agent_sessions - adding workspace_id');
      await db.run('ALTER TABLE agent_sessions ADD COLUMN workspace_id TEXT');
    });

    // ── One-time data fix (v2.9.0): fix conversation created_at from first message ──
    // A previous bug caused conversations.created_at to be incorrect.
    // For existing users: set created_at = first message's timestamp (MIN(timestamp)).
    // For conversations without messages: set created_at = NULL.
    // New installs won't have the _migrations table row, but also won't have
    // any data, so the UPDATE is a no-op either way.
    await step('fix conversation created_at from first message (v2.9.0)', async () => {
      await ensureMigrationsTable();

      if (await hasMigrationRun('fix_conversation_created_at_v2.9.0')) return;

      console.log('Worker: Running one-time fix for conversation created_at...');

      // Set created_at to the earliest message timestamp for conversations that have messages
      await db.run(`
        UPDATE conversations
        SET created_at = (
          SELECT MIN(m.timestamp)
          FROM messages m
          WHERE m.conversation_id = conversations.id
        )
        WHERE EXISTS (
          SELECT 1 FROM messages m WHERE m.conversation_id = conversations.id
        )
      `);

      // Set created_at to NULL for conversations without any messages
      await db.run(`
        UPDATE conversations
        SET created_at = NULL
        WHERE NOT EXISTS (
          SELECT 1 FROM messages m WHERE m.conversation_id = conversations.id
        )
      `);

      await markMigrationDone('fix_conversation_created_at_v2.9.0');
      console.log('Worker: Conversation created_at fix completed.');
    });

  } catch (err) {
    console.error('Worker: Migration failed:', err);
  }
};
