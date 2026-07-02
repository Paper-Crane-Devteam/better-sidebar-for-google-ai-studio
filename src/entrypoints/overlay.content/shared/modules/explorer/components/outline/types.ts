/**
 * Outline section types for the Explorer bottom panel.
 */

export type OutlineItemType = 'user-message' | 'heading' | 'code-block';

export interface OutlineNode {
  id: string;
  messageId: string;
  parentId: string | null;
  type: OutlineItemType;
  label: string;
  /** e.g. language for code blocks, h2/h3/h4 for headings */
  meta?: string;
  depth: number;
  navigable: boolean;
  order: number;
  children: OutlineNode[];
}

export interface OutlineSection {
  id: string;
  userQuery: string;
  userMessageId: string;
  userInDom: boolean;
  modelMessageId?: string;
  modelInDom: boolean;
  children: OutlineNode[];
  turnIndex: number;
  timestamp?: number;
}

export type OutlineFilter = 'all' | 'headings' | 'code';
