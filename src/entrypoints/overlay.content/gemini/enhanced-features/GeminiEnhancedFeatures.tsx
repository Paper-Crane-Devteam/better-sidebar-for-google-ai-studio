import React from 'react';
import { DefaultModelFeature } from './DefaultModelFeature';
import { GeminiUIControl } from './GeminiUIControl';

/**
 * Container for all Gemini enhanced features.
 * Mounted independently from the OverlayPanel so features remain 
 * active even when the overlay is disabled.
 */
export const GeminiEnhancedFeatures = () => {
  return (
    <>
      <DefaultModelFeature />
      <GeminiUIControl />
    </>
  );
};
