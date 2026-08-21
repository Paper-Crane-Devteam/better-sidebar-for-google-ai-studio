# Better Sidebar for Gemini & AI Studio

![Better Sidebar Banner](./assets/images/marquee.jpg)

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Available-blue?style=for-the-badge&logo=google-chrome)](https://chromewebstore.google.com/detail/better-sidebar-for-google/cjeoaidogoaekodkbhijgljhenknkenj)
[![Firefox Add-ons](https://img.shields.io/badge/Firefox_Add--ons-Available-orange?style=for-the-badge&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/better-sidebar-for-ai-studio)
[![Edge Add-ons](https://img.shields.io/badge/Edge_Add--ons-Coming_Soon-gray?style=for-the-badge&logo=microsoft-edge)](https://microsoftedge.microsoft.com/addons/)
[![Privacy Policy](https://img.shields.io/badge/Privacy-Policy-green?style=for-the-badge)](./PRIVACY.md)
[![Discord](https://img.shields.io/badge/Discord-Join_Us-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/FRzesxaGAx)
[![License](https://img.shields.io/badge/License-Open_Source-orange?style=for-the-badge)](./LICENSE)

Hi there! Welcome to the home of **Better Sidebar for Gemini & AI Studio**.

If you use **Gemini** or **Google AI Studio** heavily, you know the struggle: your chat list gets messy, old prompts get lost, and finding that _one_ specific conversation from last week is a nightmare.

We built this extension to fix that. It gives you a clean, organized sidebar with folders, tags, and a powerful search engine that actually works across **both platforms**—all while keeping your data 100% local and private.

## 🤖 What's New in v2.9.x — The Agent Has Landed

### 🚀 AI Agent

Type `>` in the input box, describe what you want in plain English, and the AI actually goes and does it — reading your data, making decisions, executing multi-step work, and reporting back. It runs **inside your browser using your own Gemini session**: no API keys, no extra tokens, no data leaving your machine.

The Agent has genuine query access to your local database (conversations, messages, folders, tags, prompts, snippets). It writes its own queries, looks at the results, and decides the next step — so it's a real multi-turn conversation, not a menu of canned actions.

**Skills that ship in the box:**
- **🗂️ Auto-Organize** — "Sort my last 200 chats into folders and tag them." It reads the titles, builds the taxonomy, creates folders, moves everything.
- **🔄 Backfill Search Index** — messages are only recorded while a chat is open, so anything from before you installed the extension has no content. This syncs the real messages in, so full-text search and export finally see everything.
- **📊 Query Your Own Data** — "Which folder has the most chats from last month?" Ask your history like a database, because it is one.
- **📝 Manage Prompts & Snippets** — rewrite, reorganize, and deduplicate in bulk.
- **🛠️ Custom Skills** — define your own in **Settings → Agent**; each becomes a permanent one-click card.

**Safety rails:** every write asks for approval first (reads run free), **Speed Mode** turns off the prompts when you trust it (with undo), the **Agent Dock** above your input box shows status / stop / approvals even when the sidebar is closed, and circuit breakers kill runs that loop or stall and tell you why.

### ✨ Also New

- **⚡ Gemini Spark Integration** — appears as a native sidebar tab if Google has rolled it out to your account
- **💾 Automatic Local Backups** — scheduled snapshots plus manual ones, with rollback
- **📜 Expandable Smart Scrollbar** — click to expand into a full message list for long conversations
- **🖍️ Text Selection Toolbar** — select text in a chat to explain, summarize, save as snippet, or copy
- **📁 Default Folder for Gems & Notebooks** — new chats land in the assigned folder automatically, and folder settings let you bind/unbind from either side
- **⌨️ Slash Commands in AI Studio** — the `/` Prompt Library shortcut is no longer Gemini-only
- **🎛️ Toolbar Icon Control Panel** — toggle platforms and features without digging through menus
- **🎨 Calmer UI** — tighter spacing rhythm, better contrast, refined themes, animated theme switching
- **📂 New Folder from the Move dialog** — no more dead-end when the folder doesn't exist yet

### 🐛 Notable Fixes

- **☁️ Google Drive sync no longer overwrites local data.** The old auto-merge logic is gone. Uploads still run automatically if sync is on, but restoring is now a deliberate, manual download. Your local data is the source of truth.
- **⚪ Grey dots cleanup** — a guarded one-click cleanup button appears in the Smart Scrollbar when a conversation has leftover records
- **📝 Snippets keep their Markdown** — headings, lists, and code blocks survive the save
- **😴 Zombie sidebar** after leaving a tab open for hours — it reconnects properly now
- **🕒 Accurate timestamps**, **💎 Gems & Notebooks detected on creation**, **📐 no more Gemini page shifting**, **⌨️ spaces no longer cancel renames**

---

## ✨ Features

Here is what Better Sidebar can do for you:

| Feature | Description |
| :--- | :--- |
| 🤖 **AI Agent** | Type `>` and describe a task in plain English. The Agent queries your local data, plans, and executes multi-step work — using your own Gemini session, no API key needed. |
| 🛠️ **Custom Agent Skills** | Define your own repeatable workflows in Settings → Agent. Each becomes a one-click card. |
| 🛑 **Agent Approvals & Dock** | Writes require approval, reads run free. The Agent Dock sits above your input with status, stop, and approvals. |
| ⚡ **Gemini Spark** | Native sidebar tab for Spark if it's enabled on your account. |
| 💾 **Automatic Local Backups** | Scheduled and manual snapshots of your extension data, with rollback. |
| 🖍️ **Text Selection Toolbar** | Select text in a chat to explain, summarize, save as a snippet, or copy. Fully configurable. |
| 🌟 **Multi-Platform Support** | Manage conversations across both Gemini and Google AI Studio seamlessly in one unified sidebar. |
| 👥 **Multi-Account Profiles** | Create separate profiles for work or personal use. Each maintains its own independent database. |
| 🔍 **Chained Search** | Filter conversations by combining multiple conditions — title, tag, and type — for laser-precise results. |
| 💎 **Gem Management** | Full Gem integration — browse, filter, create, and start conversations with your Gems right from the sidebar. |
| 📜 **Smart Scrollbar** | A visual scrollbar for Gemini conversations. Jump directly to any message, or click to expand it into a full message list. |
| 🤖 **Default Model** | Set a default model for Gemini and every new conversation will automatically use it. |
| ✏️ **True Rename** | Rename conversations directly — changes are synced to Google's servers in real time. |
| 🗑️ **True Delete & Batch Delete** | Delete or batch-delete conversations with real server-side removal. No more ghost chats. |
| 🔐 **Persistent Login** | Stay logged in across sessions with smart merge for synced data. |
| 📂 **Folders & Colors** | Drag and drop your chats into nested folders. Assign custom colors to folders and tags. |
| 📝 **Prompt Library** | Build your personal library of reusable prompts. Supports option variables, prompt composition, and system prompt imports. |
| 🔍 **Precision Search** | Full-text search across every message in your history. Limit search to the active chat for immediate context. |
| 📓 **Notebook Integration** | Full notebook support for Gemini — browse, organize, and manage your notebooks right from the sidebar. |
| ☁️ **Google Drive Backup** | Automatically upload your settings, prompts, and config data to your own Google Drive. Restoring is always a deliberate manual download — nothing overwrites your local data behind your back. |
| 🎨 **UI Customization** | Advanced layout controls for Gemini, including width adjustments and Focus Mode. |
| ⚙️ **Platform Manager** | Use the extension popup to quickly jump between platforms or enable/disable them on the fly. |
| 🏷️ **Smart Tagging** | Assign custom tags to your conversations, now visible directly in the chat header. |
| ⭐ **Favorites & Pinning** | Keep your most frequently used chats or specific prompts at the top for quick access. |
| 🔄 **Automatic Sync** | Your latest conversations are automatically synced behind the scenes when you visit the page. |
| 📊 **Timeline View** | Visualize your workflow with a "Today", "Yesterday", and "Last Week" timeline. |
| 🖼️ **Watermark-Free Downloads** | Automatically remove watermarks when downloading generated images in Gemini, including Pro HD images. |
| 📥 **Conversation Export** | Export your conversations as Markdown, Plain Text, or JSON for documentation or backup. |
| ✂️ **Snippets** | Extract highlights from any AI reply into a dedicated Snippet library with folder management. |
| 🔗 **Powerpack — Notion & Obsidian Export** | Seamlessly export conversations and snippets to Notion and Obsidian with full formatting preserved. Batch export supported. |
| 👀 **Conversation Outline** | See the structure of long conversations at a glance with the new Outline view. |
| 📝 **Chat Remarks & Rich Tooltips** | Add descriptions to chats; hover for creation date, tags, and notes. |
| 📌 **Folder Pinning** | Pin favorite folders to the top and drag-to-reorder for effortless organization. |
| 🎯 **Locate Active Chat** | One click to auto-expand and snap to your current active conversation in the tree. |
| ⚡ **Magic Slash Commands** | Type `/` in Gemini or AI Studio's input to instantly summon your Prompt Library. |
| 🏠 **Default Homes** | Assign default folders to Gems & Notebooks — new chats auto-sort themselves. Manageable from either the Gem/Notebook or the folder side. |
| 🌗 **Theme Sync** | Automatically matches the platform's light/dark mode. |
| 🔒 **Privacy First** | Everything is stored locally in your browser (SQLite). We don't see your data, ever. |
| 💾 **Data Control** | Export your data (SQL dump) anytime. You own your data. |

## 🔒 Privacy & Security

We take this seriously.

- **100% Local:** We use an embedded SQLite database running entirely within your browser.
- **No Cloud Sync to Our Servers:** Your folders, tags, and notes are NOT sent to our servers. Google Drive sync is between you and your own Google account.
- **No Training:** We do not read your conversations to train any AI models.

When you install, your browser will request permission to "Read and change data on aistudio.google.com and gemini.google.com". This is solely to inject the enhanced sidebar interface and read chat titles for organization. We do not access your other browsing history.

## 📥 Installation

**[Get it from the Chrome Web Store](https://chromewebstore.google.com/detail/better-sidebar-for-google/cjeoaidogoaekodkbhijgljhenknkenj)**

Also available on:

- [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/better-sidebar-for-ai-studio)
- **Microsoft Edge**: Not yet supported (coming soon).

## 🤝 Contributing

This project is now open source! If you're a developer and want to help make it better, feel free to open an issue or submit a PR.

## 🆘 Support & Troubleshooting

### Common Issues (FAQ)

<details>
<summary><strong>1. The extension overlay isn't appearing.</strong></summary>

- **Refresh the page:** Sometimes the extension needs a page reload to inject properly, especially right after installation.
- **Check permissions:** Ensure the extension has permission to run on `aistudio.google.com` and `gemini.google.com`.
- **Conflict:** Disable other Gemini or AI Studio extensions temporarily to check for conflicts.
</details>

<details>
<summary><strong>2. My chats aren't showing up or I can't find specific messages.</strong></summary>

- **New chats missing?** The extension automatically syncs when you visit the page. If conversations are still missing, go to `Settings` -> `Data & Storage` and click **"Scan Library"** to force a manual sync.
- **Missing message content?** If search can't find text from older chats, you might need to import them. Go to the **Search** tab and click **"Import History"**. You can upload a Google Takeout zip to fully index your past conversations.
</details>

<details>
<summary><strong>3. I lost my folder structure!</strong></summary>

- **Don't Panic:** Your data is stored locally.
- **Check Database:** In the `Settings`, try exporting your data to see if it's still there.
- **Restore:** If you have a previous backup (DB file), use the Import function to restore your state.
</details>

### Community

Join our [Discord server](https://discord.gg/FRzesxaGAx) to chat with other users, get help, or share feedback.

### Reporting Bugs

Found a bug? Have a cool idea?

- Check the [Issues](../../issues) tab to see if it's already reported.
- If not, feel free to open a new issue!

---

_Note: This is an independent project and is not affiliated with, endorsed by, or sponsored by Google._
