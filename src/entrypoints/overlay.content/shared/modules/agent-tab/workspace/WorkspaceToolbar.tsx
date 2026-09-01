/**
 * The workspace header: identity, search, and the actions that apply to the whole tree.
 *
 * Two rows, following `SnippetsHeader` — title and view controls above, search and
 * creation below — so the Agent tab's file browser reads as the same kind of panel as
 * Snippets and Library rather than a one-off.
 *
 * Upload is a dropdown rather than two buttons because files and folders are the same
 * intent reached through two different native pickers: `<input multiple>` cannot select a
 * directory and `<input webkitdirectory>` cannot select loose files, so the split exists
 * for the platform's reasons, not the user's. One button keeps that where it belongs.
 */

import React from 'react';
import {
  ArrowLeft,
  FileArchive,
  FilePlus,
  FolderPlus,
  FolderUp,
  Import,
  ListCollapse,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useI18n } from '@/shared/hooks/useI18n';
import { formatBytes } from '@/shared/workspace/file-kinds';

export interface WorkspaceToolbarProps {
  fileCount: number;
  totalBytes: number;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  /** Non-null while a transfer runs; replaces the counts line. */
  progress: string | null;
  onBack: () => void;
  onRefresh: () => void;
  onCollapseAll: () => void;
  onNewFolder: () => void;
  onNewFile: () => void;
  onUploadFiles: () => void;
  onUploadFolder: () => void;
  onExportZip: () => void;
  onClear: () => void;
}

export const WorkspaceToolbar: React.FC<WorkspaceToolbarProps> = ({
  fileCount,
  totalBytes,
  searchTerm,
  onSearchChange,
  progress,
  onBack,
  onRefresh,
  onCollapseAll,
  onNewFolder,
  onNewFile,
  onUploadFiles,
  onUploadFolder,
  onExportZip,
  onClear,
}) => {
  const { t } = useI18n();
  const isEmpty = fileCount === 0;

  return (
    <div className="flex flex-col border-b border-border/60">
      {/* Row 1: back, title, view controls */}
      <div className="flex items-center gap-1 px-2 pt-2">
        <SimpleTooltip content={t('common.back', { defaultValue: 'Back' })}>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
        </SimpleTooltip>

        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold uppercase tracking-wide text-muted-foreground/70">
          {t('agent.workspace.title', { defaultValue: 'Workspace' })}
        </h1>

        <SimpleTooltip content={t('common.refresh', { defaultValue: 'Refresh' })}>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onRefresh}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </SimpleTooltip>

        <SimpleTooltip content={t('menu.collapseAll', { defaultValue: 'Collapse all' })}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onCollapseAll}
          >
            <ListCollapse className="h-3.5 w-3.5" />
          </Button>
        </SimpleTooltip>

        {/* The only way the whole workspace leaves the browser, so it stays a top-level
            control rather than an item inside a menu. */}
        <SimpleTooltip
          content={t('agent.workspace.exportAll', {
            defaultValue: 'Export everything as ZIP',
          })}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            disabled={isEmpty}
            onClick={onExportZip}
          >
            <FileArchive className="h-3.5 w-3.5" />
          </Button>
        </SimpleTooltip>

        <SimpleTooltip
          content={t('agent.workspace.clearAll', { defaultValue: 'Clear all files' })}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
            disabled={isEmpty}
            onClick={onClear}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </SimpleTooltip>
      </div>

      {/* Row 2: search, creation, upload */}
      <div className="flex items-center gap-1 px-2 pb-2 pt-1">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('agent.workspace.searchPlaceholder', {
              defaultValue: 'Search files',
            })}
            className="h-7 pl-7 pr-7 text-xs"
          />
          {searchTerm && (
            <button
              type="button"
              aria-label={t('common.clear', { defaultValue: 'Clear' })}
              className="absolute right-1.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
              onClick={() => onSearchChange('')}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <SimpleTooltip content={t('agent.workspace.newFolder', { defaultValue: 'New folder' })}>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onNewFolder}>
            <FolderPlus className="h-4 w-4" />
          </Button>
        </SimpleTooltip>

        <SimpleTooltip content={t('agent.workspace.newFile', { defaultValue: 'New file' })}>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onNewFile}>
            <FilePlus className="h-4 w-4" />
          </Button>
        </SimpleTooltip>

        {/* No tooltip on the trigger: nesting `SimpleTooltip`'s `asChild` inside the
            trigger's own would have two wrappers competing for the Button's ref. The
            menu's two items name themselves clearly enough. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              aria-label={t('agent.workspace.upload', { defaultValue: 'Upload' })}
            >
              <Import className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onUploadFiles}>
              <Upload className="mr-2 h-4 w-4" />
              {t('agent.workspace.uploadFiles', { defaultValue: 'Upload files…' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onUploadFolder}>
              <FolderUp className="mr-2 h-4 w-4" />
              {t('agent.workspace.uploadFolder', { defaultValue: 'Upload folder…' })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Row 3: progress while transferring, otherwise the counts */}
      {progress ? (
        <div className="flex items-center gap-1.5 px-3 pb-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {progress}
        </div>
      ) : (
        fileCount > 0 && (
          <div className="px-3 pb-1.5 text-[11px] text-muted-foreground">
            {t('agent.workspace.counts', {
              defaultValue: `${fileCount} file(s) · ${formatBytes(totalBytes)}`,
              count: fileCount,
              size: formatBytes(totalBytes),
            })}
          </div>
        )
      )}
    </div>
  );
};
