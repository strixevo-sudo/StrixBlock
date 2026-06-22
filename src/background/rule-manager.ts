// StrixBlock v2 — declarativeNetRequest lifecycle manager

import {
  DNR_MAX_DYNAMIC_RULES,
  DNR_DYNAMIC_START_ID,
  DNR_PRIORITY,
} from '../shared/constants.js';
import { compileToDNR } from './filter-engine.js';

/**
 * Replace ALL existing dynamic rules with the provided new set.
 * Splits into batches if needed to stay within the 5000-rule limit.
 */
export async function updateDynamicRules(
  rules: chrome.declarativeNetRequest.Rule[]
): Promise<void> {
  // Get all existing dynamic rules to remove them
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map((r) => r.id);

  // Clamp to max
  const toAdd = rules.slice(0, DNR_MAX_DYNAMIC_RULES);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules: toAdd,
  });
}

/**
 * Add session-scoped rules (cleared when browser restarts).
 * Session rules do not count against the dynamic rule quota.
 */
export async function addSessionRules(
  rules: chrome.declarativeNetRequest.Rule[]
): Promise<void> {
  const existing = await chrome.declarativeNetRequest.getSessionRules();
  const removeIds = existing.map((r) => r.id);

  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: removeIds,
    addRules: rules,
  });
}

/**
 * Remove all dynamic rules without adding any new ones.
 */
export async function clearDynamicRules(): Promise<void> {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  if (existing.length === 0) return;
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules: [],
  });
}

/**
 * Enable or disable a static ruleset by ID.
 */
export async function setRulesetEnabled(
  rulesetId: string,
  enabled: boolean
): Promise<void> {
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enabled ? [rulesetId] : [],
    disableRulesetIds: enabled ? [] : [rulesetId],
  });
}

/**
 * Get a list of currently enabled static ruleset IDs.
 */
export async function getEnabledRulesets(): Promise<string[]> {
  return chrome.declarativeNetRequest.getEnabledRulesets();
}

/**
 * Parse and apply custom EasyList-format rules as dynamic DNR rules.
 * Merges with whitelist rules already present.
 */
export async function compileAndApplyCustomRules(
  rulesText: string,
  engine: typeof import('./filter-engine.js')
): Promise<void> {
  if (!rulesText.trim()) return;

  const { networkRules } = engine.parseFilterList(rulesText);
  const dnrRules = compileToDNR(networkRules, DNR_DYNAMIC_START_ID + 2000);
  if (dnrRules.length === 0) return;

  // Get existing dynamic rules, remove old custom rules, re-add
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const nonCustom = existing.filter((r) => r.id < DNR_DYNAMIC_START_ID + 2000);
  const removeIds = existing
    .filter((r) => r.id >= DNR_DYNAMIC_START_ID + 2000)
    .map((r) => r.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules: dnrRules.slice(0, DNR_MAX_DYNAMIC_RULES - nonCustom.length),
  });
}

/**
 * Generate and apply allow rules for all whitelisted domains.
 * Whitelist rules use IDs in the range [DNR_DYNAMIC_START_ID, DNR_DYNAMIC_START_ID+1999].
 */
export async function compileAndApplyWhitelist(domains: string[]): Promise<void> {
  const WHITELIST_START = DNR_DYNAMIC_START_ID;
  const WHITELIST_END = DNR_DYNAMIC_START_ID + 1999;

  // Remove old whitelist rules
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const oldWhitelistIds = existing
    .filter((r) => r.id >= WHITELIST_START && r.id <= WHITELIST_END)
    .map((r) => r.id);

  if (domains.length === 0 && oldWhitelistIds.length === 0) return;

  // Build new whitelist allow rules
  const newRules: chrome.declarativeNetRequest.Rule[] = domains
    .slice(0, 1000)
    .flatMap((domain, idx) => [
      // Allow all requests initiated by this domain
      {
        id: WHITELIST_START + idx * 2,
        priority: DNR_PRIORITY.WHITELIST_DOMAIN,
        action: { type: chrome.declarativeNetRequest.RuleActionType.ALLOW },
        condition: {
          initiatorDomains: [domain],
          resourceTypes: [
            'main_frame', 'sub_frame', 'script', 'image', 'stylesheet',
            'xmlhttprequest', 'font', 'media', 'ping', 'other',
          ] as chrome.declarativeNetRequest.ResourceType[],
        },
      },
      // Allow navigation to this domain
      {
        id: WHITELIST_START + idx * 2 + 1,
        priority: DNR_PRIORITY.WHITELIST_DOMAIN,
        action: { type: chrome.declarativeNetRequest.RuleActionType.ALLOW },
        condition: {
          requestDomains: [domain],
          resourceTypes: ['main_frame'] as chrome.declarativeNetRequest.ResourceType[],
        },
      },
    ]);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: oldWhitelistIds,
    addRules: newRules,
  });
}

