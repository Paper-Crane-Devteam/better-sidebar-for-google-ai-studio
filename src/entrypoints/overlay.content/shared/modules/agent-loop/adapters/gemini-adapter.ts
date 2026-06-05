/**
 * Gemini Platform Adapter.
 * Implements AgentPlatformAdapter for Google Gemini's Quill-based rich-textarea.
 */

import type { AgentPlatformAdapter } from './types';

export class GeminiAgentAdapter implements AgentPlatformAdapter {
  getEditor(): HTMLElement | null {
    return document.querySelector('rich-textarea .ql-editor[contenteditable="true"]');
  }

  insertText(text: string): void {
    const editor = this.getEditor();
    if (!editor) return;

    // Clear existing content
    editor.innerHTML = '';

    // Insert text (handle newlines as separate paragraphs for Quill)
    const lines = text.split('\n');
    for (const line of lines) {
      const p = document.createElement('p');
      p.textContent = line || '\u200B'; // Zero-width space for empty lines
      editor.appendChild(p);
    }

    // Trigger input event so Quill/Gemini detects the change
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async triggerSend(): Promise<void> {
    // Allow Gemini to process the input change
    await new Promise((r) => setTimeout(r, 150));

    const sendBtn = document.querySelector(
      'button.send-button, button[aria-label="Send message"], button[data-at-shortcutkeys]'
    ) as HTMLButtonElement | null;

    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
    } else {
      // Fallback: try finding by mat-icon content
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.querySelector('mat-icon')?.textContent?.trim() === 'send') {
          (btn as HTMLButtonElement).click();
          return;
        }
      }
      console.warn('[AgentLoop] Could not find send button');
    }
  }

  getText(): string {
    return this.getEditor()?.textContent || '';
  }

  getCursorPosition(): number {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;

    const editor = this.getEditor();
    if (!editor) return 0;

    const range = sel.getRangeAt(0);
    const preRange = document.createRange();
    preRange.selectNodeContents(editor);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().length;
  }

  observeAIResponseComplete(timeoutMs: number): Promise<HTMLElement> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        observer.disconnect();
        reject(new Error('AI response timeout'));
      }, timeoutMs);

      let debounceTimer: ReturnType<typeof setTimeout>;
      let lastKnownResponse: HTMLElement | null = null;

      const checkComplete = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const response = this.getLastAIResponseElement();
          if (response && !this.isStreaming()) {
            lastKnownResponse = response;
            clearTimeout(timeout);
            observer.disconnect();
            resolve(response);
          }
        }, 500);
      };

      const observer = new MutationObserver(checkComplete);

      // Observe the conversation container for changes
      const chatContainer = document.querySelector(
        'chat-window, .conversation-container, main'
      );
      if (chatContainer) {
        observer.observe(chatContainer, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      } else {
        // Fallback: observe body
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      }

      // Initial check (response might already be complete)
      checkComplete();
    });
  }

  extractResponseText(responseElement: HTMLElement): string {
    return responseElement.innerText || responseElement.textContent || '';
  }

  isStreaming(): boolean {
    // Gemini shows various indicators while streaming
    const indicators = [
      '.loading-indicator',
      '.streaming-indicator',
      'mat-progress-bar',
      '.response-streaming',
      // Gemini's thinking/loading animation
      'message-actions[hidden]',
    ];

    for (const selector of indicators) {
      if (document.querySelector(selector)) {
        return true;
      }
    }

    // Also check if the last response's action buttons are hidden
    // (Gemini hides copy/thumb buttons while streaming)
    const lastResponse = this.getLastAIResponseElement();
    if (lastResponse) {
      const actions = lastResponse.closest('model-response')?.querySelector('message-actions');
      if (actions && actions.hasAttribute('hidden')) {
        return true;
      }
    }

    return false;
  }

  getLastAIResponseElement(): HTMLElement | null {
    // Gemini uses model-response elements
    const responses = document.querySelectorAll(
      'model-response .model-response-text, model-response .response-content, .model-response-text'
    );
    if (responses.length > 0) {
      return responses[responses.length - 1] as HTMLElement;
    }

    // Fallback: try message content containers
    const messages = document.querySelectorAll('[data-message-author-role="model"]');
    if (messages.length > 0) {
      return messages[messages.length - 1] as HTMLElement;
    }

    return null;
  }
}
