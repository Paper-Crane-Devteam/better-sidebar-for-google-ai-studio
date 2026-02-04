import { useEffect } from 'react';
import { useSettingsStore } from '@/shared/lib/settings-store';

export const useTheme = () => {
    const { theme, setTheme } = useSettingsStore();

    // Apply theme side effects
    useEffect(() => {
        const applyTheme = (t: typeof theme) => {
            const isSystemDark = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
            const isDark = t === 'dark' || (t === 'system' && isSystemDark);

            if (isDark) {
                document.body.classList.add('dark-theme');
                document.body.classList.remove('light-theme');
            } else {
                document.body.classList.add('light-theme');
                document.body.classList.remove('dark-theme');
            }
        };

        applyTheme(theme);

        // Listen for system changes if mode is system
        if (theme === 'system') {
            const mediaQuery = globalThis.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = () => applyTheme('system');
            
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
    }, [theme]);

    return { theme, setTheme };
};
