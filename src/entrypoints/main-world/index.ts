import { proxy } from 'ajax-hook';
import throttle from 'lodash/throttle';
import { handleChatResponse } from './interceptors/chat';
import { handleLibraryResponse } from './interceptors/library';
import { handleUpdatePromptResponse } from './interceptors/update';
import { handleCreatePromptResponse } from './interceptors/create';
import { handleDeletePromptResponse } from './interceptors/delete';
import i18n from '@/locale/i18n';

const showUpdateToast = throttle(
  () => {
    const message = i18n.t('toast.interfaceUpdated');
    console.warn('Better Sidebar for Google AI Studio:', message);

    const toast = document.createElement('div');
    toast.innerText = message;
    Object.assign(toast.style, {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#d93025',
      color: '#ffffff',
      padding: '12px 24px',
      borderRadius: '4px',
      zIndex: '10000',
      fontFamily: 'Google Sans, Roboto, sans-serif',
      fontSize: '14px',
      boxShadow:
        '0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)',
      transition: 'opacity 0.3s',
      opacity: '0',
      pointerEvents: 'none',
    });

    document.body.appendChild(toast);

    // Trigger reflow to enable transition
    void toast.offsetWidth;
    toast.style.opacity = '1';

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  },
  10000,
  { trailing: false }
);

export default defineUnlistedScript(async () => {
  console.log(
    'Better Sidebar for Google AI Studio: Main World Script Initialized'
  );

  proxy({
    onRequest: (config, handler) => {
      handler.next(config);
    },
    onError: (err, handler) => {
      console.error('Better Sidebar for Google AI Studio: Request Error', err);
      handler.next(err);
    },
    onResponse: (response, handler) => {
      const url = response.config.url;

      // Dispatch to handlers - they will check URL internally or we check here
      // Checking here is cleaner for the proxy callback

      try {
        if (
          url.includes('ResolveDriveResource')
        ) {
          handleChatResponse(response, url);
        } else if (url.endsWith('ListPrompts')) {
          handleLibraryResponse(response);
        } else if (url.includes('UpdatePrompt')) {
          handleUpdatePromptResponse(response, url);
        } else if (url.includes('CreatePrompt')) {
          handleCreatePromptResponse(response, url);
        } else if (url.includes('DeletePrompt')) {
          handleDeletePromptResponse(response, url);
        }
      } catch (e) {
        console.error(
          'Better Sidebar for Google AI Studio: Error in interception handler',
          e
        );
        if (response?.status === 200) {
          showUpdateToast();
        }
      }

      handler.next(response);
    },
  });
});
