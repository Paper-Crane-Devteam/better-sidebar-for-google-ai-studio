export class ApiScanner {
    private items: any[] = [];
    private listener: (event: Event) => void;
    private isListening: boolean = false;

    constructor() {
        this.listener = (event: Event) => {
            const customEvent = event as CustomEvent;
            if (customEvent.detail && customEvent.detail.items) {
                console.log('ApiScanner: Received items batch', customEvent.detail.items.length);
                // Merge items, preferring newer ones if duplicates (though list prompt usually gives unique pages)
                this.items.push(...customEvent.detail.items);
            }
        };
    }

    start() {
        if (this.isListening) return;
        console.log('ApiScanner: Started listening for AI_STUDIO_LIBRARY_DATA');
        window.addEventListener('AI_STUDIO_LIBRARY_DATA', this.listener);
        this.isListening = true;
    }

    stop() {
        console.log('ApiScanner: Stopped listening');
        window.removeEventListener('AI_STUDIO_LIBRARY_DATA', this.listener);
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
