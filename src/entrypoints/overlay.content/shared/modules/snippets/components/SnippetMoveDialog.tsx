import React, { useCallback } from 'react';
import { useAppStore } from '@/shared/lib/store';
import { FolderPicker } from '@/shared/components/FolderPicker';

interface SnippetMoveDialogProps {
  onSelect: (folderId: string | null) => void;
  selectedIds: string[];
}

export const SnippetMoveDialog = ({ onSelect, selectedIds }: SnippetMoveDialogProps) => {
  const snippetFolders = useAppStore((state) => state.snippetFolders);
  const createSnippetFolder = useAppStore((state) => state.createSnippetFolder);

  const handleCreateFolder = useCallback(
    (name: string, parentId: string | null) => createSnippetFolder(name, parentId),
    [createSnippetFolder],
  );

  return (
    <FolderPicker
      folders={snippetFolders}
      onSelect={onSelect}
      selectedIds={selectedIds}
      onCreateFolder={handleCreateFolder}
    />
  );
};
