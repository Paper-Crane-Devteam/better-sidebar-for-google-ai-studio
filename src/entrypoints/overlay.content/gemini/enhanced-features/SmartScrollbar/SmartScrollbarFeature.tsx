import { usePegasusStore } from '@/shared/lib/pegasus-store';
import { SmartScrollbar } from './new';

/**
 * Feature wrapper that reads the showSmartScrollbar setting
 * and conditionally renders the SmartScrollbar component.
 */
export const SmartScrollbarFeature = () => {
  const showSmartScrollbar = usePegasusStore(
    (s) => s.enhancedFeatures.gemini.showSmartScrollbar,
  );

  if (!showSmartScrollbar) return null;

  return <SmartScrollbar />;
};
