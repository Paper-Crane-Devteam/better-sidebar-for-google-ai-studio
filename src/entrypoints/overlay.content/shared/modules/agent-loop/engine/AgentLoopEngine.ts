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
import { buildToolCallFingerprint, isWriteOperation } from '../execution-policy';
import { agentEventBus } from '../event-bus';
import { useAgentPolicyStore } from '../agent-policy-store';
import { COMPLETE_TASK_SIGNAL } from '../tools/complete-task';
import {
  insertMultipleCapsules,
  buildResultCapsuleText,
  triggerSend,
  RESULT_CAPSULE_CLASS,
  RESULT_CAPSULE_ATTR_CONTENT,
} from '@/entrypoints/overlay.content/shared/lib/quill-editor';
import type { CapsuleAttrs } from '@/entrypoints/overlay.content/shared/lib/quill-editor';

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
  async start(
    maxRounds: number = 20,
    session?: { conversationId?: string | null; title?: string },
  ): Promise<void> {
    this.abortController = new AbortController();
    this.circuitBreaker.reset();
    const store = useAgentLoopStore.getState();
    store.start(maxRounds, session);

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
    const totalRounds = useAgentLoopStore.getState().currentRound;
    this.abortController?.abort();
    useAgentLoopStore.getState().stop('user_stop');
    agentEventBus.emit('loop:ended', { reason: 'user_stop', totalRounds });
  }

  /**
   * Resume after a guard stopped the loop (timeout, breakpoint, circuit breaker,
   * max rounds) or after an error. Restarts `runLoop` — the previous invocation
   * has already returned in all of these cases.
   */
  async resume(): Promise<void> {
    const store = useAgentLoopStore.getState();
    if (store.status !== 'paused' && store.status !== 'error') return;

    store.resume();
    this.abortController = new AbortController();

    try {
      // Results still sitting in the editor mean the previous round never got
      // sent. Resuming straight into runLoop would wait for a response to a
      // message that was never delivered, so send it first.
      if (this.hasStagedResults()) {
        const sent = await this.waitForSendAfter(() => triggerSend({ humanDelay: false }));
        if (!sent) {
          useAgentLoopStore
            .getState()
            .pause('Could not send the staged results. Send them from the chat input.');
          return;
        }
        useAgentLoopStore.getState().resume();
        useAgentLoopStore.getState().nextRound();
      }

      await this.runLoop();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg !== 'Agent loop aborted') {
        useAgentLoopStore.getState().setError(msg);
      }
    }
  }

  /**
   * Send the pending tool results and continue the loop.
   * Valid only while status is `awaiting_send` — clicking the real send button
   * lets the existing interceptor merge the result capsules for us.
   */
  async continueNow(): Promise<void> {
    if (useAgentLoopStore.getState().status !== 'awaiting_send') return;
    // User-initiated, so no artificial pause — triggerSend still waits out any
    // in-progress generation so the click can't land on the stop button.
    await triggerSend({ humanDelay: false });
  }

  /** Whether tool results are still staged in the editor, unsent */
  private hasStagedResults(): boolean {
    const editor = this.adapter.getEditor();
    return !!editor?.querySelector(`.${RESULT_CAPSULE_CLASS}`);
  }

  /**
   * Run `action` and wait for the staged results to leave the editor.
   * The watcher is armed before the action so a fast send can't be missed.
   */
  private async waitForSendAfter(action: () => Promise<unknown>): Promise<boolean> {
    const watcher = this.waitForUserSend();
    await action();
    return watcher;
  }

  private async runLoop(): Promise<void> {
    const getStore = () => useAgentLoopStore.getState();

    while (getStore().currentRound <= getStore().maxRounds) {
      this.checkAbort();

      // ── Breakpoint check ───────────────────────────────────────────────
      const breakpoint = getStore().breakpointRound;
      if (breakpoint !== null && getStore().currentRound === breakpoint) {
        getStore().pause('已到达断点轮次');
        getStore().setBreakpointRound(null);
        agentEventBus.emit('loop:paused', { reason: 'breakpoint' });
        return;
      }

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

      // ── Token estimation for AI response ───────────────────────────────
      getStore().addTokens(Math.round(responseText.length * 0.25));

      // 3. No tool calls → nudge the AI, or stop if it keeps not making progress.
      //    A tool-less response is NOT completion: the protocol ends with
      //    complete_task. Treating it as completion made the loop declare
      //    "Task finished" on round 1 whenever a response was read early.
      if (toolCalls.length === 0) {
        const noProgressResult = this.circuitBreaker.recordNoToolResponse();

        if (noProgressResult.action === 'stop') {
          console.log('[AgentLoop] No-progress threshold reached, stopping');
          getStore().pause(noProgressResult.message);
          agentEventBus.emit('loop:ended', {
            reason: 'circuit_breaker',
            totalRounds: getStore().currentRound,
          });
          return;
        }

        console.log('[AgentLoop] No tool calls, nudging AI');
        const nudge =
          errors.length > 0
            ? // Blocks were present but unparseable — tell the AI what broke
              `${noProgressResult.message}\n\n## Parse Errors\n\n${errors.map((e) => `- ${e}`).join('\n')}`
            : noProgressResult.message;

        if (!(await this.handoffResults(nudge))) return;

        this.checkAbort();
        getStore().resume();
        getStore().nextRound();
        continue;
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

        // ── Token estimation for tool result ─────────────────────────────
        getStore().addTokens(Math.round(result.length * 0.25));

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
          // The AI's own wording — shown in the Agent tab instead of the tool name
          description: toolCall.description,
          success,
          result: finalResult,
          timestamp: Date.now(),
        });

        // Claim this call so the conversation's manual Run button won't repeat it
        getStore().recordExecutedCall(buildToolCallFingerprint(toolCall), {
          toolName: toolCall.name,
          isWrite: isWriteOperation(toolCall),
          success,
          timestamp: Date.now(),
          source: 'engine',
        });

        results.push(`### ${toolCall.description || toolCall.name}\n${finalResult}`);

        // Check if task was explicitly completed
        if (result.startsWith(COMPLETE_TASK_SIGNAL)) {
          const summary = result.slice(COMPLETE_TASK_SIGNAL.length + 1); // +1 for the colon
          console.log('[AgentLoop] Task explicitly completed:', summary);
          getStore().addResult({
            toolName: 'complete_task',
            description: summary,
            success: true,
            result: summary,
            timestamp: Date.now(),
          });
          getStore().stop('complete');
          agentEventBus.emit('loop:ended', {
            reason: 'complete',
            totalRounds: getStore().currentRound,
          });
          return;
        }

        // Check if paywall was hit — the tab renders an upgrade prompt for this
        if (result.includes('PAYWALL')) {
          console.log('[AgentLoop] Paywall hit, stopping');
          getStore().stop('paywall');
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

      // 5-7. Stage the results in the editor and get them sent (auto or by the user)
      getStore().setStatus('sending');
      const formattedResult = this.formatResults(results, errors);
      console.log('[AgentLoop] Inserting results into editor, length:', formattedResult.length);

      if (!(await this.handoffResults(formattedResult))) return;

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
   * Stage `text` in the editor and get it back to the AI.
   *
   * With `autoContinue` on (default) the engine clicks send itself, so the loop
   * runs unattended; otherwise it parks in `awaiting_send` for the user. Returns
   * false when the handoff never completed — the caller must stop the loop then,
   * because continuing would wait on an AI response nobody asked for (that is
   * the "stuck pending until timeout" symptom).
   */
  private async handoffResults(text: string): Promise<boolean> {
    const store = () => useAgentLoopStore.getState();

    await this.insertResultCapsule(text);

    // Normal checkpoint, not a fault — hence its own status.
    store().awaitSend();
    agentEventBus.emit('loop:paused', { reason: 'Waiting for user to send results' });

    // Route through the real send button so the interceptor merges the capsules
    let clicked = true;
    const sent = await this.waitForSendAfter(async () => {
      if (useAgentPolicyStore.getState().autoContinue) {
        clicked = await triggerSend();
      }
    });

    if (!sent) {
      // A refused click means the button was still "stop generating" — pausing is
      // right, because clicking anyway would have aborted the AI's answer.
      const reason = clicked
        ? 'Tool results were not sent. Click "Continue" to send them.'
        : 'Could not send while the AI was still generating. Click "Continue" to retry.';
      console.warn('[AgentLoop] Results were never sent, pausing');
      store().pause(reason);
      agentEventBus.emit('loop:paused', { reason: 'Results not sent' });
      return false;
    }

    return true;
  }

  /**
   * Insert the tool execution results into the editor as individual capsule elements.
   * Each tool result gets its own capsule for clarity. On send, they are merged into
   * a single <bs_agent_result> block.
   */
  private async insertResultCapsule(resultText: string): Promise<void> {
    const editor = this.adapter.getEditor();
    if (!editor) {
      // Fallback: just insert raw text
      this.adapter.insertText(resultText);
      return;
    }

    // Split results into individual tool sections (split on --- separator)
    const sections = this.splitResultSections(resultText);

    // Build capsule data
    const capsuleData: Array<{ displayText: string; attrs: CapsuleAttrs }> = [];

    if (sections.length === 0) {
      const wrappedResult = `<bs_agent_result>\n${resultText}\n</bs_agent_result>`;
      capsuleData.push({
        displayText: buildResultCapsuleText('Tool Results'),
        attrs: {
          className: RESULT_CAPSULE_CLASS,
          dataAttrs: { [RESULT_CAPSULE_ATTR_CONTENT]: wrappedResult },
          nonEditable: true,
        },
      });
    } else {
      for (const section of sections) {
        capsuleData.push({
          displayText: buildResultCapsuleText(section.label),
          attrs: {
            className: RESULT_CAPSULE_CLASS,
            dataAttrs: { [RESULT_CAPSULE_ATTR_CONTENT]: section.content },
            nonEditable: true,
          },
        });
      }
    }

    // Must be awaited: the capsules only exist in the DOM after the rAF wrap.
    // Starting waitForUserSend() before that made it see a capsule-free editor
    // and resolve immediately, so the round advanced without anything being sent.
    await insertMultipleCapsules(editor, capsuleData);
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
   * Wait for the staged results to be sent (detected by the result capsule
   * disappearing from the editor).
   *
   * Resolves true once sent, false if the wait timed out. It used to resolve
   * unconditionally, so a missed send looked identical to a real one and the loop
   * moved on to wait for a response that was never requested.
   */
  private waitForUserSend(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const editor = this.adapter.getEditor();
      if (!editor) {
        resolve(false);
        return;
      }

      const signal = this.abortController?.signal;
      let settled = false;

      const cleanup = () => {
        clearTimeout(timeout);
        observer.disconnect();
        parentObserver.disconnect();
        signal?.removeEventListener('abort', onAbort);
      };

      const finish = (sent: boolean) => {
        if (settled) return;
        settled = true;
        cleanup();
        // Small delay for the message to be processed
        setTimeout(() => resolve(sent), 500);
      };

      // Abort must interrupt the wait immediately. Previously this only reacted
      // to DOM mutations, so stopping the loop while idle left it hanging here.
      const onAbort = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Agent loop aborted'));
      };

      // Don't reject — report the miss so the caller can pause with a clear reason
      const timeout = setTimeout(() => finish(false), 300000); // 5 min

      const checkCapsule = (target: HTMLElement | null) => {
        if (target && !target.querySelector(`.${RESULT_CAPSULE_CLASS}`)) {
          finish(true);
        }
      };

      const observer = new MutationObserver(() => checkCapsule(editor));
      observer.observe(editor, { childList: true, subtree: true, characterData: true });

      // Also observe parent (in case editor gets replaced on SPA navigation)
      const parentObserver = new MutationObserver(() =>
        checkCapsule(this.adapter.getEditor()),
      );
      if (editor.parentElement) {
        parentObserver.observe(editor.parentElement, { childList: true, subtree: true });
      }

      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener('abort', onAbort);
    });
  }

  private formatResults(results: string[], errors: string[]): string {
    let output = '';

    // Inject user instruction if pending
    const instruction = useAgentLoopStore.getState().pendingInstruction;
    if (instruction) {
      output += `## User Instruction\n\n${instruction}\n\n`;
      useAgentLoopStore.getState().setPendingInstruction(null);
    }

    output += '## Tool Execution Results\n\n';
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
