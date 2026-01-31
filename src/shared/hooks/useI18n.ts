import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/shared/lib/settings-store';

export const useI18n = () => {
  const { t, i18n } = useTranslation();
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  const changeLanguage = async (lng: 'zh-CN' | 'en') => {
    await i18n.changeLanguage(lng);
    // Save to settings store (which persists to chrome storage)
    setLanguage(lng);
  };

  return {
    t,
    i18n,
    changeLanguage,
    currentLanguage: i18n.language as 'zh-CN' | 'en',
  };
};
