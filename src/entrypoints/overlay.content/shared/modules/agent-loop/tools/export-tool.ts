/**
 * export Tool — Placeholder.
 * Will be implemented in Phase 2.
 */

export interface ExportToolParams {
  ids: string;
  format: string;
}

export async function exportConversations(_params: ExportToolParams): Promise<string> {
  return 'ERROR: export tool is not yet available. Please use execute_sql to query conversation and message data, then present the results to the user directly.';
}
