export class ApiScanner {
    private items: any[] = [];
    private listener: (event: Event) => void;
    private isListening: boolean = false;
    private onNewItems: (() => void) | null = null;

    constructor() {
        this.listener = (event: Event) => {
            const customEvent = event as CustomEvent;
            if (customEvent.detail && customEvent.detail.items) {
                this.items.push(...customEvent.detail.items);
                // Notify listener that new items arrived (used for late-arriving responses)
                if (this.onNewItems) {
                    this.onNewItems();
                }
            }
        };
    }

    start() {
        if (this.isListening) return;
        window.addEventListener('GEMINI_LIST_CHAT_RESPONSE', this.listener);
        this.isListening = true;
    }

    stop() {
        window.removeEventListener('GEMINI_LIST_CHAT_RESPONSE', this.listener);
        this.isListening = false;
        this.onNewItems = null;
        return this.items;
    }

    getItems() {
        return this.items;
    }

    clear() {
        this.items = [];
    }

    /**
     * Register a callback that fires whenever new items arrive.
     * Used by sync-conversations to flush late-arriving responses.
     */
    setOnNewItems(cb: (() => void) | null) {
        this.onNewItems = cb;
    }

    /**
     * Temporarily stop notifying the listener, returning a restore function.
     *
     * A full library scan needs this: otherwise the incremental sync flush
     * saves every batch as it arrives, and by the time the scan diffs its
     * results against the DB nothing looks new — so the "imported N" toast
     * always reported 0.
     */
    pauseNotifications(): () => void {
        const previous = this.onNewItems;
        this.onNewItems = null;
        return () => {
            this.onNewItems = previous;
        };
    }
}

export const apiScanner = new ApiScanner();
