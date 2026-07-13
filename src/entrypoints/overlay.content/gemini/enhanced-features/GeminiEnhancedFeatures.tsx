import React from 'react';
// [DEPRECATED] import { DefaultModelFeature } from './DefaultModelFeature';
import { GeminiUIControl } from './GeminiUIControl';
// [DEPRECATED] import { TopBarTagFeature } from './TopBarTagFeature';
import { ZenModeFeature } from './ZenModeFeature';
import { SmartScrollbarFeature } from './SmartScrollbar/SmartScrollbarFeature';
import { QuickResendFeature } from './QuickResendFeature';
import { AutoHideInputFeature } from './AutoHideInputFeature';
import { SlashCommandFeature } from './SlashCommandFeature';
import { AgentLoopFeature } from './AgentLoopFeature';
import { SaveSnippetFeature } from './SaveSnippetFeature';
import { SnippetDragDrawer } from '@/entrypoints/overlay.content/shared/modules/snippets/components/SnippetDragFolderView';
import { GlobalModal } from '@/shared/components/GlobalModal';
import { GlobalPopoverPicker } from '@/shared/components/GlobalPopoverPicker';
import { SnippetReaderDrawer } from '@/entrypoints/overlay.content/shared/modules/snippets/components/SnippetReaderDrawer';
import { SettingsModal } from '@/entrypoints/overlay.content/shared/modules/settings/SettingsModal';
import { WhatsNewDialog } from '@/entrypoints/overlay.content/shared/modules/whats-new/WhatsNewDialog';
import { useAppStore } from '@/shared/lib/store';

/**
 * Container for all Gemini enhanced features.
 * Mounted independently from the OverlayPanel so features remain
 * active even when the overlay is disabled.
 */
export const GeminiEnhancedFeatures = () => {
  const isSettingsOpen = useAppStore((s) => s.ui.overlay.isSettingsOpen);
  const setIsSettingsOpen = useAppStore((s) => s.setSettingsOpen);

  return (
    <>
      {/* [DEPRECATED] DefaultModelFeature - removed due to Gemini UI redesign */}
      {/* <DefaultModelFeature /> */}
      {/* [DEPRECATED] TopBarTagFeature - removed due to Gemini UI redesign */}
      {/* <TopBarTagFeature /> */}
      <GeminiUIControl />
      <ZenModeFeature />
      <SmartScrollbarFeature />
      <QuickResendFeature />
      <AutoHideInputFeature />
      <SlashCommandFeature />
      <AgentLoopFeature />
      <SaveSnippetFeature />
      <SnippetDragDrawer />
      <SnippetReaderDrawer />
      <SettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      <WhatsNewDialog />
      <GlobalModal />
      <GlobalPopoverPicker />
    </>
  );
};
