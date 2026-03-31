import { parseBatchExecuteRequest } from '../lib/request-parser';

export function handleDeleteGemResponse(response: any, url: string) {
  if (response.status !== 200) return;

  try {
    const requestBody = response.config?.body || response.config?.data;
    if (!requestBody || typeof requestBody !== 'string') return;

    const [parsedBody] = parseBatchExecuteRequest(requestBody);
    if (!Array.isArray(parsedBody)) return;

    for (const item of parsedBody) {
      // item structure: ["UXcSJb","[\"ece55b25adb4\"]",null,"generic"]
      if (!Array.isArray(item) || item[0] !== 'UXcSJb') continue;

      const payloadString = item[1];
      if (typeof payloadString !== 'string') continue;

      try {
        const payload = JSON.parse(payloadString);
        // payload: ["ece55b25adb4"]
        if (Array.isArray(payload) && typeof payload[0] === 'string') {
          const id = payload[0];
          console.log(
            `Better Sidebar (Gemini): Detected gem deletion: ${id}`,
          );

          globalThis.dispatchEvent(
            new CustomEvent('GEMINI_GEM_DELETE', {
              detail: { id, originalUrl: url },
            }),
          );
        }
      } catch {
        // ignore parse errors
      }
    }
  } catch (e) {
    console.error(
      'Better Sidebar (Gemini): Error handling delete gem request',
      e,
    );
  }
}
