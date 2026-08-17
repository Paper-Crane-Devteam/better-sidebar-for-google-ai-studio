/**
 * Stage ③ — run the round's tool calls.
 *
 * Per call, in order: ask the circuit breaker whether this is a loop, gate it behind
 * an approval if policy says so, execute, record the outcome (store + fingerprint
 * ledger + events), then check for the two signals that end the session outright —
 * `complete_task` and a paywall hit.
 *
 * Every branch still produces a markdown section, because whatever happened has to
 * be reported back to the AI. A silent abort would leave it guessing — a refusal in
 * particular has to say so, or the AI's next move is the same statement again.
 */

import type { ParsedToolCall } from '../../types';
import type { LoopContext } from '../context';
import { executeToolCall } from '../../tools/tool-registry';
import { parseCompleteTaskSignal } from '../../tools/complete-task';
import { buildToolCallFingerprint, getToolRisk, requiresApproval } from '../../execution-policy';
import { isHandoffTool } from '../parser/tool-schema';
import { AUTO_APPROVED, requestApproval } from './approval-gate';

export type ExecuteOutcome =
  /** Round finished; feed these sections back to the AI */
  | { kind: 'results'; results: string[] }
  /**
   * A guard stopped the round, but the AI is still owed a report of what happened.
   *
   * Distinct from `ended` because these results must reach the AI eventually — the
   * caller stages them without sending, so "Retry" delivers the errors and the AI
   * gets a chance to correct itself. Dropping them was a dead end: the loop paused
   * with nothing in the composer, so Retry went back to waiting for a reply to a
   * message that was never sent, and sat there until the idle timeout.
   */
  | { kind: 'halted'; results: string[]; reason: string }
  /** Session is genuinely over (complete_task / paywall) — nothing owed, already reported */
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
  // The failure budget is counted per round: several statements failing on the same
  // wrong assumption is one mistake, not five.
  ctx.breaker.beginRound();
  const results: string[] = [];

  for (const [index, toolCall] of toolCalls.entries()) {
    ctx.abort.check();

    // ── Guard: is the AI repeating itself? ─────────────────────────────────
    const loopCheck = ctx.breaker.checkRepeatedToolCall(toolCall.name, toolCall.params);

    if (loopCheck.action === 'stop') {
      console.warn('[AgentLoop] Circuit breaker: loop hard stop');
      results.push(section(toolCall, loopCheck.message));
      return halt(
        ctx,
        results,
        'The agent kept issuing the same call. Review it above, then retry to tell it so.',
      );
    }

    if (loopCheck.action === 'warn') {
      // Warn but still run it once more — the AI gets a chance to self-correct
      results.push(`### ⚠️ Loop Warning\n${loopCheck.message}`);
    }

    const fingerprint = buildToolCallFingerprint(toolCall);

    // ── Gate: does the user have to say go? ────────────────────────────────
    const decision = requiresApproval(toolCall)
      ? await requestApproval(ctx, {
          toolCall,
          fingerprint,
          remaining: toolCalls.length - index - 1,
        })
      : AUTO_APPROVED;

    if (!decision.approved) {
      // Reported as a tool result rather than aborting the round: the AI has to
      // learn this specific call was refused, and why, or its next move is the same
      // statement again.
      const refusal = decision.reason
        ? `CANCELLED: The user rejected this operation. Their reason: ${decision.reason}\n` +
          `Do not retry it unchanged — address the objection, or call complete_task with status ` +
          `"infeasible" explaining what you would need.`
        : `CANCELLED: The user rejected this operation without giving a reason.\n` +
          `Do not retry it unchanged — take the safest alternative reading of the request, or call ` +
          `complete_task with status "infeasible".`;

      console.log('[AgentLoop] Rejected by user:', toolCall.name);
      ctx.store.addResult({
        toolName: toolCall.name,
        description: toolCall.description,
        success: false,
        result: refusal,
        timestamp: Date.now(),
      });
      ctx.store.recordExecutedCall(fingerprint, {
        toolName: toolCall.name,
        isWrite: getToolRisk(toolCall) === 'write',
        success: false,
        rejected: true,
        timestamp: Date.now(),
        source: 'engine',
      });
      results.push(section(toolCall, refusal));
      continue;
    }

    // ── Execute ────────────────────────────────────────────────────────────
    ctx.store.setCurrentTool(toolCall.name);
    console.log(`[AgentLoop] Executing: ${toolCall.name}`, toolCall.params);
    ctx.events.emit('tool:executing', { toolName: toolCall.name, params: toolCall.params });

    const result = await executeToolCall(toolCall);
    const success = isSuccess(result);

    ctx.events.emit('tool:executed', {
      toolName: toolCall.name,
      success,
      result: result.substring(0, 200), // Truncated — events are for observers, not payloads
    });

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
        // Recorded before halting, so the step list shows the failure that tripped it
        ctx.store.addResult({
          toolName: toolCall.name,
          description: toolCall.description,
          success: false,
          result: body,
          timestamp: Date.now(),
        });
        results.push(section(toolCall, `${body}\n\n${failure.message}`));
        return halt(ctx, results, 'Too many failures in a row. Review the errors above, then retry.');
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

    // Recorded so the call's card in the chat can show what became of it
    ctx.store.recordExecutedCall(fingerprint, {
      toolName: toolCall.name,
      isWrite: getToolRisk(toolCall) === 'write',
      success,
      timestamp: Date.now(),
      source: 'engine',
    });

    results.push(section(toolCall, body));

    // ── Session-ending signals ─────────────────────────────────────────────

    // A handoff tool navigated the tab away from this conversation. Nothing left to
    // send results into, and no turn coming back — end here rather than staging a
    // reply on a page that is being torn down.
    if (success && isHandoffTool(toolCall.name)) {
      console.log(`[AgentLoop] Handoff to ${toolCall.name}, ending session`);
      ctx.store.setCurrentTool(null);
      ctx.finish('complete');
      return { kind: 'ended' };
    }

    const completion = parseCompleteTaskSignal(result);
    if (completion) {
      console.log(`[AgentLoop] Task explicitly ended (${completion.status}):`, completion.summary);
      ctx.store.addResult({
        toolName: 'complete_task',
        description: completion.summary,
        // "Cannot be done" is a legitimate verdict, but marking it successful would
        // paint the summary card green for a task that delivered nothing.
        success: completion.status !== 'infeasible',
        result: completion.summary,
        timestamp: Date.now(),
      });
      ctx.store.setCurrentTool(null);
      ctx.finish(completion.status === 'infeasible' ? 'infeasible' : 'complete');
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
 * A tripped breaker stops the round but does not throw the report away.
 *
 * The caller stages `results` in the composer and pauses, so the user sees what went
 * wrong and "Retry" hands the errors to the AI instead of restarting a wait for a
 * message that was never sent.
 */
function halt(ctx: LoopContext, results: string[], reason: string): ExecuteOutcome {
  ctx.store.setCurrentTool(null);
  return { kind: 'halted', results, reason };
}
