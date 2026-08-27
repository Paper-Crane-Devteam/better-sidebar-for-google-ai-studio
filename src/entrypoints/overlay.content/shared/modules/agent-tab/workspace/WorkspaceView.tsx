/**
 * WorkspaceView — the Agent tab, showing files instead of the launcher.
 *
 * Replaces the tab's contents rather than opening a dialog or claiming a tab of its own.
 * The workspace only means anything in the context of the agent that writes to it, and a
 * sidebar this narrow has no room for a second panel.
 *
 * Read-only by design for now: the agent is the writer, and the useful thing for a person
 * here is seeing what it produced. Copy and download in the file drawer are what make
 * that content reachable from outside the browser.
 */

import React, { useEffect } from 'react';
import { ArrowLeft, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import { useI18n } from '@/shared/hooks/useI18n';
import { modal } from '@/shared/lib/modal';
import { toast } from '@/shared/lib/toast';
import { forWorkspace } from '@/shared/workspace/client';
import { useAgentLoopStore } from '../../agent-loop/agent-loop-store';
import { toolCallRecorder } from '../../agent-loop/records';
import {
  useWorkspaceStore,
  DEFAULT_WORKSPACE_ID,
} from '../../agent-loop/workspace/workspace-store';
import {
  primeBinding,
  useBoundWorkspaceId,
} from '../../agent-loop/workspace/workspace-binding';
import { useFileViewerStore } from '../../agent-loop/workspace/file-viewer-store';
import { useWorkspaceFiles } from './useWorkspaceFiles';
import { promptWorkspaceName } from './promptWorkspaceName';
import { WorkspaceTree } from './WorkspaceTree';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

interface WorkspaceViewProps {
  onBack: () => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({ onBack }) => {
  const { t } = useI18n();

  const activeId = useWorkspaceStore((s) => s.activeId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const removeWorkspace = useWorkspaceStore((s) => s.removeWorkspace);

  const conversationId = toolCallRecorder.currentConversationId;
  const lockedId = useBoundWorkspaceId(conversationId);
  const busy = useAgentLoopStore((s) => s.status) !== 'idle';

  /**
   * A locked conversation is shown *its* workspace, not the selected one.
   *
   * The tree has to agree with where the agent is actually writing, or the panel becomes
   * an argument against the files the transcript describes.
   */
  const shownId = lockedId ?? activeId;

  const openFile = useFileViewerStore((s) => s.openFile);
  const closeFile = useFileViewerStore((s) => s.close);
  // Only to mark the selected row. The reader itself lives outside this tab.
  const openPath = useFileViewerStore((s) => s.open?.path ?? null);

  const { tree, fileCount, loading, error, reload } = useWorkspaceFiles(shownId);

  // The lock lives in the database; the switcher needs it before its first paint or it
  // would briefly offer a dropdown for a conversation that cannot switch.
  useEffect(() => {
    void primeBinding(conversationId);
  }, [conversationId]);

  // A file open from the previous workspace has no meaning in this one, and the reader
  // sits outside this component — so it would otherwise stay up after a switch.
  useEffect(() => {
    closeFile();
  }, [shownId, closeFile]);

  const handleCreate = async () => {
    const name = await promptWorkspaceName({
      title: t('agent.workspace.create', { defaultValue: 'New workspace' }),
      confirmText: t('common.create', { defaultValue: 'Create' }),
    });
    // Null means cancelled or left blank — both mean "don't create one".
    if (!name) return;
    // `createWorkspace` selects the new workspace, which is what makes the tree switch
    // to it. A locked conversation keeps showing its own (see `shownId`).
    createWorkspace(name);
  };

  const current = workspaces.find((w) => w.id === shownId);
  const isDefault = shownId === DEFAULT_WORKSPACE_ID;

  /**
   * Delete the workspace and its files.
   *
   * Warns when conversations are bound to it: those chats keep their binding and will
   * report a missing workspace on their next file call, which is worth knowing before
   * confirming rather than discovering later.
   */
  const handleDelete = async () => {
    if (isDefault) return;
    const confirmed = await modal.confirmDelete({
      title: t('agent.workspace.deleteTitle', { defaultValue: 'Delete workspace' }),
      content: t('agent.workspace.deleteWarning', {
        defaultValue:
          `Delete "${current?.name ?? shownId}" and all ${fileCount} file(s) in it? ` +
          'Conversations that already used this workspace will no longer be able to ' +
          'read or write files. This cannot be undone.',
      }),
    });
    if (!confirmed) return;

    try {
      // Files first: dropping the registry entry before the data would leave an
      // unreachable directory occupying quota with nothing pointing at it.
      await forWorkspace(shownId).clear();
      removeWorkspace(shownId);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleClear = async () => {
    const confirmed = await modal.confirmDelete({
      title: t('agent.workspace.clearTitle', { defaultValue: 'Clear workspace' }),
      content: t('agent.workspace.clearWarning', {
        defaultValue: `Delete all ${fileCount} file(s) in "${current?.name ?? shownId}"? This cannot be undone.`,
      }),
    });
    if (!confirmed) return;

    try {
      await forWorkspace(shownId).clear();
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-1 border-b border-border/60 px-2 py-2">
        <SimpleTooltip content={t('common.back', { defaultValue: 'Back' })}>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
        </SimpleTooltip>

        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {t('agent.workspace.title', { defaultValue: 'Workspace' })}
        </span>

        <SimpleTooltip content={t('common.refresh', { defaultValue: 'Refresh' })}>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={reload}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </SimpleTooltip>

        {fileCount > 0 && (
          <SimpleTooltip content={t('agent.workspace.clearAll', { defaultValue: 'Clear all files' })}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
              onClick={handleClear}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </SimpleTooltip>
        )}
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="px-3 py-4 text-xs text-destructive">{error}</p>
        ) : tree.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">
            {t('agent.workspace.empty', {
              defaultValue:
                'No files yet. Ask the agent to write something and it will show up here.',
            })}
          </p>
        ) : (
          <WorkspaceTree
            nodes={tree}
            selectedPath={openPath}
            onSelectFile={(path) => openFile(shownId, path)}
          />
        )}
      </div>

      {/* Delete, for anything but the default workspace */}
      {!isDefault && (
        <div className="px-1.5 pb-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-full justify-start gap-1.5 text-[11px] text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-3 w-3" />
            {t('agent.workspace.delete', { defaultValue: 'Delete this workspace' })}
          </Button>
        </div>
      )}

      <WorkspaceSwitcher
        currentId={shownId}
        lockedId={lockedId}
        busy={busy}
        onCreate={handleCreate}
      />


    </div>
  );
};
