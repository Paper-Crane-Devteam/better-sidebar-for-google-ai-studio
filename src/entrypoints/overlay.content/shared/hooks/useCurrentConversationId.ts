import { useUrl } from '@/shared/hooks/useUrl';

export const useCurrentConversationId = () => {
  const { url } = useUrl();
  
  // Extract ID from URL like https://aistudio.google.com/prompts/123-abc
  const regex = /prompts\/([a-zA-Z0-9_-]+)/;
  const match = regex.exec(url);
  
  return match?.[1] || null;
};
