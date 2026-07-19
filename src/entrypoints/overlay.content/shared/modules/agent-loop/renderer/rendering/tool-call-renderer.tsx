/**
 * Stable rendering of tool call widgets inside shadow DOM.
 */

import ReactDOM from 'react-dom/client';
import mainStyles from '@/index.scss?inline';
import { applyShadowStyles } from '@/shared/lib/utils';
import { ShadowRootProvider } from '@/shared/components/ShadowRootContext';
import { TOOL_CALL_TAG, TOOL_CALL_RENDERED_CLASS, TOOL_CALL_ATTR } from '../constants';
import { SKELETON_MARKER_ATTR } from './skeleton';
import { syncDarkMode } from './dark-mode';
import { extractToolInfo } from '../helpers/tool-parser';
import { parseToolCallFromText, executeToolCallFn, fillResultToEditor } from '../helpers/tool-executor';
import { ToolCallWidget } from '../components/ToolCallWidget';

/**
 * Render tool call widgets into a model-response element using shadow DOM.
 * Returns the created React roots (for cleanup tracking).
 */
export function renderToolCalls(
  modelResp: HTMLElement,
  markdownEl: HTMLElement,
  allText: string,
): ReactDOM.Root[] {
  if (!allText.includes(`<${TOOL_CALL_TAG}>`)) return [];

  modelResp.classList.add(TOOL_CALL_RENDERED_CLASS);
  modelResp.setAttribute(TOOL_CALL_ATTR, 'true');

  const openTag = `<${TOOL_CALL_TAG}>`;
  const roots: ReactDOM.Root[] = [];
  let widgetIdx = 0;

  for (const child of Array.from(markdownEl.children)) {
    const candidate = child as HTMLElement;
    const text = candidate.textContent || '';
    if (!text.includes(openTag)) continue;

    const localRegex = new RegExp(`<${TOOL_CALL_TAG}>([\\s\\S]*?)<\\/${TOOL_CALL_TAG}>`, 'g');
    let localMatch: RegExpExecArray | null;
    const localToolCalls: Array<{ fullMatch: string; content: string }> = [];
    while ((localMatch = localRegex.exec(text)) !== null) {
      localToolCalls.push({ fullMatch: localMatch[0], content: localMatch[1].trim() });
    }

    if (localToolCalls.length === 0) continue;

    // Clear original content — shadow takes over rendering
    candidate.textContent = '';
    candidate.style.visibility = 'visible';
    candidate.removeAttribute(SKELETON_MARKER_ATTR);
    candidate.style.display = 'block';
    candidate.style.padding = '0';
    candidate.style.margin = '8px 0';

    // Reuse existing shadow root or create new one
    let shadow = candidate.shadowRoot;
    if (shadow) {
      shadow.innerHTML = '';
      applyShadowStyles(shadow, mainStyles);
    } else {
      shadow = candidate.attachShadow({ mode: 'open' });
      applyShadowStyles(shadow, mainStyles);
    }

    const rootContainer = document.createElement('div');
    rootContainer.className = 'shadow-body';
    shadow.appendChild(rootContainer);
    syncDarkMode(rootContainer);

    const reactRoot = ReactDOM.createRoot(rootContainer);
    roots.push(reactRoot);

    const widgets = localToolCalls.map((tc, i) => {
      const { toolName, description, query } = extractToolInfo(tc.fullMatch);
      return (
        <ToolCallWidget
          key={`${widgetIdx}-${i}`}
          toolName={toolName}
          description={description}
          query={query}
          rawText={tc.fullMatch}
          parseToolCall={parseToolCallFromText}
          executeToolCall={executeToolCallFn}
          fillResultToEditor={fillResultToEditor}
        />
      );
    });

    reactRoot.render(
      <ShadowRootProvider container={rootContainer}>
        <div className="py-1">{widgets}</div>
      </ShadowRootProvider>,
    );

    widgetIdx++;
  }

  return roots;
}
