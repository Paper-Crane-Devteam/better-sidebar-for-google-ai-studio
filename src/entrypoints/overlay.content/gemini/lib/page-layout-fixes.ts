/**
 * Workarounds for host-page layout bugs in Gemini.
 *
 * These are not extension features. They patch defects in Gemini's own CSS that
 * our users hit and report to us. Each one documents the defect it works around so
 * it can be removed once Google fixes it upstream.
 */

const STYLE_ID = 'better-sidebar-gemini-page-layout-fixes';

/**
 * ## Defect: the content area gets stuck scrolled upward
 *
 * Symptom, as reported: the page jumps up, a blank strip appears at the bottom,
 * and nothing scrolls it back. Survives until reload. Seen after clicking a
 * conversation, and much worse after attaching a second file to the composer.
 *
 * ## Cause
 *
 * Gemini renders `<chat-loading-animation>` inside `<bard-sidenav-content>`, which
 * is `position: relative` and therefore its containing block. At rest that element
 * is `position: absolute; top: 0; height: 500px; transform: translateY(100px)` with
 * `opacity: 0` — invisible, unclickable, painted behind everything, but still very
 * much in layout. Transformed boxes count toward an ancestor's scrollable overflow,
 * so it occupies 0..600px of `<bard-sidenav-content>`'s scrollable area.
 *
 * Measured while reproducing at a ~500px viewport:
 *
 *     bard-sidenav-content    clientHeight 417   scrollHeight 600   scrollTop 150
 *     bard-sidenav-container  clientHeight 417   scrollHeight 417   <- real content
 *
 * The real content fits exactly. Every pixel of the 183px of scrollable overflow
 * comes from that invisible element.
 *
 * `<bard-sidenav-content>` is `overflow: hidden`, which removes the scrollbar but
 * leaves it a scroll container that can still be scrolled programmatically. Gemini
 * then calls `scrollIntoView()` on a descendant — confirmed by intercepting
 * `Element.prototype.scrollIntoView`, which fires on `.conversation-container` when
 * a conversation is clicked and on `uploader-file-preview` when a second file is
 * attached. That walks up every scrollable ancestor, scrolls this one into the empty
 * region, and with no scrollbar the user cannot undo it.
 *
 * It only bites when `clientHeight < 600`, i.e. a viewport shorter than roughly
 * 683px. That is ordinary on a laptop and routine on Windows at 125%/150% display
 * scaling, which is why it looks intermittent and never appears on a large maximized
 * window. The shift is `600 - clientHeight`, which at a ~500px viewport is ~183px out
 * of 417px — matching the "jumped up about half a screen" reports.
 *
 * ## The fix
 *
 * Take the element out of layout. It is purely decorative: the ambient gradient glow
 * that sweeps behind the conversation while a response generates. Its entire subtree
 * is empty `<div>`s named for blobs and gradient strips — no text, no controls, no
 * spinner. It is `z-index: -1`, `pointer-events: none`, and `opacity: 0` at rest.
 * The upload spinner is a separate component and is unaffected.
 *
 * So the cost is one background flourish, and the benefit is that the invisible
 * 600px of phantom scroll area disappears, leaving nothing for `scrollIntoView()` to
 * scroll into.
 *
 * `!important` is required because Gemini styles this element through Angular's
 * `[_nghost-*]` attribute selector, which outranks a bare type selector.
 *
 * Tried first and rejected: `bard-sidenav-content { overflow: clip }`, which would
 * have made the container structurally unscrollable and fixed this whole class of
 * bug rather than today's instance. It did not stop the shift in practice, and it
 * carried a real risk of its own — `clip` does not establish a block formatting
 * context whereas `hidden` does — so it was not worth keeping alongside a fix that
 * works.
 */
const HIDE_PHANTOM_LOADING_ANIMATION = `
  chat-loading-animation {
    display: none !important;
  }
`;

/**
 * Inject the host-page CSS workarounds. Safe to call more than once.
 */
export function applyGeminiPageLayoutFixes() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = HIDE_PHANTOM_LOADING_ANIMATION;
  (document.head || document.documentElement).appendChild(style);
}
