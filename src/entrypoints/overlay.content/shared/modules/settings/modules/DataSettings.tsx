import React, { useRef, useState } from 'react';
import { Separator } from '../../../components/ui/separator';
import { Button } from '../../../components/ui/button';
import {
  Trash2,
  Download,
  Upload,
  Loader2,
  RefreshCw,
  FileUp,
} from 'lucide-react';
import { useDataManagement } from '../hooks/useDataManagement';
import { useI18n } from '@/shared/hooks/useI18n';
import { ImportHistoryDialog } from '@/entrypoints/overlay.content/aistudio/modules/search/components/ImportHistoryDialog';

export const DataSettings = () => {
  const { t } = useI18n();
  const [isImportHistoryOpen, setIsImportHistoryOpen] = useState(false);
  const { exportData, importData, resetData, scanLibrary, isLoading } =
    useDataManagement();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importData(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">{t('data.librarySync')}</h3>
        <Separator />
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-sm font-medium">
                {t('data.scanLibrary')}
              </span>
              <p className="text-xs text-muted-foreground">
                {t('data.scanLibraryDescription')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={scanLibrary}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t('data.scanLibrary')}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-sm font-medium">
                {t('data.importConversationData')}
              </span>
              <p className="text-xs text-muted-foreground">
                {t('data.importConversationDataDescription')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setIsImportHistoryOpen(true)}
              disabled={isLoading}
            >
              <FileUp className="h-4 w-4" />
              {t('data.importConversationData')}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-medium">{t('data.storageManagement')}</h3>
        <Separator />
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
            <div className="space-y-0.5">
              <span className="text-sm font-medium text-destructive">
                {t('data.resetDatabase')}
              </span>
              <p className="text-xs text-muted-foreground">
                {t('data.resetDatabaseDescription')}
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={resetData}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {t('data.resetData')}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-medium">{t('data.backupRestore')}</h3>
        <Separator />
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-sm font-medium">
                {t('data.exportData')}
              </span>
              <p className="text-xs text-muted-foreground">
                {t('data.exportDataDescription')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={exportData}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {t('data.export')}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-sm font-medium">
                {t('data.importData')}
              </span>
              <p className="text-xs text-muted-foreground">
                {t('data.importDataDescription')}
              </p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".db,.sqlite,.sql"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleImportClick}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {t('data.import')}
            </Button>
          </div>
        </div>
      </div>

      <ImportHistoryDialog
        isOpen={isImportHistoryOpen}
        onClose={() => setIsImportHistoryOpen(false)}
      />
    </div>
  );
};
