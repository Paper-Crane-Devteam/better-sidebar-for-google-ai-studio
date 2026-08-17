import { useCallback } from 'react';
import { toast } from '@/shared/lib/toast';
import { useI18n } from '@/shared/hooks/useI18n';
import type { ExportFormat, ExportItem, ExportItemsOptions } from './types';
import { exportItemsToFiles, type FileExportFormat } from './export-core';
import { openInObsidian } from './obsidian';
import { exportToNotion, createNotionPage } from './notion';
import { useSettingsStore } from '@/shared/lib/settings-store';
import { showPowerPackPaywall } from '@/shared/lib/powerpack-paywall';

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
   * Run a file-format export through the shared core and turn the outcome into a toast.
   * The agent's `export` tool calls the same core, so both produce identical files.
   */
  const runFileExport = useCallback(
    async (items: ExportItem[], format: FileExportFormat, batchName?: string) => {
      const result = await exportItemsToFiles(items, format, { multiFileZip, batchName });

      if (!result.ok) {
        toast.error(result.reason === 'no-items' ? t('export.noItems') : t('export.noContent'));
        return;
      }

      toast.success(
        result.count === 1
          ? t('export.exported')
          : t('export.exportedCount', { count: result.count }),
      );
    },
    [multiFileZip, t],
  );

  /**
   * Export a single item in the specified format.
   */
  const exportItem = useCallback(
    (item: ExportItem, format: ExportFormat) => {
      switch (format) {
        case 'text':
        case 'markdown':
        case 'json': {
          void runFileExport([item], format);
          break;
        }
        case 'obsidian': {
          if (!item.content) {
            toast.error(t('export.noContent'));
            return;
          }
          if (!showPowerPackPaywall('Export to Obsidian')) return;
          void openInObsidian(item, obsidianVault, obsidianFolder).then(() => {
            toast.success(t('export.openedInObsidian'));
          });
          break;
        }
        case 'notion': {
          if (!item.content) {
            toast.error(t('export.noContent'));
            return;
          }
          if (!showPowerPackPaywall('Export to Notion')) return;
          const { integrations } = useSettingsStore.getState();
          if (!integrations.notion.apiKey || !integrations.notion.parentPageId) {
            toast.error(t('integrations.notionNotConfigured'));
            return;
          }
          const loadingId = toast.info(t('integrations.exportingToNotion'), Infinity);
          void createNotionPage(item).then((result) => {
            toast.dismiss(loadingId);
            if (result.ok) {
              if (result.url) {
                toast.withAction(
                  t('integrations.exportedToNotion'),
                  'success',
                  { label: t('common.view'), onClick: () => window.open(result.url, '_blank') },
                  6000,
                );
              } else {
                toast.success(t('integrations.exportedToNotion'));
              }
            } else {
              toast.error(result.error || 'Export failed');
            }
          });
          break;
        }
      }
    },
    [t, runFileExport, obsidianVault, obsidianFolder],
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

      switch (format) {
        case 'text':
        case 'markdown':
        case 'json': {
          void runFileExport(items, format, name);
          break;
        }
        case 'obsidian': {
          if (!showPowerPackPaywall('Export to Obsidian')) return;
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
          if (!showPowerPackPaywall('Export to Notion')) return;
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
                const lastUrl = result.urls[result.urls.length - 1];
                if (lastUrl) {
                  toast.withAction(
                    t('integrations.exportedToNotionCount', { count: result.count }),
                    'success',
                    { label: t('common.view'), onClick: () => window.open(lastUrl, '_blank') },
                    6000,
                  );
                } else {
                  toast.success(t('integrations.exportedToNotionCount', { count: result.count }));
                }
              } else {
                toast.error(result.error || 'Export failed');
              }
            });
          } else {
            const loadingId = toast.info(t('integrations.exportingToNotion'), Infinity);
            void exportToNotion(items).then((result) => {
              toast.dismiss(loadingId);
              if (result.ok) {
                const lastUrl = result.urls[result.urls.length - 1];
                if (lastUrl) {
                  toast.withAction(
                    t('integrations.exportedToNotionCount', { count: result.count }),
                    'success',
                    { label: t('common.view'), onClick: () => window.open(lastUrl, '_blank') },
                    6000,
                  );
                } else {
                  toast.success(t('integrations.exportedToNotionCount', { count: result.count }));
                }
              } else {
                toast.error(result.error || 'Export failed');
              }
            });
          }
          break;
        }
      }
    },
    [t, exportItem, runFileExport, obsidianVault, obsidianFolder, batchPrefix],
  );

  return { exportItem, exportItems };
}
