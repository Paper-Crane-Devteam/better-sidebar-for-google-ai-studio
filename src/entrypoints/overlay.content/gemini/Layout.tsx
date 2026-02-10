/**
 * Gemini overlay layout: injects sidebar into bard-sidenav -> .sidenav-with-history-container
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { OverlayPanel } from './OverlayPanel';
import { ShadowRootProvider } from '@/shared/components/ShadowRootContext';
import { TooltipHelper } from '@/shared/lib/tooltip-helper';
import { applyShadowStyles } from '@/shared/lib/utils';
import { useSettingsStore } from '@/shared/lib/settings-store';
import { useAppStore } from '@/shared/lib/store';

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

export async function initGeminiOverlay(mainStyles: string): Promise<void> {
  console.log('Better Sidebar: Overlay (Gemini) Initialized');

  TooltipHelper.getInstance().initialize(mainStyles);

  try {
    // 0. Override bard-sidenav CSS variables based on density settings
    const bardSidenav = await waitForElement('bard-sidenav');
    const updateSidebarWidths = (density: 'compact' | 'relaxed') => {
      if (!bardSidenav) return;
      const el = bardSidenav as HTMLElement;
      if (density === 'compact') {
        el.style.setProperty('--bard-sidenav-closed-width', '55px');
        el.style.setProperty('--bard-sidenav-open-width', '345px');
      } else {
        // relaxed (default)
        el.style.setProperty('--bard-sidenav-closed-width', '63px');
        el.style.setProperty('--bard-sidenav-open-width', '360px');
      }
    };

    // Initial application
    const initialDensity = useSettingsStore.getState().layoutDensity;
    updateSidebarWidths(initialDensity);

    // Subscribe to changes
    useSettingsStore.subscribe((state) => {
      updateSidebarWidths(state.layoutDensity);
    });

    // 0.5. Monitor bard-sidenav width to detect open/close state
    if (bardSidenav) {
      const bardSidenavEl = bardSidenav as HTMLElement;
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const width = entry.contentRect.width;
          const closedWidthStr = getComputedStyle(bardSidenavEl)
            .getPropertyValue('--bard-sidenav-closed-width');
          const closedWidth = parseInt(closedWidthStr, 10) || 63;
          // If current width is greater than closed width + margin, sidebar is open
          const isSidebarOpen = width > closedWidth + 10;
          useAppStore.getState().setOverlayOpen(isSidebarOpen);
        }
      });
      resizeObserver.observe(bardSidenavEl);
    }

    // 1. Find the container
    // User specified: bard-sidenav .sidenav-with-history-container
    // We search for the class directly as it is likely unique and deep inside shadow roots.
    const container = await waitForElement('.sidenav-with-history-container');
    
    if (!container) {
        console.error('Better Sidebar: Failed to find .sidenav-with-history-container');
        return;
    }

    console.log('Better Sidebar: Found Gemini sidebar container', container);

    // 2. Prepare the container
    // User requirement: "put original content position absolute top left -9999px"
    
    const wrapperId = 'better-sidebar-for-google-ai-studio-sidebar-wrapper';
    
    // Check if we already injected (hmr support)
    if (container.querySelector(`#${wrapperId}`)) {
        return;
    }

    // Hide existing children by styling them
    // We cast children to HTMLElement to access style
    Array.from(container.children).forEach((child) => {
        if (child.id !== wrapperId) {
            const el = child as HTMLElement;
            el.style.position = 'absolute';
            el.style.top = '-9999px';
            el.style.left = '-9999px';
            // We don't set display: none because "some functions rely on inner things triggering click events"
        }
    });

    // Also hide .side-nav-menu-button if it exists (outside the container)
    waitForElement('.side-nav-menu-button').then((el) => {
        (el as HTMLElement).style.position = 'absolute';
        (el as HTMLElement).style.top = '-9999px';
        (el as HTMLElement).style.left = '-9999px';
    });
    // Also hide search-nav-button (Angular custom element) if it exists
    // Fire-and-forget: wait until the element is rendered, then hide it
    waitForElement('search-nav-button').then((el) => {
        (el as HTMLElement).style.display = 'none';
    });
    // Adjust top-bar-actions position (Angular custom element)
    waitForElement('top-bar-actions').then((el) => {
        (el as HTMLElement).style.left = '361px';
    });
    
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.id = wrapperId;
    wrapper.style.height = '100%';
    wrapper.style.width = '100%'; 
    
    container.appendChild(wrapper);

    // 3. Mount Shadow Root
    const shadow = wrapper.attachShadow({ mode: 'open' });
    applyShadowStyles(shadow, mainStyles);

    const rootContainer = document.createElement('div');
    rootContainer.classList.add('shadow-body');
    rootContainer.classList.add('theme-gemini');
    rootContainer.style.height = '100%'; // Ensure full height
    
    // Theme sync
    const syncTheme = () => {
        const isDark = document.body.classList.contains('dark-theme') || 
                       document.body.classList.contains('dark') ||
                       document.body.getAttribute('data-theme') === 'dark';
                       
        TooltipHelper.getInstance().setTheme(isDark);
        if (isDark) rootContainer.classList.add('dark');
        else rootContainer.classList.remove('dark');
    };
    syncTheme();
    
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'data-theme'],
    });

    shadow.appendChild(rootContainer);

    // 4. Render React App
    const root = ReactDOM.createRoot(rootContainer);
    root.render(
      <ShadowRootProvider container={rootContainer}>
        <div className="h-full w-full bg-background text-foreground">
          <OverlayPanel className="h-full" />
        </div>
      </ShadowRootProvider>
    );

  } catch (e) {
    console.error('Better Sidebar: Gemini overlay initialization failed', e);
  }
}
