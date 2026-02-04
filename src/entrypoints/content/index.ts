// Content script entry point - routes to platform-specific implementations

import { detectPlatform, Platform } from '@/shared/types/platform';

export default defineContentScript({
  matches: [
    'https://aistudio.google.com/*',
    'https://gemini.google.com/*',
  ],
  async main() {
    const platform = detectPlatform();
    console.log(`Better Sidebar: Content Script Initialized (Platform: ${platform})`);

    switch (platform) {
      case Platform.AI_STUDIO: {
        const { initAiStudio } = await import('./aistudio');
        initAiStudio();
        break;
      }
      case Platform.GEMINI: {
        const { initGemini } = await import('./gemini');
        initGemini();
        break;
      }
      default:
        console.warn(`Better Sidebar: Unknown platform (${platform}), no content script loaded`);
    }
  },
});
