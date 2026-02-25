import React from 'react';
import { useI18n } from '@/shared/hooks/useI18n';
import { Button } from '@/entrypoints/overlay.content/shared/components/ui/button';
import { Compass, X } from 'lucide-react';

interface TourPromptDialogProps {
  isOpen: boolean;
  onStartTour: () => void;
  onSkip: () => void;
}

export const TourPromptDialog: React.FC<TourPromptDialogProps> = ({
  isOpen,
  onStartTour,
  onSkip,
}) => {
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-8 fade-in-0"
      style={{ zIndex: 99 }}
    >
      <div className="relative w-full max-w-sm bg-background border rounded-xl shadow-2xl flex flex-col p-6">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 z-10 rounded-full w-8 h-8"
          onClick={onSkip}
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="flex flex-col items-center gap-6 py-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary">
            <Compass className="w-8 h-8" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">
              {t('guidedTour.prompt.title')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('guidedTour.prompt.description')}
            </p>
          </div>
          <div className="flex w-full gap-3">
            <Button variant="outline" className="flex-1" onClick={onSkip}>
              {t('guidedTour.prompt.skip')}
            </Button>
            <Button className="flex-1 gap-2" onClick={onStartTour}>
              <Compass className="w-4 h-4" />
              {t('guidedTour.prompt.start')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
