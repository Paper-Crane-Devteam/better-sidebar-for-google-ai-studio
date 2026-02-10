// Main-world script entry: routes to platform-specific interceptors
// Note: main-world runs in page context; use detectPlatform() from window.location

import { detectPlatform, Platform } from '@/shared/types/platform';
import { initAiStudioInterceptors } from './aistudio';
import { initGeminiInterceptors } from './gemini';
export default defineUnlistedScript(() => {
  const platform = detectPlatform();
  console.log(`Better Sidebar: Main World Script Initialized (Platform: ${platform})`);

  switch (platform) {
    case Platform.AI_STUDIO: {
      initAiStudioInterceptors();
      break;
    }
    case Platform.GEMINI: {
      initGeminiInterceptors();
      break;
    }
    default:
      console.warn(`Better Sidebar: Unknown platform (${platform}), no main-world interceptors loaded`);
  }
});
