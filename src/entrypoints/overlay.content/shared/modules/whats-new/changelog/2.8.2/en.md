# 🔧 v2.8.2 — Bug Fixes & Improvements

Another patch release focused on stability and visual polish.

## 🐛 Fixes

*   **Inbox icon not updating for existing users:** Fixed an issue where the inbox icon failed to display the exclusive icon for eligible users.
*   **Notion auth button reappearing:** The Notion authorization button no longer shows up repeatedly after you've already authorized.
*   **Filter section background color:** Fixed abnormal background color in the filter section.
*   **Prompt tab favorite display:** Fixed missing favorite styling in the Prompt tab.

## 🎨 Improvements

*   **Centralized z-index management:** Unified z-index layering across the app — popups, toasts, scrollbars, and overlays now stack correctly without unexpected overlapping.
*   **Search text highlighting:** Search results in Library, Prompt, and other tabs now highlight matched text for easier scanning.
*   **Full-text search readability:** Improved text formatting and readability of full-text search results.
*   **Version update prompt logic:** Optimized the logic for showing version update notifications.

## 🗑️ Removed

*   **Quick Resend (Gemini):** Removed the quick resend feature. You can still regenerate responses using the refresh button on AI responses — the quick resend added little extra value.
