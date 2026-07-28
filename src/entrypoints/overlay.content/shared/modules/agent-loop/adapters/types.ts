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

  /**
   * Programmatically trigger the send button.
   * Resolves false when the click was refused (e.g. the platform is still
   * generating and the button is currently "stop"), so callers can react instead
   * of assuming the message went out.
   */
  triggerSend(options?: { humanDelay?: boolean }): Promise<boolean>;

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

  /**
   * Whether the AI is currently streaming output.
   * Pass a response element to scope the check to that turn (preferred) —
   * page-wide checks pick up unrelated spinners.
   */
  isStreaming(responseElement?: HTMLElement): boolean;

  /** Get the last AI response DOM container element */
  getLastAIResponseElement(): HTMLElement | null;
}
