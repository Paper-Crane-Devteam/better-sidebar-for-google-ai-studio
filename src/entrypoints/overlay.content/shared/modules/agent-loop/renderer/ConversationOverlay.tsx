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
import { ArrowDown, Bot } from 'lucide-react';

const SCROLLER_SELECTOR = 'infinite-scroller.chat-history, .conversation-container';

export const ConversationOverlay: React.FC = () => {
  const viewMode = useAgentLoopStore((s) => s.viewMode);
  const status = useAgentLoopStore((s) => s.status);
  const messages = useConversationMessages();

  const [mountTarget, setMountTarget] = useState<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  // Find scroller container element
  useEffect(() => {
    const findTarget = () => {
      const el = document.querySelector(SCROLLER_SELECTOR) as HTMLElement | null;
      if (el) setMountTarget(el);
    };

    findTarget();
    const interval = setInterval(findTarget, 1000);
    return () => clearInterval(interval);
  }, []);

  // Ensure target scroller relative positioning if missing
  useEffect(() => {
    if (!mountTarget) return;
    const computed = window.getComputedStyle(mountTarget);
    if (computed.position === 'static') {
      mountTarget.style.position = 'relative';
    }
  }, [mountTarget]);

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
    if (viewMode === 'custom' && scrollRef.current) {
      const el = scrollRef.current;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      if (isNearBottom) {
        scrollToBottom();
      }
    }
  }, [messages, viewMode]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const isFarFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight > 200;
    setShowScrollBottomBtn(isFarFromBottom);
  };

  if (!mountTarget || viewMode !== 'custom') {
    return null;
  }

  return createPortal(
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="absolute inset-0 z-40 overflow-y-auto bg-background/95 p-4 pt-14 text-foreground backdrop-blur-xs shadow-inner transition-opacity duration-200"
      style={{ minHeight: '100%' }}
    >
      {/* List Content */}
      <div className="mx-auto max-w-4xl pb-16">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <Bot className="h-10 w-10 mb-3 opacity-40 text-emerald-500" />
            <p className="text-sm font-medium">Agent 渲染视图准备就绪</p>
            <p className="text-xs text-muted-foreground/70 mt-1">在下方对话框中输入消息或选择 Agent 提示词</p>
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
          className="fixed bottom-24 right-8 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
          title="回到底部"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
    </div>,
    mountTarget,
  );
};
