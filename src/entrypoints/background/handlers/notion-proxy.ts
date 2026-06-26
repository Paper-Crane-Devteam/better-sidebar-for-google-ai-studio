import type {
  ExtensionMessage,
  ExtensionResponse,
} from '@/shared/types/messages';
import type { MessageSender } from '../types';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

/**
 * Proxies Notion API requests from content scripts to bypass CORS.
 * The background script has host_permissions for api.notion.com.
 */
export async function handleNotionProxy(
  message: ExtensionMessage,
  _sender: MessageSender,
): Promise<ExtensionResponse | null> {
  if (message.type !== 'NOTION_API_REQUEST') return null;

  const { endpoint, method, body, apiKey } = message.payload as {
    endpoint: string;
    method: string;
    body?: any;
    apiKey: string;
  };

  if (!apiKey) {
    return { success: false, error: 'No API key provided' };
  }

  try {
    const url = `${NOTION_API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    };

    const res = await fetch(url, {
      method: method || 'GET',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        error: data.message || `HTTP ${res.status}`,
        data: { status: res.status, ...data },
      };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}
