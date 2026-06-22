// StrixBlock v2 — Extension + filter list update manager

import type { UpdateInfo, Settings, FilterList } from '../shared/types.js';
import {
  VERSION,
  STORAGE_KEYS,
  ALARM_NAMES,
  GITHUB_RELEASES_API,
} from '../shared/constants.js';
import * as storage from './storage.js';
import { parseFilterList, compileToDNR, compileToCSS } from './filter-engine.js';
import { DNR_DYNAMIC_START_ID } from '../shared/constants.js';

// ─── Extension Update Check ───────────────────────────────────────────────────

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  published_at: string;
}

/**
 * Check GitHub releases for a newer version of StrixBlock.
 */
export async function checkExtensionUpdate(repo: string): Promise<UpdateInfo> {
  const url = GITHUB_RELEASES_API(repo);

  const info: UpdateInfo = {
    available: false,
    currentVersion: VERSION,
    latestVersion: VERSION,
    releaseUrl: `https://github.com/${repo}/releases`,
    checkedAt: Date.now(),
  };

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    if (!response.ok) {
      console.warn('[StrixBlock] Update check failed:', response.status);
      return info;
    }

    const release = (await response.json()) as GitHubRelease;
    const latest = release.tag_name.replace(/^v/i, '');

    info.latestVersion = latest;
    info.releaseUrl = release.html_url;
    info.available = isNewerVersion(latest, VERSION);

    await storage.set(STORAGE_KEYS.UPDATE_INFO, info);
  } catch (err) {
    console.warn('[StrixBlock] Update check error:', err);
  }

  return info;
}

/**
 * Returns true if candidate version is strictly newer than current.
 */
function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (v: string) => v.split('.').map((n) => parseInt(n, 10) || 0);
  const [ca, cb, cc] = parse(candidate);
  const [a, b, c] = parse(current);
  if (ca !== a) return ca > a;
  if (cb !== b) return cb > b;
  return (cc ?? 0) > (c ?? 0);
}

// ─── Filter List Updates ──────────────────────────────────────────────────────

/**
 * Check and refresh all enabled filter lists that are due for an update.
 * Updates dynamic DNR rules and stores cosmetic rules for content scripts.
 */
export async function checkFilterListUpdates(settings: Settings): Promise<void> {
  const nowMs = Date.now();
  const intervalMs = settings.updates.intervalHours * 60 * 60 * 1000;

  const listsToUpdate = settings.filterLists.filter(
    (list) => list.enabled && nowMs - list.lastUpdated > intervalMs
  );

  if (listsToUpdate.length === 0) return;

  console.log(`[StrixBlock] Refreshing ${listsToUpdate.length} filter list(s)…`);

  for (const list of listsToUpdate) {
    await fetchAndApplyFilterList(list, settings);
  }
}

/**
 * Fetch, parse, and apply a single filter list.
 * Saves the updated FilterList metadata back to storage (via settings).
 */
export async function fetchAndApplyFilterList(
  list: FilterList,
  settings: Settings
): Promise<FilterList> {
  try {
    const response = await fetch(list.url);
    if (!response.ok) {
      console.warn(`[StrixBlock] Failed to fetch ${list.name}: HTTP ${response.status}`);
      return list;
    }

    const text = await response.text();
    const { networkRules, cosmeticRules, errors } = parseFilterList(text);

    console.log(
      `[StrixBlock] ${list.name}: ${networkRules.length} net, ${cosmeticRules.length} cosmetic, ${errors} errors`
    );

    // Compile network rules to DNR
    // Each filter list gets a range of IDs based on its index in the array
    const listIndex = settings.filterLists.findIndex((l) => l.id === list.id);
    const startId = DNR_DYNAMIC_START_ID + 4000 + listIndex * 1000;
    const dnrRules = compileToDNR(networkRules, startId);

    // Apply as dynamic rules (add to existing, replacing old rules for this list)
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const endId = startId + 999;
    const oldIds = existing.filter((r) => r.id >= startId && r.id <= endId).map((r) => r.id);

    if (dnrRules.length > 0 || oldIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: oldIds,
        addRules: dnrRules.slice(0, 1000),
      });
    }

    // Compile and store cosmetic rules for content scripts
    const cssText = compileToCSS(cosmeticRules);
    const storageKey = `${STORAGE_KEYS.FILTER_LIST_PREFIX}${list.id}_css`;
    await storage.set(storageKey, cssText);

    // Update list metadata
    const updated: FilterList = {
      ...list,
      lastUpdated: Date.now(),
      ruleCount: networkRules.length + cosmeticRules.length,
    };

    return updated;
  } catch (err) {
    console.error(`[StrixBlock] Error applying ${list.name}:`, err);
    return list;
  }
}

// ─── Alarm Scheduling ─────────────────────────────────────────────────────────

/**
 * Set up chrome.alarms for periodic update checks.
 */
export function scheduleUpdates(intervalHours: number): void {
  const periodInMinutes = Math.max(60, intervalHours * 60);

  // Clear any existing alarms first
  chrome.alarms.clear(ALARM_NAMES.UPDATE_CHECK);
  chrome.alarms.clear(ALARM_NAMES.FILTER_REFRESH);

  chrome.alarms.create(ALARM_NAMES.UPDATE_CHECK, {
    periodInMinutes,
    delayInMinutes: 5, // First check 5 minutes after startup
  });

  chrome.alarms.create(ALARM_NAMES.FILTER_REFRESH, {
    periodInMinutes,
    delayInMinutes: 10,
  });
}
