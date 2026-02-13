# Better Sidebar for Gemini & AI Studio - Feature Summary

## Architecture Overview
- Chrome Extension built with WXT framework
- React + TypeScript frontend
- SQLite WASM database (via offscreen document)
- Content scripts, background service worker, main-world script injection
- Shadow DOM isolation for overlay UI

## Database Schema (shared/db/schema.ts)
- **prompt_folders**: id, name, parent_id, order_index, created_at, updated_at; FK parent_id → prompt_folders(id) ON DELETE CASCADE; index idx_prompt_folders_parent
- **prompts**: id, title, content, type ('normal'|'system'), icon, folder_id, order_index, created_at, updated_at; FK folder_id → prompt_folders(id) ON DELETE CASCADE; index idx_prompts_folder
- **folders**: id, name, parent_id, order_index, created_at, updated_at; FK parent_id → folders(id) ON DELETE CASCADE; index idx_folders_parent
- **conversations**: id, title, folder_id, external_id UNIQUE, external_url, model_name, type DEFAULT 'conversation', order_index, updated_at, created_at, prompt_metadata; FK folder_id → folders(id) ON DELETE CASCADE; index idx_conversations_folder
- **messages**: id, conversation_id, role ('user'|'model'), content, message_type DEFAULT 'text' ('text'|'thought'), order_index, timestamp; FK conversation_id → conversations(id) ON DELETE CASCADE; index idx_messages_conversation
- **messages_fts**: FTS5 virtual table (id UNINDEXED, content), tokenize='trigram'; triggers messages_ai/ad/au sync INSERT/DELETE/UPDATE from messages; migration populates from messages if FTS empty
- **favorites**: id, target_id, target_type ('conversation'|'message'|'prompt'), note, created_at; UNIQUE(target_id, target_type); index idx_favorites_target
- **tags**: id, name UNIQUE, color, created_at
- **conversation_tags**: conversation_id, tag_id, created_at; PK (conversation_id, tag_id); FKs to conversations and tags ON DELETE CASCADE; indexes on tag_id and conversation_id

### Types (shared/types/db.ts)
- Folder, Conversation, Message (role, message_type), Favorite (target_type includes 'prompt'), Tag, ConversationTag, PromptFolder, Prompt (title, content, type, icon, folder_id)

## Background Service Worker (background.ts)
- Initializes SQLite database via offscreen document
- Message handler for all extension communication
- Data update notification system (notifies sidepanel and content scripts)
- Side panel auto-open on action click

### Message Types Handled
- GET_FOLDERS: Returns all folders
- CREATE_FOLDER: Creates folder with id, name, parentId
- UPDATE_FOLDER: Updates folder name, parent_id, order_index
- DELETE_FOLDER: Deletes folder by id
- GET_CONVERSATIONS: Returns all conversations or filtered by folderId
- SAVE_CONVERSATION: Saves conversation with messages (bulk insert)
- DELETE_CONVERSATION: Deletes conversation and notifies updates
- UPDATE_CONVERSATION_TITLE: Updates conversation title and last_updated timestamp
- CREATE_CONVERSATION: Creates new conversation, auto-assigns to "Imported" folder if no folderId provided
- MOVE_CONVERSATION: Moves conversation to different folder
- SCAN_LIBRARY: Opens/activates library tab and triggers scan
- SAVE_SCANNED_ITEMS: Bulk saves scanned items, merges with existing, deletes items not in scan
- EXECUTE_SQL: Executes raw SQL query (SELECT returns data, others return empty)
- RESET_DATABASE: Drops all tables, recreates schema, runs VACUUM
- OPEN_URL: Opens URL in current tab or new tab
- ADD_FAVORITE: Adds favorite with targetId, targetType, optional note
- REMOVE_FAVORITE: Removes favorite by targetId and targetType
- GET_FAVORITES: Returns all favorites
- GET_TAGS: Returns all tags
- CREATE_TAG: Creates tag with name and optional color
- UPDATE_TAG: Updates tag name or color
- DELETE_TAG: Deletes tag by id
- ADD_TAG_TO_CONVERSATION: Links tag to conversation
- REMOVE_TAG_FROM_CONVERSATION: Unlinks tag from conversation
- GET_CONVERSATION_TAGS: Returns tags for conversation or conversations for tag
- GET_ALL_CONVERSATION_TAGS: Returns all conversation-tag pairs
- EXPORT_DATABASE: Exports database as SQL dump
- IMPORT_DATABASE: Imports SQL dump
- GET_PAGE_LOCAL_STORAGE: Returns value from AI Studio page localStorage (e.g. aistudio_all_system_instructions for prompts import)
- GET_MESSAGE_SCROLL_INDEX: Returns scroll index for a message in a conversation (for search jump-to-message)

## Content Script (content/index.ts)
- Matches: https://aistudio.google.com/*
- Initializes API scanner immediately
- Theme synchronization: Observes body.dark-theme class, syncs to chrome.storage.local
- Injects main-world.js script
- Listens for AI_STUDIO_PROMPT_UPDATE event, sends UPDATE_CONVERSATION_TITLE message
- Listens for AI_STUDIO_PROMPT_DELETE event, sends DELETE_CONVERSATION message
- Initializes single chat scanner
- Handles START_LIBRARY_SCAN message, triggers scanLibrary()

## Main World Script (main-world/index.ts)
- Injects ajax-hook proxy to intercept HTTP requests
- Intercepts: ResolveDriveResource, GenerateContent (chat), ListPrompts (library), UpdatePrompt, CreatePrompt, DeletePrompt
- Dispatches custom events: AI_STUDIO_RESPONSE, AI_STUDIO_LIBRARY_DATA, AI_STUDIO_PROMPT_UPDATE, AI_STUDIO_PROMPT_CREATE, AI_STUDIO_PROMPT_DELETE

### Chat Response Handler (interceptors/chat.ts)
- Parses response structure: root[0][0]=resourceId, root[0][3][2]=modelName, root[0][4][0]=title, root[0][13]=turns
- Extracts messages from turns: turn[0]=user message, turn[2]=model message
- Dispatches AI_STUDIO_RESPONSE event with resourceId, title, modelName, messages

### Library Response Handler (interceptors/library.ts)
- Parses ListPrompts response: root[0] = items array
- Extracts: item[0]=promptPath, item[4][4][0]=createdAt seconds, item[4][4][1]=promptMetadata, item[4][11]=type metadata
- Parses prompt type: checks for ["promptType", "IMAGEN_PROMPT"] to determine text-to-image vs conversation
- Dispatches AI_STUDIO_LIBRARY_DATA event with items array

### Create Prompt Handler (interceptors/create.ts)
- Intercepts CreatePrompt response (status 200)
- Parses: json[0]=promptPath, json[4][0]=title, json[4][2]=metadata, json[4][4][0][0]=createdAt
- Dispatches AI_STUDIO_PROMPT_CREATE event with id, title, prompt_metadata, created_at, type

### Update Prompt Handler (interceptors/update.ts)
- Intercepts UpdatePrompt request body (status 200)
- Parses: json[0][0]=promptPath, json[0][4][0]=title
- Dispatches AI_STUDIO_PROMPT_UPDATE event with id, title

### Delete Prompt Handler (interceptors/delete.ts)
- Intercepts DeletePrompt request body (status 200)
- Parses: json[0]=promptPath
- Dispatches AI_STUDIO_PROMPT_DELETE event with id

## Library Scanning (content/tasks/scan-library/)
- scanLibrary(): Combines DOM scan and API scan
- scan-dom.ts: Scrolls library table, extracts items from tr[mat-row], waits for content changes
- scan-api.ts: ApiScanner class listens for AI_STUDIO_LIBRARY_DATA events, accumulates items
- Merges DOM data (title, url) with API data (created_at, prompt_metadata, type)
- Sends SAVE_SCANNED_ITEMS message to background

## Single Chat Scanner (content/tasks/scan-single-chat.ts)
- Scans messages from div[data-turn-role] elements
- Extracts role (user/model) and content via htmlToMarkdown
- Currently only initial scan on load (5s delay), mutation observer commented out

## Overlay Content Script (overlay.content/index.tsx)
- Injects sidebar into .makersuite-layout
- Hides ms-navbar via CSS and direct manipulation
- Creates shadow root for style isolation
- Syncs sidebar width with navbar collapsed state (observes ms-navbar first child class)
- Theme synchronization: Observes body.dark-theme, applies dark class to shadow root
- Responsive: Fixed position on mobile (<960px), inline on desktop
- Renders OverlayPanel component

## Overlay Panel (overlay.content/OverlayPanel.tsx)
- Tab navigation: Files, Search, Prompts, Favorites (optional), Tags, Feedback, Settings
- Tabs: Files (ExplorerTab), Search (SearchTab), Prompts (PromptsTab), Favorites, Tags, Feedback; Settings opens modal
- UI toggle: Shows/hides overlay (OverlayToggle when hidden), syncs with navbar visibility; tempHiddenToken for auto-restore when returning to root/new_chat
- Data fetching: Fetches folders, conversations, favorites, tags, conversationTags, promptFolders, prompts
- Listens for DATA_UPDATED messages, refreshes data; handles SCAN_COMPLETE payload with toast
- Restores state from chrome.storage.local (sidepanel_sort_order, sidepanel_active_tab, sidepanel_view_mode)
- Shortcut buttons (below separator, settings-controlled): Build (navigate /apps), Dashboard (navigate /api-keys), Documentation (external link), Original UI (hide overlay)
- Settings modal (isSettingsOpen), SQL executor interface toggle

## Prompts Tab (overlay.content/modules/prompts/PromptsTab.tsx)
- Local prompts management: promptFolders + prompts (separate from library conversations)
- Tree view via PromptsTree (react-arborist), folder/file nodes, selection, create/edit/preview
- Header: new folder, new prompt, collapse all, sort (alpha/date), batch selection, SidePanelMenu (import AI Studio system instructions)
- FilterBar (search, type filter), empty state "no prompts" with create button
- Create/Edit modal: CreatePromptForm (title, content, type normal/system, icon); preview modal with PromptPreviewContent, edit from preview
- Context menu: new folder at root
- Hooks: usePromptsTree, useDeleteHandler

### PromptsTree (overlay.content/modules/prompts/components/PromptsTree.tsx)
- react-arborist Tree, NodeData (folder/file), virtual list
- Sort order (alpha/date), type filter (all/normal/system), only favorites
- Move, rename, delete via usePromptsTree; Node with NodeContent, NodeContextMenu, RenameForm
- Batch: BatchSelectionCheckbox per row, batch toolbar when isBatchMode

### PromptsHeader (overlay.content/modules/prompts/components/PromptsHeader.tsx)
- Collapse all, sort toggle, batch mode button, SidePanelMenu
- Import AI Studio system: GET_PAGE_LOCAL_STORAGE key aistudio_all_system_instructions, parse JSON, create folder + prompts (system type)

### CreatePromptForm / VariableFillForm
- CreatePromptForm: title (max 100), content, type (normal/system), icon picker (PROMPT_ICON_NAMES), variable prompt help modal
- VariableFillForm: fill template variables (e.g. {{name}}) before use; used when opening prompt with variables

### Batch (overlay.content/modules/prompts/components/batch/)
- BatchToolbar: delete selected (modal confirm), move selected (MoveItemsDialog to pick target folder), exit batch mode
- MoveItemsDialog: folder tree to select destination
- BatchSelectionCheckbox: per-node selection state

### Prompts node & preview
- node/: NodeContent, NodeContextMenu (open, edit, delete, etc.), RenameForm, types
- PromptPreviewContent: display prompt body; VariableFillForm when variables present
- PromptsFilterActions: search + type filter UI
- lib/prompt-icons: PromptIconDisplay, getPromptIconComponent

## Search Tab (overlay.content/modules/search/SearchTab.tsx)
- Global search across conversation messages (store ui.search)
- Header: title, Collapse All, Import History (opens ImportHistoryDialog), SidePanelMenu
- SearchInput + SearchResults; results grouped by conversation, expand/collapse groups

### SearchInput (overlay.content/modules/search/components/SearchInput.tsx)
- Query input with debounce (300ms), triggers performGlobalSearch
- Options: case sensitive, whole word (toggle buttons)
- Expandable options: folder include/exclude (comma or list), role filter (all / user only / model only)

### SearchResults (overlay.content/modules/search/components/SearchResults.tsx)
- Grouped by conversation_id; ResultGroup (title, folder badge, match count), expand/collapse
- MatchItem: snippet with highlight (activeQuery, activeOptions), role + date; click = preview modal
- Preview modal: MarkdownRenderer with highlight, Copy as text / Copy as markdown, "Jump to conversation" (navigate + GET_MESSAGE_SCROLL_INDEX then scroll prompt-scrollbar-item)
- Empty state: no results + "Why no results?" link to indexing info modal (import/scan)
- Results summary line (count, files)

### ImportHistoryDialog (overlay.content/modules/search/components/ImportHistoryDialog.tsx)
- Import from ZIP (e.g. Google Takeout): guide with screenshots (open in Drive, download conversations)
- Load ZIP via ArrayBuffer, parse JSON files, normalize titles; match existing by normalized title (GET_CONVERSATIONS)
- Sends SAVE_CONVERSATION for each; progress logs, stats (total/success/failed)

## Explorer Tab (overlay.content/modules/explorer/ExplorerTab.tsx)
- Tree view and timeline view modes
- Search and tag filtering
- Type filter: all, conversation, text-to-image
- Sort order: alpha, date
- New folder creation (context-aware: inside selected folder or as sibling)
- New chat creation (respects newChatBehavior setting)
- Collapse all functionality
- Auto-selects conversation based on URL
- Listens for AI_STUDIO_PROMPT_CREATE, creates conversation in selected folder
- Context menu for root folder creation

## Arborist Tree Component (overlay.content/modules/explorer/components/ArboristTree.tsx)
- Uses react-arborist library
- Tree view: Hierarchical folder structure with conversations
- Timeline view: Groups conversations by time (Today, Yesterday, This Week, etc.)
- Virtual scrolling for performance
- Node selection, editing, dragging
- Expand/collapse nodes
- Search filtering
- Tag filtering
- Type filtering
- Sort order support

## Favorites Tab (overlay.content/modules/favorites/FavoritesTab.tsx)
- Displays favorited conversations and messages
- Search and tag filtering
- Type filter: all, conversation, text-to-image
- FavoritesList component renders filtered favorites

## Tags Tab (overlay.content/modules/tags/TagsTab.tsx)
- Create new tags (max 30 chars)
- List all tags
- TagItem component: Edit name, change color, delete, view tagged conversations

## Feedback Tab (overlay.content/modules/feedback/FeedbackTab.tsx)
- EmailJS integration for feedback submission
- Form fields: name (optional, max 50), email (optional, max 100), message (required, max 1000)
- System info collection: extension version, user agent, platform, current URL, screen size
- Rate limiting: 2 minute cooldown between submissions
- Toast notifications for success/error

## Settings Modal (overlay.content/modules/settings/SettingsModal.tsx)
- Sections: General, Explorer, Data & Storage, Privacy Policy, Disclaimer, Sponsor, About
- GeneralSettings: Theme (light/dark/system), layout density (compact/relaxed), new chat behavior (current-tab/new-tab), auto scan library, overlay position
- ExplorerSettings: View mode (tree/timeline), sort order (alpha/date), ignored folders
- DataSettings: Scan library, reset database, export data (SQL dump), import data (DB file)
- PrivacySettings: Privacy policy content
- DisclaimerSettings: Disclaimer content
- SponsorSettings: Sponsor information
- AboutSettings: About information

## Database Operations (shared/db/operations/)

- **admin.ts — dbAdmin**: export (returns Base64 dump), import (data, optional chunk for chunked receive), vacuum, resetDatabase (PRAGMA foreign_keys OFF; drop triggers messages_ai/ad/au; drop conversation_tags, tags, messages_fts, messages, favorites, conversations, folders, prompts, prompt_folders; run SCHEMA; VACUUM; foreign_keys ON)
- **folders.ts — folderRepo**: create(id, name, parentId), getById, getByParentId(parentId), getAll, update(id, { name, parent_id, order_index }), delete(id), deleteMultiple(ids)
- **conversations.ts — conversationRepo**: save (upsert by id; title, folder_id, external_id, external_url, model_name, type, updated_at, created_at, prompt_metadata), getById, getByFolderId, getAll, update(id, fields), delete, move(id, folderId), moveMultiple(ids, folderId), bulkSave(conversations), getAllIds, deleteMultiple(ids)
- **messages.ts — messageRepo**: create(message), bulkInsert(conversationId, messages; auto order_index), getByConversationId, delete(id), deleteByConversationId, replace(conversationId, messages; delete + insert), search(query, options: caseSensitive, wholeWord, includeFolderNames, excludeFolderNames, roleFilter) — FTS5 messages_fts for query length ≥3 else LIKE; CTEs for include/exclude folders; role filter; whole-word filter in memory; limit 500/1000; getScrollIndex(messageId, conversationId) for search jump-to-message
- **favorites.ts — favoriteRepo**: add(targetId, targetType, note), remove(targetId, targetType), getAll, isFavorite(targetId, targetType); target_type supports 'conversation'|'message'|'prompt'
- **tags.ts — tagRepo**: create(name, color) returns id, getAll, getById, update(id, { name, color }), delete(id)
- **conversationTags.ts — conversationTagRepo**: addTag(conversationId, tagId), removeTag(conversationId, tagId), getAll, getTagsByConversationId, getConversationsByTagId
- **raw.ts — rawSql**: execute(sql) — SELECT uses runQuery and returns rows; other statements use runCommand and return []
- **promptFolders.ts — promptFolderRepo**: create(id, name, parentId), getById, getByParentId(parentId), getAll, update(id, { name, parent_id, order_index }), delete(id), deleteMultiple(ids)
- **prompts.ts — promptRepo**: create(prompt; id, title required), save (upsert by id), getById, getByFolderId, getAll, update(id, { title, content, type, icon, folder_id, order_index }), delete(id), deleteMultiple(ids), move(id, folderId), moveMultiple(ids, folderId)

## Database Layer (shared/db/index.ts)
- No direct DB handle; all access via worker. initDB() ensures worker ready and sends INIT.
- runQuery(sql, bind) / runCommand(sql, bind) / runBatch(operations: { sql, bind }[]) send EXEC / RUN / RUN_BATCH to worker.
- exportDB() → worker EXPORT (returns chunked Base64). importDB(data, chunk) → worker IMPORT (supports chunked receive).
- Chrome: uses offscreen document (DB_REQUEST/DB_RESPONSE). Firefox/fallback: uses local DbWorker (shared/workers/db-worker.ts) with postMessage.

## Database Worker (shared/workers/db-worker.ts)
- SQLite WASM via @subframe7536/sqlite-wasm; storage: OPFS if supported else IndexedDB (DB_NAME, WASM_URL).
- On init: PRAGMA foreign_keys = ON; run SCHEMA; runMigrations (add order_index to messages, conversations, folders if missing).
- Message types: INIT (initDB), EXEC (SELECT; returns rows), RUN (single statement), RUN_BATCH (transaction: BEGIN; run each op; COMMIT/ROLLBACK), EXPORT (VACUUM + dump; chunked Base64 3MB), IMPORT (collect chunks; base64→bytes; OPFS overwrite or db.sync(stream); re-init).
- Request queue: serialized processing per worker. Chunked EXPORT/IMPORT to avoid OOM and large postMessage.

## State Management (shared/lib/store.ts)
- Zustand store for app state
- State: folders, conversations, favorites, tags, conversationTags, promptFolders, prompts, isLoading, ui state
- UI state: overlay (isOpen, activeTab, isScanning, showSqlInterface, tempHiddenToken, isSettingsOpen), explorer (search, tags, typeFilter, sortOrder, viewMode, batch), favorites (search, tags, typeFilter), prompts (search, typeFilter, onlyFavorites, sortOrder, batch { isBatchMode, selectedIds }), search (query, activeQuery, results, isSearching, options { caseSensitive, wholeWord, include, exclude, roleFilter, showOptions }, activeOptions)
- Actions: setFolders, setConversations, fetchData, moveItem, renameItem, createFolder, deleteItem, toggleFavorite, createTag, updateTag, deleteTag, addTagToConversation, removeTagFromConversation; setPromptFolders, setPrompts; setSearchQuery, setSearchOptions, performGlobalSearch
- Prompts actions: createPromptFolder, createPrompt, updatePrompt, deletePromptItems, movePromptItems; setPromptsSortOrder, setPromptsSearch, setPromptsTypeFilter, setPromptsOnlyFavorites, setPromptsBatchMode, setPromptsBatchSelection, togglePromptsBatchSelection
- UI actions: setOverlayOpen, setActiveTab, setIsScanning, setShowSqlInterface, setTempHiddenToken, setSettingsOpen; setExplorerSearch, setExplorerTags, setExplorerTypeFilter, setExplorerSortOrder, setExplorerViewMode; setFavoritesSearch, setFavoritesTags, setFavoritesTypeFilter; setPromptsSortOrder, setPromptsBatchMode, setPromptsBatchSelection, togglePromptsBatchSelection; setSearchQuery, setSearchOptions

## Settings Store (shared/lib/settings-store.ts)
- Zustand with persistence (chrome.storage.local)
- Settings: theme, layoutDensity, newChatBehavior, autoScanLibrary, overlayPosition, explorer (viewMode, sortOrder, ignoredFolders), shortcuts (favorites, build, dashboard, documentation, originalUI)
- Actions: setTheme, setLayoutDensity, setNewChatBehavior, setAutoScanLibrary, setOverlayPosition, setExplorerViewMode, setExplorerSortOrder, setExplorerIgnoredFolders; shortcuts toggles control overlay sidebar buttons (Favorites tab, Build, Dashboard, Documentation, Original UI)

## Utilities (shared/lib/utils.ts)
- cn(): Tailwind class name merger
- htmlToMarkdown(): Converts HTML to Markdown, handles ms-cmark-node, code blocks, lists, inline code, preserves whitespace in pre/code

## Navigation (shared/lib/navigation.ts)
- navigate(): Uses pushState and popstate event for SPA navigation

## Filter System (overlay.content/hooks/useFilter.ts, useStoreFilter.ts)
- FilterState interface: search (isOpen, query), tags (isOpen, selected), type (value)
- useStoreFilter hook: Connects to store UI state for explorer, favorites, or prompts

## Filter Bar Component (overlay.content/components/FilterBar.tsx)
- Search input: Opens/closes, auto-focus, escape to close, max 100 chars
- Tags selection: Horizontal scrollable buttons, "All" button, toggle selection

## SQL Executor (overlay.content/components/menu/SqlExecutor.tsx)
- SQL query input (textarea)
- Quick query buttons: Folders, Conversations
- Execute button
- Results table: Displays query results, tooltips for truncated values
- Error display

## Data Management Hook (overlay.content/modules/settings/hooks/useDataManagement.ts)
- exportData: Exports database as SQL, downloads as file
- importData: Reads DB file, imports to database
- resetData: Confirms and resets database
- scanLibrary: Triggers library scan

## Theme Management (overlay.content/modules/settings/hooks/useTheme.ts)
- Syncs theme with chrome.storage.local
- Applies dark class to document

## Current Conversation ID Hook (overlay.content/hooks/useCurrentConversationId.ts)
- Extracts conversation ID from URL (prompts/{id})

## App Init Hook (overlay.content/hooks/useAppInit.ts)
- Initializes app, fetches data

## UI Components
- Button: Radix UI based, variants (ghost, secondary, outline, destructive), sizes (icon, sm)
- Input: Text input with styling
- ScrollArea: Radix UI scroll area
- Separator: Radix UI separator
- Tooltip: Radix UI tooltip with helper for shadow DOM
- Context Menu: Radix UI context menu
- Dropdown Menu: Radix UI dropdown menu
- Tree View: Custom tree view component

## Global Components
- GlobalModal: Modal system for confirmations
- GlobalToast: Toast notification system
- ShadowRootContext: React context for shadow root container

## Manifest Configuration (wxt.config.ts)
- Permissions: sidePanel, storage, tabs, scripting, contentSettings, offscreen
- Host permissions: https://aistudio.google.com/*
- Web accessible resources: main-world.js, sqlite3.wasm, sqlite3.js
- CSP: script-src 'self' 'wasm-unsafe-eval' for WASM support
- Chromium args: --disable-blink-features=AutomationControlled, --no-default-browser-check, --no-first-run
- Persistent profile: .wxt/chrome-data

## Build Configuration
- WXT framework with React module
- TypeScript
- Tailwind CSS with animations
- Vite build system
- Optimized deps exclude: @sqlite.org/sqlite-wasm

## Key Features Summary
1. Library scanning: DOM + API hybrid scanning, auto-detects new/updated/deleted items
2. Real-time sync: Intercepts API calls, updates database on create/update/delete
3. Folder organization: Hierarchical folders, drag-drop support
4. Tagging system: Create tags, assign to conversations, filter by tags
5. Favorites: Star conversations/messages, filter favorites
6. Search tab: Global full-text search across conversation messages; case/whole-word/folder/role filters; jump to message with scroll; import history from ZIP
7. Prompts tab: Local prompts (folders + prompts), tree view, create/edit/preview, variable prompts, batch move/delete, import AI Studio system instructions
8. Multiple views: Tree view, timeline view (Explorer); tree view (Prompts)
9. Type filtering: Filter by conversation or text-to-image (Explorer); by normal/system (Prompts)
10. Overlay shortcuts: Build, Dashboard, Documentation, Original UI (settings-controlled)
11. SQL access: Direct database query interface
12. Data export/import: SQL dump backup/restore; import history from Takeout ZIP; export conversation as Markdown/Text/JSON
13. Theme sync: Matches AI Studio theme (light/dark)
14. Responsive: Mobile-friendly overlay
15. Offscreen database: SQLite WASM in isolated context

