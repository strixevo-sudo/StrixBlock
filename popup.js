chrome.storage.local.get('updateCheck', ({ updateCheck }) => {
  if (!updateCheck || !updateCheck.updateAvailable) return;
  const banner = document.getElementById('update-banner');
  document.getElementById('update-text').textContent = `v${updateCheck.latestVersion} available`;
  document.getElementById('update-link').href = updateCheck.releaseUrl;
  banner.style.display = 'flex';
  const dot = document.querySelector('.dot');
  if (dot) {
    dot.style.background = '#ffaa00';
    dot.style.boxShadow = '0 0 6px #ffaa00';
  }
});
