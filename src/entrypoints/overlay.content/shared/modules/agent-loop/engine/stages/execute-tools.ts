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

import type { AgentQuestion, ParsedToolCall } from '../../types';
import type { LoopContext } from '../context';
import { executeToolCall } from '../../tools/tool-registry';
import { parseCompleteTaskSignal } from '../../tools/complete-task';
import { parseAskUserSignal } from '../../tools/ask-user';
import { buildToolCallFingerprint, getToolRisk, requiresApproval } from '../../execution-policy';
import { AUTO_APPROVED, requestApproval } from './approval-gate';

export type ExecuteOutcome =
  /** Round finished; feed these sections back to the AI */
  | { kind: 'results'; results: string[] }
  /**
   * The AI needs an answer before it can continue. `results` are the sections
   * produced before the question and still owe the AI a delivery — they travel with
   * the answer, or get carried into the next round if the user replies natively.
   */
  | { kind: 'awaiting-user'; question: AgentQuestion; results: string[] }
  /** Session is over (complete / paywall / circuit breaker) — already reported */
  | { kind: 'ended' };

/** A tool result that starts with either prefix counts as a failure */
function isSuccess(result: string): boolean {
  return !result.startsWith('ERROR:') && !result.startsWith('CANCELLED:');
}

function section(toolCall: ParsedToolCall, body: string): string {
  return `### ${toolCall.description || toolCall.name}\n${body}`;
}

/** What `ask_user` reports in place of its sentinel, for the AI and the step list */
function describeQuestion(question: AgentQuestion): string {
  const options = question.options.length > 0 ? ` Options offered: ${question.options.join(' / ')}.` : '';
  return `Question put to the user.${options} Their answer follows under "User Response".`;
}

export async function executeTools(
  ctx: LoopContext,
  toolCalls: ParsedToolCall[],
): Promise<ExecuteOutcome> {
  ctx.setStatus('executing');
  const results: string[] = [];

  for (const [index, toolCall] of toolCalls.entries()) {
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
          `Do not retry it unchanged — address the objection, or use ask_user to find out what they want.`
        : `CANCELLED: The user rejected this operation without giving a reason.\n` +
          `Do not retry it unchanged — use ask_user to find out what they want instead.`;

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

    const startedAt = Date.now();
    const result = await executeToolCall(toolCall);
    const success = isSuccess(result);
    const question = parseAskUserSignal(result);

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
    // The raw sentinel would be meaningless to both the AI and the step list
    let body = question ? describeQuestion(question) : result;

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

    // Recorded so the call's card in the chat can show what became of it
    ctx.store.recordExecutedCall(fingerprint, {
      toolName: toolCall.name,
      isWrite: getToolRisk(toolCall) === 'write',
      success,
      timestamp: Date.now(),
      source: 'engine',
    });

    results.push(section(toolCall, body));

    // ── Round-ending signal: the AI needs the user ─────────────────────────
    if (question) {
      // Anything queued after the question contradicts having asked it, so it is
      // dropped — and said out loud, since silently skipping work would leave the
      // AI assuming it happened.
      const skipped = toolCalls.slice(index + 1);
      if (skipped.length > 0) {
        console.warn(`[AgentLoop] Skipping ${skipped.length} call(s) queued after ask_user`);
        results.push(
          `### ⏭️ Not executed\n` +
            `${skipped.length} tool call(s) after ask_user were skipped: ` +
            `${skipped.map((c) => c.name).join(', ')}. ` +
            `ask_user must be the last call in a response — re-issue them once you have the answer.`,
        );
      }

      ctx.store.setCurrentTool(null);
      return { kind: 'awaiting-user', question, results };
    }

    // ── Session-ending signals ─────────────────────────────────────────────
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
 * A tripped breaker pauses rather than sending: the accumulated results stay
 * visible in the tab so the user can see what went wrong before deciding to retry.
 */
function breakCircuit(ctx: LoopContext): ExecuteOutcome {
  ctx.store.setCurrentTool(null);
  ctx.pauseAndEnd('Circuit breaker triggered. Please review the issue above.', 'circuit_breaker');
  return { kind: 'ended' };
}
