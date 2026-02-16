export class ApiScanner {
  private items: any[] = [];
  private listener: (event: Event) => void;
  private isListening: boolean = false;

  constructor() {
    this.listener = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.items) {
        console.log('ChatGPT ApiScanner: Received items batch', customEvent.detail.items);
        this.items.push(...customEvent.detail.items);
      }
    };
  }

  start() {
    if (this.isListening) return;
    console.log('ChatGPT ApiScanner: Started listening for CHATGPT_LIST_CHAT_RESPONSE');
    window.addEventListener('CHATGPT_LIST_CHAT_RESPONSE', this.listener);
    this.isListening = true;
  }

  stop() {
    console.log('ChatGPT ApiScanner: Stopped listening');
    window.removeEventListener('CHATGPT_LIST_CHAT_RESPONSE', this.listener);
    this.isListening = false;
    return this.items;
  }

  getItems() {
    return this.items;
  }

  clear() {
    this.items = [];
  }
}

export const apiScanner = new ApiScanner();
