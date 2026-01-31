import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/zh-tw';
import 'dayjs/locale/ja';
import 'dayjs/locale/pt';
import 'dayjs/locale/es';
import 'dayjs/locale/ru';
import zhCN from './zh-CN.json';
import zhTW from './zh-TW.json';
import en from './en.json';
import ja from './ja.json';
import pt from './pt.json';
import es from './es.json';
import ru from './ru.json';
import { useSettingsStore } from '@/shared/lib/settings-store';

// Get language from settings store or browser language
const getInitialLanguage = (): string => {
  // Try to get from settings store synchronously
  try {
    const state = useSettingsStore.getState();
    if (state.language) {
      return state.language;
    }
  } catch {
    // Settings store might not be initialized yet, ignore
  }
  
  // Fallback to browser language
  const browserLang = navigator.language || navigator.languages?.[0] || 'en';
  if (browserLang.startsWith('zh-TW') || browserLang.startsWith('zh-Hant')) {
    return 'zh-TW';
  }
  if (browserLang.startsWith('zh')) {
    return 'zh-CN';
  }
  if (browserLang.startsWith('ja')) {
    return 'ja';
  }
  if (browserLang.startsWith('pt')) {
    return 'pt';
  }
  if (browserLang.startsWith('es')) {
    return 'es';
  }
  if (browserLang.startsWith('ru')) {
    return 'ru';
  }
  return 'en';
};

// Map i18next language codes to dayjs locale codes
const mapLanguageToDayjs = (lang: string): string => {
  switch (lang) {
    case 'zh-CN': return 'zh-cn';
    case 'zh-TW': return 'zh-tw';
    case 'ja': return 'ja';
    case 'pt': return 'pt';
    case 'es': return 'es';
    case 'ru': return 'ru';
    default: return 'en';
  }
};

// Initialize i18n
const initI18n = () => {
  const lng = getInitialLanguage();
  
  // Initialize dayjs
  dayjs.extend(localizedFormat);
  dayjs.locale(mapLanguageToDayjs(lng));
  
  i18n
    .use(initReactI18next)
    .init({
      resources: {
        'zh-CN': {
          translation: zhCN,
        },
        'zh-TW': {
          translation: zhTW,
        },
        en: {
          translation: en,
        },
        ja: {
          translation: ja,
        },
        pt: {
          translation: pt,
        },
        es: {
          translation: es,
        },
        ru: {
          translation: ru,
        },
      },
      lng,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false, // React already escapes values
      },
    });

  // Subscribe to language changes from settings store
  if (globalThis.window !== undefined) {
    let previousLanguage = useSettingsStore.getState().language;
    useSettingsStore.subscribe((state) => {
      const currentLanguage = state.language;
      const supportedLanguages = ['zh-CN', 'zh-TW', 'en', 'ja', 'pt', 'es', 'ru'];
      if (currentLanguage !== previousLanguage && supportedLanguages.includes(currentLanguage)) {
        i18n.changeLanguage(currentLanguage);
        dayjs.locale(mapLanguageToDayjs(currentLanguage));
        previousLanguage = currentLanguage;
      }
    });
  }
};

// Initialize immediately
initI18n();

export default i18n;
