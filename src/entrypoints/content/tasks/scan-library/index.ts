import { scanLibraryDom } from './scan-dom';
import { apiScanner } from './scan-api';

export async function scanLibrary() {
    console.log('Starting full library scan (DOM + API)...');
    
    // Ensure scanner is listening (idempotent check inside start)
    apiScanner.start();

    // Run DOM scan
    // This will trigger scrolls, which triggers ListPrompts requests, which ApiScanner picks up
    const domItems = await scanLibraryDom();

    // Give a small buffer for any pending requests to finish after DOM scan says "done"
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get API items
    const apiItems = apiScanner.getItems();
    
    console.log(`Merge: DOM Items: ${domItems.length}, API Items: ${apiItems.length}`);
    console.log('API Items:', apiItems);
    console.log('DOM Items:', domItems);

    // Create a map of API items by ID for fast lookup
    const apiMap = new Map();
    for (const item of apiItems) {
        if (item && item.id) {
            apiMap.set(item.id, item);
        }
    }
    
    // Merge data
    const mergedItems = domItems.map(item => {
        const apiItem = apiMap.get(item.id);
        if (apiItem) {
            return {
                ...item,
                created_at: apiItem.created_at,
                updated_at: apiItem.created_at, // User requested updated_at same as created_at initially
                prompt_metadata: apiItem.prompt_metadata,
                type: apiItem.type
            };
        }
        return item;
    });

    // Send to background
     if (mergedItems.length > 0) {
        console.log(`Sending ${mergedItems.length} merged items to background...`);
        try {
            const response = await browser.runtime.sendMessage({
                type: 'SAVE_SCANNED_ITEMS',
                payload: { items: mergedItems }
            });
            console.log('Sent scanned items to background. Response:', response);
        } catch (err) {
            console.error('Failed to send scanned items:', err);
        }
     } else {
         console.warn('No items found to send.');
     }

     return mergedItems.length;
}
