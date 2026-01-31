import React from 'react';
import { useAppStore } from '@/shared/lib/store';
import { useModalStore } from '@/shared/lib/modal';
import { ChevronRight, ChevronDown, FileText, Info, ExternalLink, Copy, FileCode } from 'lucide-react';
import { cn, stripMarkdown } from '@/shared/lib/utils';
import dayjs from 'dayjs';
import { navigate } from '@/shared/lib/navigation';
import { browser } from 'wxt/browser';
import { MarkdownRenderer } from '@/shared/components/MarkdownRenderer';
import { Button } from '@/shared/components/ui/button';
import { useI18n } from '@/shared/hooks/useI18n';
import { toast } from '@/shared/lib/toast';

export interface SearchResultItem {
  id: string;
  content: string;
  role: 'user' | 'model';
  conversation_id: string;
  conversation_title: string;
  folder_id: string | null;
  folder_name: string | null;
  timestamp: number;
  external_url?: string;
  scroll_index?: number;
}

const ResultGroup = ({ 
  conversationId, 
  data, 
  expanded, 
  onToggle,
  untitledLabel,
}: { 
  conversationId: string, 
  data: { conversation: any, matches: SearchResultItem[] }, 
  expanded: boolean, 
  onToggle: () => void;
  untitledLabel: string;
}) => {
  return (
    <div className="flex flex-col">
      <div 
        className="flex items-center gap-1 p-1 hover:bg-accent/50 cursor-pointer text-sm"
        onClick={onToggle}
      >
        {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium truncate flex-1">
            {data.conversation.title || untitledLabel}
        </span>
        {data.conversation.folderName && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md truncate max-w-[100px]">
                {data.conversation.folderName}
            </span>
        )}
        <span className="text-xs text-muted-foreground ml-1 bg-muted rounded-full px-2">
            {data.matches.length}
        </span>
      </div>
      
      {expanded && (
        <div className="flex flex-col ml-4 border-l pl-2">
          {data.matches.map(match => (
            <MatchItem key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
};

const MatchItem = ({ match }: { match: SearchResultItem }) => {
  const { t } = useI18n();
  const { activeQuery, activeOptions } = useAppStore(state => state.ui.search);
  
  const getHighlightedText = (text: string, highlight: string) => {
    // Helper to render the container structure
    const userLabel = t('export.roleUser');
    const modelLabel = t('export.roleModel');
    const renderWrapper = (content: React.ReactNode) => (
        <div className="text-xs text-muted-foreground py-1 px-2 hover:bg-accent/30 cursor-pointer rounded">
            <div className="font-mono text-[10px] mb-0.5 opacity-70">
                {match.role === 'user' ? userLabel : modelLabel} • {dayjs(match.timestamp * 1000).format('ll')}
            </div>
            <div className="line-clamp-4 break-words whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                {content}
            </div>
        </div>
    );

    if (!highlight.trim()) {
        return renderWrapper(text.substring(0, 150) + (text.length > 150 ? '...' : ''));
    }

    const escapeRegExp = (string: string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };
    
    const escapedHighlight = escapeRegExp(highlight);
    let pattern = escapedHighlight;
    let flags = 'g';
    
    if (!activeOptions.caseSensitive) {
      flags += 'i';
    }
    
    if (activeOptions.wholeWord) {
      pattern = `\\b${pattern}\\b`;
    }
    
    const regex = new RegExp(`(${pattern})`, flags);
    const searchRegex = new RegExp(pattern, flags.replace('g', ''));
    const matchResult = searchRegex.exec(text);
    
    if (!matchResult) {
        return renderWrapper(text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    }

    const index = matchResult.index;
    const matchLength = matchResult[0].length;
    const start = Math.max(0, index - 40);
    const end = Math.min(text.length, index + matchLength + 60);
    const snippet = (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '');

    const parts = snippet.split(regex);
    const highlightedContent = parts.map((part, i) => 
        (i % 2 === 1) ? 
            <span key={i} className="bg-yellow-500/30 text-foreground font-medium rounded-[2px] px-0.5">{part}</span> : 
            part
    );
    
    return renderWrapper(highlightedContent);
  };

  const handleNavigation = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 1. Navigate to conversation
    const url = match.external_url || `https://aistudio.google.com/prompts/${match.conversation_id}`;
    navigate(url);

    let scrollIndex = match.scroll_index;

    // 2. Fetch scroll index if missing (lazy load)
    if (scrollIndex === undefined) {
      try {
        const response = await browser.runtime.sendMessage({
          type: 'GET_MESSAGE_SCROLL_INDEX',
          payload: {
            messageId: match.id,
            conversationId: match.conversation_id,
          },
        });
        if (response && response.success) {
          scrollIndex = response.data;
        }
      } catch (error) {
        console.error('Failed to fetch scroll index', match.id, error);
      }
    }

    // 3. Wait for editor to load and then scroll
    if (typeof scrollIndex === 'number') {
      const targetScrollIndex = scrollIndex;
      const startTime = Date.now();
      const timeout = 10000;

      const checkAndClick = () => {
        if (Date.now() - startTime > timeout) return;

        const mainEditor = document.querySelector('.chunk-editor-main');
        if (mainEditor) {
          setTimeout(() => {
            const scrollbar = document.querySelector('ms-prompt-scrollbar');
            if (scrollbar) {
              const items = scrollbar.querySelectorAll('.prompt-scrollbar-item');
              if (items && items[targetScrollIndex]) {
                const item = items[targetScrollIndex] as HTMLElement;
                const button = item.querySelector('button');
                button?.click();
              }
            }
          }, 500);
        } else {
          setTimeout(checkAndClick, 100);
        }
      };
      setTimeout(() => {
        checkAndClick();
      }, 500);
    }
  };

  const handleCopyAsText = async () => {
      const plain = stripMarkdown(match.content);
      await navigator.clipboard.writeText(plain);
      toast.success(t('toast.copiedToClipboard'), 1500);
  };
  const handleCopyAsMarkdown = async () => {
      await navigator.clipboard.writeText(match.content);
      toast.success(t('toast.copiedToClipboard'), 1500);
  };

  const handlePreview = (e: React.MouseEvent) => {
      e.stopPropagation();
      useModalStore.getState().open({
        title: t('search.messagePreview'),
        content: (
            <div className="max-h-[60vh] overflow-y-auto p-2">
                <MarkdownRenderer 
                    highlight={activeQuery}
                    highlightOptions={activeOptions}
                >
                    {match.content}
                </MarkdownRenderer>
            </div>
        ),
        headerActions: (
            <>
                <Button variant="ghost" size="sm" onClick={handleCopyAsText} title={t('search.copyAsText')}>
                    <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCopyAsMarkdown} title={t('search.copyAsMarkdown')}>
                    <FileCode className="h-4 w-4" />
                </Button>
            </>
        ),
        modalClassName: 'max-w-4xl',
        type: 'confirm',
        confirmText: t('common.close'),
        cancelText: t('search.jumpToConversation'),
        onCancel: () => {
             // We reuse the handleNavigation logic.
             // But we need to close the modal first.
             useModalStore.getState().close();
             
             // Wait for modal to close
             setTimeout(() => {
                 handleNavigation({ preventDefault: () => {}, stopPropagation: () => {} } as any);
             }, 100);
        },
        onConfirm: () => {
            useModalStore.getState().close();
        }
      });
  };

  return (
    <div className="relative group" onClick={handlePreview}>
      {getHighlightedText(match.content, activeQuery)}
      <button
        onClick={handleNavigation}
        className="absolute top-2 right-2 p-1.5 bg-background/90 text-foreground rounded opacity-0 group-hover:opacity-100 transition-opacity border shadow-sm hover:bg-accent z-10"
        title={t('search.jumpToConversation')}
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export interface SearchResultsProps {
    grouped: Record<string, { conversation: any, matches: SearchResultItem[] }>;
    expandedIds: Set<string>;
    onToggleGroup: (id: string) => void;
}

export const SearchResults = ({ grouped, expandedIds, onToggleGroup }: SearchResultsProps) => {
  const { t } = useI18n();
  const { results, isSearching, activeQuery } = useAppStore(state => state.ui.search);

  if (results.length === 0 && !isSearching) {
    if (!activeQuery?.trim()) {
      return null;
    }

    return (
      <div className="flex flex-col items-center justify-center pt-8 p-4 text-center animate-in fade-in-0 slide-in-from-bottom-2">
        <div className="text-sm text-muted-foreground mb-2">
          {t('search.noResults', { query: activeQuery })}
        </div>
        <button
          onClick={() => useModalStore.getState().open({
            title: t('search.indexingInfoTitle'),
            content: (
              <div className="space-y-4 text-sm text-muted-foreground text-left">
                <p className="leading-relaxed">{t('search.indexingInfoIntro')}</p>
                <div className="rounded-md bg-secondary/40 border p-3 text-xs">
                  <p className="font-medium text-foreground mb-2">{t('search.indexingHowTo')}</p>
                  <ul className="list-disc pl-4 space-y-1.5">
                    <li>{t('search.indexingImport')}</li>
                    <li>{t('search.indexingScan')}</li>
                  </ul>
                </div>
              </div>
            ),
            type: 'info',
            confirmText: t('search.understood')
          })}
          className="text-xs text-blue-500 hover:text-blue-600 hover:underline font-medium inline-flex items-center gap-1"
        >
          <Info className="w-3 h-3" />
          {t('search.whyNoOlder')}
        </button>
      </div>
    );
  }
  
  if (results.length === 0 && isSearching) {
      return <div className="p-4 text-center text-sm text-muted-foreground">{t('search.searching')}</div>;
  }

  const fileCount = Object.keys(grouped).length;
  const resultCount = results.length;

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", isSearching && "opacity-60")}>
      <div className="p-2 text-xs text-muted-foreground font-medium border-b bg-muted/10">
        {t('search.resultsSummary', { count: resultCount, files: fileCount })}
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {Object.entries(grouped).map(([id, data]) => (
            <ResultGroup 
                key={id} 
                conversationId={id} 
                data={data} 
                expanded={expandedIds.has(id)}
                onToggle={() => onToggleGroup(id)}
                untitledLabel={t('common.untitled')}
            />
        ))}
      </div>
    </div>
  );
};
