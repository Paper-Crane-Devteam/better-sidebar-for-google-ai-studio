import React, { useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import {
  Loader2,
  Trash2,
  RotateCcw,
  Plus,
  HardDrive,
} from 'lucide-react';
import { useI18n } from '@/shared/hooks/useI18n';
import { useModalStore } from '@/shared/lib/modal';
import { modal } from '@/shared/lib/modal';
import { toast } from '@/shared/lib/toast';
import i18n from '@/locale/i18n';
import dayjs from 'dayjs';

/** BackupSlot without the `data` field (stripped by background handler) */
interface BackupSlotInfo {
  id: string;
  createdAt: number;
  size: number;
  /**
   * Absent on slots created before snapshot reasons were recorded.
   * `pre-sync` and `pre-merge-delete` are legacy values written by versions
   * that automated a bidirectional merge; they still exist in storage.
   */
  reason?:
    | 'manual'
    | 'routine'
    | 'pre-restore'
    | 'pre-sync'
    | 'pre-merge-delete';
}

const REASON_LABEL_KEYS = {
  manual: 'backup.reasonManual',
  routine: 'backup.reasonRoutine',
  'pre-restore': 'backup.reasonPreRestore',
  // Legacy reasons — kept so existing slots still render a label
  'pre-sync': 'backup.reasonPreSync',
  'pre-merge-delete': 'backup.reasonPreMergeDelete',
} as const;

/**
 * Snapshots taken because data was about to be destroyed are the ones a user
 * actually hunts for after an incident, so they get visual weight.
 */
const PROTECTIVE_REASONS = ['pre-merge-delete', 'pre-restore'];

interface BackupListModalProps {
  dbName: string;
  profileName: string;
}

export const BackupListModal: React.FC<BackupListModalProps> = ({
  dbName,
  profileName,
}) => {
  const { t } = useI18n();
  const [backups, setBackups] = useState<BackupSlotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await browser.runtime.sendMessage({
        type: 'BACKUP_LIST',
        payload: { dbName },
      });
      if (res?.success && Array.isArray(res.data)) {
        setBackups(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch backups:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, [dbName]);

  const handleCreate = async () => {
    setActionLoading('create');
    try {
      const res = await browser.runtime.sendMessage({
        type: 'BACKUP_CREATE',
        payload: { dbName },
      });
      if (res?.success) {
        toast.success(t('backup.created'));
        await fetchBackups();
      } else {
        toast.error(res?.error || t('backup.createFailed'));
      }
    } catch (e) {
      toast.error(t('backup.createFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestore = async (backup: BackupSlotInfo) => {
    const confirmed = await modal.confirm({
      title: t('backup.restoreTitle'),
      content: t('backup.restoreConfirm'),
      confirmText: t('backup.restore'),
      cancelText: t('common.cancel'),
    });
    if (!confirmed) return;

    setActionLoading(backup.id);
    try {
      const res = await browser.runtime.sendMessage({
        type: 'BACKUP_RESTORE',
        payload: { dbName, backupId: backup.id },
      });
      if (res?.success) {
        toast.success(t('backup.restoreSuccess'));
        useModalStore.getState().closeAll();
      } else {
        toast.error(res?.error || t('backup.restoreFailed'));
      }
    } catch (e) {
      toast.error(t('backup.restoreFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (backup: BackupSlotInfo) => {
    const confirmed = await modal.confirmDelete({
      title: t('backup.deleteTitle'),
      content: t('backup.deleteConfirm'),
    });
    if (!confirmed) return;

    setActionLoading(backup.id);
    try {
      const res = await browser.runtime.sendMessage({
        type: 'BACKUP_DELETE',
        payload: { dbName, backupId: backup.id },
      });
      if (res?.success) {
        toast.success(t('backup.deleteSuccess'));
        await fetchBackups();
      } else {
        toast.error(res?.error || t('backup.deleteFailed'));
      }
    } catch (e) {
      toast.error(t('backup.deleteFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          {t('backup.loading')}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header description */}
      <p className="text-xs text-muted-foreground">
        {t('backup.description')}
      </p>

      {/* Create button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2"
        onClick={handleCreate}
        disabled={actionLoading !== null}
      >
        {actionLoading === 'create' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        {t('backup.createBackup')}
      </Button>

      {/* Backup list */}
      {backups.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <HardDrive className="h-8 w-8 mx-auto mb-2 opacity-40" />
          {t('backup.noBackups')}
        </div>
      ) : (
        <div className="space-y-2 max-h-[360px] overflow-y-auto">
          {backups.map((backup) => (
            <div
              key={backup.id}
              className="group flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {dayjs.unix(backup.createdAt).format('YYYY-MM-DD HH:mm')}
                  </span>
                  {backup.reason && (
                    <span
                      className={`shrink-0 rounded px-1 py-1 text-xs leading-none ${
                        PROTECTIVE_REASONS.includes(backup.reason)
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {t(REASON_LABEL_KEYS[backup.reason])}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatSize(backup.size)}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 gap-1 text-xs"
                  onClick={() => handleRestore(backup)}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === backup.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  {t('backup.restore')}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(backup)}
                  disabled={actionLoading !== null}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Open the backup list modal for a specific profile.
 */
export function openBackupModal(dbName: string, profileName: string): void {
  useModalStore.getState().open({
    id: 'backup-list',
    type: 'confirm',
    title: `${profileName} — ${i18n.t('backup.title')}`,
    content: React.createElement(BackupListModal, { dbName, profileName }),
    confirmText: i18n.t('common.close'),
    onConfirm: () => useModalStore.getState().close(),
    onCancel: () => useModalStore.getState().close(),
    modalClassName: 'max-w-md',
  });
}
