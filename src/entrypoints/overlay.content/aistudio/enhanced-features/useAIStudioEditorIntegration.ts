/**
 * useAIStudioEditorIntegration — Editor integration for AI Studio's textarea.
 *
 * AI Studio uses a plain Angular-controlled <textarea> (not a contenteditable).
 * This hook provides:
 * - Input event listening for trigger char detection
 * - Keyboard navigation (↑↓ Enter Tab Escape)
 * - MutationObserver to handle SPA navigation (textarea re-creation)
 * - Popup positioning relative to the textarea
 *
 * No capsule support — AI Studio's textarea is plain text only.
 * Content is expanded inline immediately on selection.
 */

import { useEffect, useRef, useState } from 'react';
import type { TriggerPopupState } from '@/entrypoints/overlay.content/shared/features/trigger-popup/types';

export interface PopupPosition {
  bottom: number;
  left: number;
}

export interface AIStudioEditorIntegrationConfig {
  /** Get the textarea element */
  getTextarea: () => HTMLTextAreaElement | null;
  /** Whether the feature is enabled */
  enabled: boolean;
  /** The trigger character (e.g. '/') */
  triggerChar: string;
  /** Called with (text, cursorPos) on input */
  onInput: (text: string, cursorPos: number) => void;
  /** Get current popup state */
  getPopupState: () => TriggerPopupState;
  /** Keyboard handlers */
  selectPrevious: () => void;
  selectNext: () => void;
  close: () => void;
  /** Called when user confirms selection via Enter/Tab */
  onConfirmSelection: () => void;
}

export function useAIStudioEditorIntegration(config: AIStudioEditorIntegrationConfig) {
  const [popupPosition, setPopupPosition] = useState<PopupPosition>({ bottom: 0, left: 0 });

  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    console.log('[AIStudio SlashCommand] effect run, enabled =', configRef.current.enabled);
    if (!configRef.current.enabled) {
      configRef.current.close();
      return;
    }

    let currentTextarea: HTMLTextAreaElement | null = null;

    const onInput = () => {
      const textarea = configRef.current.getTextarea();
      if (!textarea) return;

      const text = textarea.value;
      const cursorPos = textarea.selectionStart;

      console.log('[AIStudio SlashCommand] input', { text, cursorPos });

      configRef.current.onInput(text, cursorPos);

      // Update popup position based on textarea location
      const rect = textarea.getBoundingClientRect();
      setPopupPosition({
        bottom: window.innerHeight - rect.top + 8,
        left: Math.max(rect.left, 16),
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const state = configRef.current.getPopupState();

      if (!state.isOpen) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          configRef.current.selectPrevious();
          return;
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          configRef.current.selectNext();
          return;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          e.stopPropagation();
          configRef.current.onConfirmSelection();
          return;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          configRef.current.close();
          return;
      }
    };

    const onBlur = () => {
      // Delay to allow popup click events to fire before closing
      setTimeout(() => {
        if (configRef.current.getPopupState().isOpen) {
          configRef.current.close();
        }
      }, 300);
    };

    // Also listen to selectionchange for cursor movement without typing
    // (e.g. clicking to a different position in the textarea)
    const onSelectionChange = () => {
      const textarea = configRef.current.getTextarea();
      if (!textarea || document.activeElement !== textarea) return;

      // Only process if popup is open — no need to re-trigger detection
      // on every cursor move
      if (configRef.current.getPopupState().isOpen) {
        const text = textarea.value;
        const cursorPos = textarea.selectionStart;
        configRef.current.onInput(text, cursorPos);
      }
    };

    const attachListeners = (textarea: HTMLTextAreaElement) => {
      textarea.addEventListener('input', onInput);
      textarea.addEventListener('keydown', onKeyDown, true);
      textarea.addEventListener('blur', onBlur);
      document.addEventListener('selectionchange', onSelectionChange);
    };

    const detachListeners = (textarea: HTMLTextAreaElement) => {
      textarea.removeEventListener('input', onInput);
      textarea.removeEventListener('keydown', onKeyDown, true);
      textarea.removeEventListener('blur', onBlur);
      document.removeEventListener('selectionchange', onSelectionChange);
    };

    // Attach to existing textarea
    currentTextarea = configRef.current.getTextarea();
    console.log('[AIStudio SlashCommand] initial textarea =', currentTextarea);
    if (currentTextarea) {
      attachListeners(currentTextarea);
    }

    // Watch for textarea appearing/changing (SPA navigation, Angular re-render)
    const bodyObserver = new MutationObserver(() => {
      const textarea = configRef.current.getTextarea();
      if (textarea && textarea !== currentTextarea) {
        console.log('[AIStudio SlashCommand] textarea changed, re-attaching', textarea);
        if (currentTextarea) detachListeners(currentTextarea);
        currentTextarea = textarea;
        attachListeners(textarea);
      }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (currentTextarea) detachListeners(currentTextarea);
      bodyObserver.disconnect();
    };
  }, [config.enabled]);

  return { popupPosition };
}
