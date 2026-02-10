import { detectPlatform, Platform } from '@/shared/types/platform';

export const navigate = (url: string) => {
  window.history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

export const navigateToConversation = (targetId: string) => {
  if (detectPlatform() === Platform.GEMINI) {
    const links = document.querySelectorAll('a[data-test-id="conversation"]');
    const targetHref = `/app/${targetId}`;
    
    for (const link of Array.from(links)) {
      if (link.classList.contains('conversation')) {
        const href = link.getAttribute('href');
        if (href && href.includes(targetHref)) {
          (link as HTMLElement).click();
          return;
        }
      }
    }
    
    console.warn(`Conversation link not found for id: ${targetId}, falling back to location.href`);
    window.location.href = `/app/${targetId}`;
  }
  // aistudio
  navigate(`/prompts/${targetId}`);
};
