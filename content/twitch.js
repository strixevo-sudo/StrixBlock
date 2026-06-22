(function () {
  'use strict';

  let adActive = false;
  let savedVolume = 1;
  let overlayEl = null;
  let reloadTimer = null;
  let reloadAttempts = 0;
  const MAX_RELOAD_ATTEMPTS = 3;

  // ── Overlay ─────────────────────────────────────────────────────────────────

  function showOverlay() {
    if (overlayEl) return;
    overlayEl = document.createElement('div');
    overlayEl.id = 'strixblock-twitch-overlay';
    Object.assign(overlayEl.style, {
      position:       'fixed',
      top:            '0',
      left:           '0',
      width:          '100%',
      height:         '100%',
      background:     '#0e0e10',
      zIndex:         '2147483647',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      pointerEvents:  'none',
      fontFamily:     'Inter, Roobert, sans-serif',
      color:          '#9147ff',
      gap:            '12px',
    });
    overlayEl.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 24 24" fill="#9147ff">
        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
      </svg>
      <span style="font-size:16px;font-weight:600;letter-spacing:1px;">StrixBlock — Skipping Ad</span>
      <span style="font-size:12px;color:#555;letter-spacing:1px;">Stream will resume shortly</span>
    `;
    document.body.appendChild(overlayEl);
  }

  function hideOverlay() {
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  }

  // ── Ad detection ─────────────────────────────────────────────────────────────

  function isAdPlaying() {
    // Countdown timer mid-roll / pre-roll
    if (document.querySelector('[data-a-target="video-ad-countdown"]')) return true;
    // Ad banner on player
    if (document.querySelector('.tw-ad-banner-display, [data-test-selector="ad-banner-default-wrapper"]')) return true;
    // Ad label bottom-left of player
    if (document.querySelector('.video-ad-label, [class*="VideoAdLabel"]')) return true;
    // Ad duration text present
    if (document.querySelector('[data-a-target="ad-text"], [class*="AdText"]')) return true;
    // Screenreader "Advertisement" text (Twitch injects this reliably)
    const srEls = document.querySelectorAll(
      '[class*="ScScreenreaderText"], [class*="tw-sr-only"], [class*="ScreenreaderText"]'
    );
    for (const el of srEls) {
      const t = el.textContent.trim();
      if (t === 'Advertisement' || t === 'Ad') return true;
    }
    // ARIA label on player container
    const playerContainer = document.querySelector(
      '.video-player__container, [data-a-target="video-player"]'
    );
    if (playerContainer) {
      const label = playerContainer.getAttribute('aria-label') || '';
      if (label.toLowerCase().includes('advertisement')) return true;
    }
    // Twitch embeds a purple "ad" pill
    const adPill = document.querySelector('[class*="tw-pill"][class*="ad"], [data-a-target*="ad-badge"]');
    if (adPill && adPill.offsetParent !== null) return true;

    return false;
  }

  // ── Player reload strategies ─────────────────────────────────────────────────

  function tryReloadStream() {
    reloadAttempts++;

    // Strategy 1: lowest latency mode toggle (forces HLS manifest refetch)
    const lowLatencyBtn = document.querySelector('[data-a-target="player-settings-button"]');

    // Strategy 2: theatre mode toggle
    const theatreBtn = document.querySelector('[data-a-target="player-theatre-mode-button"]');
    if (theatreBtn) {
      theatreBtn.click();
      setTimeout(() => theatreBtn.click(), 600);
      return;
    }

    // Strategy 3: pause/play to re-fetch playlist chunk
    const video = document.querySelector('video');
    if (video && !video.paused) {
      video.pause();
      setTimeout(() => {
        video.play().catch(() => {});
      }, 400);
      return;
    }

    // Strategy 4: force reload by setting src (last resort)
    if (video && reloadAttempts >= MAX_RELOAD_ATTEMPTS) {
      const currentSrc = video.src;
      if (currentSrc) {
        video.src = '';
        setTimeout(() => { video.src = currentSrc; video.play().catch(() => {}); }, 500);
      }
    }
  }

  // ── Ad lifecycle ─────────────────────────────────────────────────────────────

  function onAdStart() {
    if (adActive) return;
    adActive = true;
    reloadAttempts = 0;

    const video = document.querySelector('video');
    if (video) {
      savedVolume = video.volume > 0 ? video.volume : 1;
      video.muted  = true;
      video.volume = 0;
    }

    showOverlay();

    // First reload attempt at 600ms
    reloadTimer = setTimeout(tryReloadStream, 600);
    // Persistent retries: every 5s while ad is still playing
    const retryInterval = setInterval(() => {
      if (!adActive) { clearInterval(retryInterval); return; }
      if (reloadAttempts < MAX_RELOAD_ATTEMPTS) tryReloadStream();
    }, 5000);
    // Stop retrying after 30s (something else might be wrong)
    setTimeout(() => clearInterval(retryInterval), 30000);
  }

  function onAdEnd() {
    if (!adActive) return;
    adActive = false;
    clearTimeout(reloadTimer);

    const video = document.querySelector('video');
    if (video) {
      video.muted  = false;
      video.volume = savedVolume;
    }

    hideOverlay();
  }

  // ── Poll + observe ───────────────────────────────────────────────────────────

  function check() {
    if (isAdPlaying()) { onAdStart(); }
    else if (adActive) { onAdEnd(); }
  }

  setInterval(check, 300);

  const obs = new MutationObserver(check);
  function startObs() {
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-label', 'data-a-target', 'style'],
    });
  }
  document.body ? startObs() : document.addEventListener('DOMContentLoaded', startObs, { once: true });

  // Re-init on Twitch SPA navigation (React router)
  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      adActive = false;
      hideOverlay();
    }
  }, 1000);

})();
