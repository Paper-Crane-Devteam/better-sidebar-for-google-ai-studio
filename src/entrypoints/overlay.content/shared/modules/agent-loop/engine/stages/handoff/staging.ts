/**
 * Putting the results into the chat input.
 *
 * The only place in the engine that touches the composer's DOM, and the messiest
 * part of the whole loop — Quill keeps its own document model, so a write that
 * looks fine in the DOM may never register.
 *
 * Two shapes, and the difference matters downstream:
 * - **capsule** (preferred) — one collapsed chip per tool result, with the payload
 *   in a data attribute. The send-button interceptor merges them into a single
 *   `<bs_agent_result>` block on the way out.
 * - **text** (fallback) — the wrapped payload dumped in as plain text.
 *
 * The fallback exists because a failed capsule write left the composer *empty*, and
 * Gemini renders no send button at all when the input is empty. That surfaced as a
 * baffling "could not find send button", so staging now verifies its own work and
 * degrades to something ugly but sendable.
 */

import {
  buildResultCapsuleText,
  insertMultipleCapsules,
  RESULT_CAPSULE_ATTR_CONTENT,
  RESULT_CAPSULE_CLASS,
} from '@/entrypoints/overlay.content/shared/lib/quill-editor';
import type { CapsuleAttrs } from '@/entrypoints/overlay.content/shared/lib/quill-editor';
import type { AgentPlatformAdapter } from '../../../adapters/types';
import { RESULT_OPEN_TAG, splitSections, wrapForAI } from './formatter';

/** How the payload currently sits in the editor */
export type StagedShape = 'capsule' | 'text';

function toCapsule(label: string, content: string): { displayText: string; attrs: CapsuleAttrs } {
  return {
    displayText: buildResultCapsuleText(label),
    attrs: {
      className: RESULT_CAPSULE_CLASS,
      dataAttrs: { [RESULT_CAPSULE_ATTR_CONTENT]: content },
      nonEditable: true,
    },
  };
}

/**
 * Stage `resultText` in the composer and report which shape it ended up in, so the
 * send watcher knows what to look for.
 */
export async function stageResults(
  adapter: AgentPlatformAdapter,
  resultText: string,
): Promise<StagedShape> {
  const editor = adapter.getEditor();
  if (!editor) {
    console.warn('[AgentLoop] Editor not found, inserting raw text');
    adapter.insertText(wrapForAI(resultText));
    return 'text';
  }

  const sections = splitSections(resultText);
  const capsules =
    sections.length > 0
      ? // Per-tool capsules; the interceptor wraps the merged content on send
        sections.map((s) => toCapsule(s.label, s.content))
      : // No recognisable structure — one capsule carrying the whole payload
        [toCapsule('Tool Results', wrapForAI(resultText))];

  // Must be awaited: capsules only exist in the DOM after the rAF wrap. Arming the
  // send watcher before that made it see a capsule-free editor and resolve
  // immediately, so the round advanced without anything being sent.
  await insertMultipleCapsules(editor, capsules);

  if (editor.querySelector(`.${RESULT_CAPSULE_CLASS}`)) return 'capsule';

  console.warn('[AgentLoop] Capsule staging failed, falling back to plain text', {
    editorTextLength: (editor.textContent || '').length,
    capsulesRequested: capsules.length,
  });
  adapter.insertText(wrapForAI(resultText));
  return 'text';
}

/**
 * Whether the composer still holds unsent results.
 *
 * Shape-aware on purpose: checking for capsules while the fallback is active would
 * report "already sent" on the very first DOM mutation.
 */
export function isStaged(editor: HTMLElement | null, shape: StagedShape): boolean {
  if (!editor) return false;
  if (shape === 'capsule') return !!editor.querySelector(`.${RESULT_CAPSULE_CLASS}`);
  return (editor.textContent || '').includes(RESULT_OPEN_TAG);
}
