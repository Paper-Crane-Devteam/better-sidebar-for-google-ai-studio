import { useState } from 'react';
import { ChevronRight, Copy } from 'lucide-react';
import { cn } from '@/shared/lib/utils/utils';
import { useI18n } from '@/shared/hooks/useI18n';
import { OverflowTooltip } from '@/shared/components/ui/overflow-tooltip';
import { MarkdownRenderer } from '@/shared/components/MarkdownRenderer';
import { toast } from '@/shared/lib/toast';
import type { OutlineNode } from '../types';
import { getNodeIcon } from './getNodeIcon';

function collectChildrenContent(children: OutlineNode[], maxLength = 300): string {
  const parts: string[] = [];
  let totalLen = 0;

  for (const child of children) {
    if (totalLen >= maxLength) break;

    let text = '';
    if (child.type === 'code-block') {
      const lang = child.meta || '';
      text = `\`\`\`${lang}\n${child.rawContent?.slice(0, 100) || ''}${(child.rawContent?.length || 0) > 100 ? '…' : ''}\n\`\`\``;
    } else if (child.rawContent) {
      text = child.rawContent.slice(0, 100);
    } else {
      text = child.label;
    }

    if (text) {
      parts.push(text);
      totalLen += text.length;
    }

    if (child.children.length > 0 && totalLen < maxLength) {
      const nested = collectChildrenContent(child.children, maxLength - totalLen);
      if (nested) {
        parts.push(nested);
        totalLen += nested.length;
      }
    }
  }

  return parts.join('\n\n');
}

export function OutlineNodeItem({
  node,
  onNavigate,
  messageId,
  depth = 0,
}: {
  node: OutlineNode;
  onNavigate: (messageId: string, headingLabel?: string, headingLevel?: string) => void;
  messageId: string;
  depth?: number;
}) {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const parts: string[] = [];
    if (node.label) parts.push(node.label);
    if (node.rawContent && node.rawContent !== node.label) parts.push(node.rawContent);
    const content = parts.join('\n\n');
    if (content) {
      navigator.clipboard.writeText(content);
      toast.success(t('toast.copiedToClipboard'), 1000);
    }
  };

  const tooltipMarkdown = (() => {
    const parts: string[] = [];
    if (node.type === 'heading') {
      if (node.meta === 'bold' || node.meta === 'list-item') {
        // Bold headers & list items: show full rawContent (markdown rendered) in tooltip
        if (node.rawContent) {
          parts.push(node.rawContent);
        } else {
          parts.push(`**${node.label}**`);
        }
        const childContent = collectChildrenContent(node.children);
        if (childContent) parts.push(childContent);
      } else {
        const prefix = node.meta && node.meta.match(/^h\d$/) ? '#'.repeat(Number(node.meta[1])) + ' ' : '';
        parts.push(`${prefix}${node.label}`);
        const childContent = collectChildrenContent(node.children);
        if (childContent) parts.push(childContent);
      }
    } else {
      if (node.label) parts.push(node.label);
      if (node.rawContent && node.rawContent !== node.label) parts.push(node.rawContent);
    }
    return parts.join('\n\n');
  })();

  return (
    <div>
      <div
        onClick={() => onNavigate(messageId, node.label, node.type === 'heading' ? node.meta : undefined)}
        className={cn(
          'group/node flex items-center gap-1 px-2 py-1 rounded-md relative',
          'transition-colors duration-100',
          'cursor-pointer hover:bg-accent/50',
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-accent/60"
          >
            <ChevronRight
              className={cn(
                'h-2.5 w-2.5 transition-transform duration-100 text-muted-foreground/40',
                isExpanded && 'rotate-90',
              )}
            />
          </button>
        ) : (
          <div className="w-4 shrink-0" />
        )}

        {getNodeIcon(node)}

        <OverflowTooltip
          content={
            <MarkdownRenderer className="text-xs [&_*]:!text-background [&_code]:!bg-background/10 [&_code]:!text-background max-h-[300px] overflow-y-auto">
              {tooltipMarkdown}
            </MarkdownRenderer>
          }
          forceShow
          placement="right"
          tooltipClassName="max-w-[400px]"
          className={cn(
            'text-sm leading-snug truncate flex-1',
            node.type === 'heading'
              ? 'text-foreground font-medium'
              : 'text-foreground',
          )}
        >
          {node.label}
        </OverflowTooltip>

        {node.meta && node.type === 'code-block' && (
          <span className="text-[10px] px-1 py-1 rounded bg-muted/50 text-muted-foreground/70 font-mono shrink-0">
            {node.meta}
          </span>
        )}

        <div
          className="invisible group-hover/node:visible absolute right-1 top-0 bottom-0 flex items-center bg-accent/90 rounded-md px-1"
          data-tooltip-suppress
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleCopy}
            className="h-5 w-5 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors"
            title={t('outline.copy')}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <OutlineNodeItem
              key={child.id}
              node={child}
              onNavigate={onNavigate}
              messageId={messageId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
