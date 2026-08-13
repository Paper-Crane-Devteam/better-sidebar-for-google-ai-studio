/**
 * Shared vocabulary for the bridge ⇄ worker protocol.
 *
 * Kept in its own module so the service worker can import it without pulling in
 * the worker (and with it the whole SQLite WASM bundle).
 */

/**
 * The worker has no database open and was never told which one to use.
 *
 * Reported as a code rather than only prose so the bridge can react instead of
 * surfacing it: it means the worker was replaced — it crashed, or its host
 * document was recreated — and needs INIT replayed. The worker raises this
 * *before* touching the database, so replaying the original request afterwards
 * cannot apply a write twice.
 */
export const NO_DB_OPEN = 'NO_DB_OPEN';
