/**
 * Parses the event-stream response format from ChatGPT.
 * Format: 
 * event: <event_type>
 * data: <json_data>
 * 
 * or just:
 * data: <json_data>
 */
export function parseEventStream(responseBody: string): Array<{ event?: string; data: any }> {
  const results: Array<{ event?: string; data: any }> = [];
  
  if (!responseBody) {
    return results;
  }

  const lines = responseBody.split('\n');
  let currentEvent: string | undefined;
  let currentData: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (!trimmed) {
      // Empty line indicates end of a message block
      if (currentData !== undefined) {
        try {
          // Check if data is [DONE]
          if (currentData === '[DONE]') {
            results.push({ event: currentEvent, data: '[DONE]' });
          } else {
            const parsed = JSON.parse(currentData);
            results.push({ event: currentEvent, data: parsed });
          }
        } catch (e) {
          // If parsing fails, keep as string
          results.push({ event: currentEvent, data: currentData });
        }
        currentEvent = undefined;
        currentData = undefined;
      }
      continue;
    }

    if (trimmed.startsWith('event: ')) {
      currentEvent = trimmed.substring(7).trim();
    } else if (trimmed.startsWith('data: ')) {
      currentData = trimmed.substring(6).trim();
    }
  }

  // Handle any remaining data
  if (currentData !== undefined) {
    try {
      if (currentData === '[DONE]') {
        results.push({ event: currentEvent, data: '[DONE]' });
      } else {
        const parsed = JSON.parse(currentData);
        results.push({ event: currentEvent, data: parsed });
      }
    } catch (e) {
      results.push({ event: currentEvent, data: currentData });
    }
  }

  return results;
}

/**
 * Extracts messages from parsed event stream data
 */
export interface ChatGPTMessage {
  role: 'user' | 'assistant' | 'system';
  id: string;
  conversation_id: string;
  content: string;
  message_type: 'text';
  created_at: number;
}

export function extractMessagesFromEventStream(
  events: Array<{ event?: string; data: any }>,
  requestPrompt?: string
): {
  messages: ChatGPTMessage[];
  conversationId?: string;
  title?: string;
} {
  let conversationId: string | undefined;
  let title: string | undefined;
  let assistantContent = '';
  let assistantMessageId: string | undefined;
  let userMessageId: string | undefined;
  let userContent = requestPrompt || '';
  let assistantCreatedAt: number | undefined;

  for (const { event, data } of events) {
    if (data === '[DONE]') {
      continue;
    }

    // Extract conversation_id from resume_conversation_token or other data
    if (data?.type === 'resume_conversation_token' && data?.conversation_id) {
      conversationId = data.conversation_id;
    }

    // Extract conversation_id from message events
    if (data?.conversation_id) {
      conversationId = data.conversation_id;
    }

    // Extract title from title_generation event
    if (data?.type === 'title_generation' && data?.title) {
      title = data.title;
    }

    // Extract user message
    if (data?.type === 'input_message' && data?.input_message) {
      const msg = data.input_message;
      if (msg.author?.role === 'user') {
        userMessageId = msg.id;
        if (msg.content?.content_type === 'text' && Array.isArray(msg.content.parts)) {
          userContent = msg.content.parts.join('');
        }
      }
    }

    // Extract assistant message from delta events
    if (event === 'delta' && data?.v?.message) {
      const msg = data.v.message;
      if (msg.author?.role === 'assistant' && msg.content?.content_type === 'text') {
        assistantMessageId = msg.id;
        assistantCreatedAt = msg.create_time;
        if (Array.isArray(msg.content.parts) && msg.content.parts.length > 0) {
          assistantContent = msg.content.parts.join('');
        }
      }
    }

    // Handle delta append operations for streaming content
    if (event === 'delta' && data?.v && typeof data.v === 'string') {
      assistantContent += data.v;
    }

    // Handle delta with path for appending content
    if (event === 'delta' && data?.p === '/message/content/parts/0' && data?.o === 'append' && data?.v) {
      assistantContent += data.v;
    }
  }

  const messages: ChatGPTMessage[] = [];
  const timestamp = Math.floor(Date.now() / 1000);

  // Add user message if available
  if (userContent && conversationId) {
    messages.push({
      role: 'user',
      id: userMessageId || crypto.randomUUID(),
      conversation_id: conversationId,
      content: userContent,
      message_type: 'text',
      created_at: timestamp,
    });
  }

  // Add assistant message if available
  if (assistantContent && conversationId) {
    messages.push({
      role: 'assistant',
      id: assistantMessageId || crypto.randomUUID(),
      conversation_id: conversationId,
      content: assistantContent,
      message_type: 'text',
      created_at: assistantCreatedAt || timestamp,
    });
  }

  return { messages, conversationId, title };
}
