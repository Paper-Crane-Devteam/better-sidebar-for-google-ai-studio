import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { SimpleTooltip } from '@/shared/components/ui/tooltip';
import { Search, Tags, MessageSquare, Image as ImageIcon, LayoutGrid, Star } from 'lucide-react';
import type { FilterState, ExplorerTypeFilter } from '../types/filter';
import { useI18n } from '@/shared/hooks/useI18n';

interface FilterActionsProps {
  filter: FilterState<ExplorerTypeFilter>;
  showFavoritesFilter?: boolean;
}

export const FilterActions = ({ filter, showFavoritesFilter = true }: FilterActionsProps) => {
  const { t } = useI18n();
  const { search, tags, type, onlyFavorites } = filter;

  const handleTypeToggle = () => {
    const next: Record<ExplorerTypeFilter, ExplorerTypeFilter> = {
      all: 'conversation',
      conversation: 'text-to-image',
      'text-to-image': 'all',
    };
    type.setValue(next[type.value]);
  };

  const getTypeTitle = () => {
    switch (type.value) {
      case 'conversation': return t('tooltip.filterConversations');
      case 'text-to-image': return t('tooltip.filterImages');
      default: return t('tooltip.filterAll');
    }
  };

  return (
    <div className="flex items-center gap-0.5">
      <SimpleTooltip content={t('tooltip.search')}>
        <Button
          variant={search.isOpen ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={() => {
            if (search.isOpen) {
              search.setQuery('');
            }
            search.setIsOpen(!search.isOpen);
          }}
        >
          <Search className="h-4 w-4" />
        </Button>
      </SimpleTooltip>

      <SimpleTooltip content={t('tooltip.filterByTags')}>
        <Button
          variant={tags.isOpen ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={() => {
            if (tags.isOpen) {
              tags.setSelected([]);
            }
            tags.setIsOpen(!tags.isOpen);
          }}
        >
          <Tags className="h-4 w-4" />
        </Button>
      </SimpleTooltip>

      <SimpleTooltip content={getTypeTitle()}>
        <Button 
            variant={type.value === 'all' ? "ghost" : "secondary"} 
            size="icon" 
            className="h-7 w-7" 
            onClick={handleTypeToggle}
        >
            {type.value === 'all' && <LayoutGrid className="h-4 w-4" />}
            {type.value === 'conversation' && <MessageSquare className="h-4 w-4" />}
            {type.value === 'text-to-image' && <ImageIcon className="h-4 w-4" />}
        </Button>
      </SimpleTooltip>

      {showFavoritesFilter && (
        <SimpleTooltip content={t('tooltip.filterFavorites')}>
          <Button
            variant={onlyFavorites.value ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => onlyFavorites.setValue(!onlyFavorites.value)}
          >
            <Star className={`h-4 w-4 ${onlyFavorites.value ? "fill-current" : ""}`} />
          </Button>
        </SimpleTooltip>
      )}
    </div>
  );
};
