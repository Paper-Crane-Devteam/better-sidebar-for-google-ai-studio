# Security Policy

## Reporting a Vulnerability

We take the security of **Better Sidebar for Google AI Studio** seriously. If you have discovered a security vulnerability, we appreciate your help in disclosing it to us in a responsible manner.

### How to Report

Please do **not** report security vulnerabilities through public GitHub issues.

Instead, please report them via email to: `zhangyu91101313@gmail.com` or use the Feedback form inside the extension with the subject line "SECURITY VULNERABILITY".

### What to Include

*   A detailed description of the vulnerability.
*   Steps to reproduce the issue.
*   The version of the extension you are using.
*   Any relevant screenshots or code snippets.

### Our Response

We will acknowledge receipt of your report within 48 hours and will strive to fix the vulnerability as soon as possible. We ask that you give us a reasonable amount of time to correct the issue before making it public.

## Security Features

*   **Sandboxing:** The extension runs within the Chrome Extension sandbox environment.
*   **Database Isolation:** The SQLite database runs in an `offscreen` document to ensure separation from the main browsing context.
*   **No Remote Code:** We do not execute remote code. All logic is bundled within the extension.

