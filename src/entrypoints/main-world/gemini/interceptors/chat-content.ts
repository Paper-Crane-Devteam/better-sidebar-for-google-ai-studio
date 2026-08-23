import { parseStreamingResponse, extractWrbFrPayloads } from '../lib/response-parser';
import { parseBatchExecuteRequest } from '../lib/request-parser';

export function handleChatContentResponse(response: any, url: string) {
  if (response.status === 200) {
    // Parse Request
    try {
        const requestBody = response.config?.body;
        const requestData = requestBody || response.config?.data;
        if (requestData && typeof requestData === 'string') {
            const parsedBody = parseBatchExecuteRequest(requestData);
            console.log('Better Sidebar (Gemini): Parsed Chat Content Request:', parsedBody);
        }
    } catch (e) {
        console.error('Better Sidebar (Gemini): Error handling chat content request', e);
    }

    let responseBody = response.response;
    
    if (typeof responseBody !== 'string') {
       try {
         responseBody = JSON.stringify(responseBody);
       } catch (e) {
         console.warn('Better Sidebar (Gemini): Could not stringify response body', e);
         return;
       }
    }

    try {
      const retChunks = parseStreamingResponse(responseBody);
      const chunks = retChunks.map(chunk => chunk[0]);
      
      console.log('Better Sidebar (Gemini): Chat Content chunks:', chunks);

      if (chunks.length > 0) {
        // Use common helper to extract payloads
        const payloads = extractWrbFrPayloads(chunks);
        console.log('Better Sidebar (Gemini): Chat Content Payloads:', payloads);

        const chatHistory: any[] = [];
        
        try {
          // payloads[0][0] is an array of dialog entries
          // We use optional chaining and try-catch to avoid deep checks
          const entries = payloads?.[0]?.[0];
          
          if (Array.isArray(entries)) {
              for (const entry of entries) {
                   try {
                       // User provided structure:
                       // user: entry[2][0][0]
                       // model: entry[3][0][0][1][0]
                       // timestamp: entry[4] -> [seconds, nanos]
                       const conversationId = entry?.[0]?.[0]?.replace(/^c_/, '');
                       const userContentId = entry?.[0]?.[1];
                       const modelContentId = entry?.[3]?.[3];
                       const userContent = entry?.[2]?.[0]?.[0];
                       
                       const modelContent = entry?.[3]?.[0]?.[0]?.[1]?.[0];
                       const timestampArr = entry?.[4];
                       
                       let timestamp = null;
                       if (Array.isArray(timestampArr) && timestampArr.length > 0) {
                           timestamp = timestampArr[0];
                       }
                       
                       if (userContent) {
                           chatHistory.push({
                            role: 'user',
                            id: userContentId,
                            conversation_id: conversationId,
                            content: userContent,
                            message_type: 'text',
                            created_at: timestamp,
                           });
                       }
                       if(modelContent) {
                        chatHistory.push({
                            role: 'model',
                            id: modelContentId,
                            conversation_id: conversationId,
                            content: modelContent,
                            message_type: 'text',
                            created_at: timestamp,
                        });
                       }
                   } catch (innerErr) {
                       // Ignore individual entry parse errors
                   }
              }
          }
      } catch (err) {
          // Ignore payload parse errors
      }

        if (chatHistory.length > 0) {
            console.log(`Better Sidebar (Gemini): Parsed ${chatHistory.length} history items`, chatHistory);
        }

        globalThis.dispatchEvent(
          new CustomEvent('GEMINI_CHAT_CONTENT_RESPONSE', {
            detail: {
              conversationId: chatHistory[0].conversation_id,
              messages: chatHistory,
            }
          })
        );
      }
    } catch (e) {
      console.error('Better Sidebar (Gemini): Error handling chat content response', e);
    }
  }
}
