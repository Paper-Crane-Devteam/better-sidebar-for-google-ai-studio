/**
 * Outline section types for the Explorer bottom panel.
 */

export type OutlineItemType =
  | 'user-message'
  | 'heading'
  | 'code-block'
  | 'image'
  | 'table'
  | 'link'
  | 'math';

export interface OutlineNode {
  id: string;
  messageId: string;
  parentId: string | null;
  type: OutlineItemType;
  label: string;
  /** e.g. language for code blocks, h2/h3/h4 for headings */
  meta?: string;
  /** Raw content for copy operations (e.g. full code block text) */
  rawContent?: string;
  depth: number;
  navigable: boolean;
  order: number;
  children: OutlineNode[];
  /** Start character offset in the original model content (inclusive) */
  sourceStart?: number;
  /** End character offset in the original model content (exclusive) */
  sourceEnd?: number;
}

export interface OutlineSection {
  id: string;
  userQuery: string;
  /** Full user query text (not truncated) for copy */
  userQueryFull: string;
  userMessageId: string;
  userInDom: boolean;
  modelMessageId?: string;
  /** Full model response content for copy */
  modelContent?: string;
  modelInDom: boolean;
  children: OutlineNode[];
  turnIndex: number;
  timestamp?: number;
}

export type OutlineFilter = 'all' | 'headings' | 'code' | 'images' | 'tables' | 'links' | 'math';
