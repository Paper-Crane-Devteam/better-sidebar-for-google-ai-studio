import { proxy } from 'ajax-hook';
import { handleGenerateResponse } from './interceptors/generate';
import { handleChatContentResponse } from './interceptors/chat-content';
import { handleListChatResponse } from './interceptors/list-chat';

export function initGeminiInterceptors() {
  console.log('Better Sidebar: Main World Script (Gemini) Initialized');

  proxy({
    onRequest: (config, handler) => {
      handler.next(config);
    },
    onError: (err, handler) => {
      console.error('Better Sidebar: Request Error', err);
      handler.next(err);
    },
    onResponse: (response, handler) => {
      const url = response.config.url;

      try {
        if (url.includes('StreamGenerate')) {
          handleGenerateResponse(response, url);
        } else if (url.includes('batchexecute')) {
            // Check specific rpcids for chat content and list chat
            // chat content rpcid: hNvQHb
            // list chat rpcid: MaZiqc
            if (url.includes('rpcids=hNvQHb')) {
                handleChatContentResponse(response, url);
            } else if (url.includes('rpcids=MaZiqc')) {
                handleListChatResponse(response, url);
            }
        }
      } catch (e) {
        console.error('Better Sidebar: Error in Gemini interception handler', e);
      }

      handler.next(response);
    },
  });
}
