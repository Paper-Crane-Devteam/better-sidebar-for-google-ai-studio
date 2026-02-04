// Main-world script entry: routes to platform-specific interceptors
// Note: main-world runs in page context; use detectPlatform() from window.location

import { detectPlatform, Platform } from '@/shared/types/platform';

export default defineUnlistedScript(async () => {
  const platform = detectPlatform();
  console.log(`Better Sidebar: Main World Script Initialized (Platform: ${platform})`);

  switch (platform) {
    case Platform.AI_STUDIO: {
      const { initAiStudioInterceptors } = await import('./aistudio');
      initAiStudioInterceptors();
      break;
    }
    case Platform.GEMINI: {
      const { initGeminiInterceptors } = await import('./gemini');
      initGeminiInterceptors();
      break;
    }
    default:
      console.warn(`Better Sidebar: Unknown platform (${platform}), no main-world interceptors loaded`);
  }
});
