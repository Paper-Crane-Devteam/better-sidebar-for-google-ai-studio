/**
 * Robust fetch interceptor utility
 * Best practices:
 * 1. Preserves original fetch behavior and context
 * 2. Type-safe with proper TypeScript types
 * 3. Handles errors gracefully
 * 4. Supports multiple interceptors
 * 5. Non-blocking - errors in interceptors don't break the app
 */

export interface FetchInterceptorConfig {
  /**
   * Called before fetch is executed
   * Can modify request or skip interception by returning false
   */
  onRequest?: (url: string, init?: RequestInit) => boolean | void;
  
  /**
   * Called after fetch completes successfully
   * Receives cloned response to avoid consuming the stream
   */
  onResponse?: (url: string, response: Response, clonedResponse: Response, init?: RequestInit) => void | Promise<void>;
  
  /**
   * Called when fetch fails
   */
  onError?: (url: string, error: any, init?: RequestInit) => void;
  
  /**
   * URL filter - only intercept URLs matching this pattern
   */
  urlPattern?: string | RegExp | ((url: string) => boolean);
}

/**
 * Install fetch interceptor
 * Returns cleanup function to restore original fetch
 */
export function interceptFetch(config: FetchInterceptorConfig): () => void {
  // Store original fetch
  const originalFetch = window.fetch;
  
  // Type-safe wrapper
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // Extract URL from various input types
    const url = typeof input === 'string' 
      ? input 
      : input instanceof URL 
        ? input.href 
        : input instanceof Request
          ? input.url
          : String(input);
    
    // Check URL pattern
    let shouldIntercept = true;
    if (config.urlPattern) {
      if (typeof config.urlPattern === 'string') {
        shouldIntercept = url.includes(config.urlPattern);
      } else if (config.urlPattern instanceof RegExp) {
        shouldIntercept = config.urlPattern.test(url);
      } else if (typeof config.urlPattern === 'function') {
        shouldIntercept = config.urlPattern(url);
      }
    }
    
    // Call onRequest hook
    if (shouldIntercept && config.onRequest) {
      try {
        const result = config.onRequest(url, init);
        if (result === false) {
          shouldIntercept = false;
        }
      } catch (error) {
        console.error('[FetchInterceptor] Error in onRequest:', error);
      }
    }
    
    try {
      // Call original fetch with proper context
      const response = await originalFetch.apply(this, arguments as any);
      
      // Call onResponse hook without awaiting - preserve streaming for the caller.
      // The caller gets the original response (and its body stream) immediately.
      // onResponse runs in background with a clone; reading the clone does not block the returned stream.
      if (shouldIntercept && config.onResponse) {
        const clonedResponse = response.clone();
        Promise.resolve(config.onResponse(url, response, clonedResponse, init)).catch((error) => {
          // AbortError is expected when the caller closes the stream (e.g. navigation or cancel);
          // our clone then fails when reading the rest - do not log as error.
          if (error?.name === 'AbortError') return;
          console.error('[FetchInterceptor] Error in onResponse:', error);
        });
      }

      return response;
    } catch (error) {
      // Call onError hook
      if (shouldIntercept && config.onError) {
        try {
          config.onError(url, error, init);
        } catch (handlerError) {
          console.error('[FetchInterceptor] Error in onError:', handlerError);
        }
      }
      throw error;
    }
  };
  
  // Return cleanup function
  return () => {
    window.fetch = originalFetch;
  };
}

/**
 * Helper to read response body based on content type
 */
export async function readResponseBody(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type');
  
  if (contentType?.includes('application/json')) {
    return await response.json();
  } else if (contentType?.includes('text/event-stream') || contentType?.includes('text/plain')) {
    return await response.text();
  } else if (contentType?.includes('application/octet-stream')) {
    return await response.blob();
  } else {
    // Default to text
    return await response.text();
  }
}
