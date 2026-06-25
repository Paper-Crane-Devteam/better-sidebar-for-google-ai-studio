/**
 * CSS for capsules in the Gemini editor and conversation view (host page, no shadow DOM).
 * All capsules share the same <strong> + class approach.
 */

const CAPSULE_STYLES = `
/* ─── Editor input capsules ─────────────────────────────────────────────── */
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
  cursor: pointer;
}

html[dark] .bs-agent-capsule {
  background: rgba(138, 180, 248, 0.15);
  color: #8ab4f8;
  border-color: rgba(138, 180, 248, 0.3);
}

/* ─── Conversation view capsules (rendered in user-query / model-response) ─ */
.bs-conv-capsule {
  display: inline;
  cursor: pointer;
  font-weight: 600;
  color: #1a73e8;
}

.bs-conv-capsule:hover {
  text-decoration: underline;
}

html[dark] .bs-conv-capsule {
  color: #8ab4f8;
}

/* Tool call capsule in model responses — emerald accent */
.bs-conv-tool-capsule {
  display: inline;
  cursor: pointer;
  font-weight: 600;
  color: #137333;
}

.bs-conv-tool-capsule:hover {
  text-decoration: underline;
}

html[dark] .bs-conv-tool-capsule {
  color: #81c995;
}

/* Executing state */
.bs-conv-tool-capsule[data-executing="true"] {
  opacity: 0.6;
  cursor: wait;
}

/* Error state — brief flash */
.bs-conv-tool-capsule[data-error="true"] {
  color: #c5221f;
}

html[dark] .bs-conv-tool-capsule[data-error="true"] {
  color: #f28b82;
}

/* Container for conversation capsules replacing hidden original text */
.bs-conv-capsule-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 4px 0;
}
`;

let injected = false;

/**
 * Inject capsule styles into the HOST page.
 * Covers both editor capsules and conversation view capsules.
 */
export function injectRendererStyles(): void {
  if (injected) return;
  injected = true;

  const style = document.createElement('style');
  style.id = 'bs-agent-editor-capsule-styles';
  style.textContent = CAPSULE_STYLES;
  document.head.appendChild(style);
}
