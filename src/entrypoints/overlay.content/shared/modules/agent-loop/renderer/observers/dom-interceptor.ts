/**
 * DOM method patching (appendChild / insertBefore) for zero-latency element interception.
 *
 * Patches Node.prototype methods to catch user-query and model-response
 * insertions synchronously at O(1) cost per DOM operation.
 */

const INTERCEPT_TAGS = new Set(['USER-QUERY', 'MODEL-RESPONSE']);

export type InsertionCallback = (el: HTMLElement) => void;

let patched = false;
let origAppendChild: typeof Node.prototype.appendChild | null = null;
let origInsertBefore: typeof Node.prototype.insertBefore | null = null;
let callback: InsertionCallback | null = null;

function handleInsertedNode(node: Node): void {
  if (!callback) return;
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as HTMLElement;
  if (INTERCEPT_TAGS.has(el.tagName)) {
    callback(el);
    return;
  }

  // Check if inserted subtree contains target elements
  const targets = el.querySelectorAll?.('user-query, model-response');
  if (targets && targets.length > 0) {
    targets.forEach((t) => callback!(t as HTMLElement));
  }
}

/**
 * Patch Node.prototype.appendChild and insertBefore to intercept element insertion.
 */
export function patchDOMMethods(onInserted: InsertionCallback): void {
  if (patched) return;
  patched = true;
  callback = onInserted;

  origAppendChild = Node.prototype.appendChild;
  origInsertBefore = Node.prototype.insertBefore;

  const savedAppendChild = origAppendChild;
  const savedInsertBefore = origInsertBefore;

  Node.prototype.appendChild = function <T extends Node>(child: T): T {
    const result = savedAppendChild.call(this, child) as T;
    handleInsertedNode(child);
    return result;
  };

  Node.prototype.insertBefore = function <T extends Node>(child: T, ref: Node | null): T {
    const result = savedInsertBefore.call(this, child, ref) as T;
    handleInsertedNode(child);
    return result;
  };
}

/**
 * Restore original DOM methods.
 */
export function unpatchDOMMethods(): void {
  if (!patched) return;
  patched = false;
  callback = null;

  if (origAppendChild) {
    Node.prototype.appendChild = origAppendChild;
    origAppendChild = null;
  }
  if (origInsertBefore) {
    Node.prototype.insertBefore = origInsertBefore;
    origInsertBefore = null;
  }
}
