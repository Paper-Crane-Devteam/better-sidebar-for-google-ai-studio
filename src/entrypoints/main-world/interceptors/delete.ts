export function handleDeletePromptResponse(response: any, url: string) {
    if (response.status === 200) {
        console.log('Better Sidebar for Google AI Studio: Intercepted DeletePrompt');
        
        let requestBody = response.config.body;
        if (typeof requestBody !== 'string') {
          requestBody = JSON.stringify(requestBody);
        }

        const json = JSON.parse(requestBody);
        // User provided example: [ "prompts/1yF5YATn0OqUeGTox2u_bNU9WUMIo0dSc" ]

        if (Array.isArray(json) && json.length > 0) {
          const promptPath = json[0];
          if (
            typeof promptPath === 'string' &&
            promptPath.startsWith('prompts/')
          ) {
            const id = promptPath.split('/').pop();

            if (id) {
              console.log(
                `Better Sidebar for Google AI Studio: Detected prompt deletion: ${id}`
              );
              globalThis.dispatchEvent(
                new CustomEvent('AI_STUDIO_PROMPT_DELETE', {
                  detail: {
                    id,
                    originalUrl: url,
                  },
                })
              );
            }
          }
        }
    }
}
