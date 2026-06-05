/**
 * Platform Adapter Interface.
 * Each supported platform implements this to allow the AgentLoopEngine
 * to interact with platform-specific DOM (editor, send button, AI responses).
 */
export interface AgentPlatformAdapter {
  /** Get the input editor DOM element */
  getEditor(): HTMLElement | null;

  /** Insert text into the editor (replaces current content) */
  insertText(text: string): void;

  /** Programmatically trigger the send button */
  triggerSend(): Promise<void>;

  /** Get the current text content of the editor */
  getText(): string;

  /** Get cursor position (character offset) */
  getCursorPosition(): number;

  /**
   * Observe AI response completion.
   * Resolves with the AI response DOM container element once streaming finishes.
   * Rejects on timeout.
   */
  observeAIResponseComplete(timeoutMs: number): Promise<HTMLElement>;

  /**
   * Extract plain text from an AI response DOM container.
   * Handles Markdown-rendered DOM structures.
   */
  extractResponseText(responseElement: HTMLElement): string;

  /** Whether the AI is currently streaming output */
  isStreaming(): boolean;

  /** Get the last AI response DOM container element */
  getLastAIResponseElement(): HTMLElement | null;
}
