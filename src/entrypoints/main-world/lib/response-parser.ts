/**
 * Extracts the prompt type from the metadata properties array.
 * Looks for ["promptType", "IMAGEN_PROMPT"]
 * 
 * @param properties The array containing metadata properties (usually at index 11 of the metadata array)
 * @returns 'text-to-image' | 'conversation'
 */
export function parsePromptType(properties: any): 'text-to-image' | 'conversation' {
    try {
        if (Array.isArray(properties)) {
            const promptTypeEntry = properties.find((prop: any) => Array.isArray(prop) && prop[0] === 'promptType');
            if (promptTypeEntry && promptTypeEntry[1] === 'IMAGEN_PROMPT') {
                return 'text-to-image';
            }
        }
    } catch (e) {
        // ignore error
    }
    return 'conversation';
}

// --- Robust Parsing Logic (Ported from Tampermonkey Script) ---

function isTurn(arr: any[]): boolean {
    if (!Array.isArray(arr)) return false;
    return arr.includes('user') || arr.includes('model');
}

function findHistoryRecursive(node: any, depth = 0): any[] | null {
    if (depth > 4) return null;
    if (!Array.isArray(node)) return null;

    const firstFew = node.slice(0, 5);
    const childrenAreTurns = firstFew.some(child => Array.isArray(child) && isTurn(child));

    if (childrenAreTurns) {
        return node;
    }

    for (const child of node) {
        if (Array.isArray(child)) {
            const result = findHistoryRecursive(child, depth + 1);
            if (result) return result;
        }
    }
    return null;
}

function extractTextFromTurn(turn: any[]): string {
    let candidates: string[] = [];

    function scan(item: any, d = 0) {
        if (d > 3) return;
        if (typeof item === 'string' && item.length > 1) {
            if (!['user', 'model', 'function'].includes(item)) {
                candidates.push(item);
            }
        } else if (Array.isArray(item)) {
            item.forEach(sub => scan(sub, d + 1));
        }
    }

    scan(turn.slice(0, 3));
    return candidates.sort((a, b) => b.length - a.length)[0] || "";
}

function isThinkingTurn(turn: any[]): boolean {
    // Position 19 = 1 indicates a thinking/reasoning block
    return Array.isArray(turn) && turn.length > 19 && turn[19] === 1;
}

function isResponseTurn(turn: any[]): boolean {
    // Position 16 = 1 indicates a regular response
    return Array.isArray(turn) && turn.length > 16 && turn[16] === 1;
}

export interface ParsedMessage {
    role: 'user' | 'model';
    content: string;
    message_type: 'text' | 'thought';
}

export interface ParsedConversation {
    id: string;
    title: string;
    model_name: string;
    messages: ParsedMessage[];
    updated_at: number;
    created_at?: number;
    prompt_metadata?: any;
}

export function parseConversation(json: any): ParsedConversation | null {
    try {
        // Normalize structure: ResolveDriveResource returns [[...]], others return [...]
        // The script wraps to [[...]] format so capturedChatData[0] always gives the prompt data
        // We will assume 'json' is the response body. 
        // If it's the raw array from ResolveDriveResource, it might be [[...]].
        // If it's Create/Update, it might be [...].
        
        // We need to find the "root" which contains the prompt data.
        let root = json;
        if (Array.isArray(json) && json.length > 0 && Array.isArray(json[0]) && typeof json[0][0] === 'string' && json[0][0].startsWith('prompts/')) {
            // It's likely [[...]] like ResolveDriveResource
            root = json[0];
        } else if (Array.isArray(json) && typeof json[0] === 'string' && json[0].startsWith('prompts/')) {
            // It's likely [...] like CreatePrompt
            root = json;
        } else {
             // Fallback or invalid
             // check if it's the nested structure from some responses
             if (Array.isArray(json) && json.length === 1 && Array.isArray(json[0])) {
                 // Try peeling one layer
                 if (typeof json[0][0] === 'string' && json[0][0].startsWith('prompts/')) {
                     root = json[0];
                 }
             }
        }

        if (!Array.isArray(root)) return null;
        if (typeof root[0] !== 'string' || !root[0].startsWith('prompts/')) return null;

        // 1. Extract ID
        const id = root[0].split('/').pop() || '';
        
        // 2. Extract Metadata (Title, Model, etc.)
        let title = '';
        let model_name = '';
        let prompt_metadata = null;
        let created_at: number | undefined;

        const metadata = root[4]; // Title info usually here
        if (Array.isArray(metadata)) {
            if (metadata.length > 0 && typeof metadata[0] === 'string') {
                title = metadata[0];
            }
             // createdAt seems to be at metadata[4][0][0] (seconds) or similar
            if (metadata?.[4]?.[0]?.[0]) {
                created_at = Number(metadata[4][0][0]);
            }
        }
        
        // Model name is often in root[3][2]
        const modelMeta = root[3];
        if (Array.isArray(modelMeta) && modelMeta.length > 2 && typeof modelMeta[2] === 'string') {
            model_name = modelMeta[2];
        }

        // 3. Extract History
        const historyArray = findHistoryRecursive(root);
        const messages: ParsedMessage[] = [];

        if (historyArray) {
            historyArray.forEach(turn => {
                if (!Array.isArray(turn)) return;

                const isUser = turn.includes('user');
                const isModel = turn.includes('model');

                if (isUser) {
                    const text = extractTextFromTurn(turn);
                    if (text) {
                        messages.push({
                            role: 'user',
                            content: text,
                            message_type: 'text'
                        });
                    }
                } else if (isModel) {
                    const thinking = isThinkingTurn(turn);
                    const response = isResponseTurn(turn);
                    const text = extractTextFromTurn(turn);

                    if (text) {
                        let msgType: 'text' | 'thought' = 'text';
                        if (thinking && !response) {
                            msgType = 'thought';
                        }
                        
                        messages.push({
                            role: 'model',
                            content: text,
                            message_type: msgType
                        });
                    }
                }
            });
        }

        return {
            id,
            title,
            model_name,
            messages,
            updated_at: Math.floor(Date.now() / 1000), // Default to now if not found, or use created_at if appropriate
            created_at,
            prompt_metadata
        };

    } catch (e) {
        console.error('Error parsing conversation:', e);
        return null;
    }
}
