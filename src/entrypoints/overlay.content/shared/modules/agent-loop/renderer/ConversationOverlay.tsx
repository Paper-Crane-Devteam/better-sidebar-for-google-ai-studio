/**
 * ConversationOverlay — Custom conversation list container overlaying
 * native AI Studio infinite-scroller.
 *
 * Renders user cards, model cards, tool call widgets, and auto-scrolls
 * without modifying original conversation DOM nodes.
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAgentLoopStore } from '../agent-loop-store';
import { useConversationMessages } from './useConversationMessages';
import { CustomUserMessage } from './components/CustomUserMessage';
import { CustomModelResponse } from './components/CustomModelResponse';
import { ArrowDown } from 'lucide-react';
import mainStyles from '@/index.scss?inline';
import { applyShadowStyles } from '@/shared/lib/utils';
import { bindShadowRootToTheme, bindAiStudioShadowRootToTheme } from '@/themes';
import { useSettingsStore } from '@/shared/lib/settings-store';
import { detectPlatform, Platform } from '@/shared/types/platform';

const SCROLLER_SELECTOR =
  'infinite-scroller.chat-history, .conversation-container';

export const ConversationOverlay: React.FC = () => {
  const viewMode = useAgentLoopStore((s) => s.viewMode);
  const status = useAgentLoopStore((s) => s.status);
  const messages = useConversationMessages();
  const chatWidth = useSettingsStore((s) => s.enhancedFeatures.gemini?.chatWidth ?? 46);

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  // Find scroller container element and set up shadow DOM host with extension styles
  useEffect(() => {
    const findAndSetupTarget = () => {
      const el = document.querySelector(
        SCROLLER_SELECTOR,
      ) as HTMLElement | null;
      if (!el) {
        setPortalTarget(null);
        return;
      }

      if (window.getComputedStyle(el).position === 'static') {
        el.style.position = 'relative';
      }

      let shadowContainer = el.querySelector(
        '#better-sidebar-conversation-overlay-container',
      ) as HTMLElement | null;

      if (!shadowContainer) {
        shadowContainer = document.createElement('div');
        shadowContainer.id = 'better-sidebar-conversation-overlay-container';
        shadowContainer.style.position = 'absolute';
        shadowContainer.style.inset = '0';
        shadowContainer.style.pointerEvents = 'none';
        shadowContainer.style.zIndex = '40';
        el.appendChild(shadowContainer);

        const shadow = shadowContainer.attachShadow({ mode: 'open' });
        applyShadowStyles(shadow, mainStyles);

        const shadowBody = document.createElement('div');
        shadowBody.classList.add('shadow-body');
        shadowBody.style.width = '100%';
        shadowBody.style.height = '100%';
        shadowBody.style.display = 'none';
        shadowBody.style.pointerEvents = 'none';

        const platform = detectPlatform();
        if (platform === Platform.AI_STUDIO) {
          shadowBody.classList.add('theme-aistudio');
          bindAiStudioShadowRootToTheme(shadowBody);
        } else {
          const style = useSettingsStore.getState().geminiStyle;
          shadowBody.classList.add(
            style === 'classic' ? 'theme-gemini-classic' : 'theme-gemini',
          );
          bindShadowRootToTheme(shadowBody);
        }

        const syncDark = () => {
          const isDark =
            document.body.classList.contains('dark-theme') ||
            document.body.classList.contains('dark') ||
            document.body.getAttribute('data-theme') === 'dark';
          if (isDark) shadowBody.classList.add('dark');
          else shadowBody.classList.remove('dark');
        };
        syncDark();

        const observer = new MutationObserver(syncDark);
        observer.observe(document.body, {
          attributes: true,
          attributeFilter: ['class', 'data-theme'],
        });

        shadow.appendChild(shadowBody);
        setPortalTarget(shadowBody);
      } else {
        const shadow = shadowContainer.shadowRoot;
        if (shadow) {
          const shadowBody = shadow.querySelector(
            '.shadow-body',
          ) as HTMLElement | null;
          if (shadowBody) {
            setPortalTarget(shadowBody);
          }
        }
      }
    };

    findAndSetupTarget();
    const interval = setInterval(findAndSetupTarget, 1000);
    return () => clearInterval(interval);
  }, []);

  const hasAgentContent = messages.some(
    (m) =>
      Boolean(m.promptId) ||
      (m.toolCalls && m.toolCalls.length > 0) ||
      m.toolResults.length > 0,
  );

  const isCustomActive =
    viewMode === 'custom' && (hasAgentContent || status !== 'idle');

  // Manage inner shadowBody display & hide native conversation elements during custom view mode
  useEffect(() => {
    if (portalTarget) {
      portalTarget.style.display = isCustomActive ? 'block' : 'none';
      portalTarget.style.pointerEvents = isCustomActive ? 'auto' : 'none';
    }

    const styleId = 'better-sidebar-hide-native-conversation-style';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

    if (isCustomActive) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = `
        .conversation-container {
          visibility: hidden !important;
        }
      `;
    } else {
      if (styleEl) {
        styleEl.remove();
      }
    }

    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, [isCustomActive, portalTarget]);

  // Handle auto-scroll
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    if (isCustomActive && scrollRef.current) {
      const el = scrollRef.current;
      const isNearBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      if (isNearBottom) {
        scrollToBottom();
      }
    }
  }, [messages, isCustomActive]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const isFarFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight > 200;
    setShowScrollBottomBtn(isFarFromBottom);
  };

  if (!portalTarget || !isCustomActive) {
    return null;
  }

  return createPortal(
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="absolute inset-0 z-40 overflow-y-auto bg-background p-4 pt-14 text-foreground shadow-inner transition-opacity duration-200"
      style={{ minHeight: '100%', fontSize: '17px' }}
    >
      {/* List Content */}
      <div className="mx-auto pb-16" style={{ maxWidth: `${chatWidth}%`, minWidth: '724px' }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <p className="text-sm font-medium">Agent 视图</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              在下方对话框中输入消息或选择 Agent 提示词
            </p>
          </div>
        ) : (
          messages.map((msg) =>
            msg.role === 'user' ? (
              <CustomUserMessage key={msg.id} message={msg} />
            ) : (
              <CustomModelResponse key={msg.id} message={msg} />
            ),
          )
        )}
      </div>

      {/* Floating Scroll to Bottom button */}
      {showScrollBottomBtn && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="fixed bottom-24 right-8 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
          title="回到底部"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
    </div>,
    portalTarget,
  );
};
