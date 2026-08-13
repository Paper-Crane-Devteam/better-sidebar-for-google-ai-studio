import { usePegasusStore } from '@/shared/lib/pegasus-store';
import { useAgentLoopStore } from '@/entrypoints/overlay.content/shared/modules/agent-loop';
import { SmartScrollbar } from './new';

/**
 * Feature wrapper that reads the showSmartScrollbar setting
 * and conditionally renders the SmartScrollbar component.
 */
export const SmartScrollbarFeature = () => {
  const showSmartScrollbar = usePegasusStore(
    (s) => s.enhancedFeatures.gemini.showSmartScrollbar,
  );
  // Every dot maps to a native turn's offset inside the native scroller. With the
  // agent view on top, those offsets point at hidden content — the dots don't line
  // up with what's on screen and clicking one goes nowhere useful.
  const isAgentViewActive = useAgentLoopStore((s) => s.isAgentViewActive);

  if (!showSmartScrollbar || isAgentViewActive) return null;

  return <SmartScrollbar />;
};
