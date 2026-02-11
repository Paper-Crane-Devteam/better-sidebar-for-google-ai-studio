import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Layout } from 'lucide-react';
import { useSettingsStore } from '@/shared/lib/settings-store';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import { useI18n } from '@/shared/hooks/useI18n';

interface OverlayToggleProps {
  onToggle: () => void;
}

export const OverlayToggle = ({ onToggle }: OverlayToggleProps) => {
  const { t } = useI18n();
  const { overlayPosition, theme } = useSettingsStore();
  const [isHovered, setIsHovered] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDark = () => {
         if (theme === 'dark') return true;
         if (theme === 'light') return false;
         return globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
    };
    setIsDark(checkDark());
    
    if (theme === 'system') {
        const media = globalThis.matchMedia('(prefers-color-scheme: dark)');
        const listener = (e: MediaQueryListEvent) => setIsDark(e.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }
  }, [theme]);

  const buttonStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10000,
    bottom: '1rem',
    [overlayPosition === 'bottom-right' ? 'right' : 'left']: '1rem',
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    backgroundColor: isDark ? '#27272a' : '#ffffff',
    border: isDark ? '1px solid #3f3f46' : '1px solid #e4e4e7',
    color: isDark ? '#f4f4f5' : '#18181b',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    transform: isHovered ? 'scale(1.1)' : 'scale(1)',
    outline: 'none',
    padding: 0,
  };

  return createPortal(
    <div style={{ position: 'fixed', zIndex: 10000, bottom: '1rem', [overlayPosition === 'bottom-right' ? 'right' : 'left']: '1rem' }}>
        <SimpleTooltip content={t('overlay.showSidepanel')} side={overlayPosition === 'bottom-right' ? 'left' : 'right'}>
            <button
                style={{ ...buttonStyle, position: 'static' }}
                onClick={onToggle}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                aria-label={t('overlay.showSidepanel')}
            >
                <Layout style={{ width: '20px', height: '20px' }} />
            </button>
        </SimpleTooltip>
    </div>,
    document.body
  );
};

