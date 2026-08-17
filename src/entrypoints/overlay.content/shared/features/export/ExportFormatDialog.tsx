import React from 'react';
import { MessageSquare, FileCode, Braces } from 'lucide-react';
import { useModalStore } from '@/shared/lib/modal';
import obsidianIcon from '@/assets/icons/obsidian.svg';
import notionIcon from '@/assets/icons/notion.svg';
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
      icon: <img src={obsidianIcon} alt="Obsidian" className="h-5 w-5" />,
      label: i18n.t('export.exportToObsidian'),
      description: i18n.t('export.descObsidian'),
    },
    {
      format: 'notion',
      icon: <img src={notionIcon} alt="Notion" className="h-5 w-5" />,
      label: i18n.t('export.exportToNotion'),
      description: i18n.t('export.descNotion'),
    },
  ];
}

interface ExportFormatContentProps {
  onSelect: (format: ExportFormat) => void;
  /** Restrict which formats are offered. Undefined shows all of them. */
  allowed?: readonly ExportFormat[];
}

const ExportFormatContent = ({ onSelect, allowed }: ExportFormatContentProps) => {
  const options = allowed
    ? getFormatOptions().filter((opt) => allowed.includes(opt.format))
    : getFormatOptions();

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

export interface ExportDialogOptions {
  /** Only offer these formats. Defaults to all five. */
  allowed?: readonly ExportFormat[];
  /** Modal title override */
  title?: string;
  /** Called when the dialog is dismissed without a choice */
  onCancel?: () => void;
  /** Modal id, used to detect dismissal from outside */
  id?: string;
}

/**
 * Opens a modal dialog for selecting export format.
 * When user clicks a format, the modal closes and `onSelect` is called.
 */
export function openExportDialog(
  onSelect: (format: ExportFormat) => void,
  options: ExportDialogOptions = {},
): void {
  const handleSelect = (format: ExportFormat) => {
    useModalStore.getState().close();
    onSelect(format);
  };

  const dismiss = () => {
    useModalStore.getState().close();
    options.onCancel?.();
  };

  useModalStore.getState().open({
    id: options.id,
    type: 'info',
    title: options.title || i18n.t('export.export'),
    content: <ExportFormatContent onSelect={handleSelect} allowed={options.allowed} />,
    modalClassName: 'max-w-sm',
    onConfirm: dismiss,
    onCancel: dismiss,
  });
}

/**
 * Promise-flavoured format picker, for callers that aren't components — the agent's
 * `export` tool in particular, which has to await the answer and then keep going.
 *
 * Resolves `null` when the user walks away. That path is guarded twice: through the
 * modal's own cancel callback, and through a subscription that notices the modal
 * leaving the stack by any other route (Esc, backdrop, `closeAll`). A promise left
 * unresolved here would park the agent loop with no way out, so "gone" always counts
 * as "cancelled".
 */
export function pickExportFormat(
  options: Omit<ExportDialogOptions, 'onCancel' | 'id'> = {},
): Promise<ExportFormat | null> {
  return new Promise((resolve) => {
    const id = `export-format-${crypto.randomUUID().slice(0, 8)}`;
    let settled = false;

    const finish = (format: ExportFormat | null) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      resolve(format);
    };

    const unsubscribe = useModalStore.subscribe((state) => {
      if (state.stack.some((m) => m.id === id)) return;
      // Picking a format also removes the modal from the stack — `handleSelect`
      // closes before it calls back — so a disappearance only means "cancelled" if
      // no choice arrives in the same tick. Both happen synchronously, so a
      // microtask is late enough to tell them apart.
      queueMicrotask(() => finish(null));
    });

    openExportDialog((format) => finish(format), {
      ...options,
      id,
      onCancel: () => finish(null),
    });
  });
}
