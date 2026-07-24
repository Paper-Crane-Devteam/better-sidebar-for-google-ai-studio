import { createContext, useContext } from 'react';
import type { PendingNewChatEntry } from './hooks/usePendingNewChat';

interface ExplorerContextValue {
  onNewChat?: () => void;
  /** Start a new chat and show loading in the given folder */
  onNewChatInFolder?: (folderId: string) => void;
  /** Folder ID where a new chat is being created (loading state) — legacy shimmer */
  pendingNewChatFolderId?: string | null;

  // --- New pending entry system ---
  /** The current pending new chat entry (singleton) */
  pendingEntry?: PendingNewChatEntry | null;
  /** Create a pending entry in the resolved target folder */
  createPendingEntry?: (folderId: string | null) => void;
  /** Create a pending entry, expand the folder, and scroll to it */
  createPendingAndFocus?: (folderId: string | null) => void;
  /** Update the title of the pending entry */
  updatePendingTitle?: (title: string) => void;
  /** Commit editing (blur) — transition to idle */
  commitPendingEditing?: () => void;
  /** Re-enter editing mode */
  startPendingEditing?: () => void;
  /** Remove/cancel the pending entry */
  removePendingEntry?: () => void;
  /** Move the pending entry to a different folder */
  movePendingEntry?: (folderId: string | null) => void;
}

export const ExplorerContext = createContext<ExplorerContextValue>({});

export const useExplorerContext = () => useContext(ExplorerContext);
