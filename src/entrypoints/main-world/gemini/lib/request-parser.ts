/**
 * Parses the generic batch execute request payload.
 * Extracts the `f.req` parameter or generic JSON body.
 */
export function parseBatchExecuteRequest(requestBody: string): any | null {
  try {
    let jsonString: string | null = null;
    let jsonBody: any;

    // Handle string (URLSearchParams or raw JSON)
    if (typeof requestBody === 'string') {
         // Try parsing as URLSearchParams first if it looks like one
         if (requestBody.includes('f.req=')) {
             try {
                const params = new URLSearchParams(requestBody);
                const freq = params.get('f.req');
                if (freq) {
                    jsonString = freq;
                }
             } catch (e) {
                 // ignore
             }
         }
         
         if (!jsonString) {
             // Fallback regex for f.req
             const match = requestBody.match(/f\.req=([^&]*)/);
             if (match && match[1]) {
                 try {
                     jsonString = decodeURIComponent(match[1]);
                 } catch (e) {
                     // ignore
                 }
             }
         }
         
         if (!jsonString) {
             // Maybe it's raw JSON?
             jsonString = requestBody;
         }
    }

    // If we have a string, try to parse it as JSON
    if (jsonString) {
        try {
            jsonBody = JSON.parse(jsonString);
        } catch (e) {
            // If simple parse fails, try to extract the JSON array part
            const start = jsonString.indexOf('[');
            const end = jsonString.lastIndexOf(']');
            
            if (start !== -1 && end !== -1 && end > start) {
                const extracted = jsonString.substring(start, end + 1);
                try {
                    jsonBody = JSON.parse(extracted);
                } catch (e2) {
                    return null;
                }
            } else {
                return null;
            }
        }
    } else {
        return null;
    }

    return jsonBody;
  } catch (e) {
    console.error('Better Sidebar (Gemini): Error parsing request body', e);
    return null;
  }
}
