import { markdownToBlocks } from '@tryfabric/martian';
import type { ExportItem } from './types';
import { useSettingsStore } from '@/shared/lib/settings-store';

interface NotionPage {
  id: string;
  title: string;
}

/**
 * Send a Notion API request via the background script (to bypass CORS).
 */
async function notionFetch(endpoint: string, method = 'GET', body?: any): Promise<{ success: boolean; data?: any; error?: string }> {
  const { integrations } = useSettingsStore.getState();
  const apiKey = integrations.notion.apiKey;

  if (!apiKey) {
    return { success: false, error: 'No API key configured' };
  }

  const response = await browser.runtime.sendMessage({
    type: 'NOTION_API_REQUEST',
    payload: { endpoint, method, body, apiKey },
  });

  return response;
}

/**
 * Test the Notion API connection.
 */
export async function testNotionConnection(): Promise<{ ok: boolean; name?: string; error?: string }> {
  const result = await notionFetch('/users/me');
  if (!result.success) {
    return { ok: false, error: result.error };
  }
  const data = result.data;
  return { ok: true, name: data.name || data.bot?.owner?.user?.name || 'Connected' };
}

/**
 * Search for pages the integration has access to.
 */
export async function searchNotionPages(query?: string): Promise<NotionPage[]> {
  const body: any = {
    filter: { property: 'object', value: 'page' },
    page_size: 20,
  };
  if (query) body.query = query;

  const result = await notionFetch('/search', 'POST', body);
  if (!result.success) {
    throw new Error(result.error || 'Search failed');
  }

  return (result.data.results || []).map((page: any) => ({
    id: page.id,
    title: page.properties?.title?.title?.[0]?.plain_text
      || page.properties?.Name?.title?.[0]?.plain_text
      || 'Untitled',
  }));
}

/**
 * Create a new page in Notion under the configured parent page.
 */
export async function createNotionPage(item: ExportItem): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { integrations } = useSettingsStore.getState();
  const { parentPageId } = integrations.notion;

  if (!parentPageId) {
    return { ok: false, error: 'No parent page configured' };
  }

  const blocks = markdownToBlocks(item.content || '');
  // Notion API limits children to 100 blocks per request
  const children = blocks.slice(0, 100);

  const body = {
    parent: { page_id: parentPageId },
    properties: {
      title: {
        title: [{ type: 'text', text: { content: item.title } }],
      },
    },
    children,
  };

  const result = await notionFetch('/pages', 'POST', body);
  if (!result.success) {
    return { ok: false, error: result.error };
  }

  // Append remaining blocks in batches if >100
  if (blocks.length > 100) {
    const remaining = blocks.slice(100);
    for (let i = 0; i < remaining.length; i += 100) {
      const batch = remaining.slice(i, i + 100);
      await notionFetch(`/blocks/${result.data.id}/children`, 'PATCH', { children: batch });
    }
  }

  return { ok: true, url: result.data.url };
}

/**
 * Export multiple items to Notion, each as a separate page.
 * Supports progress callback and cancellation via AbortSignal-like pattern.
 */
export async function exportToNotion(
  items: ExportItem[],
  options?: {
    onProgress?: (completed: number, total: number) => void;
    shouldCancel?: () => boolean;
  },
): Promise<{ ok: boolean; count: number; cancelled?: boolean; error?: string }> {
  let count = 0;
  const total = items.length;

  for (const item of items) {
    // Check for cancellation before each request
    if (options?.shouldCancel?.()) {
      return { ok: true, count, cancelled: true };
    }

    const result = await createNotionPage(item);
    if (!result.ok) {
      return { ok: false, count, error: result.error };
    }
    count++;
    options?.onProgress?.(count, total);
  }
  return { ok: true, count };
}
