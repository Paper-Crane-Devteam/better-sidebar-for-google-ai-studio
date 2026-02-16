/**
 * Parses the ChatGPT conversation request payload to extract the user's prompt
 */
export function parseConversationRequest(requestBody: string): { prompt?: string } | null {
  try {
    const data = JSON.parse(requestBody);
    
    // Extract prompt from messages array
    if (data?.messages && Array.isArray(data.messages)) {
      for (const message of data.messages) {
        if (message?.author?.role === 'user' && message?.content?.content_type === 'text') {
          if (Array.isArray(message.content.parts) && message.content.parts.length > 0) {
            return { prompt: message.content.parts.join('') };
          }
        }
      }
    }
    
    return null;
  } catch (e) {
    console.error('Better Sidebar (ChatGPT): Error parsing conversation request', e);
    return null;
  }
}
