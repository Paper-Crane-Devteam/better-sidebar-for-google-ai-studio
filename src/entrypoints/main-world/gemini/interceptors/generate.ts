import { parseStreamingResponse, extractWrbFrPayloads } from '../lib/response-parser';
import { parseBatchExecuteRequest } from '../lib/request-parser';

export function handleGenerateResponse(response: any, url: string) {
  if (response.status === 200) {
    let prompt: string | null = null;
    // Parse Request
    try {
        const requestBody = response.config?.body;
        // Also check if config.data exists (axios sometimes uses data instead of body)
        const requestData = requestBody || response.config?.data;
        
        if (requestData && typeof requestData === 'string') {
            const parsedBody = parseBatchExecuteRequest(requestData);
            
            // Generate specific logic to extract prompt
            // Try-catch simplified access
            try {
                // The second element contains the inner JSON string -> parsedBody[1]
                // innerJson[0][0] -> prompt
                const innerJsonString = parsedBody?.[1];
                if (typeof innerJsonString === 'string') {
                    const innerJson = JSON.parse(innerJsonString);
                    const promptCandidate = innerJson?.[0]?.[0];
                    if (typeof promptCandidate === 'string') {
                        prompt = promptCandidate;
                    }
                }
            } catch (e) {
                // ignore
            }
            
            if (prompt) {
                console.log('Better Sidebar (Gemini): Parsed User Prompt:', prompt);
            }
        }
    } catch (e) {
        console.error('Better Sidebar (Gemini): Error handling generate request', e);
    }

    let responseBody = response.response;
    
    // Ensure responseBody is a string
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
      
      console.log('Better Sidebar (Gemini): Parsed StreamGenerate chunks:', retChunks);
      const chunks = retChunks.map(chunk => chunk[0]);
      if (chunks.length > 0) {
        // Use common helper to extract payloads
        const payloads = extractWrbFrPayloads(chunks);
        
        if (payloads.length > 0) {
             // Take the second to last one if available, else the first
             const targetPayloadIndex = payloads.length >= 2 ? payloads.length - 2 : 0;
             const parsedPayload = payloads[targetPayloadIndex];
             
             console.log('Better Sidebar (Gemini): Parsed Payload:', parsedPayload);

             // "返回的内容就是array[4][1]" -> parsedPayload[4][0][1][0]
             // Using simplified try-catch access
             try {
                 const contentCandidate = parsedPayload?.[4]?.[0]?.[1]?.[0];
                 if (contentCandidate) {
                     console.log('Better Sidebar (Gemini): Target Content (array[4][0][1][0]):', contentCandidate);
                 }
             } catch (e) {
                 // ignore
             }
        }

        const lastChunk = chunks[chunks.length - 1];
        
        globalThis.dispatchEvent(
          new CustomEvent('GEMINI_RESPONSE', {
            detail: {
              type: 'generate',
              chunks,
              lastChunk,
              originalUrl: url,
              requestBody: response.config?.body,
              requestData: response.config?.data,
              prompt: prompt
            }
          })
        );
      }
    } catch (e) {
      console.error('Better Sidebar (Gemini): Error handling generate response', e);
    }
  }
}
