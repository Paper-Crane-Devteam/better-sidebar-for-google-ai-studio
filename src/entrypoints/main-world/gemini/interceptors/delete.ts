import { parseBatchExecuteRequest } from '../lib/request-parser';

export function handleDeleteResponse(response: any, url: string) {
  if (response.status === 200) {
    console.log('Better Sidebar (Gemini): Intercepted Delete Chat');

    try {
      const requestBody = response.config?.body || response.config?.data;
      if (requestBody && typeof requestBody === 'string') {
        const [parsedBody] = parseBatchExecuteRequest(requestBody);
        
        if (Array.isArray(parsedBody)) {
          for (const item of parsedBody) {
            // item structure: [rpcId, payload, null, "generic"]
            // Example: ["GzXR5e","[\"c_aa2387d74e142bab\"]",null,"generic"]
            if (Array.isArray(item) && item.length >= 2 && item[0] === 'GzXR5e') {
              const payloadString = item[1];
              if (typeof payloadString === 'string') {
                try {
                  const payload = JSON.parse(payloadString);
                  // payload structure: ["c_aa2387d74e142bab"]
                  if (Array.isArray(payload) && payload.length > 0) {
                    const fullId = payload[0];
                    if (typeof fullId === 'string') {
                      const id = fullId.replace(/^c_/, '');
                      console.log(`Better Sidebar (Gemini): Detected chat deletion: ${id}`);
                      
                      globalThis.dispatchEvent(
                        new CustomEvent('GEMINI_CHAT_DELETE', {
                          detail: {
                            id,
                            originalUrl: url,
                          },
                        })
                      );
                    }
                  }
                } catch (e) {
                  console.error('Better Sidebar (Gemini): Error parsing delete payload', e);
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Better Sidebar (Gemini): Error handling delete request', e);
    }
  }
}
