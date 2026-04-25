/**
 * Tab-Profile Map
 *
 * Tracks which database each browser tab should be using.
 * This solves the multi-tab race condition where two tabs with different
 * accounts both send messages to the background, but the background only
 * has one active DB connection.
 *
 * Before processing any DB message, the background checks this map and
 * auto-switches the DB if the sender tab expects a different database.
 *
 * Also tracks the currently active (focused) tab so that auto-sync
 * always operates on the correct profile.
 */

import { switchDB } from '@/shared/db';

// tabId → dbName
const tabDbMap = new Map<number, string>();

// Track the currently active dbName in the background
let currentDbName = 'prompt-manager-for-google-ai-studio.db';

// Track the browser's currently active/focused tab
let activeTabId: number | null = null;

/**
 * Register which DB a tab is associated with.
 */
export function setTabDb(tabId: number, dbName: string) {
  tabDbMap.set(tabId, dbName);
  console.log(`[TabProfileMap] Tab ${tabId} → ${dbName}`);
}

/**
 * Update the current DB name (called after any DB switch).
 */
export function setCurrentDbName(dbName: string) {
  currentDbName = dbName;
}

/**
 * Get the current DB name.
 */
export function getCurrentDbName(): string {
  return currentDbName;
}

/**
 * Set the currently active (focused) tab.
 * Called from chrome.tabs.onActivated listener.
 */
export function setActiveTabId(tabId: number) {
  activeTabId = tabId;
}

/**
 * Get the active tab's ID, or null if unknown.
 */
export function getActiveTabId(): number | null {
  return activeTabId;
}

/**
 * Get the dbName for the active tab.
 * Falls back to currentDbName if active tab has no mapping.
 */
export function getActiveDbName(): string {
  if (activeTabId != null) {
    const db = tabDbMap.get(activeTabId);
    if (db) return db;
  }
  return currentDbName;
}

/**
 * Ensure the background DB matches what the sender tab expects.
 * Returns true if a switch was performed.
 */
export async function ensureDbForTab(tabId: number | undefined): Promise<boolean> {
  if (!tabId) return false;
  const expectedDb = tabDbMap.get(tabId);
  if (!expectedDb) return false;
  if (expectedDb === currentDbName) return false;

  console.log(`[TabProfileMap] Auto-switching DB for tab ${tabId}: ${currentDbName} → ${expectedDb}`);
  await switchDB(expectedDb);
  currentDbName = expectedDb;
  return true;
}

/**
 * Ensure the background DB is switched to the active tab's profile.
 * Used by auto-sync before performing sync operations.
 */
export async function ensureDbForActiveTab(): Promise<void> {
  if (activeTabId != null) {
    await ensureDbForTab(activeTabId);
  }
}

/**
 * Clean up when a tab is closed.
 */
export function removeTab(tabId: number) {
  tabDbMap.delete(tabId);
  if (activeTabId === tabId) {
    activeTabId = null;
  }
}
