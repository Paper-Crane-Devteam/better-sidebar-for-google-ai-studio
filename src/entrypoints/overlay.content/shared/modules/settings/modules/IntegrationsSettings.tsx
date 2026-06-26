import { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../components/ui/button';
import { Separator } from '../../../components/ui/separator';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useSettingsStore } from '@/shared/lib/settings-store';
import { useI18n } from '@/shared/hooks/useI18n';
import { Loader2, Check, X, RefreshCw, ExternalLink } from 'lucide-react';
import {
  testNotionConnection,
  searchNotionPages,
} from '../../../features/export/notion';
import { NotionIcon } from '../../../features/export/icons';

export const IntegrationsSettings = () => {
  const { t } = useI18n();
  const { integrations, setNotionConfig } = useSettingsStore();
  const { apiKey, parentPageId, parentPageTitle } = integrations.notion;

  const [apiKeyInput, setApiKeyInput] = useState(apiKey);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [connectionName, setConnectionName] = useState('');
  const [connectionError, setConnectionError] = useState('');

  const [loadingPages, setLoadingPages] = useState(false);
  const [pages, setPages] = useState<{ id: string; title: string }[]>([]);

  const loadPages = useCallback(async () => {
    setLoadingPages(true);
    try {
      const results = await searchNotionPages();
      setPages(results);
    } catch {
      setPages([]);
    }
    setLoadingPages(false);
  }, []);

  // Auto-test connection when apiKey is already saved
  useEffect(() => {
    if (apiKey) {
      void (async () => {
        const result = await testNotionConnection();
        if (result.ok) {
          setConnectionStatus('ok');
          setConnectionName(result.name || '');
          setConnectionError('');
          // Auto-load pages
          void loadPages();
        } else {
          setConnectionStatus('error');
          setConnectionError(result.error || 'Unknown error');
        }
      })();
    }
  }, [apiKey, loadPages]);

  const handleSaveApiKey = async () => {
    const trimmed = apiKeyInput.trim();
    setNotionConfig({ apiKey: trimmed });
    setTesting(true);
    setConnectionStatus('idle');

    // Need to wait a tick for the store to update before testing
    await new Promise((r) => setTimeout(r, 50));
    const result = await testNotionConnection();
    setTesting(false);

    if (result.ok) {
      setConnectionStatus('ok');
      setConnectionName(result.name || '');
      setConnectionError('');
      void loadPages();
    } else {
      setConnectionStatus('error');
      setConnectionName('');
      setConnectionError(result.error || 'Unknown error');
    }
  };

  const handleClearApiKey = () => {
    setNotionConfig({ apiKey: '', parentPageId: '', parentPageTitle: '' });
    setApiKeyInput('');
    setConnectionStatus('idle');
    setConnectionName('');
    setPages([]);
  };

  return (
    <div className="space-y-6">
      {/* Notion */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <NotionIcon className="h-5 w-5" />
          <h3 className="text-lg font-medium">Notion</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('integrations.notionDescription')}
        </p>
        <Separator />
      </div>

      {/* Step 1: API Key */}
      <div className="space-y-3">
        <label className="text-sm font-medium">{t('integrations.notionApiKey')}</label>
        <p className="text-xs text-muted-foreground">
          {t('integrations.notionApiKeyHint')}{' '}
          <a
            href="https://www.notion.so/my-integrations"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-0.5"
          >
            notion.so/my-integrations
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
        <div className="flex gap-2">
          <Input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="ntn_..."
            className="flex-1 font-mono text-xs"
          />
          <Button
            size="sm"
            onClick={handleSaveApiKey}
            disabled={!apiKeyInput.trim() || testing}
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}
          </Button>
          {apiKey && (
            <Button size="sm" variant="ghost" onClick={handleClearApiKey}>
              {t('integrations.disconnect')}
            </Button>
          )}
        </div>

        {/* Connection status */}
        {connectionStatus === 'ok' && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check className="h-4 w-4" />
            {t('integrations.connected')}: {connectionName}
          </div>
        )}
        {connectionStatus === 'error' && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <X className="h-4 w-4" />
            {t('integrations.connectionFailed')}: {connectionError}
          </div>
        )}
      </div>

      {/* Step 2: Select parent page (only show when connected) */}
      {connectionStatus === 'ok' && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t('integrations.notionParentPage')}</label>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={loadPages}
                disabled={loadingPages}
              >
                {loadingPages ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                {t('integrations.refresh')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('integrations.notionParentPageHint')}
            </p>

            {loadingPages ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common.loading')}
              </div>
            ) : pages.length > 0 ? (
              <Select
                value={parentPageId || undefined}
                onValueChange={(value) => {
                  const page = pages.find((p) => p.id === value);
                  if (page) {
                    setNotionConfig({ parentPageId: page.id, parentPageTitle: page.title });
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('integrations.selectPage')} />
                </SelectTrigger>
                <SelectContent>
                  {pages.map((page) => (
                    <SelectItem key={page.id} value={page.id}>
                      {page.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground py-2">
                {t('integrations.noPagesFound')}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};
