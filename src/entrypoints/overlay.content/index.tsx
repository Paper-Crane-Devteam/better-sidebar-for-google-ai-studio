import React from 'react';
import ReactDOM from 'react-dom/client';
import { OverlayPanel } from './OverlayPanel';
import mainStyles from '@/index.css?inline';
import { ShadowRootProvider } from '@/shared/components/ShadowRootContext';
import { TooltipHelper } from '@/shared/lib/tooltip-helper';
import { applyShadowStyles } from '@/shared/lib/utils';
import '@/locale/i18n';

export default defineContentScript({
  matches: ['https://aistudio.google.com/*'],
  cssInjectionMode: 'ui',
  async main() {
    console.log('Better Sidebar for Google AI Studio: Overlay Content Script Initialized');

    // Initialize tooltip container with styles
    TooltipHelper.getInstance().initialize(mainStyles);

    // Utility to find element across Open Shadow DOMs
    const querySelectorDeep = (selector: string, root: Document | Element = document): Element | null => {
        if (!root) return null;
        
        // 1. Try direct query
        try {
            const found = root.querySelector(selector);
            if (found) return found;
        } catch (e) {
            // Ignore query errors
        }

        // 2. Traverse Shadow Roots of all children
        // Use try-catch for Xray wrapper protection in Firefox
        try {
            const allElements = root.querySelectorAll('*');
            for (const el of allElements) {
                try {
                     // In Firefox, accessing shadowRoot on some elements via Xray might throw
                     if (el.shadowRoot) {
                        const deepFound = querySelectorDeep(selector, el.shadowRoot as unknown as Element);
                        if (deepFound) return deepFound;
                    }
                } catch (e) {
                    // Ignore inaccessible shadow roots
                }
            }
        } catch (e) {
            // Ignore traversal errors
        }
        return null;
    };

    // Helper to wait for element (handling Shadow DOM)
    const waitForElement = (selector: string): Promise<Element> => {
        return new Promise((resolve) => {
            const check = () => {
                const el = querySelectorDeep(selector);
                if (el) {
                    resolve(el);
                } else {
                    requestAnimationFrame(check);
                }
            };
            check();
        });
    };

    // 1. Hide Navbar
    const hideNavbar = async () => {
        // Global CSS
        const style = document.createElement('style');
        style.id = 'prompt-manager-for-google-ai-studio-navbar-hider';
        style.textContent = `
          ms-navbar {
            display: none !important;
            position: absolute !important;
            left: -9999px !important;
            top: -9999px !important;
          }
        `;
        document.head.appendChild(style);

        // Find and hide directly (in case of Shadow DOM encapsulation)
        try {
            console.log('Better Sidebar for Google AI Studio: Looking for ms-navbar...');
            const navbar = await waitForElement('ms-navbar');
            console.log('Better Sidebar for Google AI Studio: Found ms-navbar, hiding it.');
            (navbar as HTMLElement).style.display = 'none';
            (navbar as HTMLElement).style.position = 'absolute';
            (navbar as HTMLElement).style.left = '-9999px';
        } catch (e) {
            console.error('Better Sidebar for Google AI Studio: Failed to find ms-navbar', e);
        }
    };

    hideNavbar();

    // 2. Inject SidePanel
    console.log('Better Sidebar for Google AI Studio: Waiting for .makersuite-layout...');
    const anchor = await waitForElement('.makersuite-layout');
    console.log('Better Sidebar for Google AI Studio: Found .makersuite-layout', anchor);

    const wrapper = document.createElement('div');
    wrapper.id = 'prompt-manager-for-google-ai-studio-sidebar-wrapper';
    // Styles handled via injected CSS for transitions and media queries
    
    // Insert as first child
    anchor.insertBefore(wrapper, anchor.firstChild);

    // Sync wrapper width with ms-navbar state
    const syncSidebarWithNavbar = async () => {
        try {
            console.log('Better Sidebar for Google AI Studio: Waiting for ms-navbar to sync...');
            const navbar = await waitForElement('ms-navbar');
            const firstChild = navbar.firstElementChild;
            
            if (!firstChild) {
                 console.warn('Better Sidebar for Google AI Studio: ms-navbar has no first child');
                 return;
            }

            const updateState = () => {
                const isCollapsed = firstChild.classList.contains('collapsed');
                if (isCollapsed) {
                    wrapper.classList.add('collapsed');
                } else {
                    wrapper.classList.remove('collapsed');
                }
            };

            const observer = new MutationObserver(updateState);
            observer.observe(firstChild, { attributes: true, attributeFilter: ['class'] });
            
            // Initial check
            updateState();
            console.log('Better Sidebar for Google AI Studio: Navbar sync initialized');
            
        } catch (e) {
            console.error('Better Sidebar for Google AI Studio: Failed to sync with navbar', e);
        }
    };
    
    syncSidebarWithNavbar();

    // Add Styles
    const style = document.createElement('style');
    style.id = 'prompt-manager-for-google-ai-studio-sidebar-styles';
    style.textContent = `
        #prompt-manager-for-google-ai-studio-sidebar-wrapper {
            height: 100%;
            width: 300px;
            flex-shrink: 0;
            box-sizing: border-box;
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
            z-index: 999; 
            background: var(--background, #fff);
        }

        #prompt-manager-for-google-ai-studio-sidebar-wrapper.collapsed {
            width: 0px; 
        }

        @media screen and (max-width: 960px) {
            #prompt-manager-for-google-ai-studio-sidebar-wrapper {
                position: fixed;
                top: 0;
                left: 0;
                height: 100vh;
                box-shadow: 2px 0 8px rgba(0,0,0,0.1);
            }
        }
    `;
    document.head.appendChild(style);

    // Create shadow root for isolation
    const shadow = wrapper.attachShadow({ mode: 'open' });
    
    // Inject styles
    // mainStyles contains the Tailwind output which includes the :root { ... } variables
    applyShadowStyles(shadow, mainStyles);

    // Mount React
    const rootContainer = document.createElement('div');
    rootContainer.classList.add('shadow-body');
    // Apply a class to the root container to ensure variables are available if they are scoped to :root
    // But :root in Shadow DOM refers to the shadow host's root, so variables defined in :root inside shadow CSS should work.
    // However, if the variables are defined in global :root, they naturally cascade into Shadow DOM.
    // BUT since we are injecting 'mainStyles' (which has the variables) into the Shadow DOM, 
    // the :root selector inside mainStyles will match the Shadow Root.
    // So --border should be defined.
    
    // Let's add a class 'light' or 'dark' to the wrapper/container based on current theme to ensure conditional variables work.
    // Or just ensure the variables are reachable.
    
    // Check if we need to sync theme class
    const syncTheme = () => {
        const isDark = document.body.classList.contains('dark-theme'); // Check AI Studio's theme class
        TooltipHelper.getInstance().setTheme(isDark); // Sync tooltip theme
        if (isDark) {
            rootContainer.classList.add('dark');
        } else {
            rootContainer.classList.remove('dark');
        }
    };
    
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    shadow.appendChild(rootContainer);

    const root = ReactDOM.createRoot(rootContainer);
    root.render(
        <ShadowRootProvider container={rootContainer}>
            <div className="h-full w-full bg-background border-r text-foreground">
                <OverlayPanel className="h-full" />
            </div>
        </ShadowRootProvider>
    );
  },
});
