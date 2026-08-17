import type { AppState, SetState } from '../types';

export function createOverlayActions(set: SetState): Pick<
  AppState,
  | 'setCurrentPlatform'
  | 'setOverlayOpen'
  | 'setSidebarExpanded'
  | 'setSettingsOpen'
  | 'setTempHiddenToken'
  | 'setActiveTab'
  | 'setIsScanning'
  | 'setShowSqlInterface'
> {
  return {
    setCurrentPlatform: (currentPlatform) =>
      set((state) => ({
        ui: { ...state.ui, overlay: { ...state.ui.overlay, currentPlatform } },
      })),
    setOverlayOpen: (isOpen) =>
      set((state) => ({
        ui: { ...state.ui, overlay: { ...state.ui.overlay, isOpen } },
      })),
    setSidebarExpanded: (isSidebarExpanded) =>
      set((state) => ({
        ui: { ...state.ui, overlay: { ...state.ui.overlay, isSidebarExpanded } },
      })),
    setSettingsOpen: (isSettingsOpen, section) =>
      set((state) => ({
        ui: {
          ...state.ui,
          overlay: {
            ...state.ui.overlay,
            isSettingsOpen,
            // Only meaningful while open; cleared on close so the next plain
            // open keeps whatever section the user last looked at.
            settingsSection: isSettingsOpen ? (section ?? null) : null,
          },
        },
      })),
    setTempHiddenToken: (token) =>
      set((state) => ({
        ui: { ...state.ui, overlay: { ...state.ui.overlay, tempHiddenToken: token } },
      })),
    setActiveTab: (activeTab) =>
      set((state) => ({
        ui: { ...state.ui, overlay: { ...state.ui.overlay, activeTab } },
      })),
    setIsScanning: (isScanning) =>
      set((state) => ({
        ui: { ...state.ui, overlay: { ...state.ui.overlay, isScanning } },
      })),
    setShowSqlInterface: (showSqlInterface) =>
      set((state) => ({
        ui: { ...state.ui, overlay: { ...state.ui.overlay, showSqlInterface } },
      })),
  };
}
