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
import type { ParsedToolCall } from '../../types';

export { parseFromText as parseToolCallFromText };

export async function executeToolCallFn(parsed: ParsedToolCall): Promise<string> {
  const { executeToolCall } = await import('../../tools/tool-registry');
  return executeToolCall(parsed);
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
