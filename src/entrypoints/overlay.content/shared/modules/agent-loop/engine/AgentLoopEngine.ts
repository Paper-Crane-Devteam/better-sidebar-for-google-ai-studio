/**
 * Agent Loop Engine — Core orchestrator.
 *
 * Manages the multi-turn execution loop:
 * 1. Wait for AI response to complete
 * 2. Parse tool calls from response text
 * 3. Execute each tool call
 * 4. Format results and auto-send back to AI
 * 5. Repeat until no tool calls or max rounds reached
 */

import type { AgentPlatformAdapter } from '../adapters/types';
import { useAgentLoopStore } from '../agent-loop-store';
import { parseToolCalls } from './ToolCallParser';
import { executeToolCall } from '../tools/tool-registry';

export class AgentLoopEngine {
  private adapter: AgentPlatformAdapter;
  private abortController: AbortController | null = null;

  constructor(adapter: AgentPlatformAdapter) {
    this.adapter = adapter;
  }

  /**
   * Start the agent loop.
   * Call this after the initial prompt message has been sent.
   */
  async start(maxRounds: number = 20): Promise<void> {
    this.abortController = new AbortController();
    const store = useAgentLoopStore.getState();
    store.start(maxRounds);

    console.log('[AgentLoop] Engine started, max rounds:', maxRounds);

    try {
      await this.runLoop();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg !== 'Agent loop aborted') {
        console.error('[AgentLoop] Engine error:', e);
        useAgentLoopStore.getState().setError(msg);
      }
    }
  }

  /** Stop the loop gracefully */
  stop(): void {
    console.log('[AgentLoop] Engine stopped by user');
    this.abortController?.abort();
    useAgentLoopStore.getState().stop();
  }

  /** Resume after pause (retry) */
  async resume(): Promise<void> {
    const store = useAgentLoopStore.getState();
    if (store.status !== 'paused') return;

    store.resume();
    this.abortController = new AbortController();

    try {
      await this.runLoop();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg !== 'Agent loop aborted') {
        useAgentLoopStore.getState().setError(msg);
      }
    }
  }

  private async runLoop(): Promise<void> {
    const getStore = () => useAgentLoopStore.getState();

    while (getStore().currentRound <= getStore().maxRounds) {
      this.checkAbort();

      // 1. Wait for AI response
      getStore().setStatus('waiting_ai');
      console.log(`[AgentLoop] Round ${getStore().currentRound}: Waiting for AI response...`);

      let responseElement: HTMLElement;
      try {
        responseElement = await this.adapter.observeAIResponseComplete(60000);
      } catch (e) {
        console.warn('[AgentLoop] AI response timeout');
        getStore().pause('AI response timed out (60s). Click "Retry" to try again.');
        return;
      }

      this.checkAbort();

      // 2. Parse tool calls
      getStore().setStatus('parsing');
      const responseText = this.adapter.extractResponseText(responseElement);
      console.log('[AgentLoop] Parsing response, length:', responseText.length);

      const { toolCalls, errors } = parseToolCalls(responseText);
      console.log(`[AgentLoop] Found ${toolCalls.length} tool calls, ${errors.length} errors`);

      // 3. No tool calls → loop complete
      if (toolCalls.length === 0) {
        console.log('[AgentLoop] No tool calls found, loop complete');
        getStore().stop();
        return;
      }

      // 4. Execute tool calls
      getStore().setStatus('executing');
      const results: string[] = [];

      for (const toolCall of toolCalls) {
        this.checkAbort();
        getStore().setCurrentTool(toolCall.name);
        console.log(`[AgentLoop] Executing: ${toolCall.name}`, toolCall.params);

        const result = await executeToolCall(toolCall);

        getStore().addResult({
          toolName: toolCall.name,
          success: !result.startsWith('ERROR:') && !result.startsWith('CANCELLED:'),
          result,
          timestamp: Date.now(),
        });

        results.push(`### ${toolCall.name}\n${result}`);

        // Check if paywall was hit
        if (result.includes('PAYWALL')) {
          console.log('[AgentLoop] Paywall hit, stopping');
          getStore().stop();
          return;
        }
      }

      getStore().setCurrentTool(null);
      this.checkAbort();

      // 5. Format results and insert into editor as a capsule (user decides to send)
      getStore().setStatus('sending');
      const formattedResult = this.formatResults(results, errors);
      console.log('[AgentLoop] Inserting results into editor, length:', formattedResult.length);

      this.insertResultCapsule(formattedResult);

      // 6. Pause — user must press Enter/send to continue the loop
      getStore().pause('Tool results ready. Press Enter to send and continue.');

      // 7. Wait for user to send (we listen for the message to actually be sent)
      await this.waitForUserSend();

      this.checkAbort();

      // 8. Advance to next round
      getStore().resume();
      getStore().nextRound();

      // 9. Check max rounds
      if (getStore().currentRound > getStore().maxRounds) {
        console.log('[AgentLoop] Max rounds reached');
        getStore().pause(`Reached maximum rounds (${getStore().maxRounds}). Continue?`);
        return;
      }
    }
  }

  /**
   * Insert the tool execution results into the editor wrapped in a capsule element.
   * The capsule shows a summary pill; the full XML content is stored in a data attribute
   * and expanded before sending.
   */
  private insertResultCapsule(resultText: string): void {
    const editor = this.adapter.getEditor();
    if (!editor) {
      // Fallback: just insert raw text
      this.adapter.insertText(resultText);
      return;
    }

    // Wrap results in our result XML tag
    const wrappedResult = `<bs_agent_result>\n${resultText}\n</bs_agent_result>`;

    // Clear editor and insert capsule
    editor.innerHTML = '';

    const p = document.createElement('p');
    const capsule = document.createElement('strong');
    capsule.className = 'bs-agent-result-capsule';
    capsule.setAttribute('data-result-content', wrappedResult);
    capsule.contentEditable = 'false';
    capsule.textContent = '📋 Tool Results (press Enter to send)';

    p.appendChild(capsule);
    // Add a space after for cursor placement
    p.appendChild(document.createTextNode('\u00A0'));
    editor.appendChild(p);

    // Trigger input event
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.focus();
  }

  /**
   * Wait for the user to send the message (detects the result capsule being removed
   * from the editor — meaning the message was sent).
   * Resolves when the editor no longer contains the result capsule.
   */
  private waitForUserSend(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        observer.disconnect();
        // Don't reject — just resolve so the engine can continue waiting
        resolve();
      }, 300000); // 5 min timeout

      const editor = this.adapter.getEditor();
      if (!editor) {
        clearTimeout(timeout);
        resolve();
        return;
      }

      const checkCapsule = () => {
        // If capsule is gone, user sent the message
        const capsule = editor.querySelector('.bs-agent-result-capsule');
        if (!capsule) {
          clearTimeout(timeout);
          observer.disconnect();
          // Small delay for the message to be processed
          setTimeout(resolve, 500);
        }
      };

      // Also check if abort was called
      const checkAbort = () => {
        if (this.abortController?.signal.aborted) {
          clearTimeout(timeout);
          observer.disconnect();
          reject(new Error('Agent loop aborted'));
        }
      };

      const observer = new MutationObserver(() => {
        checkAbort();
        checkCapsule();
      });

      observer.observe(editor, { childList: true, subtree: true, characterData: true });

      // Also observe parent (in case editor gets replaced)
      const parentObserver = new MutationObserver(() => {
        const newEditor = this.adapter.getEditor();
        if (newEditor && !newEditor.querySelector('.bs-agent-result-capsule')) {
          clearTimeout(timeout);
          parentObserver.disconnect();
          observer.disconnect();
          setTimeout(resolve, 500);
        }
      });
      if (editor.parentElement) {
        parentObserver.observe(editor.parentElement, { childList: true, subtree: true });
      }
    });
  }

  private formatResults(results: string[], errors: string[]): string {
    let output = '## Tool Execution Results\n\n';
    output += results.join('\n\n---\n\n');

    if (errors.length > 0) {
      output += '\n\n## Parse Errors\n\n';
      output += errors.map((e) => `- ${e}`).join('\n');
    }

    return output;
  }

  private checkAbort(): void {
    if (this.abortController?.signal.aborted) {
      throw new Error('Agent loop aborted');
    }
  }
}
