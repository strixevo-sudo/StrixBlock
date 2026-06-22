(function () {
  'use strict';

  let lastAction = 0;

  const SKIP_SELECTORS = [
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button',
    '.ytp-skip-ad-button-modern',
    '.ytp-ad-skip-button-modern',
    '.ytp-ad-skip-button-slot .ytp-ad-skip-button',
    '.ytp-ad-skip-button-slot button',
    'button.ytp-skip-ad-button',
    '[class*="skip-ad"]',
    '[id*="skip-ad"]',
    '[class*="SkipAd"]',
    'button[aria-label*="Skip"]',
    'button[aria-label*="skip"]',
    '.videoAdUiSkipButton',
    '.ytp-ad-skip-button-container button',
  ].join(',');

  const CLOSE_SELECTORS = [
    '.ytp-ad-overlay-close-button',
    '.ytp-ad-overlay-panel .ytp-ad-overlay-close-button',
    '.ytp-ad-text-overlay .ytp-ad-overlay-close-button',
    '.ad-showing .ytp-ad-overlay-close-button',
    '[class*="ad-overlay"] [class*="close"]',
  ].join(',');

  function skipAd() {
    const now = Date.now();
    if (now - lastAction < 180) return;

    const player = document.querySelector('.html5-video-player');
    const video  = document.querySelector('video.html5-main-video') ||
                   document.querySelector('video');

    if (!player && !video) return;

    const adShowing = player && (
      player.classList.contains('ad-showing') ||
      player.classList.contains('ad-interrupting')
    );

    // 1. Try clicking any visible skip button
    const skipBtn = document.querySelector(SKIP_SELECTORS);
    if (skipBtn && (skipBtn.offsetParent !== null || skipBtn.offsetWidth > 0)) {
      lastAction = now;
      skipBtn.click();
      return;
    }

    // 2. Jump to end to force skip when no button is visible yet
    if (adShowing && video && video.duration && isFinite(video.duration) && video.duration > 0) {
      lastAction = now;
      video.currentTime = video.duration;
      video.dispatchEvent(new Event('ended'));
      return;
    }

    // 3. Close overlay ads
    const closeBtn = document.querySelector(CLOSE_SELECTORS);
    if (closeBtn && closeBtn.offsetParent !== null) {
      lastAction = now;
      closeBtn.click();
    }

    // 4. Hide ad badges / promoted labels
    document.querySelectorAll(
      '.ytp-ad-badge, .ytp-ad-simple-ad-badge, .ytp-ad-timed-pie-countdown-renderer'
    ).forEach(el => { el.style.cssText = 'display:none!important'; });
  }

  // Mute during ad and restore after (backup to jump-to-end)
  let savedVolume = null;
  function muteGuard() {
    const player = document.querySelector('.html5-video-player');
    const video  = document.querySelector('video.html5-main-video') || document.querySelector('video');
    if (!player || !video) return;
    const adShowing = player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
    if (adShowing && !video.muted) {
      savedVolume = video.volume;
      video.muted = true;
      video.volume = 0;
    } else if (!adShowing && video.muted && savedVolume !== null) {
      video.muted = false;
      video.volume = savedVolume;
      savedVolume = null;
    }
  }

  setInterval(skipAd, 200);
  setInterval(muteGuard, 300);

  const observer = new MutationObserver(() => {
    skipAd();
    muteGuard();
  });

  function startObserver() {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden'],
    });
  }

  if (document.body) {
    startObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  }

  // Auto-resume if paused by enforcement dialog (not by the user)
  setInterval(function() {
    const player = document.querySelector('.html5-video-player');
    const video  = document.querySelector('video.html5-main-video') || document.querySelector('video');
    if (!player || !video) return;
    const adShowing = player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
    if (adShowing || !video.paused) return;
    // Only resume if an enforcement or adblock dialog is present
    const enforcement = document.querySelector(
      'ytd-enforcement-message-view-model, tp-yt-paper-dialog[id="yt-confirm-dialog"], ytd-popup-container yt-confirm-dialog-renderer'
    );
    if (enforcement) {
      const container = enforcement.closest('ytd-popup-container, tp-yt-paper-dialog') || enforcement;
      container.remove();
      video.play().catch(() => {});
    }
  }, 600);

  // Handle YouTube SPA navigation
  document.addEventListener('yt-navigate-finish', () => {
    lastAction = 0;
    savedVolume = null;
  });
})();
