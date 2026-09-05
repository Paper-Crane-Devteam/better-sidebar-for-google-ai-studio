/**
 * The docx handler.
 *
 * Read-only for now: outline, paragraph ranges and search. Editing (tracked changes and
 * comments) is the next slice and plugs in as `edit` on this same object — the engine,
 * the backup path and the verifier are already in place for it.
 *
 * `verify` is the reason the write path can be trusted, so it is written to be paranoid
 * rather than fast: it runs twice per save, on a file we are about to hand back to the
 * user as their thesis.
 */

import { registerHandler, type FormatHandler } from '../registry';
import { DocumentError } from '../types';
import { openArchive } from '../zip';
import { tokenize, element } from '../ooxml/xml-cursor';
import { docxOutline } from './outline';
import { docxRead } from './project';
import { openDocx } from './model';

/**
 * Structural check on bytes we produced.
 *
 * Four things, in the order that a broken edit is most likely to break them:
 *
 * 1. The archive still opens and still has `[Content_Types].xml`. ⚠️ A missing or
 *    incomplete content-types part is the single most common way a hand-edited docx
 *    turns into "Word found unreadable content" — and it is what happens when a new part
 *    (like `comments.xml`) is added without declaring it.
 * 2. The main part is still reachable through the relationships.
 * 3. The main part still tokenises, and every element in it still closes. `tokenize`
 *    itself catches an unterminated tag; `element('w:body')` walking to a close proves
 *    the tree is balanced through the body.
 * 4. The body still has content. An edit that emptied the document would otherwise pass
 *    every structural test.
 */
function verifyDocx(bytes: Uint8Array): void {
  const archive = openArchive(bytes);

  if (!archive.has('[Content_Types].xml')) {
    throw new DocumentError('[Content_Types].xml is missing');
  }

  const contentTypes = tokenize(archive.text('[Content_Types].xml'));
  if (!element(contentTypes, 'Types')) {
    throw new DocumentError('[Content_Types].xml has no <Types> root');
  }

  // Re-runs relationship lookup, tokenising and the body check. Deliberately the same
  // code path a read takes: if a read of these bytes would fail, the save must fail too.
  const doc = openDocx(bytes);

  if (doc.blocks.length === 0) {
    throw new DocumentError('the document body came out empty');
  }

  // Every part the content types declare by name must actually be in the archive.
  // A dangling override is how a removed part (calcChain, comments) leaves a file that
  // opens in Word but not in Pages or WPS.
  for (const override of contentTypes.tokens) {
    if (override.kind !== 'self' && override.kind !== 'open') continue;
    if (override.name !== 'Override') continue;
    const tag = contentTypes.source.slice(override.start, override.end);
    const match = /PartName\s*=\s*"([^"]+)"/.exec(tag);
    if (!match) continue;
    const partName = match[1].replace(/^\/+/, '');
    if (!archive.has(partName)) {
      throw new DocumentError(
        `[Content_Types].xml declares "${partName}", which is not in the file`,
      );
    }
  }
}

export const docxHandler: FormatHandler = {
  format: 'docx',
  // `.docm` is the same package with macros. Reading it is identical; the macros live in
  // a part we never touch, and refusing the extension would only make the user rename it.
  extensions: ['docx', 'docm'],
  outline: docxOutline,
  read: docxRead,
  verify: verifyDocx,
};

registerHandler(docxHandler);
