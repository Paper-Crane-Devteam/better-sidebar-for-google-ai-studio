/**
 * Skeleton overlay management during streaming.
 */

import { TOOL_CALL_TAG } from '../constants';

const SKELETON_OVERLAY_CLASS = 'bs-agent-skeleton-overlay';
const SKELETON_MARKER_ATTR = 'data-bs-skeleton';

export interface SkeletonEntry {
  modelResponse: HTMLElement;
  hiddenElements: HTMLElement[];
  overlayEl: HTMLElement;
  lastContent: string;
  stabilityTimer: ReturnType<typeof setTimeout> | null;
}

export { SKELETON_MARKER_ATTR };

export function showSkeleton(
  modelResp: HTMLElement,
  markdownEl: HTMLElement,
  skeletons: Map<HTMLElement, SkeletonEntry>,
): void {
  if (skeletons.has(modelResp)) return;

  const openTag = `<${TOOL_CALL_TAG}>`;
  const hiddenElements: HTMLElement[] = [];

  for (const child of markdownEl.children) {
    const el = child as HTMLElement;
    if (el.textContent?.includes(openTag)) {
      el.style.visibility = 'hidden';
      el.setAttribute(SKELETON_MARKER_ATTR, 'true');
      hiddenElements.push(el);
    }
  }

  if (hiddenElements.length === 0) return;

  const overlay = document.createElement('div');
  overlay.className = SKELETON_OVERLAY_CLASS;
  overlay.style.cssText = `
    position: relative;
    margin: 8px 0;
    border-radius: 8px;
    overflow: hidden;
    height: 48px;
    background: linear-gradient(90deg, 
      var(--skeleton-bg, rgba(128,128,128,0.08)) 25%, 
      var(--skeleton-shine, rgba(128,128,128,0.15)) 50%, 
      var(--skeleton-bg, rgba(128,128,128,0.08)) 75%
    );
    background-size: 200% 100%;
    animation: bs-skeleton-shimmer 1.5s ease-in-out infinite;
    border: 1px solid rgba(128,128,128,0.1);
  `;

  if (!document.getElementById('bs-skeleton-keyframes')) {
    const style = document.createElement('style');
    style.id = 'bs-skeleton-keyframes';
    style.textContent = `
      @keyframes bs-skeleton-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(style);
  }

  const lastHidden = hiddenElements[hiddenElements.length - 1];
  lastHidden.insertAdjacentElement('afterend', overlay);

  skeletons.set(modelResp, {
    modelResponse: modelResp,
    hiddenElements,
    overlayEl: overlay,
    lastContent: markdownEl.textContent || '',
    stabilityTimer: null,
  });
}

export function removeSkeleton(
  modelResp: HTMLElement,
  skeletons: Map<HTMLElement, SkeletonEntry>,
): void {
  const skeleton = skeletons.get(modelResp);
  if (!skeleton) return;

  for (const el of skeleton.hiddenElements) {
    el.style.visibility = '';
    el.removeAttribute(SKELETON_MARKER_ATTR);
  }
  skeleton.overlayEl.remove();
  if (skeleton.stabilityTimer) clearTimeout(skeleton.stabilityTimer);
  skeletons.delete(modelResp);
}

export function cleanupAllSkeletons(skeletons: Map<HTMLElement, SkeletonEntry>): void {
  for (const [, entry] of skeletons) {
    for (const el of entry.hiddenElements) {
      el.style.visibility = '';
      el.removeAttribute(SKELETON_MARKER_ATTR);
    }
    entry.overlayEl.remove();
    if (entry.stabilityTimer) clearTimeout(entry.stabilityTimer);
  }
  skeletons.clear();
}
