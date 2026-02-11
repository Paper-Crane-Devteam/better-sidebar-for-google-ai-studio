import React from 'react';
import { useI18n } from '@/shared/hooks/useI18n';
import { useSettingsStore } from '@/shared/lib/settings-store';
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/entrypoints/overlay.content/shared/components/ui/context-menu';
import { FolderPlus, Edit2, Trash2, Star, StarOff, Copy, Files } from 'lucide-react';
import { NodeProps } from './types';

interface NodeContextMenuProps extends NodeProps {
  isFavorite: boolean;
  onDelete: () => void;
  onCreateFolder: (parentId: string) => void;
  onToggleFavorite: (id: string, isFav: boolean) => void;
  onCopy: (e: React.MouseEvent) => void;
  onDuplicate: () => void;
}

export const NodeContextMenu = ({
  node,
  onCreateFolder,
  onToggleFavorite,
  onDelete,
  isFavorite,
  onCopy,
  onDuplicate,
}: NodeContextMenuProps) => {
  const { t } = useI18n();
  const { explorer } = useSettingsStore();
  const { enableRightClickRename } = explorer;
  const shouldPreventRef = React.useRef(false);

  const isFile = node.data.type === 'file';

  return (
    <ContextMenuContent
      className="w-48"
      onCloseAutoFocus={(e) => {
        if (shouldPreventRef.current) {
          e.preventDefault();
          shouldPreventRef.current = false;
        }
      }}
    >
      {node.data.type === 'folder' && (
        <>
          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onCreateFolder(node.data.id);
            }}
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            {t('node.newFolder')}
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      {isFile && (
        <>
          <ContextMenuItem onClick={onCopy}>
            <Copy className="mr-2 h-4 w-4" />
            {t('prompts.copyContent')}
          </ContextMenuItem>

          <ContextMenuItem onClick={onDuplicate}>
            <Files className="mr-2 h-4 w-4" />
            {t('node.duplicate')}
          </ContextMenuItem>

          <ContextMenuItem
            onClick={() => onToggleFavorite(node.data.id, isFavorite)}
          >
            {isFavorite ? (
              <>
                <StarOff className="mr-2 h-4 w-4" />
                {t('node.removeFromFavorites')}
              </>
            ) : (
              <>
                <Star className="mr-2 h-4 w-4" />
                {t('node.addToFavorites')}
              </>
            )}
          </ContextMenuItem>

          <ContextMenuSeparator />
        </>
      )}
      
      <ContextMenuItem
        onClick={() => {
          shouldPreventRef.current = true;
          node.edit();
        }}
      >
        <Edit2 className="mr-2 h-4 w-4" />
        {t('node.rename')}
      </ContextMenuItem>

      <ContextMenuItem
        onClick={onDelete}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        {t('node.delete')}
      </ContextMenuItem>
    </ContextMenuContent>
  );
};
