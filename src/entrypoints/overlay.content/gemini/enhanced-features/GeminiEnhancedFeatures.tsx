import React from 'react';
// [DEPRECATED] import { DefaultModelFeature } from './DefaultModelFeature';
import { useGeminiUI } from './GeminiUIControl/useGeminiUI';
// [DEPRECATED] import { TopBarTagFeature } from './TopBarTagFeature';
import { ZenModeFeature } from './ZenModeFeature';
import { SmartScrollbarFeature } from './SmartScrollbar/SmartScrollbarFeature';
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
import { ProfilePickerDialog } from '@/entrypoints/overlay.content/shared/components/ProfilePickerDialog';
import { RatingPromptDialog } from '@/entrypoints/overlay.content/shared/modules/feedback/RatingPromptDialog';
import { PowerPackPaywall } from '@/shared/components/PowerPackPaywall';
import { HotkeyCheatsheet } from '@/entrypoints/overlay.content/shared/components/HotkeyCheatsheet';
import { TourPromptDialog } from '@/entrypoints/overlay.content/shared/modules/guided-tour/TourPromptDialog';
import { GuidedTour } from '@/entrypoints/overlay.content/shared/modules/guided-tour/GuidedTour';
import { useGuidedTour } from '@/entrypoints/overlay.content/shared/modules/guided-tour/useGuidedTour';
import { GEMINI_TOUR_STEPS } from '@/entrypoints/overlay.content/shared/modules/guided-tour/tour-steps';

/**
 * Container for all Gemini enhanced features.
 * Mounted independently from the OverlayPanel so features remain
 * active even when the overlay is disabled.
 */
export const GeminiEnhancedFeatures = () => {
  const isSettingsOpen = useAppStore((s) => s.ui.overlay.isSettingsOpen);
  const setIsSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const isSidebarExpanded = useAppStore((s) => s.ui.overlay.isSidebarExpanded);
  const guidedTour = useGuidedTour();

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
      <ZenModeFeature />
      <SmartScrollbarFeature />
      <AutoHideInputFeature />
      <SlashCommandFeature />
      <AgentLoopFeature />
      <SaveSnippetFeature />
      <SnippetDragDrawer />
      <SnippetReaderDrawer />
      <SettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      <WhatsNewDialog />
      <ProfilePickerDialog />
      <RatingPromptDialog />
      <PowerPackPaywall />
      <HotkeyCheatsheet />
      {guidedTour.showPrompt && isSidebarExpanded && (
        <TourPromptDialog
          isOpen={guidedTour.showPrompt}
          onStartTour={guidedTour.acceptTour}
          onSkip={guidedTour.dismissPrompt}
        />
      )}
      {guidedTour.isActive && isSidebarExpanded && (
        <GuidedTour
          steps={GEMINI_TOUR_STEPS}
          currentStep={guidedTour.currentStep}
          isActive={guidedTour.isActive}
          onNext={guidedTour.nextStep}
          onPrev={guidedTour.prevStep}
          onSkip={guidedTour.skipTour}
        />
      )}
      <GlobalModal />
      <GlobalPopoverPicker />
      <GlobalToast />
    </>
  );
};
