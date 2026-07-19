/**
 * User query detection and rendering handler.
 *
 * Detects agent loop prompt markers and result tags in user-query elements,
 * renders them as clickable capsules.
 */

import { createClickableCapsule } from '@/entrypoints/overlay.content/shared/lib/capsule-modal';
import {
  buildPromptCapsuleText,
  buildResultCapsuleText,
  CAPSULE_CLASS,
  CAPSULE_ATTR_CONTENT,
  RESULT_CAPSULE_CLASS,
  RESULT_CAPSULE_ATTR_CONTENT,
} from '@/entrypoints/overlay.content/shared/lib/quill-editor';
import {
  PROMPT_MARKER_PREFIX,
  PROMPT_RENDERED_CLASS,
  PROMPT_ID_ATTR,
  RESULT_TAG,
  extractPromptId,
} from '../constants';
import { getBuiltInPromptById } from '../../prompts/built-in-registry';

/**
 * Attempt to render a user-query element.
 * Returns true if handled (either rendered or determined not to be our content).
 */
export function tryRenderUserQuery(el: HTMLElement): boolean {
  const textLines = el.querySelectorAll('.query-text-line');
  if (textLines.length === 0) return false;

  const firstLine = textLines[0]?.textContent?.trim() || '';
  const fullText = Array.from(textLines).map((l) => l.textContent || '').join('\n');

  const hasPromptMarker = firstLine.startsWith(PROMPT_MARKER_PREFIX);
  const hasResult = fullText.includes(`<${RESULT_TAG}>`);

  if (!hasPromptMarker && !hasResult) return true; // Not our content, skip

  el.classList.add(PROMPT_RENDERED_CLASS);

  if (hasPromptMarker) {
    renderPromptUserQuery(el, textLines, fullText);
  } else {
    renderResultUserQuery(el, textLines, fullText);
  }
  return true;
}

/**
 * Detect if a previously-rendered user-query has lost its rendering
 * (Angular rebuilt the element, visible .query-text-line with raw markers).
 */
export function hasLostUserQueryRendering(el: HTMLElement): boolean {
  const textLines = el.querySelectorAll('.query-text-line');
  for (const line of textLines) {
    const htmlEl = line as HTMLElement;
    if (htmlEl.style.display !== 'none') {
      const text = htmlEl.textContent?.trim() || '';
      if (text.startsWith(PROMPT_MARKER_PREFIX) || text.includes(`<${RESULT_TAG}>`)) {
        return true;
      }
    }
  }
  return false;
}

// ─── Private Render Methods ──────────────────────────────────────────────────

function renderPromptUserQuery(
  el: HTMLElement,
  textLines: NodeListOf<Element>,
  fullText: string,
): void {
  const firstLine = textLines[0]?.textContent?.trim() || '';
  const promptId = extractPromptId(firstLine);
  if (!promptId) return;

  el.setAttribute(PROMPT_ID_ATTR, promptId);
  const prompt = getBuiltInPromptById(promptId);
  const title = prompt?.title || promptId;

  const userRequestSeparator = '## User Request';
  const separatorIdx = fullText.indexOf(userRequestSeparator);

  let capsuleContent: string;
  let userText: string | null = null;

  if (separatorIdx !== -1) {
    capsuleContent = fullText.slice(0, separatorIdx).trim();
    userText = fullText.slice(separatorIdx + userRequestSeparator.length).trim();
  } else {
    capsuleContent = fullText;
  }

  textLines.forEach((line) => {
    (line as HTMLElement).style.display = 'none';
  });

  const insertTarget = textLines[0]?.parentElement || el;

  const displayText = buildPromptCapsuleText(title);
  const capsuleEl = createClickableCapsule(displayText, {
    className: CAPSULE_CLASS,
    dataAttrs: { [CAPSULE_ATTR_CONTENT]: capsuleContent } as Record<string, string>,
    nonEditable: true,
  }, capsuleContent);

  const wrapper = document.createElement('div');
  wrapper.appendChild(capsuleEl);

  if (userText) {
    const userTextEl = document.createElement('div');
    userTextEl.className = 'query-text-line';
    userTextEl.textContent = userText;
    wrapper.appendChild(userTextEl);
  }

  insertTarget.insertBefore(wrapper, insertTarget.firstChild);
}

function renderResultUserQuery(
  el: HTMLElement,
  textLines: NodeListOf<Element>,
  fullText: string,
): void {
  textLines.forEach((line) => {
    (line as HTMLElement).style.display = 'none';
  });

  const insertTarget = textLines[0]?.parentElement || el;
  const wrapper = document.createElement('div');

  const resultRegex = new RegExp(
    `<${RESULT_TAG}>([\\s\\S]*?)<\\/${RESULT_TAG}>`,
    'g',
  );

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = resultRegex.exec(fullText)) !== null) {
    const beforeText = fullText.slice(lastIndex, match.index).trim();
    if (beforeText) {
      const textEl = document.createElement('div');
      textEl.className = 'query-text-line';
      textEl.textContent = beforeText;
      wrapper.appendChild(textEl);
    }

    const resultContent = match[1].trim();
    const headingMatch = resultContent.match(/^### (.+)/m);
    const label = headingMatch ? headingMatch[1].trim() : 'Tool Result';

    const displayText = buildResultCapsuleText(label);
    const capsuleEl = createClickableCapsule(displayText, {
      className: RESULT_CAPSULE_CLASS,
      dataAttrs: { [RESULT_CAPSULE_ATTR_CONTENT]: resultContent } as Record<string, string>,
      nonEditable: true,
    }, resultContent);
    wrapper.appendChild(capsuleEl);

    lastIndex = match.index + match[0].length;
  }

  const afterText = fullText.slice(lastIndex).trim();
  if (afterText) {
    const textEl = document.createElement('div');
    textEl.className = 'query-text-line';
    textEl.textContent = afterText;
    wrapper.appendChild(textEl);
  }

  insertTarget.insertBefore(wrapper, insertTarget.firstChild);
}
