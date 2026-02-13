import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/shared/lib/store';
import { useSettingsStore } from '@/shared/lib/settings-store';
import { Button } from '../shared/components/ui/button';
import { Separator } from '../shared/components/ui/separator';
import {
  Files,
  Star,
  Tag,
  MessageSquare,
  Settings,
  Hammer,
  LayoutDashboard,
  BookOpen,
  LogOut,
  Search,
  Sparkles,
} from 'lucide-react';
import { SqlExecutor } from '../shared/components/menu/SqlExecutor';
import { ExplorerTab } from '../shared/modules/explorer/ExplorerTab';
import { PromptsTab } from '../shared/modules/prompts/PromptsTab';
import { SearchTab } from '../shared/modules/search/SearchTab';
import { FavoritesTab } from '../shared/modules/favorites/FavoritesTab';
import { TagsTab } from '../shared/modules/tags/TagsTab';
import { FeedbackTab } from '../shared/modules/feedback/FeedbackTab';
import { SettingsModal } from '../shared/modules/settings/SettingsModal';
import { WhatsNewDialog } from '../shared/modules/whats-new/WhatsNewDialog';
import '@/index.scss';
import { GlobalModal } from '@/shared/components/GlobalModal';
import { GlobalToast } from '@/shared/components/GlobalToast';
import { useAppInit } from '../shared/hooks/useAppInit';
import { OverlayToggle } from '../shared/components/OverlayToggle';
import { toast } from '@/shared/lib/toast';
import { useI18n } from '@/shared/hooks/useI18n';
import { navigate } from '@/shared/lib/navigation';
import { useUrl } from '@/shared/hooks/useUrl';
import { useModuleConfig } from './useModuleConfig';

export const OverlayPanel = ({ className }: { className?: string }) => {
  const moduleConfig = useModuleConfig();
  useAppInit();
  const { t } = useI18n();
  const { path } = useUrl();

  const [, setContainer] = useState<HTMLDivElement | null>(null);
  const layoutDensity = useSettingsStore((state) => state.layoutDensity);
  const newChatBehavior = useSettingsStore((state) => state.newChatBehavior);
  const shortcuts = useSettingsStore((state) => state.shortcuts);
  const {
    fetchData,
    ui,
    setOverlayOpen: setIsUIVisible,
    setActiveTab,
    setIsScanning,
    setShowSqlInterface,
    setExplorerViewMode,
    setExplorerSortOrder,
    setTempHiddenToken,
    setSettingsOpen: setIsSettingsOpen,
    setOverlayOpen
  } = useAppStore();

  const {
    isOpen: isUIVisible,
    activeTab,
    isScanning,
    showSqlInterface,
    tempHiddenToken,
    isSettingsOpen,
  } = ui.overlay;

  // Handle auto-switching UI based on URL
  useEffect(() => {
    // TODO: Implement URL-based UI switching for ChatGPT if needed
  }, [path, isUIVisible, setIsUIVisible, tempHiddenToken, setTempHiddenToken]);

  // 1. Handle UI Toggle Side Effects
  useEffect(() => {
    const sidebarHider = document.getElementById(
      'better-sidebar-for-google-ai-studio-chatgpt-sidebar-hider',
    ) as HTMLStyleElement;
    const originalSidebar = document.querySelector('#stage-slideover-sidebar') as HTMLElement;
    const wrapper = document.getElementById(
      'better-sidebar-for-google-ai-studio-sidebar-wrapper',
    );

    if (isUIVisible) {
      // Show Enhanced UI, Hide Original
      if (sidebarHider) sidebarHider.disabled = false;
      if (originalSidebar) {
        originalSidebar.style.display = 'none';
        originalSidebar.style.position = 'absolute';
        originalSidebar.style.left = '-9999px';
      }
      if (wrapper) wrapper.style.display = 'block';
    } else {
      // Hide Enhanced UI, Show Original
      if (sidebarHider) sidebarHider.disabled = true;
      if (originalSidebar) {
        originalSidebar.style.display = ''; // Reset to default
        originalSidebar.style.position = '';
        originalSidebar.style.left = '';
      }
      if (wrapper) wrapper.style.display = 'none';
    }
  }, [isUIVisible]);

  useEffect(() => {
    // Initial fetch
    fetchData();

    // Initialize from settings store
    const settings = useSettingsStore.getState();
    setExplorerViewMode(settings.explorer.viewMode);
    setExplorerSortOrder(settings.explorer.sortOrder);

    // Listen for updates from background script
    const listener = (message: any) => {
      if (message.type === 'DATA_UPDATED') {
        console.log('Received DATA_UPDATED signal, refreshing...');
        fetchData(true);

        // Handle specific update types with payload
        if (message.updateType === 'SCAN_COMPLETE' && message.payload) {
          // Only set isScanning to false when scan actually completes
          setIsScanning(false);
          
          const count = message.payload.count || 0;
          console.log(`Scan completed, imported ${count} items`);
          if (count > 0) {
            toast.success(t('toast.imported', { count }));
          } else {
            toast.info(t('toast.scanComplete'));
          }
        }
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => {
      browser.runtime.onMessage.removeListener(listener);
    };
  }, []);

  // Handle tab activation/visibility change to sync data
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, refreshing data...');
        fetchData(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData]);

  const handleTabChange = (
    tab:
      | 'files'
      | 'favorites'
      | 'tags'
      | 'feedback'
      | 'settings'
      | 'search'
      | 'prompts',
  ) => {
    if (tab === 'settings') {
      setIsSettingsOpen(true);
      return;
    }
    setActiveTab(tab);
  };

  if (!isUIVisible) {
    return <OverlayToggle onToggle={() => setIsUIVisible(true)} />;
  }

  if (showSqlInterface) {
    return <SqlExecutor onClose={() => setShowSqlInterface(false)} />;
  }

  const handleNavigation = (url: string) => {
    // TODO: Implement navigation for ChatGPT
  };

  const handleExternalLink = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div
      ref={setContainer}
      className={`flex bg-background text-foreground ${className || 'h-full'} relative`}
      data-density={layoutDensity}
    >
      {/* Sidebar Tabs */}
      <div className="sidebar-nav border-r flex flex-col items-center bg-muted/20 shrink-0">
        <Button
          variant={activeTab === 'files' ? 'secondary' : 'ghost'}
          size="icon"
          title={t('tabs.files')}
          onClick={() => handleTabChange('files')}
          className="sidebar-btn rounded-xl transition-all hover:rounded-xl"
        >
          <Files className="sidebar-icon" />
        </Button>
        <Button
          variant={activeTab === 'search' ? 'secondary' : 'ghost'}
          size="icon"
          title={t('tabs.search')}
          onClick={() => handleTabChange('search')}
          className="sidebar-btn rounded-xl transition-all hover:rounded-xl"
        >
          <Search className="sidebar-icon" />
        </Button>
        <Button
          variant={activeTab === 'prompts' ? 'secondary' : 'ghost'}
          size="icon"
          title={t('tabs.prompts')}
          onClick={() => handleTabChange('prompts')}
          className="sidebar-btn rounded-xl transition-all hover:rounded-xl"
        >
          <Sparkles className="sidebar-icon" />
        </Button>
        {shortcuts?.favorites && (
          <Button
            variant={activeTab === 'favorites' ? 'secondary' : 'ghost'}
            size="icon"
            title={t('tabs.favorites')}
            onClick={() => handleTabChange('favorites')}
            className="sidebar-btn rounded-xl transition-all hover:rounded-xl"
          >
            <Star className="sidebar-icon" />
          </Button>
        )}
        <Button
          variant={activeTab === 'tags' ? 'secondary' : 'ghost'}
          size="icon"
          title={t('tabs.tags')}
          onClick={() => handleTabChange('tags')}
          className="sidebar-btn rounded-xl transition-all hover:rounded-xl"
        >
          <Tag className="sidebar-icon" />
        </Button>

        {(shortcuts?.build ||
          shortcuts?.dashboard ||
          shortcuts?.documentation) && <Separator className="w-8 my-1" />}

        {shortcuts?.build && (
          <Button
            variant="ghost"
            size="icon"
            title={t('shortcuts.build')}
            onClick={() => handleNavigation('/')}
            className="sidebar-btn rounded-xl transition-all hover:rounded-xl"
          >
            <Hammer className="sidebar-icon" />
          </Button>
        )}

        {shortcuts?.dashboard && (
          <Button
            variant="ghost"
            size="icon"
            title={t('shortcuts.dashboard')}
            onClick={() => handleNavigation('/')}
            className="sidebar-btn rounded-xl transition-all hover:rounded-xl"
          >
            <LayoutDashboard className="sidebar-icon" />
          </Button>
        )}

        {shortcuts?.documentation && (
          <Button
            variant="ghost"
            size="icon"
            title={t('shortcuts.documentation')}
            onClick={() =>
              handleExternalLink('https://help.openai.com/')
            }
            className="sidebar-btn rounded-xl transition-all hover:rounded-xl"
          >
            <BookOpen className="sidebar-icon" />
          </Button>
        )}

        <div className="flex-1" />

        {shortcuts?.originalUI && (
          <Button
            variant="ghost"
            size="icon"
            title={t('shortcuts.originalUI')}
            onClick={() => setIsUIVisible(false)}
            className="sidebar-btn rounded-xl transition-all hover:rounded-xl"
          >
            <LogOut className="sidebar-icon" />
          </Button>
        )}

        <Button
          variant={activeTab === 'feedback' ? 'secondary' : 'ghost'}
          size="icon"
          title={t('tabs.feedback')}
          onClick={() => handleTabChange('feedback')}
          className="sidebar-btn rounded-xl transition-all hover:rounded-xl"
        >
          <MessageSquare className="sidebar-icon" />
        </Button>
        <Button
          variant={isSettingsOpen ? 'secondary' : 'ghost'}
          size="icon"
          title={t('tabs.settings')}
          onClick={() => handleTabChange('settings')}
          className="sidebar-btn rounded-xl transition-all hover:rounded-xl"
        >
          <Settings className="sidebar-icon" />
        </Button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeTab === 'files' ? (
          <ExplorerTab
            onNewChat={moduleConfig.explorer.onNewChat}
            filterTypes={moduleConfig.explorer.filterTypes}
            visibleFilters={moduleConfig.explorer.visibleFilters}
            extraHeaderButtons={moduleConfig.explorer.extraHeaderButtons}
            menuActions={moduleConfig.general.menuActions}
          />
        ) : activeTab === 'search' ? (
          <SearchTab
            extraHeaderButtons={moduleConfig.search.extraHeaderButtons}
            menuActions={moduleConfig.general.menuActions}
            onNavigate={moduleConfig.search.onNavigate}
          />
        ) : activeTab === 'prompts' ? (
          <PromptsTab menuActions={moduleConfig.general.menuActions}/>
        ) : activeTab === 'favorites' ? (
          <FavoritesTab menuActions={moduleConfig.general.menuActions}/>
        ) : activeTab === 'tags' ? (
          <TagsTab menuActions={moduleConfig.general.menuActions}/>
        ) : activeTab === 'feedback' ? (
          <FeedbackTab />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {t('overlay.settingsPageComingSoon')}
          </div>
        )}
      </div>
      <SettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      <WhatsNewDialog />
      <GlobalModal />
      <GlobalToast />
    </div>
  );
};
