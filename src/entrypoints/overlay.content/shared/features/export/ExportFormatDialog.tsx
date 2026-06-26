import React from 'react';
import { MessageSquare, FileCode, Braces } from 'lucide-react';
import { useModalStore } from '@/shared/lib/modal';
import { ObsidianIcon, NotionIcon } from './icons';
import type { ExportFormat } from './types';
import i18n from '@/locale/i18n';

interface FormatOption {
  format: ExportFormat;
  icon: React.ReactNode;
  label: string;
  description: string;
}

function getFormatOptions(): FormatOption[] {
  return [
    {
      format: 'markdown',
      icon: <FileCode className="h-5 w-5" />,
      label: i18n.t('export.exportAsMarkdown'),
      description: i18n.t('export.descMarkdown'),
    },
    {
      format: 'text',
      icon: <MessageSquare className="h-5 w-5" />,
      label: i18n.t('export.exportAsText'),
      description: i18n.t('export.descText'),
    },
    {
      format: 'json',
      icon: <Braces className="h-5 w-5" />,
      label: i18n.t('export.exportAsJson'),
      description: i18n.t('export.descJson'),
    },
    {
      format: 'obsidian',
      icon: <ObsidianIcon className="h-5 w-5" />,
      label: i18n.t('export.exportToObsidian'),
      description: i18n.t('export.descObsidian'),
    },
    {
      format: 'notion',
      icon: <NotionIcon className="h-5 w-5" />,
      label: i18n.t('export.exportToNotion'),
      description: i18n.t('export.descNotion'),
    },
  ];
}

interface ExportFormatContentProps {
  onSelect: (format: ExportFormat) => void;
}

const ExportFormatContent = ({ onSelect }: ExportFormatContentProps) => {
  const options = getFormatOptions();

  return (
    <div className="flex flex-col gap-2 py-2">
      {options.map((opt) => (
        <button
          key={opt.format}
          type="button"
          className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-border hover:bg-accent/50 hover:border-primary/30 transition-colors text-left w-full"
          onClick={() => onSelect(opt.format)}
        >
          <div className="flex-shrink-0 text-muted-foreground">
            {opt.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">{opt.label}</div>
            <div className="text-xs text-muted-foreground">{opt.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
};

/**
 * Opens a modal dialog for selecting export format.
 * When user clicks a format, the modal closes and `onSelect` is called.
 */
export function openExportDialog(onSelect: (format: ExportFormat) => void): void {
  const handleSelect = (format: ExportFormat) => {
    useModalStore.getState().close();
    onSelect(format);
  };

  useModalStore.getState().open({
    type: 'info',
    title: i18n.t('export.export'),
    content: <ExportFormatContent onSelect={handleSelect} />,
    modalClassName: 'max-w-sm',
    onConfirm: () => useModalStore.getState().close(),
    onCancel: () => useModalStore.getState().close(),
  });
}
