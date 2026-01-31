import { handleChatResponse } from './chat';

function extractRequestData(body: any): {
  id: string | null;
  title: string | null;
} {
  let id: string | null = null;
  let title: string | null = null;

  let reqJson = body;
  if (typeof reqJson === 'string') {
    reqJson = JSON.parse(reqJson);
  }

  // Structure: [["prompts/ID", null, null, ..., ["Title", "123"]]]
  if (reqJson && Array.isArray(reqJson) && Array.isArray(reqJson[0])) {
    const item = reqJson[0];
    const promptPath = item[0]; // "prompts/..."
    const titleData = item[4]; // ["Title", "123"]

    if (typeof promptPath === 'string') {
      id = promptPath.split('/').pop() || null;
    }

    if (Array.isArray(titleData) && titleData.length > 0) {
      title = titleData[0];
    }
  }

  return { id, title };
}

function extractResponseData(body: any): { updated_at: number | null } {
  let updated_at: number | null = null;

  let responseBody = body;
  if (typeof responseBody === 'string') {
    responseBody = JSON.parse(responseBody);
  }

  // User provided path: [4][4][0][0] - Value is seconds
  if (responseBody && Array.isArray(responseBody)) {
    const timestamp = responseBody?.[4]?.[4]?.[0]?.[0];
    if (timestamp !== undefined && timestamp !== null) {
      updated_at = Number(timestamp);
    }
  }

  return { updated_at };
}

export function handleUpdatePromptResponse(response: any, url: string) {
  if (response.status === 200) {
    console.log(
      'Better Sidebar for Google AI Studio: Intercepted UpdatePrompt'
    );

    // 1. Dispatch legacy/specific event
    // 1. Extract ID and Title from REQUEST
    const { id, title } = extractRequestData(response.config.body);

    // 2. Extract updated_at from RESPONSE
    const { updated_at } = extractResponseData(response.response);

    if (updated_at) {
      console.log('Extracted updated_at from response:', updated_at);
    }

    // 3. Dispatch Update Event
    if (id && (title || updated_at)) {
      console.log(
        `Better Sidebar for Google AI Studio: Detected update for ${id}. Title: ${title}, UpdatedAt: ${updated_at}`
      );

      const detail: any = {
        id,
        originalUrl: url,
      };

      if (title) detail.title = title;
      if (updated_at) detail.updated_at = updated_at;

      globalThis.dispatchEvent(
        new CustomEvent('AI_STUDIO_PROMPT_UPDATE', {
          detail,
        })
      );
    }

    // 4. Dispatch generic response event for Data Persistence (saving messages)
    // UpdatePrompt response also contains the full conversation history
    handleChatResponse(response, url);
  }
}
