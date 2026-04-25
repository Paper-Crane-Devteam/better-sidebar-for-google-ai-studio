import React, { useState, useRef, useEffect } from 'react';
import { Tag } from '@/shared/types/db';
import { useAppStore } from '@/shared/lib/store';
import { useSettingsStore } from '@/shared/lib/settings-store';
import { Tag as TagIcon } from 'lucide-react';
import { Input } from '@/entrypoints/overlay.content/shared/components/ui/input';
import { cn } from '@/shared/lib/utils/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/entrypoints/overlay.content/shared/components/ui/context-menu';
import { modal } from '@/shared/lib/modal';
import { useI18n } from '@/shared/hooks/useI18n';
import { NodeActionBar, renderMenuItems } from '@/entrypoints/overlay.content/shared/components/node-action-bar';
import { useTagMenuItems } from './useTagMenuItems';

interface TagItemProps {
  tag: Tag;
}

export const TagItem = ({ tag }: TagItemProps) => {
  const { t } = useI18n();
  const { deleteTag, updateTag } = useAppStore();
  const layoutDensity = useSettingsStore((state) => state.layoutDensity);
  const rowHeight = layoutDensity === 'compact' ? 32 : 38;

  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(tag.name);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleRename = async () => {
    if (!newName.trim() || newName === tag.name) {
      setIsEditing(false);
      setNewName(tag.name);
      return;
    }
    await updateTag(tag.id, { name: newName.trim() });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    const confirmed = await modal.confirm({
      title: t('tags.deleteTag'),
      content: t('tags.deleteTagConfirm'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
    });
    if (confirmed) {
      await deleteTag(tag.id);
    }
  };

  const handleColorChange = async (color: string | null) => {
    await updateTag(tag.id, { color });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setNewName(tag.name);
    }
  };

  const menuItems = useTagMenuItems({
    tag,
    onRename: () => setIsEditing(true),
    onDelete: handleDelete,
    onColorChange: handleColorChange,
  });

  if (isEditing) {
    return (
      <div className="p-2">
        <Input
          ref={inputRef}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={handleRename}
          onKeyDown={onKeyDown}
          maxLength={30}
          className="h-8 text-sm"
        />
      </div>
    );
  }

  const isMenuActive = isContextMenuOpen || isDropdownOpen;

  return (
    <ContextMenu onOpenChange={setIsContextMenuOpen} modal={false}>
      <ContextMenuTrigger>
        <div style={{ height: rowHeight }} className="w-full px-1">
          <div
            className={cn(
              'group flex items-center justify-between px-2 rounded-sm text-sm border border-transparent transition-colors cursor-default h-[calc(100%-2px)] mt-[1px] relative pr-8',
              tag.color
                ? 'tag-item-colored'
                : isMenuActive
                  ? 'bg-accent/50'
                  : 'hover:bg-accent/50',
              tag.color && isMenuActive && 'tag-item-colored-active',
              isMenuActive && 'node-menu-active',
            )}
            style={tag.color ? { '--tag-color': tag.color } as React.CSSProperties : undefined}
          >
            <div className="flex items-center gap-2 overflow-hidden" style={tag.color ? { color: tag.color } : undefined}>
              <TagIcon className="h-4 w-4 shrink-0" />
              <span className="truncate font-medium">{tag.name}</span>
            </div>
            <NodeActionBar
              menuItems={menuItems}
              forceVisible={isMenuActive}
              onDropdownOpenChange={setIsDropdownOpen}
            />
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {renderMenuItems(menuItems, 'context')}
      </ContextMenuContent>
    </ContextMenu>
  );
};
