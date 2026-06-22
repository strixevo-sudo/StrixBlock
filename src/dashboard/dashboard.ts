// StrixBlock v2 — Dashboard script

import type { Settings, Stats, FilterList, UpdateInfo } from '../shared/types.js';
import { VERSION } from '../shared/constants.js';
import { formatCount, formatRelativeTime } from '../shared/utils.js';

// ─── State ────────────────────────────────────────────────────────────────────

let currentSettings: Settings | null = null;

// ─── DOM Helpers ──────────────────────────────────────────────────────────────

function $<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function showToast(message: string, duration = 2500): void {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), duration);
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function initNav(): void {
  document.querySelectorAll<HTMLElement>('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      const page = item.dataset['page'];
      if (!page) return;

      document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
      document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));

      item.classList.add('active');
      document.getElementById(`page-${page}`)?.classList.add('active');
    });
  });
}

// ─── Message helpers ──────────────────────────────────────────────────────────

async function sendMessage<T>(message: object): Promise<T | null> {
  try {
    const res = await chrome.runtime.sendMessage(message);
    if (res?.success) return res.data as T;
    console.warn('[StrixBlock] Message failed:', res?.error);
    return null;
  } catch (err) {
    console.error('[StrixBlock] sendMessage error:', err);
    return null;
  }
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function renderOverview(stats: Stats): void {
  $('statTotal').textContent = formatCount(stats.total);
  $('statSession').textContent = formatCount(stats.session);
  $('statAds').textContent = formatCount(stats.byCategory.ads ?? 0);
  $('statTrackers').textContent = formatCount(stats.byCategory.trackers ?? 0);

  // Top blocked domains
  const container = $('topDomainsContainer');
  const entries = Object.entries(stats.byDomain)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  if (entries.length === 0) {
    container.innerHTML = '<div class="empty-state">No data yet</div>';
    return;
  }

  container.innerHTML = `
    <table class="domain-table">
      <thead>
        <tr><th>Domain</th><th style="text-align:right">Blocked</th></tr>
      </thead>
      <tbody>
        ${entries
          .map(([domain, count]) => `
            <tr>
              <td>${escapeHtml(domain)}</td>
              <td>${formatCount(count)}</td>
            </tr>
          `)
          .join('')}
      </tbody>
    </table>
  `;
}

$('clearStatsBtn').addEventListener('click', async () => {
  await sendMessage({ type: 'CLEAR_STATS' });
  const stats = await sendMessage<Stats>({ type: 'GET_STATS' });
  if (stats) renderOverview(stats);
  showToast('Statistics cleared');
});

$('exportBtn').addEventListener('click', () => {
  if (!currentSettings) return;
  const data = JSON.stringify({ settings: currentSettings, version: VERSION }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `strixblock-settings-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Settings exported');
});

$<HTMLInputElement>('importFile').addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text) as { settings?: Settings };
    if (data.settings) {
      await sendMessage({ type: 'UPDATE_SETTINGS', settings: data.settings });
      currentSettings = data.settings;
      renderAllSettings();
      showToast('Settings imported');
    }
  } catch {
    showToast('Import failed — invalid file');
  }
});

// ─── Filter Lists ─────────────────────────────────────────────────────────────

function renderFilterLists(lists: FilterList[]): void {
  const container = $('filterListsContainer');
  if (lists.length === 0) {
    container.innerHTML = '<div class="empty-state">No filter lists</div>';
    return;
  }

  container.innerHTML = lists
    .map(
      (list) => `
      <div class="filter-list-item" data-id="${escapeHtml(list.id)}">
        <label class="toggle">
          <input type="checkbox" class="filter-list-toggle" data-id="${escapeHtml(list.id)}" ${list.enabled ? 'checked' : ''}>
          <div class="toggle-slider"></div>
        </label>
        <div class="filter-list-info">
          <div class="filter-list-name">${escapeHtml(list.name)}</div>
          <div class="filter-list-meta">
            <span class="badge badge-${list.category}">${list.category}</span>
            <span>${list.ruleCount > 0 ? `${formatCount(list.ruleCount)} rules` : 'Not yet fetched'}</span>
            <span>Updated ${formatRelativeTime(list.lastUpdated)}</span>
          </div>
        </div>
        <div class="filter-list-actions">
          <button class="btn btn-secondary btn-sm filter-list-update" data-id="${escapeHtml(list.id)}">
            Update
          </button>
        </div>
      </div>
    `
    )
    .join('');

  // Toggle handlers
  container.querySelectorAll<HTMLInputElement>('.filter-list-toggle').forEach((cb) => {
    cb.addEventListener('change', async () => {
      if (!currentSettings) return;
      const id = cb.dataset['id'];
      const newLists = currentSettings.filterLists.map((l) =>
        l.id === id ? { ...l, enabled: cb.checked } : l
      );
      currentSettings = { ...currentSettings, filterLists: newLists };
      await sendMessage({ type: 'UPDATE_SETTINGS', settings: { filterLists: newLists } });
      showToast(cb.checked ? 'Filter list enabled' : 'Filter list disabled');
    });
  });

  // Update handlers
  container.querySelectorAll<HTMLButtonElement>('.filter-list-update').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset['id'];
      btn.textContent = 'Updating…';
      btn.disabled = true;

      const updated = await sendMessage<FilterList>({ type: 'FETCH_FILTER_LIST', listId: id });
      btn.textContent = 'Update';
      btn.disabled = false;

      if (updated && currentSettings) {
        const newLists = currentSettings.filterLists.map((l) =>
          l.id === updated.id ? updated : l
        );
        currentSettings = { ...currentSettings, filterLists: newLists };
        renderFilterLists(newLists);
        showToast(`${updated.name} updated`);
      } else {
        showToast('Update failed');
      }
    });
  });
}

// ─── Custom Rules ─────────────────────────────────────────────────────────────

function initRules(): void {
  const textarea = $<HTMLTextAreaElement>('customRulesTextarea');

  $('saveRulesBtn').addEventListener('click', async () => {
    if (!currentSettings) return;
    const rules = textarea.value;
    currentSettings = { ...currentSettings, customRules: rules };
    await sendMessage({ type: 'UPDATE_SETTINGS', settings: { customRules: rules } });
    showToast('Rules saved and applied');
  });

  $('clearRulesBtn').addEventListener('click', async () => {
    textarea.value = '';
    if (!currentSettings) return;
    currentSettings = { ...currentSettings, customRules: '' };
    await sendMessage({ type: 'UPDATE_SETTINGS', settings: { customRules: '' } });
    showToast('Custom rules cleared');
  });
}

// ─── Whitelist ────────────────────────────────────────────────────────────────

function renderWhitelist(whitelist: string[]): void {
  const container = $('whitelistContainer');

  if (whitelist.length === 0) {
    container.innerHTML = '<div class="empty-state">No sites whitelisted</div>';
    return;
  }

  container.innerHTML = whitelist
    .map(
      (domain) => `
      <div class="whitelist-entry">
        <div class="whitelist-domain">${escapeHtml(domain)}</div>
        <button class="btn btn-danger btn-sm remove-whitelist" data-domain="${escapeHtml(domain)}">
          Remove
        </button>
      </div>
    `
    )
    .join('');

  container.querySelectorAll<HTMLButtonElement>('.remove-whitelist').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const domain = btn.dataset['domain'];
      if (!domain || !currentSettings) return;
      await sendMessage({ type: 'REMOVE_FROM_WHITELIST', domain });
      currentSettings = {
        ...currentSettings,
        whitelist: currentSettings.whitelist.filter((d) => d !== domain),
      };
      renderWhitelist(currentSettings.whitelist);
      showToast(`${domain} removed from whitelist`);
    });
  });
}

function initWhitelist(): void {
  const input = $<HTMLInputElement>('whitelistInput');

  const addDomain = async () => {
    const domain = input.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!domain || !currentSettings) return;
    if (currentSettings.whitelist.includes(domain)) {
      showToast('Already in whitelist');
      return;
    }
    await sendMessage({ type: 'WHITELIST_SITE', domain });
    currentSettings = {
      ...currentSettings,
      whitelist: [...currentSettings.whitelist, domain],
    };
    input.value = '';
    renderWhitelist(currentSettings.whitelist);
    showToast(`${domain} added to whitelist`);
  };

  $('addWhitelistBtn').addEventListener('click', addDomain);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addDomain();
  });
}

// ─── Settings ─────────────────────────────────────────────────────────────────

interface ToggleConfig {
  key: string;
  label: string;
  desc?: string;
}

function renderToggleGroup(
  containerId: string,
  configs: ToggleConfig[],
  getVal: (key: string) => boolean,
  onToggle: (key: string, val: boolean) => Promise<void>
): void {
  const container = $(containerId);
  container.innerHTML = configs
    .map(
      (cfg) => `
      <div class="toggle-row">
        <div class="toggle-row-info">
          <div class="toggle-row-label">${escapeHtml(cfg.label)}</div>
          ${cfg.desc ? `<div class="toggle-row-desc">${escapeHtml(cfg.desc)}</div>` : ''}
        </div>
        <label class="toggle">
          <input type="checkbox" data-key="${escapeHtml(cfg.key)}" ${getVal(cfg.key) ? 'checked' : ''}>
          <div class="toggle-slider"></div>
        </label>
      </div>
    `
    )
    .join('');

  container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const key = cb.dataset['key'];
      if (key) onToggle(key, cb.checked);
    });
  });
}

function renderAllSettings(): void {
  if (!currentSettings) return;

  const featureConfigs: ToggleConfig[] = [
    { key: 'ads', label: 'Block Ads', desc: 'Block advertisements on all websites' },
    { key: 'trackers', label: 'Block Trackers', desc: 'Block tracking scripts and analytics' },
    { key: 'malware', label: 'Block Malware', desc: 'Block known malware and phishing domains' },
    { key: 'cookieBanners', label: 'Hide Cookie Banners', desc: 'Remove GDPR/cookie consent popups' },
    { key: 'annoyances', label: 'Remove Annoyances', desc: 'Block newsletter popups, push prompts, etc.' },
    { key: 'cosmetic', label: 'Cosmetic Filtering', desc: 'Inject CSS to hide ad slots' },
    { key: 'antiAdblock', label: 'Anti-Adblock Bypass', desc: 'Remove "please disable your ad blocker" walls' },
    { key: 'youtube', label: 'YouTube Ad Skip', desc: 'Skip and mute YouTube ads automatically' },
    { key: 'twitch', label: 'Twitch Ad Mute', desc: 'Mute Twitch ads and reload stream' },
  ];

  renderToggleGroup(
    'featuresContainer',
    featureConfigs,
    (key) => currentSettings!.features[key as keyof Settings['features']],
    async (key, val) => {
      if (!currentSettings) return;
      const features = { ...currentSettings.features, [key]: val };
      currentSettings = { ...currentSettings, features };
      await sendMessage({ type: 'UPDATE_SETTINGS', settings: { features } });
    }
  );

  const privacyConfigs: ToggleConfig[] = [
    { key: 'blockFingerprinting', label: 'Block Fingerprinting', desc: 'Spoof canvas, WebGL, AudioBuffer to prevent tracking' },
    { key: 'sendDNT', label: 'Send Do Not Track', desc: 'Set navigator.doNotTrack = "1"' },
    { key: 'blockGPC', label: 'Global Privacy Control', desc: 'Set navigator.globalPrivacyControl = true' },
  ];

  renderToggleGroup(
    'privacyContainer',
    privacyConfigs,
    (key) => currentSettings!.privacy[key as keyof Settings['privacy']],
    async (key, val) => {
      if (!currentSettings) return;
      const privacy = { ...currentSettings.privacy, [key]: val };
      currentSettings = { ...currentSettings, privacy };
      await sendMessage({ type: 'UPDATE_SETTINGS', settings: { privacy } });
    }
  );

  // UI settings
  $('uiContainer').innerHTML = `
    <div class="toggle-row">
      <div class="toggle-row-info">
        <div class="toggle-row-label">Show Badge Counter</div>
        <div class="toggle-row-desc">Show blocked count on extension icon</div>
      </div>
      <label class="toggle">
        <input type="checkbox" id="badgeToggle" ${currentSettings.ui.showBadge ? 'checked' : ''}>
        <div class="toggle-slider"></div>
      </label>
    </div>
    <div class="toggle-row">
      <div class="toggle-row-info">
        <div class="toggle-row-label">Theme</div>
      </div>
      <select id="themeSelect">
        <option value="dark" ${currentSettings.ui.theme === 'dark' ? 'selected' : ''}>Dark</option>
        <option value="light" ${currentSettings.ui.theme === 'light' ? 'selected' : ''}>Light</option>
        <option value="system" ${currentSettings.ui.theme === 'system' ? 'selected' : ''}>System</option>
      </select>
    </div>
  `;

  $<HTMLInputElement>('badgeToggle').addEventListener('change', async (e) => {
    if (!currentSettings) return;
    const showBadge = (e.target as HTMLInputElement).checked;
    const ui = { ...currentSettings.ui, showBadge };
    currentSettings = { ...currentSettings, ui };
    await sendMessage({ type: 'UPDATE_SETTINGS', settings: { ui } });
  });

  $<HTMLSelectElement>('themeSelect').addEventListener('change', async (e) => {
    if (!currentSettings) return;
    const theme = (e.target as HTMLSelectElement).value as 'dark' | 'light' | 'system';
    const ui = { ...currentSettings.ui, theme };
    currentSettings = { ...currentSettings, ui };
    await sendMessage({ type: 'UPDATE_SETTINGS', settings: { ui } });
  });

  // Update settings
  $('updatesContainer').innerHTML = `
    <div class="toggle-row">
      <div class="toggle-row-info">
        <div class="toggle-row-label">Check for Extension Updates</div>
      </div>
      <label class="toggle">
        <input type="checkbox" id="checkExtToggle" ${currentSettings.updates.checkExtension ? 'checked' : ''}>
        <div class="toggle-slider"></div>
      </label>
    </div>
    <div class="toggle-row">
      <div class="toggle-row-info">
        <div class="toggle-row-label">Auto-Update Filter Lists</div>
      </div>
      <label class="toggle">
        <input type="checkbox" id="checkFiltersToggle" ${currentSettings.updates.checkFilterLists ? 'checked' : ''}>
        <div class="toggle-slider"></div>
      </label>
    </div>
    <div class="toggle-row">
      <div class="toggle-row-info">
        <div class="toggle-row-label">Update Interval</div>
        <div class="toggle-row-desc">How often to refresh filter lists</div>
      </div>
      <select id="intervalSelect">
        <option value="6" ${currentSettings.updates.intervalHours === 6 ? 'selected' : ''}>Every 6 hours</option>
        <option value="12" ${currentSettings.updates.intervalHours === 12 ? 'selected' : ''}>Every 12 hours</option>
        <option value="24" ${currentSettings.updates.intervalHours === 24 ? 'selected' : ''}>Every 24 hours</option>
        <option value="48" ${currentSettings.updates.intervalHours === 48 ? 'selected' : ''}>Every 2 days</option>
        <option value="168" ${currentSettings.updates.intervalHours === 168 ? 'selected' : ''}>Weekly</option>
      </select>
    </div>
  `;

  const saveUpdateSetting = async () => {
    if (!currentSettings) return;
    const checkExtension = $<HTMLInputElement>('checkExtToggle').checked;
    const checkFilterLists = $<HTMLInputElement>('checkFiltersToggle').checked;
    const intervalHours = parseInt($<HTMLSelectElement>('intervalSelect').value, 10);
    const updates = { ...currentSettings.updates, checkExtension, checkFilterLists, intervalHours };
    currentSettings = { ...currentSettings, updates };
    await sendMessage({ type: 'UPDATE_SETTINGS', settings: { updates } });
  };

  $('checkExtToggle').addEventListener('change', saveUpdateSetting);
  $('checkFiltersToggle').addEventListener('change', saveUpdateSetting);
  $('intervalSelect').addEventListener('change', saveUpdateSetting);
}

function initSettings(): void {
  $('resetSettingsBtn').addEventListener('click', async () => {
    if (!confirm('Reset all settings to defaults? This cannot be undone.')) return;
    await sendMessage({ type: 'UPDATE_SETTINGS', settings: {} });
    // Re-load
    const fresh = await sendMessage<Settings>({ type: 'GET_SETTINGS' });
    if (fresh) {
      currentSettings = fresh;
      renderAllSettings();
      if (fresh.filterLists) renderFilterLists(fresh.filterLists);
      if (fresh.whitelist) renderWhitelist(fresh.whitelist);
    }
    showToast('Settings reset to defaults');
  });
}

// ─── About ────────────────────────────────────────────────────────────────────

async function initAbout(): Promise<void> {
  $('aboutVersion').textContent = VERSION;

  // Load update info from storage
  chrome.storage.local.get(['update_info'], (result) => {
    const info = result['update_info'] as UpdateInfo | undefined;
    if (info) {
      const status = $('updateStatus');
      if (info.available) {
        status.innerHTML = `Update available: <a href="${escapeHtml(info.releaseUrl)}" target="_blank" rel="noopener">v${escapeHtml(info.latestVersion)}</a>`;
        status.style.color = 'var(--warning)';
      } else {
        status.textContent = `Up to date (last checked ${formatRelativeTime(info.checkedAt)})`;
        status.style.color = 'var(--success)';
      }
    } else {
      $('updateStatus').textContent = 'No update check performed yet';
    }
  });

  $('checkUpdateBtn').addEventListener('click', async () => {
    const btn = $<HTMLButtonElement>('checkUpdateBtn');
    btn.textContent = 'Checking…';
    btn.disabled = true;

    const info = await sendMessage<UpdateInfo>({ type: 'CHECK_UPDATE' });
    btn.textContent = 'Check for Updates';
    btn.disabled = false;

    const status = $('updateStatus');
    if (info) {
      if (info.available) {
        status.innerHTML = `Update available: <a href="${escapeHtml(info.releaseUrl)}" target="_blank" rel="noopener">v${escapeHtml(info.latestVersion)}</a>`;
        status.style.color = 'var(--warning)';
        showToast(`Update available: v${info.latestVersion}`);
      } else {
        status.textContent = `Already up to date (v${info.currentVersion})`;
        status.style.color = 'var(--success)';
        showToast('Already up to date');
      }
    } else {
      status.textContent = 'Update check failed';
      showToast('Update check failed');
    }
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  $('logoVersion').textContent = `v${VERSION}`;

  initNav();
  initRules();
  initWhitelist();
  initSettings();
  await initAbout();

  // Load data from background
  const [settings, stats] = await Promise.all([
    sendMessage<Settings>({ type: 'GET_SETTINGS' }),
    sendMessage<Stats>({ type: 'GET_STATS' }),
  ]);

  if (settings) {
    currentSettings = settings;
    renderAllSettings();
    renderFilterLists(settings.filterLists);
    renderWhitelist(settings.whitelist);

    // Populate custom rules textarea
    $<HTMLTextAreaElement>('customRulesTextarea').value = settings.customRules ?? '';
  }

  if (stats) {
    renderOverview(stats);
  }
}

init().catch((err) => {
  console.error('[StrixBlock] Dashboard init error:', err);
});
