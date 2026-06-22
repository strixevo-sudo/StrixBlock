(function () {
  'use strict';

  let lastAction = 0;
  let savedVolume = null;

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

  function getPlayer() {
    return document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
  }

  function getVideo() {
    const p = getPlayer();
    if (p) { const v = p.querySelector('video'); if (v) return v; }
    return document.querySelector('video.html5-main-video') || document.querySelector('video');
  }

  function isAdShowing() {
    const player = getPlayer();
    if (!player) return false;
    return (
      player.classList.contains('ad-showing') ||
      player.classList.contains('ad-interrupting')
    );
  }

  function skipAd() {
    const now = Date.now();
    if (now - lastAction < 100) return;

    const video = getVideo();
    const adShowing = isAdShowing();

    // 1. Click visible skip button
    const skipBtn = document.querySelector(SKIP_SELECTORS);
    if (skipBtn && (skipBtn.offsetParent !== null || skipBtn.offsetWidth > 0)) {
      lastAction = now;
      skipBtn.click();
      return;
    }

    // 2. Jump to end (skippable pre-rolls and mid-rolls)
    if (adShowing && video && video.duration && isFinite(video.duration) && video.duration > 0) {
      lastAction = now;
      video.currentTime = video.duration;
      video.dispatchEvent(new Event('ended'));
      return;
    }

    // 3. Close overlay/banner ads
    const closeBtn = document.querySelector(CLOSE_SELECTORS);
    if (closeBtn && closeBtn.offsetParent !== null) {
      lastAction = now;
      closeBtn.click();
    }

    // 4. Hide ad badges
    document.querySelectorAll(
      '.ytp-ad-badge, .ytp-ad-simple-ad-badge, .ytp-ad-timed-pie-countdown-renderer'
    ).forEach(el => { el.style.cssText = 'display:none!important'; });
  }

  function muteGuard() {
    const player = getPlayer();
    const video = getVideo();
    if (!player || !video) return;
    const adShowing = isAdShowing();
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

  setInterval(skipAd, 100);
  setInterval(muteGuard, 200);

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

  // Remove enforcement/adblock dialog and resume video
  setInterval(function() {
    const player = getPlayer();
    const video = getVideo();
    if (!player || !video) return;
    const adShowing = isAdShowing();
    if (adShowing || !video.paused) return;
    const enforcement = document.querySelector(
      'ytd-enforcement-message-view-model, tp-yt-paper-dialog[id="yt-confirm-dialog"], ytd-popup-container yt-confirm-dialog-renderer'
    );
    if (enforcement) {
      const container = enforcement.closest('ytd-popup-container, tp-yt-paper-dialog') || enforcement;
      container.remove();
      video.play().catch(() => {});
    }
  }, 500);

  document.addEventListener('yt-navigate-finish', () => {
    lastAction = 0;
    savedVolume = null;
  });
})();
