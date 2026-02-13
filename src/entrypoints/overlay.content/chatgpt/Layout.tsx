/**
 * ChatGPT overlay layout: finds parent of #stage-slideover-sidebar, inserts custom sidebar as first child
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { OverlayPanel } from './OverlayPanel';
import { ShadowRootProvider } from '@/shared/components/ShadowRootContext';
import { TooltipHelper } from '@/shared/lib/tooltip-helper';
import { applyShadowStyles } from '@/shared/lib/utils';
import { useSettingsStore } from '@/shared/lib/settings-store';

const querySelectorDeep = (
  selector: string,
  root: Document | Element = document
): Element | null => {
  if (!root) return null;
  try {
    const found = root.querySelector(selector);
    if (found) return found;
  } catch (e) {}
  try {
    const allElements = root.querySelectorAll('*');
    for (const el of allElements) {
      try {
        if (el.shadowRoot) {
          const deepFound = querySelectorDeep(
            selector,
            el.shadowRoot as unknown as Element
          );
          if (deepFound) return deepFound;
        }
      } catch (e) {}
    }
  } catch (e) {}
  return null;
};

const waitForElement = (selector: string): Promise<Element> => {
  return new Promise((resolve) => {
    const check = () => {
      const el = querySelectorDeep(selector);
      if (el) resolve(el);
      else requestAnimationFrame(check);
    };
    check();
  });
};

export async function initChatGPTOverlay(mainStyles: string): Promise<void> {
  console.log('Better Sidebar: Overlay (ChatGPT) Initialized');

  TooltipHelper.getInstance().initialize(mainStyles);

  // Wait for ChatGPT's React to finish hydration before injecting our elements
  await new Promise<void>(resolve => {
    const waitForHydration = () => {
      if (document.readyState === 'complete') {
        // Use requestIdleCallback to wait for React hydration to complete
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => {
            // Add small delay after idle to ensure hydration is done
            setTimeout(resolve, 50);
          });
        } else {
          setTimeout(resolve, 150);
        }
      } else {
        window.addEventListener('load', waitForHydration, { once: true });
      }
    };
    waitForHydration();
  });

  // 1. Hide original sidebar
  const style = document.createElement('style');
  style.id = 'better-sidebar-for-google-ai-studio-chatgpt-sidebar-hider';
  style.textContent = `
    #stage-slideover-sidebar {
      display: none !important;
      position: absolute !important;
      left: -9999px !important;
      top: -9999px !important;
    }
  `;
  document.head.appendChild(style);

  try {
    const originalSidebar = await waitForElement('#stage-slideover-sidebar');
    (originalSidebar as HTMLElement).style.display = 'none';
    (originalSidebar as HTMLElement).style.position = 'absolute';
    (originalSidebar as HTMLElement).style.left = '-9999px';
  } catch (e) {
    console.error('Better Sidebar: Failed to find #stage-slideover-sidebar', e);
  }

  // 2. Inject custom sidebar as first child of parent
  const originalSidebar = await waitForElement('#stage-slideover-sidebar');
  const parent = originalSidebar.parentElement;
  
  if (!parent) {
    console.error('Better Sidebar: Failed to find parent of #stage-slideover-sidebar');
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.id = 'better-sidebar-for-google-ai-studio-sidebar-wrapper';
  
  // Mark the element to prevent ChatGPT's React from trying to hydrate it
  // These attributes tell React this is an independent React root
  wrapper.setAttribute('data-reactroot', '');
  wrapper.setAttribute('data-react-root', 'independent');
  
  // Insert using requestAnimationFrame to ensure it happens after React's render cycle
  await new Promise<void>(resolve => {
    requestAnimationFrame(() => {
      parent.insertBefore(wrapper, parent.firstChild);
      resolve();
    });
  });

  // TODO: Sync sidebar collapse state if needed

  const sidebarStyle = document.createElement('style');
  sidebarStyle.id = 'better-sidebar-for-google-ai-studio-sidebar-styles';
  
  // Function to update sidebar width based on layout density
  const updateSidebarWidth = (density: 'compact' | 'relaxed') => {
    const width = density === 'compact' ? '300px' : '320px';
    sidebarStyle.textContent = `
      #better-sidebar-for-google-ai-studio-sidebar-wrapper {
        height: 100%;
        width: ${width};
        flex-shrink: 0;
        box-sizing: border-box;
        transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        overflow: hidden;
        z-index: 999;
        background: var(--background, #fff);
      }
      #better-sidebar-for-google-ai-studio-sidebar-wrapper.collapsed {
        width: 0px;
      }
      @media screen and (max-width: 960px) {
        #better-sidebar-for-google-ai-studio-sidebar-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          height: 100vh;
          box-shadow: 2px 0 8px rgba(0,0,0,0.1);
        }
      }
    `;
  };

  // Initial width based on current density
  updateSidebarWidth(useSettingsStore.getState().layoutDensity);
  document.head.appendChild(sidebarStyle);

  // Subscribe to density changes
  useSettingsStore.subscribe((state) => {
    updateSidebarWidth(state.layoutDensity);
  });

  const shadow = wrapper.attachShadow({ mode: 'open' });
  applyShadowStyles(shadow, mainStyles);

  const rootContainer = document.createElement('div');
  rootContainer.classList.add('shadow-body');
  rootContainer.classList.add('theme-chatgpt');
  
  // Ensure container is completely empty to avoid hydration warnings
  rootContainer.innerHTML = '';

  const syncTheme = () => {
    // TODO: Detect ChatGPT theme (light/dark)
    const isDark = document.documentElement.classList.contains('dark');
    TooltipHelper.getInstance().setTheme(isDark);
    if (isDark) rootContainer.classList.add('dark');
    else rootContainer.classList.remove('dark');
  };
  syncTheme();
  const observer = new MutationObserver(syncTheme);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  shadow.appendChild(rootContainer);

  // Use requestAnimationFrame to ensure React renders after ChatGPT's React is done
  // This prevents hydration errors from ChatGPT's React interfering
  requestAnimationFrame(() => {
    // Temporarily suppress hydration warnings caused by ChatGPT's React
    const originalError = console.error;
    console.error = (...args: any[]) => {
      if (
        typeof args[0] === 'string' &&
        (args[0].includes('Hydration failed') ||
          args[0].includes('server rendered HTML') ||
          args[0].includes('hydration'))
      ) {
        return;
      }
      originalError.apply(console, args);
    };

    const root = ReactDOM.createRoot(rootContainer);
    root.render(
      <ShadowRootProvider container={rootContainer}>
        <div 
          className="h-full w-full bg-background border-r text-foreground"
          suppressHydrationWarning
        >
          <OverlayPanel className="h-full" />
        </div>
      </ShadowRootProvider>
    );

    // Restore console.error after a delay
    setTimeout(() => {
      console.error = originalError;
    }, 1000);
  });
}
