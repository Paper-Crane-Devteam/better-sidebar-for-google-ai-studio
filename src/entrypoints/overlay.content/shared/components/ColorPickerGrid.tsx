import React from 'react';
import { Check } from 'lucide-react';
import { COLOR_PRESETS } from '@/shared/lib/preset-colors';
import { useI18n } from '@/shared/hooks/useI18n';
import { cn } from '@/shared/lib/utils/utils';

interface ColorPickerGridProps {
  selectedColor: string | null;
  onColorChange: (color: string | null) => void;
  className?: string;
  size?: 'sm' | 'lg';
}

/**
 * A reusable color picker grid component with preset colors.
 * Used by folders and tags to select a color.
 */
export const ColorPickerGrid = ({
  selectedColor,
  onColorChange,
  className,
  size = 'sm',
}: ColorPickerGridProps) => {
  const { t } = useI18n();

  const buttonClass = size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';
  const iconClass = size === 'lg' ? 'w-4 h-4' : 'w-3 h-3';

  return (
    <div className={cn("flex flex-wrap gap-2", size === 'lg' ? 'w-full' : 'max-w-[160px]', className)}>
      {/* Default (no color) */}
      <button
        type="button"
        className={cn(`${buttonClass} rounded-full border-2 border-border flex items-center justify-center hover:scale-110 transition-transform`)}
        onClick={() => onColorChange(null)}
        title={t('folderSettings.defaultColor')}
      >
        {selectedColor === null && (
          <Check className={`${iconClass} text-muted-foreground`} />
        )}
      </button>
      {COLOR_PRESETS.map((preset) => (
        <button
          key={preset.value}
          type="button"
          className={cn(`${buttonClass} rounded-full border-2 border-transparent flex items-center justify-center hover:scale-110 transition-transform`)}
          style={{ backgroundColor: preset.value }}
          onClick={() => onColorChange(preset.value)}
          title={t(preset.labelKey)}
        >
          {selectedColor === preset.value && (
            <Check className={`${iconClass} text-white drop-shadow-sm`} />
          )}
        </button>
      ))}
    </div>
  );
};
