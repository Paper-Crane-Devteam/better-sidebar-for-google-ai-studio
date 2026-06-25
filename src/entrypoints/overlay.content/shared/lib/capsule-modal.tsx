/**
 * Capsule Helpers — Shared logic for creating clickable capsule elements
 * and showing their content in a modal.
 *
 * Used by:
 * - Input capsule click (AgentLoopFeature, SlashCommandFeature)
 * - User-query area capsule rendering (ConversationRenderer)
 */

import React from 'react';
import { useModalStore } from '@/shared/lib/modal';
import { createCapsuleElement, type CapsuleAttrs } from './quill-editor';

/**
 * Open a modal displaying capsule raw content.
 */
export function showCapsuleDetailModal(title: string, content: string): void {
  useModalStore.getState().open({
    type: 'info',
    title,
    content: (
      <pre className="text-xs whitespace-pre-wrap break-words font-mono leading-relaxed max-h-[400px] overflow-y-auto">
        {content}
      </pre>
    ),
    confirmText: 'Close',
    onConfirm: () => useModalStore.getState().close(),
    onCancel: () => {},
  });
}

/**
 * Create a <strong> capsule element with click-to-show-modal behavior.
 * Single function that encapsulates: create element + style + bind click.
 */
export function createClickableCapsule(
  displayText: string,
  attrs: CapsuleAttrs,
  detailContent: string,
): HTMLElement {
  const el = createCapsuleElement(displayText, attrs);
  el.style.cursor = 'pointer';
  el.addEventListener('click', () => {
    showCapsuleDetailModal(displayText, detailContent);
  });
  return el;
}
