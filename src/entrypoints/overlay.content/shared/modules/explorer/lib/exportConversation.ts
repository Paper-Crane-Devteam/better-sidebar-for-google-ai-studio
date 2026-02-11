import { stripMarkdown } from '@/shared/lib/utils';
import type { Message } from '@/shared/types/db';
import i18n from '@/locale/i18n';

/** Fetch messages for a conversation via background script. Returns null on error or empty. */
export async function fetchMessagesForExport(
  conversationId: string
): Promise<Message[] | null> {
  try {
    const response = await browser.runtime.sendMessage({
      type: 'GET_MESSAGES_BY_CONVERSATION_ID',
      payload: { conversationId },
    });
    if (!response?.success || !Array.isArray(response.data)) return null;
    const messages = response.data as Message[];
    if (messages.length === 0) return null;
    return messages;
  } catch {
    return null;
  }
}

/** Build plain text export (strip markdown). Filter to text messages only. */
export function buildExportText(messages: Message[]): string {
  const userLabel = i18n.t('export.roleUser');
  const modelLabel = i18n.t('export.roleModel');
  const textMessages = messages.filter((m) => m.message_type !== 'thought');
  return textMessages
    .map((m) => {
      const content = m.content ?? '';
      return `${m.role === 'user' ? userLabel : modelLabel}:\n${stripMarkdown(content)}`;
    })
    .join('\n\n');
}

/** Build markdown export (content as-is). */
export function buildExportMarkdown(messages: Message[]): string {
  const userLabel = i18n.t('export.roleUser');
  const modelLabel = i18n.t('export.roleModel');
  const textMessages = messages.filter((m) => m.message_type !== 'thought');
  return textMessages
    .map((m) => {
      const content = m.content ?? '';
      const heading = m.role === 'user' ? `## ${userLabel}` : `## ${modelLabel}`;
      return `${heading}\n\n${content}`;
    })
    .join('\n\n');
}

/** Build JSON export (messages as array of { role, content }). */
export function buildExportJson(messages: Message[]): string {
  const textMessages = messages.filter((m) => m.message_type !== 'thought');
  const data = textMessages.map((m) => ({
    role: m.role,
    content: m.content ?? '',
  }));
  return JSON.stringify(data, null, 2);
}

/** Trigger download of a blob with the given filename. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Sanitize filename: remove invalid chars and limit length. */
export function safeFilename(name: string, maxLen = 80): string {
  const sanitized = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
  return sanitized.slice(0, maxLen) || i18n.t('export.defaultFilename');
}
