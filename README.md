# Better Sidebar for Gemini & AI Studio

![Better Sidebar Banner](./assets/images/marquee.jpg)

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Available-blue?style=for-the-badge&logo=google-chrome)](https://chromewebstore.google.com/detail/better-sidebar-for-google/cjeoaidogoaekodkbhijgljhenknkenj)
[![Firefox Add-ons](https://img.shields.io/badge/Firefox_Add--ons-Available-orange?style=for-the-badge&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/better-sidebar-for-ai-studio)
[![Edge Add-ons](https://img.shields.io/badge/Edge_Add--ons-Coming_Soon-gray?style=for-the-badge&logo=microsoft-edge)](https://microsoftedge.microsoft.com/addons/)
[![Privacy Policy](https://img.shields.io/badge/Privacy-Policy-green?style=for-the-badge)](./PRIVACY.md)
[![License](https://img.shields.io/badge/License-Open_Source-orange?style=for-the-badge)](./LICENSE)

Hi there! Welcome to the home of **Better Sidebar for Gemini & AI Studio**.

If you use **Gemini** or **Google AI Studio** heavily, you know the struggle: your chat list gets messy, old prompts get lost, and finding that *one* specific conversation from last week is a nightmare.

We built this extension to fix that. It gives you a clean, organized sidebar with folders, tags, and a powerful search engine that actually works across **both platforms**—all while keeping your data 100% local and private.

## 🚀 What's New in v2.0.0?

This is a groundbreaking release! We've expanded platform support to Gemini and introduced unified data management across both platforms.

### 🌟 Gemini Platform Support (Major Feature)
Better Sidebar now works with **both Gemini and AI Studio**!
*   **Dual Platform Support**: Seamlessly switch between Gemini and AI Studio with the same powerful sidebar features you love.
*   **Feature Parity**: All core features—folders, tags, search, and prompt library—work identically on both platforms.

### 🔄 Automatic Conversation Sync
Your conversations stay up-to-date without manual intervention.
*   **Real-Time Updates**: The extension automatically syncs your latest conversations when you visit Gemini or AI Studio.
*   **Seamless Integration**: No more manual "Scan Library" clicks—your sidebar always reflects your current conversation list.
### 🔗 Unified Data Management
One library for two platforms—your prompts and search work everywhere.
*   **Shared Prompt Library**: Create a prompt once, use it on both Gemini and AI Studio. Your entire prompt collection is available across platforms.
*   **Cross-Platform Search**: Search through conversations from both Gemini and AI Studio simultaneously using the unified search engine.
*   **Single Source of Truth**: All your data lives in one place, making backup and export simpler.

### 🎨 Improved UI Layouts
Enhanced visual options for better comfort and productivity.
*   **Compact View**: A denser layout for users who prefer seeing more information at once.
*   **Relaxed View**: A more spacious design with better readability for extended use.

### ✨ Performance & Polish
*   **Optimized Batch Operations**: Improved speed and reliability when performing bulk actions like moving multiple conversations or applying tags.
*   **UI/UX Refinements**: Fixed numerous interface bugs and smoothed out interactions for a more polished experience across both platforms.

## ✨ Features

Here is what Better Sidebar can do for you:

| Feature | Description |
| :--- | :--- |
| 📂 **Folders** | Drag and drop your chats into nested folders. Keep your "Coding" separate from your "Creative Writing". |
| 📝 **Prompt Library** | **(New!)** Save, manage, and reuse your best prompts and templates locally with variable support. |
| 📥 **Conversation Export** | **(New!)** Export conversations as Markdown, Plain Text, or JSON. |
| 🔍 **Deep Search** | **(New!)** Full-text search across all your conversations. Filter by role, folder, or exact match. |
| 🏷️ **Tags** | Add custom tags to conversations for flexible filtering. |
| 📊 **Timeline View** | See your work organized by "Today", "Yesterday", and "Last Week". |
| ⭐ **Favorites** | Pin your most used chats or specific prompts to the top. |
| 🔒 **Privacy First** | Everything is stored locally in your browser (SQLite). We don't see your data, ever. |
| 🌗 **Theme Sync** | It looks like it belongs there. Automatically matches AI Studio's light/dark mode. |
| 💾 **Data Control** | Export your data (SQL dump) anytime. You own your data. |

## 🔒 Privacy & Security

We take this seriously.

*   **Local Only:** We use an embedded database (SQLite WASM) inside your browser.
*   **No Cloud:** Your folders, tags, and notes never leave your device.
*   **No Training:** We don't use your data to train models.

When you install, your browser will request permission to "Read and change data on aistudio.google.com and gemini.google.com". This is just so we can draw the sidebar on the page and read your chat titles to organize them. That's it.

## 🚧 Roadmap

We're just getting started. Here is what's on our mind:

- [x] **Full Content Search** (Done in v1.1.0!)
- [x] **Prompt Library** (Done in v1.1.0!)
- [x] **Gemini Platform Support** (Done in v2.0.0!)
- [ ] **Additional Platform Support**: Maybe bring this to ChatGPT or Claude?
- [ ] **Cloud Sync**: Optional secure sync for those who work across multiple devices.
- [ ] **AI Auto-Tagging**: Using a local LLM to help organize your chats automatically.

## 📥 Installation

**[Get it from the Chrome Web Store](https://chromewebstore.google.com/detail/better-sidebar-for-google/cjeoaidogoaekodkbhijgljhenknkenj)**

Also available on:
*   [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/better-sidebar-for-ai-studio)
*   **Microsoft Edge**: Not yet supported (coming soon).

## 🤝 Contributing

This project is now open source! If you're a developer and want to help make it better, feel free to open an issue or submit a PR.

## 🆘 Support & Troubleshooting

### Common Issues (FAQ)

<details>
<summary><strong>1. The extension overlay isn't appearing.</strong></summary>

*   **Refresh the page:** Sometimes the extension needs a page reload to inject properly, especially right after installation.
*   **Check permissions:** Ensure the extension has permission to run on `aistudio.google.com` and `gemini.google.com`.
*   **Conflict:** Disable other Gemini or AI Studio extensions temporarily to check for conflicts.
</details>

<details>
<summary><strong>2. My chats aren't showing up or I can't find specific messages.</strong></summary>

*   **New chats missing?** The extension automatically syncs when you visit the page. If conversations are still missing, go to `Settings` -> `Data & Storage` and click **"Scan Library"** to force a manual sync.
*   **Missing message content?** If search can't find text from older chats, you might need to import them. Go to the **Search** tab and click **"Import History"**. You can upload a Google Takeout zip to fully index your past conversations.
</details>

<details>
<summary><strong>3. I lost my folder structure!</strong></summary>

*   **Don't Panic:** Your data is stored locally.
*   **Check Database:** In the `Settings`, try exporting your data to see if it's still there.
*   **Restore:** If you have a previous backup (DB file), use the Import function to restore your state.
</details>

### Reporting Bugs

Found a bug? Have a cool idea?
*   Check the [Issues](../../issues) tab to see if it's already reported.
*   If not, feel free to open a new issue!

---

*Note: This is an independent project and is not affiliated with Google.*
