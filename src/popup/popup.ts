// StrixBlock v2 — Popup script

import type { TabStats, Stats, Settings, UpdateInfo } from '../shared/types.js';
import { formatCount } from '../shared/utils.js';
import { VERSION } from '../shared/constants.js';

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const versionBadge = document.getElementById('versionBadge') as HTMLElement;
const statusDot = document.getElementById('statusDot') as HTMLElement;
const siteDomain = document.getElementById('siteDomain') as HTMLElement;
const siteToggle = document.getElementById('siteToggle') as HTMLInputElement;
const toggleLabel = document.getElementById('toggleLabel') as HTMLElement;
const totalBlocked = document.getElementById('totalBlocked') as HTMLElement;
const pageBlocked = document.getElementById('pageBlocked') as HTMLElement;
const updateBanner = document.getElementById('updateBanner') as HTMLElement;
const updateLink = document.getElementById('updateLink') as HTMLAnchorElement;
const dashboardBtn = document.getElementById('dashboardBtn') as HTMLButtonElement;

// ─── State ────────────────────────────────────────────────────────────────────

let currentDomain = '';
let currentTabId: number | undefined;

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  versionBadge.textContent = `v${VERSION}`;

  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab?.id;

  if (!tab?.url) {
    siteDomain.textContent = 'No active page';
    return;
  }

  // Fetch all data in parallel
  const [tabInfoRes, statsRes, settingsRes] = await Promise.allSettled([
    chrome.runtime.sendMessage({ type: 'GET_TAB_INFO', tabId: currentTabId }),
    chrome.runtime.sendMessage({ type: 'GET_STATS' }),
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }),
  ]);

  // Tab info
  if (tabInfoRes.status === 'fulfilled' && tabInfoRes.value?.success) {
    const tabInfo = tabInfoRes.value.data as TabStats;
    currentDomain = tabInfo.domain;
    siteDomain.textContent = tabInfo.domain || 'Unknown';
    pageBlocked.textContent = formatCount(tabInfo.blocked);

    // Toggle reflects whether site is protected (NOT whitelisted)
    const isProtected = !tabInfo.whitelisted;
    siteToggle.checked = isProtected;
    setToggleLabel(isProtected);
  } else {
    try {
      currentDomain = new URL(tab.url).hostname;
    } catch { /* ignore */ }
    siteDomain.textContent = currentDomain || 'Unknown';
    pageBlocked.textContent = '0';
  }

  // Global stats
  if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
    const stats = statsRes.value.data as Stats;
    totalBlocked.textContent = formatCount(stats.total);
  }

  // Settings — update extension enabled state
  if (settingsRes.status === 'fulfilled' && settingsRes.value?.success) {
    const settings = settingsRes.value.data as Settings;
    if (!settings.enabled) {
      document.body.classList.add('ext-disabled');
      statusDot.classList.add('inactive');
    } else {
      statusDot.classList.remove('inactive');
    }
  }

  // Check for update info in storage
  chrome.storage.local.get(['update_info'], (result) => {
    const info = result['update_info'] as UpdateInfo | undefined;
    if (info?.available) {
      updateBanner.classList.add('visible');
      updateLink.href = info.releaseUrl;
    }
  });
}

// ─── Toggle Handler ───────────────────────────────────────────────────────────

siteToggle.addEventListener('change', async () => {
  if (!currentDomain) return;

  try {
    const res = await chrome.runtime.sendMessage({
      type: 'TOGGLE_SITE',
      domain: currentDomain,
    });

    if (res?.success) {
      const isProtected = !res.data?.whitelisted;
      siteToggle.checked = isProtected;
      setToggleLabel(isProtected);
    }
  } catch (err) {
    console.error('[StrixBlock] Toggle error:', err);
  }
});

function setToggleLabel(isProtected: boolean): void {
  toggleLabel.textContent = isProtected ? 'Protected' : 'Paused';
  toggleLabel.className = 'toggle-label ' + (isProtected ? 'enabled' : 'disabled');
}

// ─── Dashboard Button ─────────────────────────────────────────────────────────

dashboardBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

// ─── Update link ──────────────────────────────────────────────────────────────

updateLink.addEventListener('click', (e) => {
  e.preventDefault();
  if (updateLink.href) {
    chrome.tabs.create({ url: updateLink.href });
    window.close();
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

init().catch((err) => {
  console.error('[StrixBlock] Popup init error:', err);
});
