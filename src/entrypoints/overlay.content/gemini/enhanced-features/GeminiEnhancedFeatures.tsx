import React from 'react';
// [DEPRECATED] import { DefaultModelFeature } from './DefaultModelFeature';
import { useGeminiUI } from './GeminiUIControl/useGeminiUI';
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
import { GlobalToast } from '@/shared/components/GlobalToast';
import { SnippetReaderDrawer } from '@/entrypoints/overlay.content/shared/modules/snippets/components/SnippetReaderDrawer';
import { SettingsModal } from '@/entrypoints/overlay.content/shared/modules/settings/SettingsModal';
import { WhatsNewDialog } from '@/entrypoints/overlay.content/shared/modules/whats-new/WhatsNewDialog';
import { useAppStore } from '@/shared/lib/store';
import { useInitConversationMessages } from '@/shared/hooks/useInitConversationMessages';

/**
 * Container for all Gemini enhanced features.
 * Mounted independently from the OverlayPanel so features remain
 * active even when the overlay is disabled.
 */
export const GeminiEnhancedFeatures = () => {
  const isSettingsOpen = useAppStore((s) => s.ui.overlay.isSettingsOpen);
  const setIsSettingsOpen = useAppStore((s) => s.setSettingsOpen);

  // Initialize the shared conversation messages store (DB fetch, interceptor, DOM observer)
  useInitConversationMessages();

  // Keep GeminiUI side-effects running (CSS injection, top-bar-actions offset, etc.)
  // even though the control panel UI is hidden.
  useGeminiUI();

  return (
    <>
      {/* [DEPRECATED] DefaultModelFeature - removed due to Gemini UI redesign */}
      {/* <DefaultModelFeature /> */}
      {/* [DEPRECATED] TopBarTagFeature - removed due to Gemini UI redesign */}
      {/* <TopBarTagFeature /> */}
      {/* [HIDDEN] GeminiUIControl - temporarily hidden */}
      {/* <GeminiUIControl /> */}
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
      <GlobalToast />
    </>
  );
};
