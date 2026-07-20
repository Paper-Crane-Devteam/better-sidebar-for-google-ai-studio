/**
 * Centralized z-index registry for Better Sidebar overlay components.
 * 
 * Stacking rules:
 * 1. Base page features (ZenMode, AutoHideInput, etc.): low z-index or default.
 * 2. SmartScrollbar: 38 (should float on right of native page, below sidebar and drawer)
 * 3. Sidebar Wrapper: 999
 * 4. Snippet Reader Drawer: 9998 (slides out from sidebar, should be above normal page content)
 * 5. Modals & Dialogs (SettingsModal, GlobalModal, WhatsNewDialog, PowerPackPaywall): 10000
 * 6. Global Toast alerts: 10010 (must display above modals so notifications are visible)
 * 7. Topmost UI elements (Tooltips, popovers, dropdowns, guided tour): 20000+
 * 
 * Note: Since most overlays, modals, and toasts are rendered inside the 
 * 'enhanced-features' shadow DOM container (which has z-index: auto), their 
 * z-index values compare directly and stack correctly.
 */
export const Z_INDEX = {
  // Elements on the native page
  PAGE_FEATURE: 10,
  
  // SmartScrollbar
  SMART_SCROLLBAR: 38,
  
  // Main sidebar
  SIDEBAR: 999,
  
  // Drawer panel
  DRAWER: 9998,
  
  // Modals / Dialogs / Paywalls
  MODAL: 10000,
  
  // Toast notifications (must be above modals)
  TOAST: 10010,
  
  // Topmost popups (guided tour, tooltips, radix popovers/menus)
  POPUP: 20000,
  MAX: 2147483647,
} as const;
