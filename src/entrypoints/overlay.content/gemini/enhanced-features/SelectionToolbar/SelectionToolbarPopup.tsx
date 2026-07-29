/**
 * SelectionToolbarPopup — The floating toolbar UI that appears near text selection.
 * Renders action buttons based on user settings.
 */

import type { SelectionToolbarConfig } from '@/shared/lib/pegasus-store';
import { useI18n } from '@/shared/hooks/useI18n';
import {
  QuoteIcon,
  LightbulbIcon,
  BookmarkIcon,
  FileTextIcon,
  ClipboardCopyIcon,
} from 'lucide-react';

interface SelectionToolbarPopupProps {
  visible: boolean;
  position: { top: number; left: number };
  config: SelectionToolbarConfig | undefined;
  onReference: () => void;
  onExplain: () => void;
  onSummarize: () => void;
  onSaveAsSnippet: () => void;
  onCopyAsMarkdown: () => void;
}

export const SelectionToolbarPopup = ({
  visible,
  position,
  config,
  onReference,
  onExplain,
  onSummarize,
  onSaveAsSnippet,
  onCopyAsMarkdown,
}: SelectionToolbarPopupProps) => {
  const { t } = useI18n();

  if (!visible) return null;

  const actions = [
    {
      key: 'reference' as const,
      enabled: config?.reference ?? true,
      icon: QuoteIcon,
      label: t('geminiUI.selectionToolbarReference'),
      onClick: onReference,
    },
    {
      key: 'explain' as const,
      enabled: config?.explain ?? true,
      icon: LightbulbIcon,
      label: t('geminiUI.selectionToolbarExplain'),
      onClick: onExplain,
    },
    {
      key: 'summarize' as const,
      enabled: config?.summarize ?? true,
      icon: FileTextIcon,
      label: t('geminiUI.selectionToolbarSummarize'),
      onClick: onSummarize,
    },
    {
      key: 'saveAsSnippet' as const,
      enabled: config?.saveAsSnippet ?? true,
      icon: BookmarkIcon,
      label: t('geminiUI.selectionToolbarSaveAsSnippet'),
      onClick: onSaveAsSnippet,
    },
    {
      key: 'copyAsMarkdown' as const,
      enabled: config?.copyAsMarkdown ?? true,
      icon: ClipboardCopyIcon,
      label: t('geminiUI.selectionToolbarCopyAsMarkdown'),
      onClick: onCopyAsMarkdown,
    },
  ].filter((a) => a.enabled);

  if (actions.length === 0) return null;

  return (
    <div
      className="fixed pointer-events-auto animate-in fade-in zoom-in-95 duration-150"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
      }}
    >
      <div className="flex items-center gap-1 rounded-lg bg-popover p-1 shadow-lg">
        {actions.map(({ key, icon: Icon, label, onClick }) => (
          <button
            key={key}
            type="button"
            title={label}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClick();
            }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
