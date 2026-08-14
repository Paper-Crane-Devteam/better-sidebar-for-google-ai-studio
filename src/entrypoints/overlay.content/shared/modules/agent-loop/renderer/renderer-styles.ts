/**
 * CSS for capsules in the Gemini editor (host page, no shadow DOM).
 *
 * Capsules are `<strong>` elements, so their appearance — bold text — comes from
 * the tag itself and from Gemini's own editor styles. All this adds is the click
 * affordance; the capsules are deliberately plain text, not pills.
 *
 * The conversation view is rendered by ConversationOverlay in the sidebar's
 * shadow DOM and themed via CSS variables, so it needs nothing here.
 */

const CAPSULE_STYLES = `
.bs-prompt-capsule {
  cursor: pointer;
}

.bs-agent-result-capsule {
  cursor: pointer;
}
`;

let injected = false;

/**
 * Inject capsule styles into the HOST page.
 */
export function injectRendererStyles(): void {
  if (injected) return;
  injected = true;

  const style = document.createElement('style');
  style.id = 'bs-agent-editor-capsule-styles';
  style.textContent = CAPSULE_STYLES;
  document.head.appendChild(style);
}
