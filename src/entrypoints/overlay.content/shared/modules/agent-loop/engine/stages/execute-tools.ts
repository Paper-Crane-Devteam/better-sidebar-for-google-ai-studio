/**
 * Stage ③ — run the round's tool calls.
 *
 * Per call, in order: ask the circuit breaker whether this is a loop, execute,
 * record the outcome (store + fingerprint ledger + events), then check for the two
 * signals that end the session outright — `complete_task` and a paywall hit.
 *
 * Every branch still produces a markdown section, because whatever happened has to
 * be reported back to the AI. A silent abort would leave it guessing.
 */

import type { ParsedToolCall } from '../../types';
import type { LoopContext } from '../context';
import { executeToolCall } from '../../tools/tool-registry';
import { COMPLETE_TASK_SIGNAL } from '../../tools/complete-task';
import { buildToolCallFingerprint, isWriteOperation } from '../../execution-policy';

export type ExecuteOutcome =
  /** Round finished; feed these sections back to the AI */
  | { kind: 'results'; results: string[] }
  /** Session is over (complete / paywall / circuit breaker) — already reported */
  | { kind: 'ended' };

/** A tool result that starts with either prefix counts as a failure */
function isSuccess(result: string): boolean {
  return !result.startsWith('ERROR:') && !result.startsWith('CANCELLED:');
}

function section(toolCall: ParsedToolCall, body: string): string {
  return `### ${toolCall.description || toolCall.name}\n${body}`;
}

export async function executeTools(
  ctx: LoopContext,
  toolCalls: ParsedToolCall[],
): Promise<ExecuteOutcome> {
  ctx.setStatus('executing');
  const results: string[] = [];

  for (const toolCall of toolCalls) {
    ctx.abort.check();

    // ── Guard: is the AI repeating itself? ─────────────────────────────────
    const loopCheck = ctx.breaker.checkRepeatedToolCall(toolCall.name, toolCall.params);

    if (loopCheck.action === 'stop') {
      console.warn('[AgentLoop] Circuit breaker: loop hard stop');
      results.push(section(toolCall, loopCheck.message));
      return breakCircuit(ctx);
    }

    if (loopCheck.action === 'warn') {
      // Warn but still run it once more — the AI gets a chance to self-correct
      results.push(`### ⚠️ Loop Warning\n${loopCheck.message}`);
    }

    // ── Execute ────────────────────────────────────────────────────────────
    ctx.store.setCurrentTool(toolCall.name);
    console.log(`[AgentLoop] Executing: ${toolCall.name}`, toolCall.params);
    ctx.events.emit('tool:executing', { toolName: toolCall.name, params: toolCall.params });

    const startedAt = Date.now();
    const result = await executeToolCall(toolCall);
    const success = isSuccess(result);

    ctx.events.emit('tool:executed', {
      toolName: toolCall.name,
      success,
      result: result.substring(0, 200), // Truncated — events are for observers, not payloads
      durationMs: Date.now() - startedAt,
    });
    ctx.countTokens(result);

    // ── Guard: consecutive failures ────────────────────────────────────────
    // Always recorded: a success here resets the failure streak.
    const failure = ctx.breaker.recordToolResult(
      toolCall.name,
      success,
      success ? undefined : result,
    );
    let body = result;

    if (failure) {
      // Escalating hints, so the AI stops retrying the same broken approach
      body = ctx.breaker.getProgressiveErrorGuidance(result);

      if (failure.action === 'stop') {
        console.warn('[AgentLoop] Circuit breaker: failure hard stop');
        ctx.events.emit('tool:error', { toolName: toolCall.name, error: failure.message });
        results.push(section(toolCall, `${body}\n\n${failure.message}`));
        return breakCircuit(ctx);
      }

      if (failure.action === 'warn') body += `\n\n${failure.message}`;
    }

    ctx.store.addResult({
      toolName: toolCall.name,
      // The AI's own wording — shown in the Agent tab instead of the tool name
      description: toolCall.description,
      success,
      result: body,
      timestamp: Date.now(),
    });

    // Claim this call so the conversation's manual Run button won't repeat it
    ctx.store.recordExecutedCall(buildToolCallFingerprint(toolCall), {
      toolName: toolCall.name,
      isWrite: isWriteOperation(toolCall),
      success,
      timestamp: Date.now(),
      source: 'engine',
    });

    results.push(section(toolCall, body));

    // ── Session-ending signals ─────────────────────────────────────────────
    if (result.startsWith(COMPLETE_TASK_SIGNAL)) {
      const summary = result.slice(COMPLETE_TASK_SIGNAL.length + 1); // +1 for the colon
      console.log('[AgentLoop] Task explicitly completed:', summary);
      ctx.store.addResult({
        toolName: 'complete_task',
        description: summary,
        success: true,
        result: summary,
        timestamp: Date.now(),
      });
      ctx.store.setCurrentTool(null);
      ctx.finish('complete');
      return { kind: 'ended' };
    }

    if (result.includes('PAYWALL')) {
      console.log('[AgentLoop] Paywall hit, stopping');
      ctx.store.setCurrentTool(null);
      ctx.finish('paywall');
      return { kind: 'ended' };
    }
  }

  ctx.store.setCurrentTool(null);
  ctx.abort.check();
  ctx.events.emit('loop:round-completed', { round: ctx.round, toolCallCount: toolCalls.length });

  return { kind: 'results', results };
}

/**
 * A tripped breaker pauses rather than sending: the accumulated results stay
 * visible in the tab so the user can see what went wrong before deciding to retry.
 */
function breakCircuit(ctx: LoopContext): ExecuteOutcome {
  ctx.store.setCurrentTool(null);
  ctx.pauseAndEnd('Circuit breaker triggered. Please review the issue above.', 'circuit_breaker');
  return { kind: 'ended' };
}
