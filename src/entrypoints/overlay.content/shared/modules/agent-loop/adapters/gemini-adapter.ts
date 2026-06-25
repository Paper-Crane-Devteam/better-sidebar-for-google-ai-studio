/**
 * Gemini Platform Adapter.
 * Implements AgentPlatformAdapter for Google Gemini's Quill-based rich-textarea.
 */

import type { AgentPlatformAdapter } from './types';
import {
  getEditor as quillGetEditor,
  getCursorPosition as quillGetCursorPosition,
  replaceAllContent,
  triggerSend as quillTriggerSend,
} from '@/entrypoints/overlay.content/shared/lib/quill-editor';

export class GeminiAgentAdapter implements AgentPlatformAdapter {
  getEditor(): HTMLElement | null {
    return quillGetEditor();
  }

  insertText(text: string): void {
    const editor = this.getEditor();
    if (!editor) return;
    replaceAllContent(editor, text);
  }

  async triggerSend(): Promise<void> {
    await quillTriggerSend();
  }

  getText(): string {
    return this.getEditor()?.textContent || '';
  }

  getCursorPosition(): number {
    const editor = this.getEditor();
    if (!editor) return 0;
    return quillGetCursorPosition(editor);
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
