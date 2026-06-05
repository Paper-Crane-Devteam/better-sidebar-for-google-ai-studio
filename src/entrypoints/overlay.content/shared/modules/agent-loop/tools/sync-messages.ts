/**
 * sync_conversation_messages Tool — Placeholder.
 * Will be implemented in Phase 2.
 */

export interface SyncMessagesParams {
  conversation_ids: string;
}

export async function syncMessages(_params: SyncMessagesParams): Promise<string> {
  return 'ERROR: sync_conversation_messages is not yet available. Please use execute_sql to query existing message data, or ask the user to manually open conversations they want to sync.';
}
