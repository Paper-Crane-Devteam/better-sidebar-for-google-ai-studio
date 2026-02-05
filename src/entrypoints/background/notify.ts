/**
 * Notify all parts of the extension about data updates (sidepanel, content scripts).
 */
export async function notifyDataUpdated(
  updateType?: string,
  payload?: unknown,
): Promise<void> {
  const message: { type: string; updateType?: string; payload?: unknown } = {
    type: 'DATA_UPDATED',
  };
  if (updateType) message.updateType = updateType;
  if (payload !== undefined) message.payload = payload;

  browser.runtime.sendMessage(message).catch(() => {
    // Expected if no listeners (e.g. sidepanel closed)
  });

  try {
    const tabs = await browser.tabs.query({
      url: ['https://aistudio.google.com/*', 'https://gemini.google.com/*'],
    });
    for (const tab of tabs) {
      if (tab.id) {
        browser.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    }
  } catch (e) {
    console.error('Error notifying tabs:', e);
  }
}
