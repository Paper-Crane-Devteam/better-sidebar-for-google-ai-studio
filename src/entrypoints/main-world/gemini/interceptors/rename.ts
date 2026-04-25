import { parseResponsePayloads } from '../lib/response-parser';

export function handleRenameResponse(response: any, url: string) {
  if (response.status !== 200) return;

  let responseBody = response.response;
  if (typeof responseBody !== 'string') {
    try {
      responseBody = JSON.stringify(responseBody);
    } catch {
      return;
    }
  }

  try {
    const payloads = parseResponsePayloads(responseBody);

    for (const data of payloads) {
      try {
        // data[1][0] is id (e.g. "c_e1e43bcbf6138193"), strip c_ prefix
        // data[1][1] is the new name
        const rawId = data?.[1]?.[0];
        const newName = data?.[1]?.[1];

        if (typeof rawId === 'string' && typeof newName === 'string') {
          const id = rawId.replace(/^c_/, '');
          console.log(
            `Better Sidebar (Gemini): Detected chat rename: ${id} -> ${newName}`,
          );

          globalThis.dispatchEvent(
            new CustomEvent('GEMINI_CHAT_RENAME', {
              detail: { id, newName, originalUrl: url },
            }),
          );
        }
      } catch {
        // ignore individual payload errors
      }
    }
  } catch (e) {
    console.error(
      'Better Sidebar (Gemini): Error handling rename response',
      e,
    );
  }
}
