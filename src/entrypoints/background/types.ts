import type Browser from 'webextension-polyfill';

/** Message sender from runtime.onMessage callback (webextension-polyfill does not export Runtime from wxt/browser). */
export type MessageSender = Browser.Runtime.MessageSender;
