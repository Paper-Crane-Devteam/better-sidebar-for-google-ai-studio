export interface ConversationNode {
  id: string;
  conversationId: string;
  content: string;
  role: 'user' | 'model';
  timestamp?: number;
  orderIndex?: number;
  isActive?: boolean;
  inDom: boolean;
  /** Markdown headings extracted from model responses (### level) */
  headings?: string[];
}

/**
 * Extract top-level markdown headings (###) from model response content.
 * Only extracts ### (h3) as these represent major sections in typical AI responses.
 */
export function extractHeadings(content: string): string[] {
  if (!content) return [];
  const headings: string[] = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const match = /^###\s+(.+)/.exec(line.trim());
    if (match) {
      headings.push(match[1].trim());
    }
  }
  return headings;
}
