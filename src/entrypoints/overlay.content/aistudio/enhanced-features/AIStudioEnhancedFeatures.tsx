import { AutoHideInputFeature } from './AutoHideInputFeature';
import { AutoHideRunSettingsFeature } from './AutoHideRunSettingsFeature';
import { SaveSnippetFeature } from './SaveSnippetFeature';
import { SnippetDragDrawer } from '@/entrypoints/overlay.content/shared/modules/snippets/components/SnippetDragFolderView';
import { GlobalModal } from '@/shared/components/GlobalModal';
import { GlobalToast } from '@/shared/components/GlobalToast';
import { SnippetReaderDrawer } from '@/entrypoints/overlay.content/shared/modules/snippets/components/SnippetReaderDrawer';
import { SettingsModal } from '@/entrypoints/overlay.content/shared/modules/settings/SettingsModal';
import { WhatsNewDialog } from '@/entrypoints/overlay.content/shared/modules/whats-new/WhatsNewDialog';
import { ProfilePickerDialog } from '@/entrypoints/overlay.content/shared/components/ProfilePickerDialog';
import { RatingPromptDialog } from '@/entrypoints/overlay.content/shared/modules/feedback/RatingPromptDialog';
import { PowerPackPaywall } from '@/shared/components/PowerPackPaywall';
import { HotkeyCheatsheet } from '@/entrypoints/overlay.content/shared/components/HotkeyCheatsheet';
import { useAppStore } from '@/shared/lib/store';
import { useInitConversationMessages } from '@/shared/hooks/useInitConversationMessages';

/**
 * Container for all AI Studio enhanced features.
 * These features inject CSS/behavior into the native AI Studio page
 * and remain active regardless of whether the overlay sidebar is visible.
 */
export const AIStudioEnhancedFeatures = () => {
  const isSettingsOpen = useAppStore((s) => s.ui.overlay.isSettingsOpen);
  const setIsSettingsOpen = useAppStore((s) => s.setSettingsOpen);

  // Initialize the shared conversation messages store (DB fetch, interceptor, DOM observer)
  useInitConversationMessages();

  return (
    <>
      <AutoHideInputFeature />
      <AutoHideRunSettingsFeature />
      <SaveSnippetFeature />
      <SnippetDragDrawer />
      <SnippetReaderDrawer />
      <SettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      <WhatsNewDialog />
      <ProfilePickerDialog />
      <RatingPromptDialog />
      <PowerPackPaywall />
      <HotkeyCheatsheet />
      <GlobalModal />
      <GlobalToast />
    </>
  );
};
