/**
 * Tool execution and result filling utilities.
 */

import {
  getEditor as quillGetEditor,
  appendCapsule,
  buildResultCapsuleText,
  RESULT_CAPSULE_CLASS,
  RESULT_CAPSULE_ATTR_CONTENT,
} from '@/entrypoints/overlay.content/shared/lib/quill-editor';
import { parseToolCallFromText as parseFromText } from './tool-parser';
import { useAgentLoopStore } from '../../agent-loop-store';
import { buildToolCallFingerprint, isWriteOperation } from '../../execution-policy';
import type { ParsedToolCall } from '../../types';

export { parseFromText as parseToolCallFromText };

export async function executeToolCallFn(parsed: ParsedToolCall): Promise<string> {
  const { executeToolCall } = await import('../../tools/tool-registry');
  const result = await executeToolCall(parsed);

  // Claim the call so neither this button nor the engine repeats it
  useAgentLoopStore.getState().recordExecutedCall(buildToolCallFingerprint(parsed), {
    toolName: parsed.name,
    isWrite: isWriteOperation(parsed),
    success: !result.startsWith('ERROR:') && !result.startsWith('CANCELLED:'),
    timestamp: Date.now(),
    source: 'manual',
  });

  return result;
}

export function fillResultToEditor(toolName: string, result: string): void {
  const editor = quillGetEditor();
  if (!editor) return;

  const content = `### ${toolName}\n${result}`;
  const displayText = buildResultCapsuleText(toolName);

  appendCapsule(editor, displayText, {
    className: RESULT_CAPSULE_CLASS,
    dataAttrs: { [RESULT_CAPSULE_ATTR_CONTENT]: content },
    nonEditable: true,
  });
}
