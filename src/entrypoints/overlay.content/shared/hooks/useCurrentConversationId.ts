import { useUrl } from '@/shared/hooks/useUrl';
import { detectPlatform, PLATFORM_CONFIG } from '@/shared/types/platform';
export const useCurrentConversationId = () => {
  const { url } = useUrl();
  
  const platform = detectPlatform();
  const chatUrlTemplate = PLATFORM_CONFIG[platform].promptUrlTemplate();
  const regex = new RegExp(`${chatUrlTemplate}([a-zA-Z0-9_-]+)`);
  const match = regex.exec(url);
  return match?.[1] || null;
};
