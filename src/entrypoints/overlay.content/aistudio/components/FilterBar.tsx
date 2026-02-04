import React, { useRef, useEffect, useState, useCallback } from 'react';
import { debounce } from 'lodash';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import type {
  ExplorerTypeFilter,
  FilterState,
  PromptsTypeFilter,
} from '../types/filter';
import { Tag } from '@/shared/types/db';
import { useI18n } from '@/shared/hooks/useI18n';
import { X } from 'lucide-react';

interface FilterBarProps {
  filter: FilterState<ExplorerTypeFilter> | FilterState<PromptsTypeFilter>;
  allTags: Tag[];
}

export const FilterBar = ({ filter, allTags }: FilterBarProps) => {
  const { t } = useI18n();
  const { search, tags } = filter;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [localQuery, setLocalQuery] = useState(search.query);

  // Sync local query with prop when it changes externally
  useEffect(() => {
    setLocalQuery(search.query);
  }, [search.query]);

  // Create debounced search function
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      search.setQuery(value);
    }, 350),
    [search.setQuery]
  );

  // Focus effect for search input
  useEffect(() => {
    if (search.isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [search.isOpen]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalQuery(value);
    debouncedSearch(value);
  };

  const handleClearSearch = () => {
    setLocalQuery('');
    search.setQuery('');
    searchInputRef.current?.focus();
  };

  return (
    <>
      {/* Search Input Area */}
      {search.isOpen && (
        <div className="px-3 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 animate-in slide-in-from-top-2 duration-200">
          <div className="relative">
            <Input
              ref={searchInputRef}
              placeholder={t('tooltip.search')}
              value={localQuery}
              onChange={handleSearchChange}
              maxLength={100}
              className="h-8 text-sm pr-8"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  search.setIsOpen(false);
                }
              }}
            />
            {localQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={handleClearSearch}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Tags Selection Area */}
      {tags.isOpen && (
        <div className="px-3 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 animate-in slide-in-from-top-2 duration-200">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <Button
              variant={tags.selected.length === 0 ? "secondary" : "ghost"}
              size="sm"
              className="h-6 text-xs whitespace-nowrap"
              onClick={() => tags.setSelected([])}
            >
              All
            </Button>
            {allTags.map(tag => {
              const isSelected = tags.selected.includes(tag.id);
              return (
                <Button
                  key={tag.id}
                  variant={isSelected ? "secondary" : "ghost"}
                  size="sm"
                  className="h-6 text-xs whitespace-nowrap"
                  onClick={() => {
                    const newSelected = isSelected
                      ? tags.selected.filter(id => id !== tag.id)
                      : [...tags.selected, tag.id];
                    tags.setSelected(newSelected);
                  }}
                >
                  {tag.name}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};
