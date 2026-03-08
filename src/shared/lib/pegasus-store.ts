import { create } from 'zustand';
import {
  initPegasusZustandStoreBackend,
  pegasusZustandStoreReady,
} from '@webext-pegasus/store-zustand';

interface PegasusState {
  enhancedFeatures: {
    gemini: {
      removeWatermark: boolean;
    };
  };
  setGeminiEnhancedFeature: (
    key: keyof PegasusState['enhancedFeatures']['gemini'],
    value: boolean,
  ) => void;
}

export const usePegasusStore = create<PegasusState>()((set) => ({
  enhancedFeatures: {
    gemini: {
      removeWatermark: false,
    },
  },
  setGeminiEnhancedFeature: (key, value) =>
    set((state) => ({
      ...state,
      enhancedFeatures: {
        ...state.enhancedFeatures,
        gemini: {
          ...state.enhancedFeatures.gemini,
          [key]: value,
        },
      },
    })),
}));

export const STORE_NAME = 'pegasusGlobalStore';

export const initPegasusBackendStore = () =>
  initPegasusZustandStoreBackend(STORE_NAME, usePegasusStore, {
    storageStrategy: 'local',
  });

export const getPegasusStoreReady = () =>
  pegasusZustandStoreReady(STORE_NAME, usePegasusStore);
