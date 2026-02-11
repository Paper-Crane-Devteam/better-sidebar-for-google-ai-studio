import {
  parseStreamingResponse,
  extractWrbFrPayloads,
} from '../lib/response-parser';
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
      console.error(
        'Better Sidebar (Gemini): Error handling generate request',
        e,
      );
    }

    let responseBody = response.response;

    // Ensure responseBody is a string
    if (typeof responseBody !== 'string') {
      try {
        responseBody = JSON.stringify(responseBody);
      } catch (e) {
        console.warn(
          'Better Sidebar (Gemini): Could not stringify response body',
          e,
        );
        return;
      }
    }

    try {
      const retChunks = parseStreamingResponse(responseBody);

      console.log(
        'Better Sidebar (Gemini): Parsed StreamGenerate chunks:',
        retChunks,
      );
      const chunks = retChunks.map((chunk) => chunk[0]);
      if (chunks.length > 0) {
        // Use common helper to extract payloads
        const payloads = extractWrbFrPayloads(chunks);

        if (payloads.length > 0) {
          let targetPayload: any = null;
          let targetPayloadIndex = -1;

          // 倒着找，找到第一个[4]?.[0]?.[1]?.[0]有内容的
          for (let i = payloads.length - 1; i >= 0; i--) {
            const p = payloads[i];
            try {
              const content = p?.[4]?.[0]?.[1]?.[0];
              if (content) {
                targetPayload = p;
                targetPayloadIndex = i;
                break;
              }
            } catch (e) {
              // ignore
            }
          }

          console.log(
            'Better Sidebar (Gemini): Parsed Payload:',
            targetPayloadIndex,
            targetPayload,
          );

          if (targetPayload) {
            try {
              const contentCandidate = targetPayload?.[4]?.[0]?.[1]?.[0];
              const conversationId = targetPayload?.[1]?.[0]?.replace(
                /^c_/,
                '',
              );

              if (contentCandidate && conversationId) {
                console.log(
                  'Better Sidebar (Gemini): Target Content:',
                  contentCandidate,
                );
                console.log(
                  'Better Sidebar (Gemini): Conversation ID:',
                  conversationId,
                );

                // 找标题: 倒着找 payload[10][0] 有内容
                let title: string | undefined;
                for (let i = payloads.length - 1; i >= 0; i--) {
                  try {
                    const t = payloads[i]?.[10]?.[0];
                    if (typeof t === 'string' && t) {
                      title = t;
                      break;
                    }
                  } catch (e) {
                    // ignore
                  }
                }

                const messages = [];
                const timestamp = Math.floor(Date.now() / 1000);

                // User Message
                if (prompt) {
                  messages.push({
                    role: 'user',
                    id: crypto.randomUUID(), // We don't have ID in generate response usually, so generate one
                    conversation_id: conversationId,
                    content: prompt,
                    message_type: 'text',
                    created_at: timestamp,
                  });
                }

                // Model Message
                messages.push({
                  role: 'model',
                  id: crypto.randomUUID(),
                  conversation_id: conversationId,
                  content: contentCandidate,
                  message_type: 'text',
                  created_at: timestamp,
                });

                if (title) {
                    globalThis.dispatchEvent(new CustomEvent('BETTER_SIDEBAR_PROMPT_CREATE', {
                        detail: {
                            id: conversationId,
                            title,
                            messages,
                            created_at: timestamp,
                            type: 'conversation',
                            platform: 'gemini'
                        }
                    }));
                } else {
                    globalThis.dispatchEvent(new CustomEvent('GEMINI_CHAT_CONTENT_RESPONSE', {
                        detail: {
                            conversationId,
                            messages
                        }
                    }));
                }
              }
            } catch (e) {
              console.error(
                'Better Sidebar (Gemini): Error parsing target payload',
                e,
              );
            }
          }
        }

        const lastChunk = chunks[chunks.length - 1];
        console.log('Better Sidebar (Gemini): Last Chunk:', lastChunk);

        globalThis.dispatchEvent(
          new CustomEvent('GEMINI_RESPONSE', {
            detail: {
              type: 'generate',
              chunks,
              lastChunk,
              originalUrl: url,
              requestBody: response.config?.body,
              requestData: response.config?.data,
              prompt: prompt,
            },
          }),
        );
      }
    } catch (e) {
      console.error(
        'Better Sidebar (Gemini): Error handling generate response',
        e,
      );
    }
  }
}
