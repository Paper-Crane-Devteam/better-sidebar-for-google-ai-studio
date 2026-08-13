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
import { findConversationScroller } from './constants';
import { useAgentViewState } from './useAgentViewState';
import { CustomUserMessage } from './components/CustomUserMessage';
import { CustomModelResponse } from './components/CustomModelResponse';
import { ArrowDown } from 'lucide-react';
import mainStyles from '@/index.scss?inline';
import { applyShadowStyles } from '@/shared/lib/utils';
import { bindShadowRootToTheme, bindAiStudioShadowRootToTheme } from '@/themes';
import { usePegasusStore } from '@/shared/lib/pegasus-store';
import { useSettingsStore } from '@/shared/lib/settings-store';
import { detectPlatform, Platform } from '@/shared/types/platform';

export const ConversationOverlay: React.FC = () => {
  const { messages, isActive: isCustomActive } = useAgentViewState();
  const setAgentViewActive = useAgentLoopStore((s) => s.setAgentViewActive);
  const chatWidth = usePegasusStore((s) => s.enhancedFeatures.gemini?.chatWidth ?? 46);

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [nativeScroller, setNativeScroller] = useState<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  // Find scroller container element and set up shadow DOM host with extension styles
  useEffect(() => {
    const findAndSetupTarget = () => {
      const el = findConversationScroller();
      if (!el) {
        setPortalTarget(null);
        setNativeScroller(null);
        return;
      }

      setNativeScroller((prev) => (prev === el ? prev : el));

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
        // The hide-native rule uses visibility, which is inherited. If our host
        // ever ends up inside a hidden container, opt back in explicitly.
        shadowBody.style.visibility = 'visible';

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

  // Manual tool execution is only offered on the newest model turn
  const latestModelMessageId = [...messages].reverse().find((m) => m.role === 'model')?.id;

  /**
   * Only blank out / take over the native conversation once we can actually render a
   * replacement. Otherwise a selector regression leaves the user staring at an empty
   * chat area with no way back.
   */
  const canReplaceNative = isCustomActive && !!portalTarget && messages.length > 0;

  // Let the rest of the UI know the conversation area is ours (see the smart scrollbar)
  useEffect(() => {
    setAgentViewActive(canReplaceNative);
    return () => setAgentViewActive(false);
  }, [canReplaceNative, setAgentViewActive]);

  /**
   * Park the native scroller at the top for as long as we're covering it.
   *
   * The overlay is an absolutely positioned child of that scroller, so it is
   * viewport-*sized* but content-*anchored*: it sits at scroll offset 0 and slides
   * out of sight along with the turns it replaces. Switch over while the native
   * view was scrolled down and you'd be looking at the empty space below our panel.
   *
   * Pinning instead of tracking `scrollTop`, because a moving `top` would visibly
   * lag the scroll. The listener is not paranoia: Gemini keeps auto-scrolling to
   * the newest turn while a response streams in, and `overflow: hidden` doesn't
   * stop programmatic scrolling.
   *
   * On the way out we hand the user back the position they came from — or the
   * bottom, if that's where they were, since the conversation has usually grown
   * while the agent was working.
   */
  useEffect(() => {
    // Gated on canReplaceNative, not on isCustomActive: while the native turns are
    // still visible they have to stay scrollable.
    if (!canReplaceNative || !nativeScroller) return;

    const previousScrollTop = nativeScroller.scrollTop;
    const wasAtBottom =
      nativeScroller.scrollHeight - previousScrollTop - nativeScroller.clientHeight < 80;
    const previousOverflowY = nativeScroller.style.overflowY;

    nativeScroller.style.overflowY = 'hidden';

    const pin = () => {
      if (nativeScroller.scrollTop !== 0) nativeScroller.scrollTop = 0;
    };
    pin();
    nativeScroller.addEventListener('scroll', pin, { passive: true });

    return () => {
      nativeScroller.removeEventListener('scroll', pin);
      nativeScroller.style.overflowY = previousOverflowY;
      nativeScroller.scrollTop = wasAtBottom
        ? nativeScroller.scrollHeight
        : previousScrollTop;
    };
  }, [canReplaceNative, nativeScroller]);

  // Manage inner shadowBody display & hide native conversation elements during custom view mode
  useEffect(() => {
    if (portalTarget) {
      portalTarget.style.display = isCustomActive ? 'block' : 'none';
      portalTarget.style.pointerEvents = isCustomActive ? 'auto' : 'none';
    }

    const styleId = 'better-sidebar-hide-native-conversation-style';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

    if (canReplaceNative) {
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
  }, [isCustomActive, portalTarget, canReplaceNative]);

  // Handle auto-scroll
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  // Our list is shorter than the native one, so "where you were" doesn't translate.
  // Landing at the newest turn is the one position that always makes sense.
  const pendingJumpToBottomRef = useRef(false);
  const wasActiveRef = useRef(false);
  if (isCustomActive && !wasActiveRef.current) pendingJumpToBottomRef.current = true;
  wasActiveRef.current = isCustomActive;

  useEffect(() => {
    if (!isCustomActive) return;
    const el = scrollRef.current;
    if (!el) return;

    if (pendingJumpToBottomRef.current) {
      // Turns are still being parsed on the first pass after activation
      if (messages.length === 0) return;
      pendingJumpToBottomRef.current = false;
      el.scrollTop = el.scrollHeight;
      return;
    }

    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (isNearBottom) {
      scrollToBottom();
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
      // overscrollBehavior: reaching our end must not hand the wheel to the native
      // scroller underneath, which would drag this panel off screen.
      style={{ height: '100%', fontSize: '17px', overscrollBehavior: 'contain' }}
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
              <CustomModelResponse
                key={msg.id}
                message={msg}
                isLatestResponse={msg.id === latestModelMessageId}
              />
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
