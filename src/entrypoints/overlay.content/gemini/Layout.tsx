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
          const isSidebarExpanded = width > closedWidth + 10;
          
          useAppStore.getState().setSidebarExpanded(isSidebarExpanded);
        }
      });
      resizeObserver.observe(bardSidenavEl);
    }

    // 1. Find the container
    const container = await waitForElement('.sidenav-with-history-container');
    
    if (!container) {
        console.error('Better Sidebar: Failed to find .sidenav-with-history-container');
        return;
    }

    console.log('Better Sidebar: Found Gemini sidebar container', container);

    const wrapperId = 'better-sidebar-for-google-ai-studio-sidebar-wrapper';
    
    // Store references to elements we need to toggle
    const elements = {
        wrapper: null as HTMLElement | null,
        sideNavMenuBtn: null as HTMLElement | null,
        searchNavBtn: null as HTMLElement | null,
        topBarActions: null as HTMLElement | null,
        topBarActionsOriginalLeft: '' as string,
    };

    // Start looking for external elements
    waitForElement('.side-nav-menu-button').then(el => {
        elements.sideNavMenuBtn = el as HTMLElement;
        // Apply current state
        const enabled = useAppStore.getState().ui.overlay.isOpen;
        if (enabled) {
            (el as HTMLElement).style.position = 'absolute';
            (el as HTMLElement).style.top = '-9999px';
            (el as HTMLElement).style.left = '-9999px';
        }
    });

    waitForElement('search-nav-button').then(el => {
        elements.searchNavBtn = el as HTMLElement;
        const enabled = useAppStore.getState().ui.overlay.isOpen;
        if (enabled) {
            (el as HTMLElement).style.display = 'none';
        }
    });

    waitForElement('top-bar-actions').then(el => {
        elements.topBarActions = el as HTMLElement;
        elements.topBarActionsOriginalLeft = (el as HTMLElement).style.left;
        const enabled = useAppStore.getState().ui.overlay.isOpen;
        if (enabled) {
            (el as HTMLElement).style.left = '361px';
        }
    });


    // Function to update visibility/state based on enabled status
    const updateState = (enabled: boolean) => {
        // 1. Manage Wrapper
        if (enabled) {
            if (!elements.wrapper) {
                // Create wrapper if doesn't exist
                const wrapper = document.createElement('div');
                wrapper.id = wrapperId;
                wrapper.style.height = '100%';
                wrapper.style.width = '100%'; 
                
                container.appendChild(wrapper);
                elements.wrapper = wrapper;

                const shadow = wrapper.attachShadow({ mode: 'open' });
                applyShadowStyles(shadow, mainStyles);

                const rootContainer = document.createElement('div');
                rootContainer.classList.add('shadow-body');
                rootContainer.classList.add('theme-gemini');
                rootContainer.style.height = '100%';
                
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

                // Render React App
                const root = ReactDOM.createRoot(rootContainer);
                root.render(
                  <ShadowRootProvider container={rootContainer}>
                    <div className="h-full w-full bg-background text-foreground">
                      <OverlayPanel className="h-full" />
                    </div>
                  </ShadowRootProvider>
                );
            } else {
                elements.wrapper.style.display = 'block';
            }
        } else {
            if (elements.wrapper) {
                elements.wrapper.style.display = 'none';
            }
        }

        // 2. Hide/Show Original Elements (children of container)
        Array.from(container.children).forEach((child) => {
            if (child.id !== wrapperId) {
                const el = child as HTMLElement;
                if (enabled) {
                    el.style.position = 'absolute';
                    el.style.top = '-9999px';
                    el.style.left = '-9999px';
                } else {
                    el.style.position = '';
                    el.style.top = '';
                    el.style.left = '';
                }
            }
        });

        // 3. Update External Elements
        if (elements.sideNavMenuBtn) {
            if (enabled) {
                elements.sideNavMenuBtn.style.position = 'absolute';
                elements.sideNavMenuBtn.style.top = '-9999px';
                elements.sideNavMenuBtn.style.left = '-9999px';
            } else {
                elements.sideNavMenuBtn.style.position = '';
                elements.sideNavMenuBtn.style.top = '';
                elements.sideNavMenuBtn.style.left = '';
            }
        }

        if (elements.searchNavBtn) {
            if (enabled) {
                elements.searchNavBtn.style.display = 'none';
            } else {
                elements.searchNavBtn.style.display = '';
            }
        }

        if (elements.topBarActions) {
            if (enabled) {
                elements.topBarActions.style.left = '361px';
            } else {
                elements.topBarActions.style.left = elements.topBarActionsOriginalLeft;
            }
        }
    };

    // Initial state check
    updateState(useAppStore.getState().ui.overlay.isOpen);

    // Subscribe to state changes
    useAppStore.subscribe((state, prevState) => {
        if (state.ui.overlay.isOpen !== prevState.ui.overlay.isOpen) {
            updateState(state.ui.overlay.isOpen);
        }
    });

  } catch (e) {
    console.error('Better Sidebar: Gemini overlay initialization failed', e);
  }
}
