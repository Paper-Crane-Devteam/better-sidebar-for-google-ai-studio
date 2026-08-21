# ✨ v2.9.1 — Default Folders and Selection Toolbar

This is a fast iteration release based directly on your feedback. Thank you to everyone who provided suggestions. 🙏

## ✨ New Features

*   **📁 Default Folders for Gems & Notebooks:** You can now assign a default folder to any Gem or Notebook. When you start a new conversation using that preset, it will automatically be placed into the assigned folder, saving you from manually moving it later.
*   **⚡ Manage Default Associations from Folders:** The folder settings panel now lists all Gems and Notebooks that use it as their default folder, allowing you to bind or unbind them directly. Additionally, when a folder is set as a default, a shortcut button is added to its hover action bar, letting you create a related conversation with a single click.
*   **🗑️ Optional: Skip Delete Confirmation:** This feature is disabled by default. Once enabled in "Settings → General", deleting a single conversation will skip the confirmation dialog. Please note: This action is immediate, permanent, and cannot be undone; it will delete the data from both the extension and the cloud platform. Bulk deletions will still prompt for confirmation.
*   **🖍️ Text Selection Toolbar:** When you highlight text in a conversation, a compact toolbar will appear above it. You can have the AI explain or summarize the selection, save it as a Snippet, or simply copy it. You can customize which actions are displayed or disable the toolbar entirely in the settings.

## 🐛 Bug Fixes

*   **⚪ Cleaning Invalid Gray Dots in Historical Chats:** In v2.9.0, we optimized the rendering for new conversations to prevent leftover invalid record dots. To ensure the absolute safety of your historical data, we now provide a safe cleanup method: When residual records exist in a conversation, a cleanup button will appear at the top of the Smart Scrollbar. After you click and confirm, the system will only delete unreferenced, invalid records without affecting any normal history. If data anomalies are detected, the cleanup operation will automatically abort.
*   **⋯ Fixed Gemini Native Menu Misalignment:** Fixed an issue where extension CSS conflicts caused Google's native "More actions" menu to be misaligned.
*   **📂 Fixed Display Issues with Long Folder Names:** Fixed an issue where long folder names would overlap with the hover action buttons. Overly long names are now properly truncated and hidden.
*   **📝 Fixed Loss of Markdown Formatting in Snippets:** Fixed an issue where text formatting was lost when saving a Snippet. All Markdown formatting, including headers, lists, and code blocks, is now fully preserved.

***

Thank you for your ongoing support and feedback. We will continue listening to your suggestions to optimize the extension experience.
