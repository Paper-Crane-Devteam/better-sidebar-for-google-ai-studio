// src/content/tasks/scan-single-chat.ts

import { htmlToMarkdown } from '@/shared/lib/utils';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

function scanMessages(): ChatMessage[] {
  const messages: ChatMessage[] = [];
  // The selector for message turns. Based on mock.html, but might need adjustment.
  const turnElements = document.querySelectorAll('div[data-turn-role]');

  turnElements.forEach((turnElement) => {
    const role = turnElement.getAttribute('data-turn-role')?.toLowerCase();
    if (role === 'model' || role === 'user') {
      const contentElement = turnElement.querySelector(
        '.turn-content',
      ) as HTMLElement;
      if (contentElement) {
        const content = htmlToMarkdown(contentElement);
        if (!content) {
          console.log(
            'Empty content parsed for role:',
            role,
            'HTML:',
            contentElement.innerHTML
          );
        }
        messages.push({
          role: role as 'user' | 'model',
          content: content,
        });
      }
    }
  });
  console.log('Scanned messages:', messages);
  return messages;
}

function observeChatContainer() {
  // Find the container of all chat messages. This is a guess.
  // Using `body` with `subtree` is a broad but effective way to catch chat additions
  // if a more specific container is not easily identifiable.
  const chatContainer = document.body;

  if (!chatContainer) {
    console.error('Chat container (document.body) not found.');
    return;
  }

  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // A simple check to see if what's added might be a chat turn.
        const hasChatTurn = Array.from(mutation.addedNodes).some(node => 
          node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).querySelector('div[data-turn-role]')
        );

        if(hasChatTurn) {
             console.log('Potential chat message added, re-scanning messages.');
             // You can add a debounce here if it fires too rapidly.
             scanMessages();
             break; // No need to check other mutations in this batch
        }
      }
    }
  });

  observer.observe(chatContainer, { childList: true, subtree: true });

  console.log('Mutation observer started for chat container.');
}

export function initSingleChatScanner() {
  console.log('Single chat scanner initialized.');

  // Initial scan on load
  setTimeout(() => {
    scanMessages();
  }, 5000);
  // scanMessages();

  // Set up observer for subsequent changes
  // observeChatContainer();
}
