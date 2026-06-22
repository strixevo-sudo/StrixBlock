(function () {
  'use strict';

  let inputFocused = false;
  document.addEventListener('focusin',  e => { if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) inputFocused = true; }, true);
  document.addEventListener('focusout', e => { if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) inputFocused = false; }, true);

  // Selectors used by common anti-adblock walls
  const WALL_SELECTORS = [
    '[class*="adblock-detected"]',
    '[class*="adblock-wall"]',
    '[class*="adblock-message"]',
    '[class*="adblocker-detected"]',
    '[class*="ad-block-notification"]',
    '[class*="disable-ad-block"]',
    '[class*="adblock-notice"]',
    '[class*="adblock-modal"]',
    '[class*="ad-blocker-modal"]',
    '[class*="ab-notice"]',
    '[class*="ab-modal"]',
    '[id*="adblock-detected"]',
    '[id*="adblock-wall"]',
    '[id*="adblock-overlay"]',
    '[id*="ab-detected"]',
    '[id*="AdBlocker"]',
    '[class*="AdBlocker"]',
    '[class*="adBlocker"]',
    '.adblock-overlay',
    '.ablock-overlay',
    '#adb_overlay',
    '#adblock_overlay',
    '#adblock-notice',
    '.adblock-notice',
    '#adblocker',
    '.adblocker-popup',
    '.anti-adblock',
    '.anti_adblock',
    '[data-adblock]',
    '[data-ab-modal]',
    '[class*="paywall-ab"]',
    '[class*="paywallAB"]',
    '.js-adblock-modal',
    '#adblock-modal',
    '#ab-popup',
    '.ab-popup',
    '#ad-block-overlay',
    '.ad-block-overlay',
    '[class*="no-ad-notice"]',
    '[class*="ads-blocked"]',
    '[class*="blocked-ads-notice"]',
    '[id*="ab-overlay"]',
    '[id*="ABOverlay"]',
  ].join(',');

  // Phrases that appear in anti-adblock messages
  const WALL_PHRASES = [
    'adblock',
    'ad blocker',
    'ad-blocker',
    'disable your ad',
    'turn off your ad',
    'whitelist',
    'please allow ads',
    'allow advertising',
  ];

  // Body-class patterns added by anti-adblock detectors
  const ADBLOCK_BODY_CLASSES = [
    'adblock-detected', 'adblocker-detected', 'ads-blocked',
    'is-adblocked', 'has-adblock', 'adblock-active',
    'js-adblock', 'body-adblock',
  ];

  function removeWalls() {
    if (inputFocused) return;
    // Remove known anti-adblock overlay/modal elements
    document.querySelectorAll(WALL_SELECTORS).forEach(el => {
      if (el && el.offsetParent !== null) el.remove();
    });

    // Strip anti-adblock classes added to <body>/<html>
    const targets = [document.body, document.documentElement];
    targets.forEach(el => {
      if (!el) return;
      ADBLOCK_BODY_CLASSES.forEach(cls => el.classList && el.classList.remove(cls));
    });

    // Unlock body scroll that anti-adblock walls often set
    if (document.body) {
      const bs = document.body.style;
      if (bs.overflow === 'hidden' || bs.overflow === 'hidden !important') {
        const hasLegitModal = document.querySelector(
          'dialog[open], [role="dialog"]:not([class*="ad"]), .modal:not([class*="ad"])'
        );
        if (!hasLegitModal) {
          bs.overflow = '';
          bs.position = '';
        }
      }
    }
  }

  // ── YouTube-specific anti-adblock handling ───────────────────────────────

  function handleYouTubeWall() {
    if (!location.hostname.includes('youtube.com')) return;
    const ytDialogs = document.querySelectorAll(
      'ytd-enforcement-message-view-model, ytd-popup-container tp-yt-paper-dialog, #dialog, .yt-confirm-dialog-renderer'
    );
    let removedDialog = false;
    ytDialogs.forEach(el => {
      const text = el.innerText || '';
      if (
        text.toLowerCase().includes('ad blocker') ||
        text.toLowerCase().includes('adblocker') ||
        text.toLowerCase().includes('ads help keep') ||
        text.toLowerCase().includes('allow google to show')
      ) {
        el.remove();
        removedDialog = true;
        const video = document.querySelector('video');
        if (video && video.paused) video.play().catch(() => {});
      }
    });
    // Only remove the backdrop if we actually removed an enforcement dialog
    // (backdrop is also used by search suggestions — removing it unconditionally breaks search)
    if (removedDialog) {
      const backdrop = document.querySelector('tp-yt-iron-overlay-backdrop');
      if (backdrop) backdrop.remove();
    }
  }

  // ── Spoof the `adsbygoogle` global so sites think ads are loaded ─────────
  try {
    if (!window.adsbygoogle) {
      Object.defineProperty(window, 'adsbygoogle', {
        get: () => ({ push: () => {} }),
        set: () => {},
        configurable: true,
      });
    }
  } catch (_) {}

  // Spoof `googletag` so header bidding / GPT scripts don't throw
  try {
    if (!window.googletag) {
      window.googletag = {
        cmd: [],
        defineSlot: () => ({ addService: () => ({}), setTargeting: () => ({}) }),
        pubads: () => ({
          enableSingleRequest: () => {},
          collapseEmptyDivs: () => {},
          enableLazyLoad: () => {},
          refresh: () => {},
          addEventListener: () => {},
          setTargeting: () => {},
        }),
        enableServices: () => {},
        display: () => {},
        destroySlots: () => {},
      };
    }
  } catch (_) {}

  // Inject fake bait elements so anti-adblock detectors think ads loaded
  try {
    const bait = document.createElement('div');
    bait.className = 'ad ads adsbox doubleclick ad-placement carbon-ads pub_300x250 banner-ads adsbygoogle';
    bait.id = 'ad-bait-strixblock';
    // 300x250 IAB size but hidden off-screen — convinces size-check detectors
    bait.style.cssText = [
      'display:block!important', 'height:250px!important', 'width:300px!important',
      'position:fixed!important', 'top:-9999px!important', 'left:-9999px!important',
      'pointer-events:none!important', 'visibility:visible!important', 'opacity:1!important',
    ].join(';');
    bait.setAttribute('data-ad-client', 'ca-pub-0000000000000000');
    bait.setAttribute('data-ad-slot', '0000000000');
    document.documentElement.appendChild(bait);

    // Also inject an <ins class="adsbygoogle"> to fool adsense detectors
    const insEl = document.createElement('ins');
    insEl.className = 'adsbygoogle';
    insEl.id = 'ad-ins-bait-strixblock';
    insEl.style.cssText = 'display:block!important;height:90px!important;width:728px!important;position:fixed!important;top:-9999px!important;left:-9999px!important;pointer-events:none!important;';
    insEl.setAttribute('data-ad-client', 'ca-pub-0000000000000000');
    insEl.setAttribute('data-ad-slot', '1111111111');
    document.documentElement.appendChild(insEl);
  } catch (_) {}


  // Run removal immediately and on DOM changes
  removeWalls();
  handleYouTubeWall();

  let wallTimer = null;
  const obs = new MutationObserver(() => {
    clearTimeout(wallTimer);
    wallTimer = setTimeout(() => { removeWalls(); handleYouTubeWall(); }, 300);
  });
  function startObs() {
    obs.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'id'],
    });
  }

  if (document.body) {
    startObs();
  } else {
    document.addEventListener('DOMContentLoaded', startObs, { once: true });
  }
})();
