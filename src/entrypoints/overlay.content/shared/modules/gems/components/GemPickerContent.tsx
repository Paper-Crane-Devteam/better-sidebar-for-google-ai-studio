import { useState, useMemo, useEffect, useRef } from 'react';
import { Gem as GemIcon, Search, Sparkles } from 'lucide-react';
import { cn } from '@/shared/lib/utils/utils';
import { useI18n } from '@/shared/hooks/useI18n';
import { useAppStore } from '@/shared/lib/store';
import { navigate } from '@/shared/lib/navigation';
import { useModalStore } from '@/shared/lib/modal';
import { useSettingsStore } from '@/shared/lib/settings-store';
import type { Gem } from '@/shared/types/db';

interface GemPickerContentProps {
  lastSelectedGemId?: string | null;
}

export const GemPickerContent = ({ lastSelectedGemId }: GemPickerContentProps) => {
  const { t } = useI18n();
  const { gems } = useAppStore();
  const close = useModalStore((s) => s.close);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const lastSelectedGem = useMemo(
    () => (lastSelectedGemId ? gems.find((g) => g.id === lastSelectedGemId) : null),
    [gems, lastSelectedGemId],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return gems;
    const q = search.toLowerCase();
    return gems.filter((g) => g.name.toLowerCase().includes(q));
  }, [gems, search]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleSelect = (gem: Gem) => {
    useSettingsStore.getState().setLastSelectedGemId(gem.id);
    close();
    navigate(`https://gemini.google.com/gem/${gem.id}`);
  };

  return (
    <div className="-mx-6 -my-4">
      {/* Search */}
      <div className="px-3 pb-2 pt-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('gems.searchGems')}
            className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 pl-8 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* List */}
      <div className="max-h-[300px] overflow-y-auto px-2 pb-2 flex flex-col gap-0.5">
        {/* Last selected gem shortcut */}
        {lastSelectedGem && !search.trim() && (
          <>
            <button
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm w-full text-left',
                'hover:bg-accent/50 transition-colors',
                'text-purple-600 dark:text-purple-400 font-medium',
              )}
              onClick={() => handleSelect(lastSelectedGem)}
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {t('gems.chatWithLastGem', { name: lastSelectedGem.name })}
              </span>
            </button>
            <div className="h-px bg-border mx-1 my-1" />
          </>
        )}

        {filtered.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-6">
            {t('gems.noGems')}
          </div>
        ) : (
          filtered.map((gem) => (
            <button
              key={gem.id}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm w-full text-left',
                'hover:bg-accent/50 transition-colors',
              )}
              onClick={() => handleSelect(gem)}
            >
              <GemIcon className="h-4 w-4 text-purple-500 shrink-0" />
              <span className="truncate">{gem.name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
