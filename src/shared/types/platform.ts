// Platform definitions for multi-platform support
import AIStudioIcon from '@/assets/icons/aistudio.png';
import GeminiIcon from '@/assets/icons/gemini.svg';
import ChatGPTIcon from '@/assets/icons/chatgpt.svg';
import ClaudeIcon from '@/assets/icons/claude.svg';

export enum Platform {
  AI_STUDIO = 'aistudio',
  GEMINI = 'gemini',
  CHATGPT = 'chatgpt',
  CLAUDE = 'claude',
  UNKNOWN = 'unknown',
}

export interface PlatformConfig {
  id: Platform;
  name: string;
  hostname: string;
  urlPattern: string;
  icon: string;
  color: string;
  promptUrlTemplate: (id?: string) => string;
}

export const PLATFORM_CONFIG: Record<
  Platform,
  PlatformConfig
> = {
  [Platform.AI_STUDIO]: {
    id: Platform.AI_STUDIO,
    name: 'Google AI Studio',
    hostname: 'aistudio.google.com',
    urlPattern: 'https://aistudio.google.com',
    icon: AIStudioIcon,
    color: 'blue',
    promptUrlTemplate: (id?: string) =>
      `https://aistudio.google.com/prompts/${id || ''}`,
  },
  [Platform.GEMINI]: {
    id: Platform.GEMINI,
    name: 'Google Gemini',
    hostname: 'gemini.google.com',
    urlPattern: 'https://gemini.google.com',
    icon: GeminiIcon,
    color: 'purple',
    promptUrlTemplate: (id?: string) => `https://gemini.google.com/app/${id || ''}`,
  },
  [Platform.CHATGPT]: {
    id: Platform.CHATGPT,
    name: 'ChatGPT',
    hostname: 'chatgpt.com',
    urlPattern: 'https://chatgpt.com',
    icon: ChatGPTIcon,
    color: 'green',
    promptUrlTemplate: (id?: string) => `https://chatgpt.com/c/${id || ''}`,
  },
  [Platform.CLAUDE]: {
    id: Platform.CLAUDE,
    name: 'Claude',
    hostname: 'claude.ai',
    urlPattern: 'https://claude.ai',
    icon: ClaudeIcon,
    color: 'orange',
    promptUrlTemplate: (id?: string) => `https://claude.ai/chat/${id || ''}`,
  },
  [Platform.UNKNOWN]: {
    id: Platform.UNKNOWN,
    name: 'Unknown',
    hostname: '',
    urlPattern: '',
    icon: 'question',
    color: 'gray',
    promptUrlTemplate: (id?: string) => '',
  },
};

/**
 * Detect current platform based on hostname
 * Can be used in content scripts and main-world scripts
 */
export function detectPlatform(
  hostname: string = typeof window !== 'undefined'
    ? window.location.hostname
    : ''
): Platform {
  for (const [platform, config] of Object.entries(PLATFORM_CONFIG)) {
    if (hostname === config.hostname) {
      console.log('Detected platform:', platform);
      return platform as Platform;
    }
  }
  return Platform.UNKNOWN;
}

/**
 * Get platform config, returns undefined for UNKNOWN platform
 */
export function getPlatformConfig(
  platform: Platform
): PlatformConfig | undefined {
  if (platform === Platform.UNKNOWN) return undefined;
  return PLATFORM_CONFIG[platform];
}

/**
 * Get all supported platform URL patterns for manifest
 */
export function getAllUrlPatterns(): string[] {
  return Object.values(PLATFORM_CONFIG).map((config) => config.urlPattern);
}

/**
 * Get all supported hostnames
 */
export function getAllHostnames(): string[] {
  return Object.values(PLATFORM_CONFIG).map((config) => config.hostname);
}
