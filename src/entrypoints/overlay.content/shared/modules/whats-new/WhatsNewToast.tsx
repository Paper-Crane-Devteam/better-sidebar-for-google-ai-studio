import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useWhatsNew } from './useWhatsNew';
import { CURRENT_VERSION } from './changelog';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Z_INDEX } from '@/shared/lib/z-index';

export const WhatsNewToast: React.FC = () => {
  const { t } = useTranslation();
  const { isToastOpen, closeToast, openWhatsNew } = useWhatsNew();

  useEffect(() => {
    if (!isToastOpen) return;

    // Auto dismiss after 6 seconds
    const timer = setTimeout(() => {
      closeToast();
    }, 6000);

    return () => clearTimeout(timer);
  }, [isToastOpen, closeToast]);

  if (!isToastOpen) return null;

  const handleViewDetails = () => {
    closeToast();
    openWhatsNew({ showAll: true });
  };

  return (
    <div
      className="fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl animate-in slide-in-from-bottom-5 fade-in duration-300"
      style={{
        zIndex: Z_INDEX.TOAST,
        backgroundColor: 'var(--panel-bg)',
        boxShadow: 'var(--shadow-panel)',
        color: 'var(--foreground)',
      }}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-yellow-500/10 shrink-0">
        <Sparkles className="w-4 h-4 text-yellow-500 fill-yellow-500" />
      </div>
      <div className="text-xs font-medium pr-1">
        {t('whatsNew.toastTitle', { version: CURRENT_VERSION })}
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="h-7 px-2.5 text-xs font-semibold shrink-0"
        onClick={handleViewDetails}
      >
        {t('whatsNew.viewDetails')}
      </Button>
      <button
        onClick={closeToast}
        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/50 ml-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
