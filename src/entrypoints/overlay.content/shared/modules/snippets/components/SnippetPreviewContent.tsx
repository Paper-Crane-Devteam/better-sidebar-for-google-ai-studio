import React from 'react';
import { useI18n } from '@/shared/hooks/useI18n';

interface SnippetPreviewContentProps {
  snippet: any;
}

export const SnippetPreviewContent = ({ snippet }: SnippetPreviewContentProps) => {
  const { t } = useI18n();

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  return (
    <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
      {snippet.content && (
        <div className="rounded-md bg-muted/40 p-3">
          <pre className="whitespace-pre-wrap text-sm font-mono break-words">
            {snippet.content}
          </pre>
        </div>
      )}
      {snippet.source_url && (
        <div className="text-xs text-muted-foreground">
          {t('snippets.source')}: {snippet.source_url}
        </div>
      )}
      {snippet.created_at && (
        <div className="text-xs text-muted-foreground">
          {t('snippets.createdAt')}: {formatDate(snippet.created_at)}
        </div>
      )}
    </div>
  );
};
