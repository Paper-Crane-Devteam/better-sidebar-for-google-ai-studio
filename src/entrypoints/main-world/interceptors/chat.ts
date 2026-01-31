import { parseConversation } from '../lib/response-parser';

export function handleChatResponse(response: any, url: string) {
  if (response.status === 200 || response.response) {
    let responseBody = response.response;
    if (typeof responseBody !== 'string') {
      responseBody = JSON.stringify(responseBody);
    }
    
    // Parse the response body as JSON first
    let json;
    try {
        // Remove anti-hijacking prefix if present (often )]}' )
        const cleanBody = responseBody.replace(/^\)\]\}'/, '').trim();
        json = JSON.parse(cleanBody);
    } catch (e) {
        console.error('Better Sidebar for Google AI Studio: JSON parse error', e);
        return;
    }

    const parsedData = parseConversation(json);

    if (parsedData && parsedData.messages.length > 0) {
      console.log(
        'Better Sidebar for Google AI Studio: Successfully parsed chat data',
        parsedData
      );

      // Dispatch event with the structured data
      globalThis.dispatchEvent(
        new CustomEvent('AI_STUDIO_RESPONSE', {
          detail: {
            ...parsedData,
            originalUrl: url,
          },
        })
      );
    }
  }
}
