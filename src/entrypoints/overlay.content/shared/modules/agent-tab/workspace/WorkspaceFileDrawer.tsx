/**
 * WorkspaceFileDrawer — read a workspace file, to the right of the sidebar.
 *
 * Mounted at the platform's top level (next to `SnippetReaderDrawer`), not inside the
 * Agent tab. A panel nested in the tab is clipped by it, so it could only ever cover the
 * file tree it was opened from; the reading area has to start where the sidebar ends.
 * `fixed inset-0` plus `left: <sidebar width>` is how the snippet reader does it, and the
 * width is measured rather than assumed because the sidebar is resizable.
 *
 * Markdown is rendered; everything else is monospace text. No syntax highlighting — the
 * project carries no highlighter, and adding one for a preview pane is a poor trade
 * against the bundle it costs.
 */

import React, { useEffect, useState } from 'react';
import { Copy, Download, Loader2, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { MarkdownRenderer } from '@/shared/components/MarkdownRenderer';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import { useI18n } from '@/shared/hooks/useI18n';
import { toast } from '@/shared/lib/toast';
import { cn } from '@/shared/lib/utils/utils';
import { forWorkspace } from '@/shared/workspace/client';
import { useFileViewerStore } from '../../agent-loop/workspace/file-viewer-store';

/** Extensions rendered as Markdown rather than shown as source. */
const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'mdx'];

function extensionOf(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? '' : base.slice(dot + 1).toLowerCase();
}

export const WorkspaceFileDrawer: React.FC = () => {
  const { t } = useI18n();
  const open = useFileViewerStore((s) => s.open);
  const close = useFileViewerStore((s) => s.close);

  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const path = open?.path ?? null;
  const workspaceId = open?.workspaceId ?? null;

  // Fade in on the frame after mount, so the transition has two states to move between.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [open]);

  useEffect(() => {
    if (!workspaceId || !path) return;

    let cancelled = false;
    setContent(null);
    setError(null);

    forWorkspace(workspaceId)
      .read(path)
      .then((result) => {
        // The drawer can be closed, or switched to another file, while this is in
        // flight; writing then would show one file's body under another's name.
        if (!cancelled) setContent(result.content);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, path]);

  /**
   * Where the sidebar ends — the drawer's left edge.
   *
   * Measured from the live element and observed for resizes, because the sidebar can be
   * dragged wider. A hardcoded width would leave the drawer either overlapping it or
   * floating away from it after any resize.
   */
  const [sidebarWidth, setSidebarWidth] = useState(360);
  useEffect(() => {
    if (!open) return;
    const sidebarEl = (document.querySelector('bard-sidenav') ||
      document.getElementById(
        'better-sidebar-for-google-ai-studio-sidebar-wrapper',
      )) as HTMLElement | null;
    if (!sidebarEl) return;

    setSidebarWidth(sidebarEl.getBoundingClientRect().width);

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver((entries) => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const last = entries[entries.length - 1];
        if (last) setSidebarWidth(last.contentRect.width);
      }, 150);
    });
    observer.observe(sidebarEl);
    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      observer.disconnect();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open || !path) return null;

  const name = path.slice(path.lastIndexOf('/') + 1);
  const isMarkdown = MARKDOWN_EXTENSIONS.includes(extensionOf(path));

  const handleCopy = async () => {
    if (content == null) return;
    await navigator.clipboard.writeText(content);
    toast.success(t('common.copied', { defaultValue: 'Copied' }));
  };

  /**
   * Save the file to disk.
   *
   * The one route out of OPFS: nothing outside the browser can reach these bytes, so a
   * workspace without this is a one-way store.
   */
  const handleDownload = () => {
    if (content == null) return;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-[9998] flex transition-opacity duration-200',
        isVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      style={{ left: `${sidebarWidth}px` }}
    >
      {/* Backdrop — clicking the page outside the reader closes it */}
      <div
        className="absolute inset-0 bg-background/95 backdrop-blur-sm"
        onClick={close}
      />

      <div
        className={cn(
          'relative flex h-full w-full flex-col transition-transform duration-300 ease-out',
          isVisible ? 'translate-x-0' : 'translate-x-[20px]',
        )}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center gap-2 bg-background/80 px-6 py-4 backdrop-blur-sm">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-foreground">{name}</h2>
            {/* The full path only earns its line when it says something the name doesn't */}
            {path !== name && (
              <p className="truncate text-xs text-muted-foreground">{path}</p>
            )}
          </div>

          <SimpleTooltip content={t('common.copy', { defaultValue: 'Copy' })}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={content == null}
              onClick={handleCopy}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </SimpleTooltip>

          <SimpleTooltip content={t('common.download', { defaultValue: 'Download' })}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={content == null}
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
            </Button>
          </SimpleTooltip>

          <SimpleTooltip content={t('common.close', { defaultValue: 'Close' })}>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={close}>
              <X className="h-4 w-4" />
            </Button>
          </SimpleTooltip>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-10">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : content == null ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : content === '' ? (
            <p className="text-sm text-muted-foreground">
              {t('agent.workspace.emptyFile', { defaultValue: 'This file is empty.' })}
            </p>
          ) : isMarkdown ? (
            // Constrained so long prose does not run the full width of a wide window.
            <div className="max-w-3xl">
              <MarkdownRenderer>{content}</MarkdownRenderer>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground">
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
