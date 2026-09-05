/**
 * Documents MCP Server — "Documents".
 *
 * A third builtin server rather than more tools inside the workspace one, for the same
 * reason the workspace was split out of the core: it can be turned off. Someone using the
 * agent to organise chats has no use for Office parsing, and a schema in the prompt costs
 * tokens on every single round whether it is used or not.
 *
 * It is also a genuinely different capability from the file tools. The workspace server
 * reads and writes *text*; this one understands containers — a `.docx` is a zip full of
 * XML, and `read_file` on one returns nothing usable. Keeping them separate is what lets
 * the prompt say that clearly.
 */

import type { MCPServer } from './types';
import { DOCUMENT_TOOLS } from './providers/document-provider';

export const DOCUMENT_MCP_ID = 'builtin-documents';

export const DOCUMENT_MCP: MCPServer = {
  id: DOCUMENT_MCP_ID,
  type: 'builtin',
  name: 'Documents',
  description:
    'Read Word documents in the workspace: outline, headings, paragraph ranges and ' +
    'search. Editing with tracked changes and comments, plus Excel, PowerPoint, PDF and ' +
    'subtitles, are being added on top of the same engine.',
  enabled: true,
  tools: DOCUMENT_TOOLS,
};
