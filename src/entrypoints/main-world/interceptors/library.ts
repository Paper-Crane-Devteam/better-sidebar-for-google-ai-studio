import { parsePromptType } from '../lib/response-parser';

export function handleLibraryResponse(response: any) {
    console.log('Better Sidebar for Google AI Studio: Intercepted ListPrompts');
    if (response.response) {
      let responseBody = response.response;
      // Ensure string
      if (typeof responseBody !== 'string') {
        responseBody = JSON.stringify(responseBody);
      }

      const json = JSON.parse(responseBody);
      // Based on user description:
      // root[0] is the list of items
      // item[0] is "prompts/ID"
      // item[4] contains metadata
      // item[4][4] is ["seconds", nanos]

      if (Array.isArray(json) && Array.isArray(json[0])) {
        const items = json[0]
          .map((item: any) => {
            const promptPath = item[0]; // "prompts/..."
            const id = promptPath?.split('/')?.pop();
            // Timestamp & Metadata
            let createdAtSeconds = null;
            let promptMetadata = null;
            let type = 'conversation';

            if (
              item[4] &&
              Array.isArray(item[4]) &&
              Array.isArray(item[4][4])
            ) {
              const metaArray = item[4][4];
              const secondsStr = metaArray[0];
              if (secondsStr) {
                createdAtSeconds = parseInt(secondsStr, 10);
              }
              if (metaArray.length > 1) {
                promptMetadata = metaArray[1];
              }

              type = parsePromptType(item[4]?.[11]);
            }

            return {
              id,
              created_at: createdAtSeconds,
              prompt_metadata: promptMetadata,
              type,
            };
          })
          .filter((i: any) => i && i.id);

        if (items.length > 0) {
          console.log(
            `Better Sidebar for Google AI Studio: Parsed ${items.length} prompts from API`
          );
          globalThis.dispatchEvent(
            new CustomEvent('AI_STUDIO_LIBRARY_DATA', {
              detail: { items },
            })
          );
        }
      }
    }
}
