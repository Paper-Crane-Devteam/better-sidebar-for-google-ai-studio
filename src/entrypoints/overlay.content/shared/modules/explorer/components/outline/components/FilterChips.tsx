import { Heading, Code2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils/utils';
import { useI18n } from '@/shared/hooks/useI18n';
import type { OutlineFilter } from '../types';

interface FilterChipsProps {
  filter: OutlineFilter;
  onFilterChange: (f: OutlineFilter) => void;
  stats: { headings: number; codeBlocks: number; images: number; tables: number; links: number; math: number };
}

export function FilterChips({ filter, onFilterChange, stats }: FilterChipsProps) {
  const { t } = useI18n();
  const filters: { key: OutlineFilter; label: string; icon?: React.ReactNode; count: number }[] = [
    { key: 'all', label: t('outline.filterAll'), count: -1 },
    { key: 'headings', label: t('outline.filterHeadings'), icon: <Heading className="h-3 w-3" />, count: stats.headings },
    { key: 'code', label: t('outline.filterCode'), icon: <Code2 className="h-3 w-3" />, count: stats.codeBlocks },
  ];

  const visibleFilters = filters.filter((f) => f.count === -1 || f.count > 0);

  return (
    <div className="flex items-center gap-1">
      {visibleFilters.map(({ key, label, icon, count }) => (
        <button
          key={key}
          onClick={() => onFilterChange(key)}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium',
            'transition-colors duration-100 whitespace-nowrap',
            filter === key
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
          )}
        >
          {icon}
          {label}
          {count > 0 && (
            <span className="text-[9px] opacity-60">{count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
