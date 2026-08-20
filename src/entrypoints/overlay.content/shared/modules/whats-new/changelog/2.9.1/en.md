# ✨ v2.9.1 — Default Folders & Selection Toolbar

A quick follow-up to 2.9.0, built almost entirely from your feedback. Thank you for the reports. 🙏

## ✨ New

*   **📁 Default Folder for Gems & Notebooks:** Assign a default folder to any Gem or Notebook. Start a new chat from it and the conversation lands in that folder automatically — no dragging afterwards.
*   **⚡ Manage default folders from the folder side:** Folder settings now lists every Gem and Notebook that defaults into that folder, so you can bind or unbind them right there. And when a folder is someone's default, its hover row gets an extra button to start that Gem's or Notebook's chat directly.
*   **🗑️ Optional: delete conversations without confirmation:** Off by default. Turn it on in Settings → General and deleting a single conversation skips the dialog entirely — immediate, permanent, no undo, removed both here and on the platform. Batch delete still asks.
*   **🖍️ Text Selection Toolbar:** Select any text in a conversation and a small toolbar appears right above it. Ask the AI to explain or summarize the selection, save it as a snippet, or copy it. Configurable in settings — pick which actions show up, or turn the whole thing off.

## 🐛 Fixes

*   **⚪ Grey dots in older conversations, finally cleanable.** v2.9.0 stopped new chats from leaving dead dots behind, but existing threads kept theirs, and I held off on a cleanup script because I didn't want to risk anyone's history. Here's the safe version: when a conversation has leftover records, a cleanup button appears at the top of the Smart Scrollbar. One click to arm it, one to confirm, done. It only ever removes records the conversation itself no longer refers to, it never touches history it hasn't verified, and it backs out entirely if anything looks off.
*   **⋯ Gemini's native 3-dot menu was misplaced.** You were right, this one was on me — some of the extension's CSS was leaking into Google's own action menu and pushing it out of position. Patched.
*   **📂 Folder action buttons blending into long names.** Long folder names used to show through the hover buttons and turn into visual mush. The name now truncates cleanly behind them.
*   **📝 Snippets losing Markdown formatting.** Saved snippets kept the text but dropped the formatting. Tracked down and fixed — headings, lists, code blocks and the rest now survive the save.

***

Small release, quick turnaround. Keep the reports coming — this one exists because of them.
