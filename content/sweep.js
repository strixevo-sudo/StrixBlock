(function () {
  'use strict';

  const AD_SIZES = new Set([
    '300x250', '728x90', '160x600', '320x50', '468x60',
    '970x250', '970x90', '336x280', '200x200', '250x250',
    '120x600', '300x600', '320x100', '480x320', '300x50',
    '300x1050', '970x66', '320x480', '640x480',
  ]);

  const AD_FRAGMENTS = [
    // Core ad networks
    'google_ads', 'googlead', 'googlesyndication', 'adsbygoogle',
    'doubleclick', 'dclk', 'taboola', 'outbrain', 'revcontent',
    'mgid_', 'criteo', 'appnexus', 'adnxs', 'pubmatic',
    'rubiconproject', 'openx', 'districtm', 'indexexchange',
    'sharethrough', 'spotx', 'sovrn', 'lijit',
    'teads', 'freewheel', 'triplelift', 'vidazoo', 'connatix',
    'sharethrough', 'magnite', 'smartadserver', 'seedtag',
    // Ad container classes/IDs
    'adsbox', 'ads-container', 'ad-container', 'ad-slot', 'ad-unit',
    'ad-banner', 'ad-wrapper', 'ad_unit', 'ad_slot', 'ad_banner',
    'advert_container', 'advert-slot',
    'advertisement', 'sponsored-content', 'native-ad', 'native_ad',
    'dfp-ad', 'header-bidding', 'prebid-container', 'prebid-ad',
    'gpt-ad', 'div-gpt-ad', 'google-auto-placed',
    // Specific patterns
    'ad-leaderboard', 'ad-halfpage', 'ad-skyscraper', 'ad-rectangle',
    'ad-megabanner', 'ad-pushdown', 'ad-interstitial',
    'sticky-ad', 'floor-ad', 'banner-ad', 'sidebar-ad',
    'ezoic-ad', 'mediavine-ad', 'raptive-ad',
    'carbonads', 'buysellads', 'adzerk',
  ];

  // Phrases used in aria-label / title to mark ad content
  const AD_ARIA_PHRASES = ['advertisement', 'sponsored', 'ads by', 'promoted'];

  const PROTECTED_IDS = new Set([
    'strixblock-twitch-overlay', 'ad-bait-strixblock', 'ad-ins-bait-strixblock',
    'player', 'video-player', 'main-content',
    'chat', 'content', 'header', 'footer', 'nav', 'sidebar',
  ]);

  function sizeStr(el) {
    return `${el.offsetWidth}x${el.offsetHeight}`;
  }

  function matchesAdFragment(str) {
    if (!str) return false;
    const low = str.toLowerCase();
    return AD_FRAGMENTS.some(f => low.includes(f));
  }

  function matchesAdAria(str) {
    if (!str) return false;
    const low = str.toLowerCase();
    return AD_ARIA_PHRASES.some(p => low.includes(p));
  }

  function isAdElement(el) {
    if (!el) return false;
    if (PROTECTED_IDS.has(el.id)) return false;
    if (el.querySelector && el.querySelector('video')) return false;
    // Never hide YouTube's core navigation chrome
    if (el.closest && el.closest('ytd-masthead, #masthead-container, ytd-searchbox, #search')) return false;

    const tag = el.tagName;
    const cls = el.className && typeof el.className === 'string' ? el.className : '';
    const id  = el.id || '';

    if (tag === 'IFRAME') {
      const src = el.src || el.getAttribute('src') || '';
      if (matchesAdFragment(src)) return true;
      if (AD_SIZES.has(sizeStr(el))) return true;
    }

    if (matchesAdFragment(cls) || matchesAdFragment(id)) return true;

    const ariaLabel = el.getAttribute('aria-label') || '';
    const title = el.getAttribute('title') || '';
    if (matchesAdAria(ariaLabel) || matchesAdAria(title)) return true;

    if (el.attributes) {
      for (const attr of el.attributes) {
        if ((attr.name === 'data-ad-client' || attr.name === 'data-ad-slot' ||
             attr.name === 'data-adunit' ||
             attr.name === 'data-taboola-id' || attr.name === 'data-hb' ||
             attr.name === 'data-prebid' || attr.name === 'data-google-av-cxn')) return true;
        if (attr.name.startsWith('data-') && matchesAdFragment(attr.value)) return true;
      }
    }

    return false;
  }

  let sweepTimer = null;

  function hideEl(el) {
    el.style.cssText = 'display:none!important;visibility:hidden!important;height:0!important;overflow:hidden!important;pointer-events:none!important;';
  }

  function sweepAds() {
    document.querySelectorAll(
      'iframe, ins, div[id], div[class], article[class], section[class], aside, [data-ad-client], [data-ad-slot], [data-taboola-id], [id^="div-gpt-ad"], [id^="google_ads_iframe"]'
    ).forEach(el => {
      if (isAdElement(el) && el.parentNode) hideEl(el);
    });

    // Also sweep by high z-index + ad-like positioning (overlay ads)
    document.querySelectorAll('div[style*="z-index"]').forEach(el => {
      const st = el.style;
      const zi = parseInt(st.zIndex || '0', 10);
      if (zi > 9000 && (st.position === 'fixed' || st.position === 'absolute')) {
        const cls = el.className || '';
        const id  = el.id || '';
        if (matchesAdFragment(cls) || matchesAdFragment(id)) hideEl(el);
      }
    });
  }

  function debouncedSweep() {
    clearTimeout(sweepTimer);
    sweepTimer = setTimeout(sweepAds, 400);
  }

  const obs = new MutationObserver(debouncedSweep);

  function init() {
    sweepAds();
    obs.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
