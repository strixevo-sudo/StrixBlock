const CURRENT_VERSION = '1.3.0';
const GITHUB_REPO = 'strixevo-sudo/StrixBlock';

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

async function checkForUpdates() {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
    if (!res.ok) return;
    const data = await res.json();
    const latest = (data.tag_name || '').replace(/^v/, '');
    if (!latest) return;
    const updateAvailable = compareVersions(latest, CURRENT_VERSION) > 0;
    await chrome.storage.local.set({
      updateCheck: {
        updateAvailable,
        latestVersion: latest,
        releaseUrl: data.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`,
        checkedAt: Date.now(),
      }
    });
  } catch (_) {}
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[StrixBlock] v1.3.0 installed — 788 rules active.');
  checkForUpdates();
  chrome.alarms.create('updateCheck', { periodInMinutes: 1440 });
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[StrixBlock] Service worker started.');
  checkForUpdates();
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'updateCheck') checkForUpdates();
});
