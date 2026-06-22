// StrixBlock v2 — Stats manager

import type { Stats, CategoryStats } from '../shared/types.js';
import { STORAGE_KEYS, BADGE_MAX_COUNT } from '../shared/constants.js';
import * as storage from './storage.js';
import * as settingsManager from './settings.js';

// In-memory per-tab blocked counts
const _tabCounts = new Map<number, number>();

// In-memory session counter (reset on service worker restart)
let _sessionCount = 0;

const EMPTY_CATEGORY_STATS: CategoryStats = {
  ads: 0,
  trackers: 0,
  malware: 0,
  annoyances: 0,
  other: 0,
};

function emptyStats(): Stats {
  return {
    total: 0,
    session: 0,
    byCategory: { ...EMPTY_CATEGORY_STATS },
    byDomain: {},
    lastReset: Date.now(),
  };
}

/**
 * Increment the blocked count for a tab and update global stats.
 */
export async function increment(
  tabId: number,
  domain: string,
  category: string
): Promise<void> {
  // Update in-memory tab count
  _tabCounts.set(tabId, (_tabCounts.get(tabId) ?? 0) + 1);
  _sessionCount++;

  // Update persistent global stats
  const stats = await getGlobalStats();
  stats.total++;
  stats.session = _sessionCount;

  const cat = category as keyof CategoryStats;
  if (cat in stats.byCategory) {
    stats.byCategory[cat]++;
  } else {
    stats.byCategory.other++;
  }

  if (domain) {
    stats.byDomain[domain] = (stats.byDomain[domain] ?? 0) + 1;
  }

  await storage.set(STORAGE_KEYS.STATS, stats);

  // Update badge
  updateBadge(tabId);
}

/**
 * Get the blocked count for a specific tab.
 */
export function getTabStats(tabId: number): number {
  return _tabCounts.get(tabId) ?? 0;
}

/**
 * Get the global stats from storage.
 */
export async function getGlobalStats(): Promise<Stats> {
  const stored = await storage.get<Stats>(STORAGE_KEYS.STATS);
  if (!stored) return emptyStats();
  // Ensure all fields present (forward compat)
  return {
    ...emptyStats(),
    ...stored,
    byCategory: {
      ...EMPTY_CATEGORY_STATS,
      ...(stored.byCategory ?? {}),
    },
    byDomain: stored.byDomain ?? {},
  };
}

/**
 * Clear the session counter (called on service worker startup).
 */
export function clearSession(): void {
  _sessionCount = 0;
  _tabCounts.clear();
}

/**
 * Clear all stats from storage.
 */
export async function clearAll(): Promise<void> {
  clearSession();
  await storage.set(STORAGE_KEYS.STATS, emptyStats());
  // Clear badge on all tabs
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id !== undefined) {
        chrome.action.setBadgeText({ text: '', tabId: tab.id });
      }
    }
  });
}

/**
 * Clean up tab state when a tab is closed.
 */
export function onTabRemoved(tabId: number): void {
  _tabCounts.delete(tabId);
}

/**
 * Update the extension badge for a given tab.
 */
function updateBadge(tabId: number): void {
  try {
    const settings = settingsManager.get();
    if (!settings.ui.showBadge) return;

    const count = _tabCounts.get(tabId) ?? 0;
    if (count === 0) {
      chrome.action.setBadgeText({ text: '', tabId });
      return;
    }

    const text = count > BADGE_MAX_COUNT ? '9999+' : count.toString();
    chrome.action.setBadgeText({ text, tabId });
    chrome.action.setBadgeBackgroundColor({
      color: settings.ui.badgeColor || '#e74c3c',
      tabId,
    });
  } catch {
    // Settings may not be loaded yet — ignore
  }
}

/**
 * Rebuild badge for a tab when settings change (e.g. badge toggled on).
 */
export function refreshBadge(tabId: number): void {
  updateBadge(tabId);
}

/**
 * Clear badge for all tabs (called when extension is disabled or badge hidden).
 */
export function clearAllBadges(): void {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id !== undefined) {
        chrome.action.setBadgeText({ text: '', tabId: tab.id });
      }
    }
  });
}
