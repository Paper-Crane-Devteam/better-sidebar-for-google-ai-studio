/**
 * Document tool providers.
 *
 * One tool, and that is a decision rather than a starting point. Five formats × "outline /
 * read a part / search" would be fifteen schemas in **every** prompt, for a capability
 * most sessions never use. `manage_files` already set the precedent: fold the variants
 * into a parameter and keep the prompt short.
 *
 * ⚠️ **This description is deliberately terse, and must stay that way.** The assembled
 * system prompt sits at roughly 29k of a ~30k ceiling (`prompts/initial-message.ts`), so
 * every character here is taken from the user's own request. The first draft of this
 * schema was 1249 characters and that alone pushed the message over the limit, which
 * silently dropped the user's task. Guidance that is better placed in a skill — how to
 * work through a document, what to do about tracked changes — belongs there, where it is
 * loaded on demand, not here where it is loaded always.
 */

import type { ToolDefinition } from '../types';
import { readDocumentTool } from '../../tools/document-tools';

export const readDocumentProvider: ToolDefinition = {
  schema: {
    name: 'doc_read',
    description:
      'Read a Word .docx (read_file cannot — it is a zip). Path alone returns the ' +
      'outline; then read a part. Output is capped, so never ask for a whole document.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Workspace path.' },
        mode: { type: 'string', description: 'outline (default) | range | search' },
        range: { type: 'string', description: 'range mode: "p12-p48", "p12" or table "t3".' },
        query: { type: 'string', description: 'search mode: literal text.' },
      },
      required: ['path'],
    },
  },
  execute: readDocumentTool,
};

/** Every document tool, in the order the prompt should present them. */
export const DOCUMENT_TOOLS: ToolDefinition[] = [readDocumentProvider];
