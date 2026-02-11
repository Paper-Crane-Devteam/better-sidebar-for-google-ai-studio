import React, { useState, useRef, useEffect } from 'react';
import { Tag } from '@/shared/types/db';
import { useAppStore } from '@/shared/lib/store';
import { Tag as TagIcon, MoreVertical, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/entrypoints/overlay.content/shared/components/ui/button';
import { Input } from '@/entrypoints/overlay.content/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/entrypoints/overlay.content/shared/components/ui/context-menu';
import { modal } from '@/shared/lib/modal';
import { useI18n } from '@/shared/hooks/useI18n';

interface TagItemProps {
  tag: Tag;
}

export const TagItem = ({ tag }: TagItemProps) => {
  const { t } = useI18n();
  const { deleteTag, updateTag } = useAppStore();
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

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setNewName(tag.name);
    }
  };

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

  const isActive = isContextMenuOpen || isDropdownOpen;

  return (
    <ContextMenu onOpenChange={setIsContextMenuOpen}>
      <ContextMenuTrigger>
        <div
          className={cn(
            'group flex items-center justify-between p-2 rounded-md text-sm border border-transparent transition-colors cursor-default',
            isActive
              ? 'bg-accent/50 border-border'
              : 'hover:bg-accent/50 hover:border-border'
          )}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <TagIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate font-medium">{tag.name}</span>
          </div>
          <div
            className={cn(
              'flex items-center transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
          >
            <DropdownMenu onOpenChange={setIsDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  {t('tags.rename')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('common.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => setIsEditing(true)}>
          <Edit2 className="mr-2 h-4 w-4" />
          {t('tags.rename')}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={handleDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t('common.delete')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
