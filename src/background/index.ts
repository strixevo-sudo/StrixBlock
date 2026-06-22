// StrixBlock v2 — Service worker entry point

import type { Message, MessageResponse, TabStats } from '../shared/types.js';
import { ALARM_NAMES, STORAGE_KEYS } from '../shared/constants.js';
import { extractDomain } from '../shared/utils.js';

import * as settingsManager from './settings.js';
import * as statsManager from './stats-manager.js';
import * as filterEngine from './filter-engine.js';
import * as ruleManager from './rule-manager.js';
import * as updateManager from './update-manager.js';
import * as storage from './storage.js';

// ─── Initialisation ───────────────────────────────────────────────────────────

let _initPromise: Promise<void> | null = null;

function ensureInit(): Promise<void> {
  if (!_initPromise) _initPromise = _init();
  return _initPromise;
}

async function _init(): Promise<void> {
  console.log('[StrixBlock] Initialising service worker…');

  try {
    const settings = await settingsManager.load();
    statsManager.clearSession();

    if (settings.enabled) {
      await ruleManager.compileAndApplyWhitelist(settings.whitelist);

      if (settings.customRules.trim()) {
        await ruleManager.compileAndApplyCustomRules(settings.customRules, filterEngine);
      }

      if (settings.updates.checkExtension || settings.updates.checkFilterLists) {
        updateManager.scheduleUpdates(settings.updates.intervalHours);
      }
    }

    console.log('[StrixBlock] Service worker ready.');
  } catch (err) {
    console.error('[StrixBlock] Initialisation error:', err);
    _initPromise = null; // allow retry on next message
  }
}

// Run immediately so SW restarts (no onInstalled/onStartup) are covered
ensureInit();

// ─── Event Listeners ──────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[StrixBlock] onInstalled:', details.reason);
  await ensureInit();

  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dist/dashboard/dashboard.html') });
  }
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[StrixBlock] onStartup');
  ensureInit();
});

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) => {
    ensureInit()
      .then(() => handleMessage(message, sender))
      .then(sendResponse)
      .catch((err) => {
        console.error('[StrixBlock] Message error:', err);
        sendResponse({ success: false, error: String(err) });
      });

    return true;
  }
);

async function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  switch (message.type) {
    case 'GET_TAB_INFO': {
      const tabId = message.tabId ?? sender.tab?.id;
      if (tabId === undefined) {
        return { success: false, error: 'No tab ID' };
      }

      let tab: chrome.tabs.Tab | undefined;
      try {
        tab = await chrome.tabs.get(tabId);
      } catch {
        return { success: false, error: 'Tab not found' };
      }

      const url = tab.url ?? '';
      const domain = extractDomain(url);
      const blocked = statsManager.getTabStats(tabId);
      const whitelisted = settingsManager.isWhitelisted(domain);

      const tabStats: TabStats = { tabId, url, domain, blocked, whitelisted };
      return { success: true, data: tabStats };
    }

    case 'GET_STATS': {
      const stats = await statsManager.getGlobalStats();
      return { success: true, data: stats };
    }

    case 'GET_SETTINGS': {
      const settings = settingsManager.get();
      return { success: true, data: settings };
    }

    case 'UPDATE_SETTINGS': {
      const partial = message.settings;
      await settingsManager.update(partial);
      const updated = settingsManager.get();

      // Re-apply rules if features changed
      await ruleManager.compileAndApplyWhitelist(updated.whitelist);
      if (updated.customRules.trim()) {
        await ruleManager.compileAndApplyCustomRules(updated.customRules, filterEngine);
      } else {
        // Clear custom rule range
        const existing = await chrome.declarativeNetRequest.getDynamicRules();
        const customIds = existing
          .filter((r) => r.id >= 12000 && r.id <= 14999)
          .map((r) => r.id);
        if (customIds.length > 0) {
          await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: customIds,
            addRules: [],
          });
        }
      }

      // Badge update
      if (!updated.ui.showBadge) {
        statsManager.clearAllBadges();
      }

      return { success: true };
    }

    case 'TOGGLE_SITE': {
      const { domain } = message;
      const settings = settingsManager.get();
      const whitelisted = settings.whitelist.includes(domain);

      if (whitelisted) {
        await settingsManager.removeFromWhitelist(domain);
      } else {
        await settingsManager.addToWhitelist(domain);
      }

      // Recompile whitelist
      const updated = settingsManager.get();
      await ruleManager.compileAndApplyWhitelist(updated.whitelist);

      return { success: true, data: { whitelisted: !whitelisted } };
    }

    case 'WHITELIST_SITE': {
      await settingsManager.addToWhitelist(message.domain);
      const updated = settingsManager.get();
      await ruleManager.compileAndApplyWhitelist(updated.whitelist);
      return { success: true };
    }

    case 'REMOVE_FROM_WHITELIST': {
      await settingsManager.removeFromWhitelist(message.domain);
      const updated = settingsManager.get();
      await ruleManager.compileAndApplyWhitelist(updated.whitelist);
      return { success: true };
    }

    case 'CLEAR_STATS': {
      await statsManager.clearAll();
      return { success: true };
    }

    case 'FETCH_FILTER_LIST': {
      const settings = settingsManager.get();
      const list = settings.filterLists.find((l) => l.id === message.listId);
      if (!list) return { success: false, error: 'List not found' };

      const updated = await updateManager.fetchAndApplyFilterList(list, settings);

      // Update the filter list metadata in settings
      const newLists = settings.filterLists.map((l) =>
        l.id === updated.id ? updated : l
      );
      await settingsManager.update({ filterLists: newLists });

      return { success: true, data: updated };
    }

    case 'CHECK_UPDATE': {
      const settings = settingsManager.get();
      const info = await updateManager.checkExtensionUpdate(settings.updates.githubRepo);
      return { success: true, data: info };
    }

    case 'STATS_INCREMENT': {
      const { tabId, domain, category } = message;
      await statsManager.increment(tabId, domain, category);
      return { success: true };
    }

    case 'GET_COSMETIC_RULES': {
      // Return all stored cosmetic CSS from filter lists
      const settings = settingsManager.get();
      const parts: string[] = [];

      for (const list of settings.filterLists) {
        if (!list.enabled) continue;
        const key = `${STORAGE_KEYS.FILTER_LIST_PREFIX}${list.id}_css`;
        const css = await storage.get<string>(key, '');
        if (css) parts.push(css);
      }

      return { success: true, data: parts.join('\n\n') };
    }

    case 'GET_UPDATE_INFO': {
      const info = await storage.get(STORAGE_KEYS.UPDATE_INFO);
      return { success: true, data: info };
    }

    default: {
      const _exhaustive: never = message;
      return { success: false, error: `Unknown message type: ${(_exhaustive as Message).type}` };
    }
  }
}

// ─── Alarm Handler ────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  await ensureInit();
  const settings = settingsManager.get();

  if (alarm.name === ALARM_NAMES.UPDATE_CHECK) {
    if (settings.updates.checkExtension) {
      await updateManager.checkExtensionUpdate(settings.updates.githubRepo);
    }
  } else if (alarm.name === ALARM_NAMES.FILTER_REFRESH) {
    if (settings.updates.checkFilterLists) {
      await updateManager.checkFilterListUpdates(settings);
    }
  }
});

// ─── Tab Removed ──────────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener((tabId) => {
  statsManager.onTabRemoved(tabId);
});

// ─── DNR Rule Matched Debug (stats tracking) ──────────────────────────────────

// Only available on dev builds with declarativeNetRequestFeedback permission
if ('onRuleMatchedDebug' in chrome.declarativeNetRequest) {
  (chrome.declarativeNetRequest as unknown as {
    onRuleMatchedDebug: {
      addListener: (
        cb: (info: { request: { tabId: number; url: string; initiator?: string } }) => void
      ) => void;
    };
  }).onRuleMatchedDebug.addListener((info) => {
    const domain = extractDomain(info.request.url);
    if (domain && info.request.tabId > 0) {
      statsManager.increment(info.request.tabId, domain, 'ads').catch(() => {});
    }
  });
}
