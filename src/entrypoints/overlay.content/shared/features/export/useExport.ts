import { useCallback } from 'react';
import { toast } from '@/shared/lib/toast';
import { useI18n } from '@/shared/hooks/useI18n';
import type { ExportFormat, ExportItem, ExportItemsOptions } from './types';
import {
  safeFilename,
  buildExportText,
  buildExportMarkdown,
  buildExportJson,
  downloadBlob,
} from './utils';
import { openInObsidian } from './obsidian';
import { exportToNotion, createNotionPage } from './notion';
import { useSettingsStore } from '@/shared/lib/settings-store';

interface UseExportOptions {
  /** Obsidian vault name (optional, uses last-opened vault if omitted) */
  obsidianVault?: string;
  /** Folder path inside the Obsidian vault */
  obsidianFolder?: string;
  /**
   * When true, multi-item export for text/md/json creates a zip (one file per item).
   * When false (default), multiple items are merged into a single file.
   */
  multiFileZip?: boolean;
  /** Filename prefix for batch export (default: "export") */
  batchPrefix?: string;
}

/**
 * Shared export hook that provides format-agnostic export capabilities.
 * Can be used by explorer, snippets, or any other module.
 */
export function useExport(options: UseExportOptions = {}) {
  const { t } = useI18n();
  const {
    obsidianVault,
    obsidianFolder = 'Snippets',
    multiFileZip = false,
    batchPrefix = 'export',
  } = options;

  /**
   * Export a single item in the specified format.
   */
  const exportItem = useCallback(
    (item: ExportItem, format: ExportFormat) => {
      if (!item.content && format !== 'json') {
        toast.error(t('export.noContent'));
        return;
      }

      const baseName = safeFilename(item.title);

      switch (format) {
        case 'text': {
          const text = buildExportText(item);
          const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
          downloadBlob(blob, `${baseName}.txt`);
          toast.success(t('export.exported'));
          break;
        }
        case 'markdown': {
          const md = buildExportMarkdown(item);
          const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
          downloadBlob(blob, `${baseName}.md`);
          toast.success(t('export.exported'));
          break;
        }
        case 'json': {
          const json = buildExportJson([item]);
          const blob = new Blob([json], {
            type: 'application/json;charset=utf-8',
          });
          downloadBlob(blob, `${baseName}.json`);
          toast.success(t('export.exported'));
          break;
        }
        case 'obsidian': {
          void openInObsidian(item, obsidianVault, obsidianFolder).then(() => {
            toast.success(t('export.openedInObsidian'));
          });
          break;
        }
        case 'notion': {
          const { integrations } = useSettingsStore.getState();
          if (!integrations.notion.apiKey || !integrations.notion.parentPageId) {
            toast.error(t('integrations.notionNotConfigured'));
            return;
          }
          toast.success(t('integrations.exportingToNotion'));
          void createNotionPage(item).then((result) => {
            if (result.ok) {
              toast.success(t('integrations.exportedToNotion'));
            } else {
              toast.error(result.error || 'Export failed');
            }
          });
          break;
        }
      }
    },
    [t, obsidianVault, obsidianFolder],
  );

  /**
   * Export multiple items as a zip (one file per item).
   */
  const exportItemsAsZip = useCallback(
    async (items: ExportItem[], format: 'text' | 'markdown' | 'json', zipName: string) => {
      const { zipSync, strToU8 } = await import('fflate');
      const files: Record<string, Uint8Array> = {};
      const usedNames = new Set<string>();

      for (const item of items) {
        let fname = safeFilename(item.title);
        if (usedNames.has(fname)) {
          let counter = 2;
          while (usedNames.has(`${fname} (${counter})`)) counter++;
          fname = `${fname} (${counter})`;
        }
        usedNames.add(fname);

        let content: string;
        let ext: string;
        if (format === 'text') {
          content = buildExportText(item);
          ext = 'txt';
        } else if (format === 'markdown') {
          content = buildExportMarkdown(item);
          ext = 'md';
        } else {
          content = buildExportJson([item]);
          ext = 'json';
        }
        files[`${fname}.${ext}`] = strToU8(content);
      }

      const zipData = zipSync(files, { level: 6 });
      const blob = new Blob([zipData], { type: 'application/zip' });
      downloadBlob(blob, `${zipName}.zip`);
      toast.success(t('export.exportedCount', { count: items.length }));
    },
    [t],
  );

  /**
   * Export multiple items merged into a single file.
   */
  const exportItemsMerged = useCallback(
    (items: ExportItem[], format: 'text' | 'markdown' | 'json', filename: string) => {
      if (format === 'text') {
        const text = items
          .map((item) => `# ${item.title}\n\n${buildExportText(item)}`)
          .join('\n\n---\n\n');
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        downloadBlob(blob, `${filename}.txt`);
      } else if (format === 'markdown') {
        const md = items
          .map((item) => buildExportMarkdown(item))
          .join('\n---\n\n');
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        downloadBlob(blob, `${filename}.md`);
      } else {
        const json = buildExportJson(items);
        const blob = new Blob([json], {
          type: 'application/json;charset=utf-8',
        });
        downloadBlob(blob, `${filename}.json`);
      }
      toast.success(t('export.exportedCount', { count: items.length }));
    },
    [t],
  );

  /**
   * Export multiple items in the specified format.
   */
  const exportItems = useCallback(
    (items: ExportItem[], format: ExportFormat, options?: ExportItemsOptions) => {
      if (items.length === 0) {
        toast.error(t('export.noItems'));
        return;
      }

      // Single item: delegate to exportItem
      if (items.length === 1) {
        exportItem(items[0], format);
        return;
      }

      const name = options?.batchName || batchPrefix;
      const timestamp = new Date().toISOString().slice(0, 10);

      switch (format) {
        case 'text':
        case 'markdown':
        case 'json': {
          const filename = `${safeFilename(name)}-${timestamp}`;
          if (multiFileZip) {
            void exportItemsAsZip(items, format, filename);
          } else {
            exportItemsMerged(items, format, filename);
          }
          break;
        }
        case 'obsidian': {
          // Always combine into a single Obsidian note
          const combined: ExportItem = {
            id: 'batch-export',
            title: name,
            content: items
              .map((item) => `## ${item.title}\n\n${item.content || ''}`)
              .join('\n\n---\n\n'),
            createdAt: Math.floor(Date.now() / 1000),
          };
          void openInObsidian(combined, obsidianVault, obsidianFolder).then(() => {
            toast.success(t('export.openedInObsidian'));
          });
          break;
        }
        case 'notion': {
          const { integrations } = useSettingsStore.getState();
          if (!integrations.notion.apiKey || !integrations.notion.parentPageId) {
            toast.error(t('integrations.notionNotConfigured'));
            return;
          }

          // For 2+ items, show progress toast with cancel button
          if (items.length > 2) {
            let cancelled = false;
            const toastId = toast.withAction(
              t('integrations.notionProgress', { current: 0, total: items.length }),
              'info',
              { label: t('common.cancel'), onClick: () => { cancelled = true; } },
            );

            void exportToNotion(items, {
              onProgress: (completed, total) => {
                toast.update(toastId, {
                  message: t('integrations.notionProgress', { current: completed, total }),
                });
              },
              shouldCancel: () => cancelled,
            }).then((result) => {
              toast.dismiss(toastId);
              if (result.cancelled) {
                toast.info(t('integrations.notionCancelled', { count: result.count }));
              } else if (result.ok) {
                toast.success(t('integrations.exportedToNotionCount', { count: result.count }));
              } else {
                toast.error(result.error || 'Export failed');
              }
            });
          } else {
            toast.info(t('integrations.exportingToNotion'));
            void exportToNotion(items).then((result) => {
              if (result.ok) {
                toast.success(t('integrations.exportedToNotionCount', { count: result.count }));
              } else {
                toast.error(result.error || 'Export failed');
              }
            });
          }
          break;
        }
      }
    },
    [t, exportItem, exportItemsAsZip, exportItemsMerged, multiFileZip, obsidianVault, obsidianFolder, batchPrefix],
  );

  return { exportItem, exportItems };
}
