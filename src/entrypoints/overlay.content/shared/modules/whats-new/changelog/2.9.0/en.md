# 🤖 v2.9.0 — The AI Agent is Here

After a period of development and architectural updates, we are excited to introduce a brand new feature: **the AI Agent**. 🎉

We hope to provide you with a more practical **intelligent assistant**, rather than just a few shortcut buttons. You can tell it what you need in plain language, and it will attempt to search your data, analyze it, execute steps, and report back to you. All of this runs entirely locally in your browser using your current Gemini session. There are no API keys required, no extra tokens consumed, and your data never leaves your device, ensuring privacy and security.

## 🚀 Core Update: AI Agent

Simply type `>` in the Gemini input box to bring it up.

A list will appear where you can select a **preset skill**, or you can choose not to and just naturally describe your request, letting the AI determine how to execute it.

**We have prepared the following basic skills for you to try:**

*   **🗂️ Auto-Organize:** "Sort my last 200 conversations into folders and tag them." It will automatically analyze titles, attempt categorization, create folders, and move the items, helping you organize backlogged chat records.
*   **🔄 Complete Search Index:** You might have noticed that full-text search sometimes misses earlier conversations. This is because old chats from before the extension was installed only have titles in the database by default. This skill helps find these "empty" chats and syncs their contents automatically. If they remain empty after syncing, it means they are no longer available in the cloud, and the Agent will help you clean up this invalid data.
*   **📊 Data Query:** "Which folder had the most conversations last month?" Just ask, and it will query the local data to give you an answer.
*   **📝 Batch Manage Prompts and Snippets:** It assists with rewriting, recategorizing, deduplicating, or reorganizing to help tidy up your library.
*   **🛠️ Custom Skills:** In **Settings → Agent**, you can use your own instructions to define new skills. If you have repetitive workflows, you can try teaching them to the Agent, so you can run them with a single click later.

### 🔓 Exploring More Possibilities

In addition to preset skills, the Agent can directly query the extension's database, including conversations, messages, folders, tags, Prompts, and Snippets. It can automatically write queries based on your needs, analyze the results, and decide the next step. As long as it involves your local data and can be clearly described, you can try asking it to help.

You might want to try these approaches:

*   Type `>` and **just ask it**: "What can you do with my data?" or "Are there areas in my workspace that need organizing?" See what it suggests.
*   **Interact with it like an assistant through multi-turn conversations.** It maintains context. For example: "Interesting, break that down by month please." "Do the same for starred chats." "Actually, just merge those two folders."
*   Try requests we haven't created presets for: "What topics do I talk about the most?" "Find conversations about the auth bug from March and group them." "Which of my Prompts have I never used?"
*   If you discover interesting use cases, you are very welcome to share them with us.

**Regarding Security and Control:**

*   **🛑 You decide.** By default, any action that modifies data will ask for your confirmation first, while read operations can execute directly. You can adjust these policies in the settings at any time.
*   **⚡ Ludicrous Mode.** If you are familiar with and trust its operations, you can enable Ludicrous Mode so it stops asking for confirmation. (All actions can still be undone.)
*   **🎛️ Agent Dock.** The status bar is pinned above the input box, so you can see the current progress even when the sidebar is closed. Status, stop buttons, and approvals are clearly visible.
*   **🔌 Smart Circuit Breaker.** If the Agent gets stuck in a loop or progresses slowly, the engine will automatically interrupt and notify you of the reason. If it runs for too long, it will pause and ask for your input instead of running endlessly in the background.

**💚 To all early Powerpack adopters — this feature is now unlocked for you for free.** Thank you for your continued trust and support.

## ✨ More Improvements

*   **⚡ Gemini Spark Integration:** If Google has enabled Spark on your account, the sidebar will automatically display a Spark tab.
*   **🎨 Visual Refresh:** The overall interface has been retuned—spacing is more compact, and contrast is more comfortable. We also added transition animations when switching themes, hoping to provide a better visual experience.
*   **🎛️ Quick Settings Access:** Clicking the extension icon in the browser toolbar now opens a control panel to quickly switch platforms or toggle features.
*   **⌨️ AI Studio `/` Support:** The `/` shortcut to bring up the Prompt library was previously limited to Gemini; now it can be used in AI Studio as well.
*   **💾 Auto Local Backups:** Extension data now supports scheduled automatic backups, and you can create manual snapshots at any time to improve data safety.
*   **📜 Smart Scrollbar Enhancements:** Clicking the Smart Scrollbar expands it into a message list for easier browsing of long conversations.
*   **📁 New Folder Button:** Added a button to create new folders directly within the "Move to folder" modal.

## 🐛 Bug Fixes

*   **☁️ Google Drive Sync Logic:** Improved the previous auto-merge logic. Drive will no longer automatically overwrite or merge into your local data. To restore data, you must manually initiate a download. Uploads remain automatic (if sync is enabled). This ensures your local data is always your most reliable source of truth.
*   **🔍 Gemini Conversation Scan:** Fixed an issue where scanning the conversation list would occasionally fail.
*   **😴 Sleep Disconnect Issue:** Fixed an issue where the sidebar became unresponsive after the tab was left idle for a long time. It can now reconnect normally.
*   **📐 Page Jumping:** Resolved occasional layout jitter in the Gemini interface.
*   **⌨️ Spacebar Rename Exit:** Typing a space while renaming will no longer accidentally exit edit mode.
*   **🕒 Time Display Errors:** Conversation creation times and last active times now display correctly.
*   **💎 Real-time Gem/Notebook Detection:** New Gems or Notebooks are now instantly detected by the extension after creation.
*   **⚪ Gray Dead Pixel:** Fixed an unclickable dot that occasionally appeared on the Smart Scrollbar.

***

This version is a significant update for us recently, and the Agent engine will continue to be refined in future versions.

If you are interested, you are welcome to type `>` to bring up the panel and experience this new feature yourself. If you encounter any issues or have suggestions for improvement, please feel free to let us know via Discord or email.
