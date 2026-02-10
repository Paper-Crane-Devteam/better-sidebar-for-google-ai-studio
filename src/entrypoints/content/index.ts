// Content script entry point - routes to platform-specific implementations

import { detectPlatform, Platform } from '@/shared/types/platform';
import { initAiStudio } from './aistudio';
import { initGemini } from './gemini';

export default defineContentScript({
  matches: [
    'https://aistudio.google.com/*',
    'https://gemini.google.com/*',
  ],
  runAt: 'document_start',
  main() {
    const platform = detectPlatform();
    console.log(`Better Sidebar: Content Script Initialized (Platform: ${platform})`);

    switch (platform) {
      case Platform.AI_STUDIO: {
        initAiStudio();
        break;
      }
      case Platform.GEMINI: {
        initGemini();
        break;
      }
      default:
        console.warn(`Better Sidebar: Unknown platform (${platform}), no content script loaded`);
    }
  },
});
