import { navigate } from '@/shared/lib/navigation';
import type { ExplorerTypeFilter } from '../shared/types/filter';
import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '@/shared/lib/settings-store';
import { Button } from '@/shared/components/ui/button';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import { UserMinus } from 'lucide-react';
import { useAppStore } from '@/shared/lib/store';
import { useI18n } from '@/shared/hooks/useI18n';

export interface ModuleConfig {
  explorer: {
    onNewChat: () => void;
    filterTypes?: ExplorerTypeFilter[];
    extraHeaderButtons?: React.ReactNode;
    visibleFilters?: ('search' | 'tags' | 'type' | 'favorites')[];
    menuActions?: {
      onViewHistory?: () => void;
      onSwitchToOriginalUI?: () => void;
    };
  };
  prompts: {
    // Placeholder for future prompts module customization
    enabled: boolean;
  };
}

const TemporaryChatButton = () => {
  const { t } = useI18n();
  const [isTempChat, setIsTempChat] = useState(false);

  useEffect(() => {
    let observer: MutationObserver | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let currentBtn: Element | null = null;

    const cleanup = () => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      currentBtn = null;
    };

    const updateState = (btn: Element) => {
      const isTemp = btn.classList.contains('temp-chat-on');
      setIsTempChat(isTemp);
    };

    const startObserving = (btn: Element) => {
      // Disconnect previous observer
      if (observer) observer.disconnect();
      
      observer = new MutationObserver((mutations) => {
        // Check if button state changed
        updateState(btn);
        
        // Check if button is still in DOM or parent changed
        if (!document.body.contains(btn)) {
            // Button removed, restart polling
            cleanup();
            startPolling();
        }
      });

      // Observe the button for class changes (state)
      observer.observe(btn, { attributes: true, attributeFilter: ['class'] });
      
      // Also observe parent for child list changes (detect removal/replacement)
      if (btn.parentNode) {
          observer.observe(btn.parentNode, { childList: true });
      }
    };

    const checkAndObserve = () => {
      const btn = document.querySelector('button[aria-label="Temporary chat"]');
      
      if (btn) {
        // If it's a new button instance
        if (btn !== currentBtn) {
          currentBtn = btn;
          updateState(btn);
          startObserving(btn);
          
          // Found it, stop polling
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }
      } else {
        // Button lost/not found, ensure polling is active
        if (!pollInterval) {
            startPolling();
        }
        currentBtn = null;
      }
    };

    const startPolling = () => {
      if (!pollInterval) {
        // Poll more frequently when searching (500ms), then stop when found
        pollInterval = setInterval(checkAndObserve, 1000);
      }
    };

    // Initial check
    checkAndObserve();
    // Start polling if not found immediately
    if (!currentBtn) {
        startPolling();
    }

    return cleanup;
  }, []);

  const toggleTempChat = () => {
    const btn = document.querySelector(
      'button[aria-label="Temporary chat"]',
    ) as HTMLButtonElement;
    if (btn) {
      btn.click();
      // State update will happen via observer
    } else {
      console.warn('Temporary chat button not found');
    }
  };

  return (
    <SimpleTooltip content={t('tooltip.temporaryChat')}>
      <Button
        variant={isTempChat ? 'secondary' : 'ghost'}
        size="icon"
        className="h-7 w-7"
        onClick={toggleTempChat}
      >
        <UserMinus className="h-4 w-4" />
      </Button>
    </SimpleTooltip>
  );
};

export const useModuleConfig = (): ModuleConfig => {
  const newChatBehavior = useSettingsStore((state) => state.newChatBehavior);
  const setOverlayOpen = useAppStore((state) => state.setOverlayOpen);

  return {
    explorer: {
      onNewChat: () => {
        const url = 'https://gemini.google.com/app';
        if (newChatBehavior === 'new-tab') {
            window.open(url, '_blank');
        } else {
          const newChatBtn = document.querySelector(
            'a[aria-label="New chat"]',
          ) as HTMLElement;
          if (newChatBtn) {
            newChatBtn.click();
          } else {
            // Fallback if button not found
            window.location.href = url;
          }
        }
      },
      visibleFilters: ['search', 'tags', 'favorites'],
      extraHeaderButtons: <TemporaryChatButton />,
      menuActions: {
        onViewHistory: () => {
           navigate('/search');
        },
        onSwitchToOriginalUI: () => {
          setOverlayOpen(false);
        },
      },
    },
    prompts: {
      enabled: true,
    },
  };
};
