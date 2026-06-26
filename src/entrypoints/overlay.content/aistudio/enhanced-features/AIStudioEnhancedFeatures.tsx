import { AutoHideInputFeature } from './AutoHideInputFeature';
import { AutoHideRunSettingsFeature } from './AutoHideRunSettingsFeature';
import { SaveSnippetFeature } from './SaveSnippetFeature';
import { SnippetDragDrawer } from '@/entrypoints/overlay.content/shared/modules/snippets/components/SnippetDragFolderView';
import { GlobalModal } from '@/shared/components/GlobalModal';
import { SnippetReaderDrawer } from '@/entrypoints/overlay.content/shared/modules/snippets/components/SnippetReaderDrawer';
import { SettingsModal } from '@/entrypoints/overlay.content/shared/modules/settings/SettingsModal';
import { WhatsNewDialog } from '@/entrypoints/overlay.content/shared/modules/whats-new/WhatsNewDialog';
import { useAppStore } from '@/shared/lib/store';

/**
 * Container for all AI Studio enhanced features.
 * These features inject CSS/behavior into the native AI Studio page
 * and remain active regardless of whether the overlay sidebar is visible.
 */
export const AIStudioEnhancedFeatures = () => {
  const isSettingsOpen = useAppStore((s) => s.ui.overlay.isSettingsOpen);
  const setIsSettingsOpen = useAppStore((s) => s.setSettingsOpen);

  return (
    <>
      <AutoHideInputFeature />
      <AutoHideRunSettingsFeature />
      <SaveSnippetFeature />
      <SnippetDragDrawer />
      <SnippetReaderDrawer />
      <SettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      <WhatsNewDialog />
      <GlobalModal />
    </>
  );
};
