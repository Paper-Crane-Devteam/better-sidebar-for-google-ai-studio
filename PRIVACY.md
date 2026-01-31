# Privacy Policy

**Last Updated:** [06/01/2026]

This Privacy Policy describes how **Better Sidebar for Google AI Studio** ("we", "our", or "the Extension") handles your information. We are committed to protecting your privacy and ensuring you have full control over your data.

## 1. Data Collection and Storage

### Local-First Architecture
The Extension is designed with a "Local-First" architecture. This means:

*   **Local Storage:** All organizational data you create (Folders, Tags, Favorites, Notes) is stored locally on your device using an embedded SQLite database within your browser.
*   **No Cloud Sync:** We do not operate a cloud server to store your prompts or organizational structure. Your data stays on your machine.
*   **Google AI Studio Data:** The Extension interacts with the Google AI Studio page to identify your conversations for the purpose of organizing them. We do not transmit this content to any third-party servers.

### What We DO NOT Collect
*   We do **not** collect, store, or transmit your chat history, prompts, or generated responses to our servers.
*   We do **not** collect personal identification information (PII) such as your name, email address, or phone number.
*   We do **not** track your browsing history outside of the Google AI Studio domain.

## 2. Permissions

The Extension requires specific permissions to function:

*   `storage`: To save your settings and preferences locally.
*   `activeTab` / `host_permissions` (`https://aistudio.google.com/*`): To modify the AI Studio interface (injecting the overlay) and read conversation titles/IDs to enable folder organization.
*   `offscreen`: To run the SQLite database securely in a separate context.

## 3. Data Backup and Export

Since your data is stored locally, you are responsible for backing it up. The Extension provides an **Export** feature that generates a SQL file of your organizational data. We strongly recommend regular backups, especially before clearing your browser data.

## 4. Third-Party Services

*   **Google AI Studio:** The Extension operates on top of Google AI Studio. Your use of Google AI Studio is subject to Google's own Privacy Policy and Terms of Service.
*   **Feedback Form:** If you choose to use the Feedback form within the extension, the message (including your email if provided) is sent via a third-party email service (EmailJS) directly to our support team. This is the *only* instance where data leaves your browser, and it is initiated solely by you.

## 5. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.

## 6. Contact Us

If you have any questions about this Privacy Policy, please contact us via the GitHub Issues page in this repository.

