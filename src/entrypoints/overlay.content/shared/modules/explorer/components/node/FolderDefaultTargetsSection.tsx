import React, { useCallback, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { UIcon } from '@/shared/components/ui/icon';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAppStore } from '@/shared/lib/store';
import { usePopoverPickerStore } from '@/shared/lib/popover-picker';
import { toast } from '@/shared/lib/toast';
import type { Gem, Notebook } from '@/shared/types/db';
import { GemPickerContent } from '../../../gems/components/GemPickerContent';
import { NotebookPickerContent } from '../../../notebooks/components/NotebookPickerContent';

type TargetKind = 'gem' | 'notebook';

interface FolderDefaultTargetsSectionProps {
  folderId: string;
}

/**
 * Reverse editor for `gem.default_folder_id` / `notebook.default_folder_id`.
 *
 * The relation is stored on the gem/notebook side (each one points at exactly
 * one folder), so from a folder's point of view it is one-to-many: several
 * gems may legitimately drop their chats into the same folder. This section
 * therefore shows a *list* of bound targets, not a single selection.
 *
 * Writes happen immediately rather than on the parent dialog's Save, because
 * each binding is an independent record — batching them into the dialog's
 * confirm would leave "cancel" with ambiguous semantics.
 */
export const FolderDefaultTargetsSection = ({
  folderId,
}: FolderDefaultTargetsSectionProps) => {
  const { t } = useI18n();
  const gems = useAppStore((s) => s.gems);
  const notebooks = useAppStore((s) => s.notebooks);
  const folders = useAppStore((s) => s.folders);
  const fetchData = useAppStore((s) => s.fetchData);
  const [busy, setBusy] = useState(false);

  const boundGems = useMemo(
    () => gems.filter((g) => g.default_folder_id === folderId),
    [gems, folderId],
  );
  const boundNotebooks = useMemo(
    () => notebooks.filter((n) => n.default_folder_id === folderId),
    [notebooks, folderId],
  );

  const setTarget = useCallback(
    async (kind: TargetKind, id: string, value: string | null) => {
      setBusy(true);
      try {
        await browser.runtime.sendMessage({
          type: kind === 'gem' ? 'UPDATE_GEM' : 'UPDATE_NOTEBOOK',
          payload: { id, updates: { default_folder_id: value } },
        });
        await fetchData(true);
        return true;
      } catch (err) {
        console.error('Failed to update default folder:', err);
        toast.error(t('folderSettings.defaultTargetFailed'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [fetchData, t],
  );

  const handleAdd = useCallback(
    async (kind: TargetKind, e: React.MouseEvent) => {
      const anchorRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const picker = usePopoverPickerStore.getState();

      const picked =
        kind === 'gem'
          ? await picker.open<Gem>({
              anchorRect,
              width: 280,
              content: (
                <GemPickerContent
                  closeModalOnSelect={false}
                  recordLastSelected={false}
                  excludeIds={boundGems.map((g) => g.id)}
                  showDefaultFolderHint
                />
              ),
            })
          : await picker.open<Notebook>({
              anchorRect,
              width: 280,
              content: (
                <NotebookPickerContent
                  closeModalOnSelect={false}
                  recordLastSelected={false}
                  excludeIds={boundNotebooks.map((n) => n.id)}
                  showDefaultFolderHint
                />
              ),
            });

      if (!picked) return;

      // A gem/notebook can only have one default folder, so picking one that is
      // already bound elsewhere silently steals it — tell the user where it came from.
      const previousId = picked.default_folder_id;
      const previousName =
        previousId && previousId !== folderId
          ? folders.find((f) => f.id === previousId)?.name
          : undefined;

      if (!(await setTarget(kind, picked.id, folderId))) return;

      toast.success(
        previousName
          ? t('folderSettings.defaultTargetMoved', {
              name: picked.name,
              from: previousName,
            })
          : t('folderSettings.defaultTargetAdded', { name: picked.name }),
      );
    },
    [boundGems, boundNotebooks, folderId, folders, setTarget, t],
  );

  const handleRemove = useCallback(
    async (kind: TargetKind, item: Gem | Notebook) => {
      if (!(await setTarget(kind, item.id, null))) return;
      toast.success(t('folderSettings.defaultTargetRemoved', { name: item.name }));
    },
    [setTarget, t],
  );

  // Nothing bindable (non-Gemini platform, or gems/notebooks not imported yet)
  if (gems.length === 0 && notebooks.length === 0) return null;

  const renderChip = (
    kind: TargetKind,
    item: Gem | Notebook,
    icon: React.ReactNode,
  ) => (
    <span
      key={`${kind}-${item.id}`}
      className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs text-foreground"
    >
      {icon}
      <span className="truncate max-w-[140px]">{item.name}</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleRemove(kind, item)}
        aria-label={t('folderSettings.defaultTargetRemove', { name: item.name })}
        className="ml-1 shrink-0 rounded text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );

  const renderAddButton = (kind: TargetKind, icon: string, label: string) => (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => void handleAdd(kind, e)}
      className="inline-flex items-center gap-1 rounded-md border border-dashed border-border/60 px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:opacity-50"
    >
      <Plus className="h-3 w-3 shrink-0" />
      <UIcon icon={icon} className="h-3 w-3 shrink-0" />
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground">
        {t('folderSettings.defaultTargets')}
      </label>
      <p className="text-xs text-muted-foreground">
        {t('folderSettings.defaultTargetsHint')}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {boundGems.map((gem) =>
          renderChip(
            'gem',
            gem,
            gem.icon_url ? (
              <img
                src={gem.icon_url}
                alt=""
                className="h-3 w-3 shrink-0 rounded-sm object-cover"
              />
            ) : (
              <UIcon icon="tabler:diamond" className="h-3 w-3 shrink-0 text-muted-foreground" />
            ),
          ),
        )}
        {boundNotebooks.map((notebook) =>
          renderChip(
            'notebook',
            notebook,
            <UIcon icon="tabler:notebook" className="h-3 w-3 shrink-0 text-muted-foreground" />,
          ),
        )}
        {gems.length > 0 &&
          renderAddButton('gem', 'tabler:diamond', t('folderSettings.addGemTarget'))}
        {notebooks.length > 0 &&
          renderAddButton('notebook', 'tabler:notebook', t('folderSettings.addNotebookTarget'))}
      </div>
    </div>
  );
};
