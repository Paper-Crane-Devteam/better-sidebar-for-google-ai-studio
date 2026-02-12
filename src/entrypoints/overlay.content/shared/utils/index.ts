import { PLATFORM_CONFIG , detectPlatform } from '@/shared/types/platform';
export function getExternalUrl(id: string) {
  const platform = detectPlatform();
  return PLATFORM_CONFIG[platform].promptUrlTemplate(id);
}