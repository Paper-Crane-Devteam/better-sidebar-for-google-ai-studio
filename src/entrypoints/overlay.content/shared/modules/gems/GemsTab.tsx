import { useRef } from 'react';
import { useAppStore } from '@/shared/lib/store';
import { GemsHeader } from './components/GemsHeader';
import { GemsTreeView, GemsTreeHandle } from './components/GemsTreeView';
import { FilterBar } from '../../components/FilterBar';
import { useStoreFilter } from '../../hooks/useStoreFilter';
import { Gem as GemIcon } from 'lucide-react';
import { useI18n } from '@/shared/hooks/useI18n';

interface GemsTabProps {
  menuActions?: {
    onViewHistory?: () => void;
    onSwitchToOriginalUI?: () => void;
  };
}

export const GemsTab = ({ menuActions }: GemsTabProps) => {
  const { t } = useI18n();
  const { gems, tags: allTags } = useAppStore();
  const filter = useStoreFilter('gems');
  const treeRef = useRef<GemsTreeHandle>(null);

  const handleCollapseAll = () => {
    treeRef.current?.collapseAll();
  };

  const handleSelect = (_nodes: any[]) => {
    // Selection handled inside GemNode (navigation)
  };

  return (
    <div className="flex flex-col h-full w-full relative">
      <GemsHeader
        onCollapseAll={handleCollapseAll}
        filter={filter}
        menuActions={menuActions}
      />

      <FilterBar filter={filter} allTags={allTags} />

      <div className="flex-1 overflow-hidden relative">
        {gems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center text-muted-foreground gap-3">
            <GemIcon className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm">{t('gems.empty')}</p>
          </div>
        ) : (
          <GemsTreeView ref={treeRef} onSelect={handleSelect} />
        )}
      </div>
    </div>
  );
};
