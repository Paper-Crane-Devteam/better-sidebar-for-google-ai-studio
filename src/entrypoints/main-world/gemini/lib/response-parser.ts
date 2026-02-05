/**
 * Parses the streaming response format from Google Gemini.
 * Heuristic: Split by lines that consist solely of a number (the length).
 */
export function parseStreamingResponse(responseBody: string): any[] {
  const chunks: any[] = [];
  
  let raw = responseBody;
  // Remove XSSI prefix if present
  if (raw.startsWith(")]}'")) {
    raw = raw.substring(4);
  }
  
  // Split by newlines
  // In the stream, we see patterns like:
  // <JSON>
  // <NUMBER>
  // <JSON>
  // So we assume any line that matches ^\d+$ is a delimiter.
  
  const lines = raw.split('\n');
  let currentJsonStr = '';
  
  for (const line of lines) {
      const trimmed = line.trim();
      
      // Check if this line is a length delimiter
      // It must be a non-empty string of digits
      if (/^\d+$/.test(trimmed)) {
          // If we have accumulated a JSON string, try to parse it
          if (currentJsonStr.trim()) {
              try {
                  // Sometimes the accumulated string might be wrapped in [] or similar,
                  // or just be the JSON array.
                  chunks.push(JSON.parse(currentJsonStr));
              } catch (e) {
                  // If parse fails, maybe it wasn't a complete JSON yet?
                  // But based on the structure, chunks are separated by lengths.
                  // Only common issue is if a number appears inside a JSON string on its own line.
                  // But standard JSON usually doesn't format that way unless pretty-printed.
                  // Gemini response seems to be compact JSON.
                  // console.warn('Gemini Parser: Failed to parse intermediate chunk', e);
              }
              currentJsonStr = '';
          }
      } else {
          // It's part of the JSON content
          currentJsonStr += line + '\n';
      }
  }
  
  // Parse any remaining content
  if (currentJsonStr.trim()) {
      try {
          chunks.push(JSON.parse(currentJsonStr));
      } catch (e) {
          // console.warn('Gemini Parser: Failed to parse final chunk', e);
      }
  }

  return chunks;
}

/**
 * Extracts and parses payloads from 'wrb.fr' chunks.
 * These chunks typically contain a JSON string in index 2.
 */
export function extractWrbFrPayloads(chunks: any[]): any[] {
  const payloads: any[] = [];
  
  chunks.forEach(chunk => {
    // Usually chunk is like ["wrb.fr", "someId", "jsonString"]
    if (Array.isArray(chunk) && chunk[0] === 'wrb.fr') {
       if (chunk.length > 2 && typeof chunk[2] === 'string') {
         try {
           payloads.push(JSON.parse(chunk[2]));
         } catch (e) {
           // ignore
         }
       }
    }
  });
  
  return payloads;
}
