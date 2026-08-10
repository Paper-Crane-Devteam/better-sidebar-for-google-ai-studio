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
   * Resolves with the AI response DOM container element once the turn has finished.
   *
   * `idleTimeoutMs` is a budget for **silence, not for the whole turn**: every sign
   * that the turn is alive (output growing, the platform reporting it is generating)
   * must reset it. An implementation that treats it as a total timeout will kill long
   * answers mid-generation.
   *
   * Rejects once that silence budget runs out. It has to be able to reject: a
   * platform that errors out never completes a turn, and DOM-based detection can
   * stop recognising its own signals, so "wait forever" would leave the engine stuck
   * with no explanation.
   */
  observeAIResponseComplete(idleTimeoutMs: number): Promise<HTMLElement>;

  /**
   * Extract plain text from an AI response DOM container.
   * Handles Markdown-rendered DOM structures.
   */
  extractResponseText(responseElement: HTMLElement): string;

  /** Get the last AI response DOM container element */
  getLastAIResponseElement(): HTMLElement | null;
}
