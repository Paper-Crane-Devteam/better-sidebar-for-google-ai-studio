import { useTheme } from '../modules/settings/hooks/useTheme';

export const useAppInit = () => {
    // Initialize Theme
    useTheme();
    
    // Future: Initialize other settings like auto-scan
};

