/**
 * Additional CSS for the renderer's shadow DOM widgets.
 * This is combined with mainStyles and injected into each shadow root.
 *
 * Only covers the editor capsules (injected into host page) since those
 * are NOT in a shadow root — they live in Gemini's contenteditable.
 */

/**
 * CSS injected into each shadow root (alongside mainStyles/Tailwind).
 * Minimal — just overrides needed on top of Tailwind.
 */
export const RENDERER_CSS = `
  .shadow-body {
    font-family: 'Google Sans', 'Roboto', sans-serif;
  }
`;

/**
 * CSS for capsules in the Gemini editor (host page, no shadow DOM).
 * Must be self-contained since the editor is outside our shadow roots.
 */
const EDITOR_CAPSULE_STYLES = `
.bs-prompt-capsule {
  cursor: pointer;
}

.bs-agent-capsule {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 9999px;
  background: rgba(66, 133, 244, 0.12);
  color: #1a73e8;
  font-weight: 500;
  font-size: 13px;
  user-select: none;
  pointer-events: none;
  vertical-align: baseline;
  margin-right: 4px;
  border: 1px solid rgba(66, 133, 244, 0.25);
  line-height: 1.4;
}

.bs-agent-result-capsule {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 9999px;
  background: rgba(52, 168, 83, 0.12);
  color: #1e8e3e;
  font-weight: 500;
  font-size: 13px;
  user-select: none;
  cursor: pointer;
  vertical-align: baseline;
  margin-right: 4px;
  border: 1px solid rgba(52, 168, 83, 0.25);
  line-height: 1.4;
}

html[dark] .bs-agent-capsule {
  background: rgba(138, 180, 248, 0.15);
  color: #8ab4f8;
  border-color: rgba(138, 180, 248, 0.3);
}

html[dark] .bs-agent-result-capsule {
  background: rgba(129, 201, 149, 0.15);
  color: #81c995;
  border-color: rgba(129, 201, 149, 0.3);
}
`;

let injected = false;

/**
 * Inject editor capsule styles into the HOST page (for Quill editor capsules).
 * Shadow DOM widgets get their styles via applyShadowStyles in each mount.
 */
export function injectRendererStyles(): void {
  if (injected) return;
  injected = true;

  const style = document.createElement('style');
  style.id = 'bs-agent-editor-capsule-styles';
  style.textContent = EDITOR_CAPSULE_STYLES;
  document.head.appendChild(style);
}
