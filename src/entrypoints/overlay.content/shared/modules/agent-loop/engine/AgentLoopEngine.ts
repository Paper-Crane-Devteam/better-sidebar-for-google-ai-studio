/**
 * Agent Loop Engine — Core orchestrator.
 *
 * Manages the multi-turn execution loop:
 * 1. Wait for AI response to complete
 * 2. Parse tool calls from response text
 * 3. Execute each tool call
 * 4. Format results and auto-send back to AI
 * 5. Repeat until no tool calls or max rounds reached
 *
 * Includes circuit breaker protection against:
 * - Repeated identical tool calls (loop detection)
 * - Consecutive failures (progressive escalation)
 * - No-progress rounds (AI not using tools)
 */

import type { AgentPlatformAdapter } from '../adapters/types';
import { useAgentLoopStore } from '../agent-loop-store';
import { parseToolCalls } from './ToolCallParser';
import { executeToolCall } from '../tools/tool-registry';
import { CircuitBreaker } from './circuit-breaker';
import { agentEventBus } from '../event-bus';
import { COMPLETE_TASK_SIGNAL } from '../tools/complete-task';

export class AgentLoopEngine {
  private adapter: AgentPlatformAdapter;
  private abortController: AbortController | null = null;
  private circuitBreaker: CircuitBreaker;

  constructor(adapter: AgentPlatformAdapter) {
    this.adapter = adapter;
    this.circuitBreaker = new CircuitBreaker();
  }

  /**
   * Start the agent loop.
   * Call this after the initial prompt message has been sent.
   */
  async start(maxRounds: number = 20): Promise<void> {
    this.abortController = new AbortController();
    this.circuitBreaker.reset();
    const store = useAgentLoopStore.getState();
    store.start(maxRounds);

    console.log('[AgentLoop] Engine started, max rounds:', maxRounds);
    agentEventBus.emit('loop:started', { maxRounds, timestamp: Date.now() });

    try {
      await this.runLoop();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg !== 'Agent loop aborted') {
        console.error('[AgentLoop] Engine error:', e);
        useAgentLoopStore.getState().setError(msg);
        agentEventBus.emit('loop:ended', {
          reason: 'error',
          totalRounds: useAgentLoopStore.getState().currentRound,
        });
      }
    }
  }

  /** Stop the loop gracefully */
  stop(): void {
    console.log('[AgentLoop] Engine stopped by user');
    this.abortController?.abort();
    useAgentLoopStore.getState().stop();
    agentEventBus.emit('loop:ended', {
      reason: 'user_stop',
      totalRounds: useAgentLoopStore.getState().currentRound,
    });
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
      agentEventBus.emit('ai:response-waiting', undefined);
      console.log(`[AgentLoop] Round ${getStore().currentRound}: Waiting for AI response...`);
      agentEventBus.emit('loop:round-started', { round: getStore().currentRound });

      let responseElement: HTMLElement;
      try {
        responseElement = await this.adapter.observeAIResponseComplete(60000);
      } catch (e) {
        console.warn('[AgentLoop] AI response timeout');
        agentEventBus.emit('ai:response-timeout', { timeoutMs: 60000 });
        getStore().pause('AI response timed out (60s). Click "Retry" to try again.');
        agentEventBus.emit('loop:paused', { reason: 'AI response timeout' });
        return;
      }

      this.checkAbort();

      // 2. Parse tool calls
      getStore().setStatus('parsing');
      const responseText = this.adapter.extractResponseText(responseElement);
      console.log('[AgentLoop] Parsing response, length:', responseText.length);

      const { toolCalls, errors } = parseToolCalls(responseText);
      console.log(`[AgentLoop] Found ${toolCalls.length} tool calls, ${errors.length} errors`);

      agentEventBus.emit('ai:response-received', {
        textLength: responseText.length,
        toolCallCount: toolCalls.length,
      });

      // 3. No tool calls → check circuit breaker for no-progress
      if (toolCalls.length === 0) {
        const noProgressResult = this.circuitBreaker.recordNoToolResponse();

        if (noProgressResult && noProgressResult.action === 'stop') {
          console.log('[AgentLoop] No-progress threshold reached, stopping');
          getStore().pause(noProgressResult.message);
          agentEventBus.emit('loop:ended', {
            reason: 'circuit_breaker',
            totalRounds: getStore().currentRound,
          });
          return;
        }

        if (noProgressResult && noProgressResult.action === 'nudge') {
          // AI didn't use tools — send a nudge and let it try again
          console.log('[AgentLoop] No tool calls, nudging AI');
          this.insertResultCapsule(noProgressResult.message);
          await this.waitForUserSend();
          this.checkAbort();
          getStore().nextRound();
          continue;
        }

        // First time no tools — task is likely complete
        console.log('[AgentLoop] No tool calls found, loop complete');
        getStore().stop();
        agentEventBus.emit('loop:ended', {
          reason: 'complete',
          totalRounds: getStore().currentRound,
        });
        return;
      }

      // Reset no-progress counter since we have tool calls
      this.circuitBreaker.resetNoProgress();

      // 4. Execute tool calls
      getStore().setStatus('executing');
      const results: string[] = [];
      let circuitBroken = false;

      for (const toolCall of toolCalls) {
        this.checkAbort();

        // ── Circuit breaker: loop detection ──────────────────────────────
        const loopCheck = this.circuitBreaker.checkRepeatedToolCall(toolCall.name, toolCall.params);

        if (loopCheck.action === 'stop') {
          console.warn('[AgentLoop] Circuit breaker: loop hard stop');
          results.push(`### ${toolCall.description || toolCall.name}\n${loopCheck.message}`);
          circuitBroken = true;
          break;
        }

        if (loopCheck.action === 'warn') {
          // Inject warning but still execute this time
          results.push(`### ⚠️ Loop Warning\n${loopCheck.message}`);
        }

        // ── Execute the tool ─────────────────────────────────────────────
        getStore().setCurrentTool(toolCall.name);
        console.log(`[AgentLoop] Executing: ${toolCall.name}`, toolCall.params);
        agentEventBus.emit('tool:executing', { toolName: toolCall.name, params: toolCall.params });

        const startTime = Date.now();
        const result = await executeToolCall(toolCall);
        const durationMs = Date.now() - startTime;

        const success = !result.startsWith('ERROR:') && !result.startsWith('CANCELLED:');

        agentEventBus.emit('tool:executed', {
          toolName: toolCall.name,
          success,
          result: result.substring(0, 200), // Truncate for event
          durationMs,
        });

        // ── Circuit breaker: failure tracking ────────────────────────────
        const failureResult = this.circuitBreaker.recordToolResult(
          toolCall.name,
          success,
          success ? undefined : result,
        );

        let finalResult = result;

        if (!success && failureResult) {
          // Apply progressive error guidance
          finalResult = this.circuitBreaker.getProgressiveErrorGuidance(result);

          if (failureResult.action === 'stop') {
            console.warn('[AgentLoop] Circuit breaker: failure hard stop');
            results.push(`### ${toolCall.description || toolCall.name}\n${finalResult}\n\n${failureResult.message}`);
            circuitBroken = true;

            agentEventBus.emit('tool:error', { toolName: toolCall.name, error: failureResult.message });
            break;
          }

          if (failureResult.action === 'warn') {
            // Append warning to result
            finalResult += `\n\n${failureResult.message}`;
          }
        }

        getStore().addResult({
          toolName: toolCall.name,
          success,
          result: finalResult,
          timestamp: Date.now(),
        });

        results.push(`### ${toolCall.description || toolCall.name}\n${finalResult}`);

        // Check if task was explicitly completed
        if (result.startsWith(COMPLETE_TASK_SIGNAL)) {
          const summary = result.slice(COMPLETE_TASK_SIGNAL.length + 1); // +1 for the colon
          console.log('[AgentLoop] Task explicitly completed:', summary);
          getStore().addResult({
            toolName: 'complete_task',
            success: true,
            result: summary,
            timestamp: Date.now(),
          });
          getStore().stop();
          agentEventBus.emit('loop:ended', {
            reason: 'complete',
            totalRounds: getStore().currentRound,
          });
          return;
        }

        // Check if paywall was hit
        if (result.includes('PAYWALL')) {
          console.log('[AgentLoop] Paywall hit, stopping');
          getStore().stop();
          agentEventBus.emit('loop:ended', { reason: 'error', totalRounds: getStore().currentRound });
          return;
        }
      }

      getStore().setCurrentTool(null);
      this.checkAbort();

      // If circuit breaker triggered a hard stop, pause the loop
      if (circuitBroken) {
        getStore().pause('Circuit breaker triggered. Please review the issue above.');
        agentEventBus.emit('loop:ended', {
          reason: 'circuit_breaker',
          totalRounds: getStore().currentRound,
        });
        return;
      }

      agentEventBus.emit('loop:round-completed', {
        round: getStore().currentRound,
        toolCallCount: toolCalls.length,
      });

      // 5. Format results and insert into editor as a capsule (user decides to send)
      getStore().setStatus('sending');
      const formattedResult = this.formatResults(results, errors);
      console.log('[AgentLoop] Inserting results into editor, length:', formattedResult.length);

      this.insertResultCapsule(formattedResult);

      // 6. Pause — user must press Enter/send to continue the loop
      getStore().pause('Tool results ready. Press Enter to send and continue.');
      agentEventBus.emit('loop:paused', { reason: 'Waiting for user to send results' });

      // 7. Wait for user to send (we listen for the message to actually be sent)
      await this.waitForUserSend();

      this.checkAbort();

      // 8. Advance to next round
      getStore().resume();
      agentEventBus.emit('loop:resumed', undefined);
      getStore().nextRound();

      // 9. Check max rounds
      if (getStore().currentRound > getStore().maxRounds) {
        console.log('[AgentLoop] Max rounds reached');
        getStore().pause(`Reached maximum rounds (${getStore().maxRounds}). Continue?`);
        agentEventBus.emit('loop:ended', {
          reason: 'max_rounds',
          totalRounds: getStore().maxRounds,
        });
        return;
      }
    }
  }

  /**
   * Insert the tool execution results into the editor as individual capsule elements.
   * Each tool result gets its own capsule for clarity. On send, they are merged into
   * a single <bs_agent_result> block.
   */
  private insertResultCapsule(resultText: string): void {
    const editor = this.adapter.getEditor();
    if (!editor) {
      // Fallback: just insert raw text
      this.adapter.insertText(resultText);
      return;
    }

    // Split results into individual tool sections (split on --- separator)
    const sections = this.splitResultSections(resultText);

    // Clear editor
    editor.innerHTML = '';

    const p = document.createElement('p');

    if (sections.length === 0) {
      // Fallback: single capsule
      const wrappedResult = `<bs_agent_result>\n${resultText}\n</bs_agent_result>`;
      const capsule = this.createResultCapsuleElement('📋 Tool Results', wrappedResult);
      p.appendChild(capsule);
      p.appendChild(document.createTextNode('\u00A0'));
    } else {
      // One capsule per tool result section
      for (const section of sections) {
        const capsule = this.createResultCapsuleElement(
          `📋 ${section.label}`,
          section.content,
        );
        p.appendChild(capsule);
        p.appendChild(document.createTextNode(' '));
      }
    }

    editor.appendChild(p);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.focus();
  }

  /** Create a single result capsule DOM element */
  private createResultCapsuleElement(label: string, content: string): HTMLElement {
    const capsule = document.createElement('strong');
    capsule.className = 'bs-agent-result-capsule';
    capsule.setAttribute('data-result-content', content);
    capsule.contentEditable = 'false';
    capsule.textContent = label;
    return capsule;
  }

  /**
   * Split formatted results text into individual sections.
   * Format: "## Tool Execution Results\n\n### label\ncontent\n\n---\n\n### label\ncontent"
   */
  private splitResultSections(resultText: string): Array<{ label: string; content: string }> {
    const sections: Array<{ label: string; content: string }> = [];

    // Remove the "## Tool Execution Results" header
    const body = resultText.replace(/^## Tool Execution Results\n\n/, '');

    // Split on "---" separator
    const parts = body.split(/\n\n---\n\n/);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Extract label from ### heading
      const headingMatch = trimmed.match(/^### (.+)\n([\s\S]*)$/);
      if (headingMatch) {
        sections.push({
          label: headingMatch[1].trim(),
          content: trimmed,
        });
      } else {
        // No heading — use generic label
        sections.push({
          label: 'Result',
          content: trimmed,
        });
      }
    }

    return sections;
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
