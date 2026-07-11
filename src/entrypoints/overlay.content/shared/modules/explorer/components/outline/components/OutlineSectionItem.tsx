import { ChevronRight, Copy, MapPin } from 'lucide-react';
import { cn } from '@/shared/lib/utils/utils';
import { useI18n } from '@/shared/hooks/useI18n';
import { OverflowTooltip } from '@/shared/components/ui/overflow-tooltip';
import { toast } from '@/shared/lib/toast';
import type { OutlineSection } from '../types';
import { OutlineNodeItem } from './OutlineNodeItem';

export function OutlineSectionItem({
  section,
  isActive,
  isCollapsed,
  onToggle,
  onNavigate,
  activeRef,
}: {
  section: OutlineSection;
  isActive: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
  onNavigate: (messageId: string, headingLabel?: string, headingLevel?: string) => void;
  activeRef?: React.RefObject<HTMLDivElement>;
}) {
  const { t } = useI18n();
  const hasChildren = section.children.length > 0;

  const handleCopyQuery = (e: React.MouseEvent) => {
    e.stopPropagation();
    const content = section.userQueryFull || section.userQuery;
    navigator.clipboard.writeText(content);
    toast.success(t('toast.copiedToClipboard'), 1000);
  };

  return (
    <div ref={activeRef} className="mx-1 rounded-md">
      <div
        className={cn(
          'group/section flex items-center gap-1 px-2 py-1 rounded-md relative',
          'cursor-pointer hover:bg-accent/50',
        )}
        onClick={() => hasChildren && onToggle()}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-accent/80"
          >
            <ChevronRight
              className={cn(
                'h-3 w-3 transition-transform duration-150',
                !isCollapsed && 'rotate-90',
                isActive ? 'text-primary' : 'text-muted-foreground/50',
              )}
            />
          </button>
        ) : (
          <div className="flex h-5 w-5 shrink-0 items-center justify-center">
            <div
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                isActive ? 'bg-primary' : 'bg-muted-foreground/30',
              )}
            />
          </div>
        )}

        <span
          className={cn(
            'text-[10px] font-bold shrink-0 w-4 text-center',
            isActive ? 'text-primary' : 'text-muted-foreground/60',
          )}
        >
          {section.turnIndex}
        </span>

        <OverflowTooltip
          content={section.userQueryFull || section.userQuery}
          placement="right"
          className={cn(
            'text-sm leading-snug truncate flex-1',
            isActive ? 'text-primary font-medium' : 'text-foreground',
          )}
        >
          {section.userQuery}
        </OverflowTooltip>

        <div
          className="invisible group-hover/section:visible absolute right-1 top-0 bottom-0 flex items-center gap-1 bg-accent/90 rounded-md px-1"
          data-tooltip-suppress
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleCopyQuery}
            className="h-5 w-5 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors"
            title={t('outline.copyQuery')}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          {section.userInDom && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigate(section.userMessageId);
              }}
              className="h-5 w-5 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors"
              title={t('outline.navigate')}
            >
              <MapPin className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {hasChildren && !isCollapsed && (
        <div className="ml-4 border-l border-border/25 pl-2 mb-1">
          {section.children.map((node) => (
            <OutlineNodeItem
              key={node.id}
              node={node}
              onNavigate={onNavigate}
              messageId={section.modelMessageId || section.userMessageId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
