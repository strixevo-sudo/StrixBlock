// StrixBlock v2 — Settings manager

import type { Settings } from '../shared/types.js';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../shared/constants.js';
import { matchesDomain } from '../shared/utils.js';
import * as storage from './storage.js';

let _cached: Settings | null = null;

/**
 * Deep-merge partial settings on top of the default settings.
 * Ensures all required keys are present even if storage has old/partial data.
 */
function mergeWithDefaults(stored: Partial<Settings>): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    features: {
      ...DEFAULT_SETTINGS.features,
      ...(stored.features ?? {}),
    },
    ui: {
      ...DEFAULT_SETTINGS.ui,
      ...(stored.ui ?? {}),
    },
    privacy: {
      ...DEFAULT_SETTINGS.privacy,
      ...(stored.privacy ?? {}),
    },
    updates: {
      ...DEFAULT_SETTINGS.updates,
      ...(stored.updates ?? {}),
    },
    filterLists: stored.filterLists?.length
      ? stored.filterLists
      : DEFAULT_SETTINGS.filterLists,
    whitelist: stored.whitelist ?? [],
    customRules: stored.customRules ?? '',
  };
}

/**
 * Load settings from storage, merging with defaults.
 * Caches the result in memory.
 */
export async function load(): Promise<Settings> {
  const raw = await storage.get<Partial<Settings>>(STORAGE_KEYS.SETTINGS, {});
  _cached = mergeWithDefaults(raw ?? {});
  return _cached;
}

/**
 * Save the full settings object to storage and update cache.
 */
export async function save(settings: Settings): Promise<void> {
  _cached = settings;
  await storage.set(STORAGE_KEYS.SETTINGS, settings);
}

/**
 * Get the cached settings (must call load() first).
 * Throws if settings have not been loaded.
 */
export function get(): Settings {
  if (!_cached) {
    throw new Error('[StrixBlock] Settings not loaded — call load() first');
  }
  return _cached;
}

/**
 * Update partial settings, merging with current cached settings.
 */
export async function update(partial: Partial<Settings>): Promise<void> {
  const current = _cached ?? (await load());
  const updated = mergeWithDefaults({ ...current, ...partial });
  await save(updated);
}

/**
 * Check if a domain is on the whitelist.
 * Supports wildcard matching via matchesDomain().
 */
export function isWhitelisted(domain: string): boolean {
  const settings = _cached;
  if (!settings) return false;
  return settings.whitelist.some((pattern) => matchesDomain(domain, pattern));
}

/**
 * Add a domain to the whitelist.
 */
export async function addToWhitelist(domain: string): Promise<void> {
  const current = _cached ?? (await load());
  if (!current.whitelist.includes(domain)) {
    const updated: Settings = {
      ...current,
      whitelist: [...current.whitelist, domain],
    };
    await save(updated);
  }
}

/**
 * Remove a domain from the whitelist.
 */
export async function removeFromWhitelist(domain: string): Promise<void> {
  const current = _cached ?? (await load());
  const updated: Settings = {
    ...current,
    whitelist: current.whitelist.filter((d) => d !== domain),
  };
  await save(updated);
}

/**
 * Reset all settings to defaults.
 */
export async function reset(): Promise<void> {
  _cached = { ...DEFAULT_SETTINGS };
  await storage.set(STORAGE_KEYS.SETTINGS, _cached);
}
