import { parsePromptType } from '../lib/response-parser';

export function handleLibraryResponse(response: any) {
  console.log('Better Sidebar: Intercepted ListPrompts');
  if (response.response) {
    let responseBody = response.response;
    if (typeof responseBody !== 'string') {
      responseBody = JSON.stringify(responseBody);
    }

    const json = JSON.parse(responseBody);

    if (Array.isArray(json) && Array.isArray(json[0])) {
      const items = json[0]
        .map((item: any) => {
          const promptPath = item[0];
          const id = promptPath?.split('/')?.pop();
          let createdAtSeconds = null;
          let promptMetadata = null;
          let type = 'conversation';
          let title = null;

          if (item[4] && Array.isArray(item[4])) {
            // Extract title from item[4][0]
            if (item[4][0]) {
              title = item[4][0];
            }

            // Extract metadata from item[4][4]
            if (Array.isArray(item[4][4])) {
              const metaArray = item[4][4];
              const secondsStr = metaArray[0];
              if (secondsStr) {
                createdAtSeconds = parseInt(secondsStr, 10);
              }
              if (metaArray.length > 1) {
                promptMetadata = metaArray[1];
              }
            }

            type = parsePromptType(item[4]?.[11]);
          }

          return {
            id,
            title,
            created_at: createdAtSeconds,
            prompt_metadata: promptMetadata,
            type,
          };
        })
        .filter((i: any) => i && i.id);

      if (items.length > 0) {
        console.log(`Better Sidebar: Parsed ${items.length} prompts from API`);
        globalThis.dispatchEvent(
          new CustomEvent('AI_STUDIO_LIBRARY_DATA', {
            detail: { items },
          })
        );
      }
    }
  }
}
