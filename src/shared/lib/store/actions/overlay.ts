import type { AppState, SetState } from '../types';

export function createOverlayActions(set: SetState): Pick<
  AppState,
  | 'setCurrentPlatform'
  | 'setOverlayOpen'
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
    setSettingsOpen: (isSettingsOpen) =>
      set((state) => ({
        ui: { ...state.ui, overlay: { ...state.ui.overlay, isSettingsOpen } },
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
