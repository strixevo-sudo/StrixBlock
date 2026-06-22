// Runs in MAIN world — can modify the actual page window
// Applied to ALL pages via manifest <all_urls> entry
(function () {
  'use strict';

  if (!window.google) window.google = {};

  const AD_EVENT_TYPES = {
    CONTENT_PAUSE_REQUESTED: 'contentPauseRequested',
    CONTENT_RESUME_REQUESTED: 'contentResumeRequested',
    ALL_ADS_COMPLETED: 'allAdsCompleted',
    LOADED: 'loaded', STARTED: 'started', COMPLETE: 'complete',
    FIRST_QUARTILE: 'firstQuartile', MIDPOINT: 'midpoint',
    THIRD_QUARTILE: 'thirdQuartile', SKIPPED: 'skip',
    AD_BREAK_READY: 'adBreakReady', PAUSED: 'pause', RESUMED: 'resume',
  };

  function makeFakeAdsManager() {
    const listeners = {};
    const mgr = {
      _listeners: listeners,
      addEventListener: function(type, fn) { listeners[type] = fn; },
      removeEventListener: function() {},
      init: function() {},
      start: function() {
        // Immediately fire sequence: ads "started" then "complete" — no visual ad shown
        const fire = function(type) {
          const fn = listeners[type];
          if (fn) try { fn({ type: type, getAd: function() { return null; } }); } catch (_) {}
        };
        // Brief pause then immediate resume — bypasses YouTube's timeout detection
        setTimeout(function() {
          fire(AD_EVENT_TYPES.CONTENT_PAUSE_REQUESTED);
          setTimeout(function() {
            fire(AD_EVENT_TYPES.ALL_ADS_COMPLETED);
            fire(AD_EVENT_TYPES.CONTENT_RESUME_REQUESTED);
          }, 1);
        }, 1);
      },
      resize: function() {},
      destroy: function() {},
      getVolume: function() { return 1; },
      setVolume: function() {},
      getRemainingTime: function() { return 0; },
      pause: function() {},
      resume: function() {},
      isCustomPlaybackUsed: function() { return false; },
      getAdSkippableState: function() { return false; },
      skip: function() {},
    };
    return mgr;
  }

  const imaStub = {
    VERSION: '3.543.0',
    AdError: function () {},
    AdErrorEvent: { Type: { AD_ERROR: 'adError' } },
    AdEvent: { Type: AD_EVENT_TYPES },
    AdsManagerLoadedEvent: { Type: { ADS_MANAGER_LOADED: 'adsManagerLoaded' } },
    AdsLoader: function () {
      const self = this;
      self._listeners = {};
      self.addEventListener = function(type, fn) { self._listeners[type] = fn; };
      self.removeEventListener = function() {};
      self.requestAds = function() {
        // Fire ADS_MANAGER_LOADED after short delay so YouTube's setup code runs
        setTimeout(function() {
          const fn = self._listeners['adsManagerLoaded'];
          if (fn) {
            try {
              fn({ getAdsManager: function() { return makeFakeAdsManager(); } });
            } catch (_) {}
          }
        }, 100);
      };
      self.contentComplete = function() {};
      self.destroy = function() {};
      return self;
    },
    AdsRequest: function () {
      return { adTagUrl: '', linearAdSlotWidth: 0, linearAdSlotHeight: 0,
               nonLinearAdSlotWidth: 0, nonLinearAdSlotHeight: 0 };
    },
    AdDisplayContainer: function () { return { initialize: function() {}, destroy: function() {} }; },
    settings: {
      setVpaidMode: function() {}, setLocale: function() {},
      setDisableCustomPlaybackForIOS10Plus: function() {},
      setAutoPlayAdBreaks: function() {}, setNumRedirects: function() {},
    },
    UiElements: { AD_ATTRIBUTION: 'adAttribution', COUNTDOWN: 'countdown' },
    ViewMode: { NORMAL: 'normal', FULLSCREEN: 'fullscreen' },
    VpaidMode: { DISABLED: 0, ENABLED: 1, INSECURE: 2 },
  };

  try {
    Object.defineProperty(window.google, 'ima', {
      get: () => imaStub,
      set: () => {},
      configurable: false,
      enumerable: true,
    });
  } catch (_) {
    window.google.ima = imaStub;
  }

  // Spoof adsbygoogle
  try {
    if (!window.adsbygoogle) {
      Object.defineProperty(window, 'adsbygoogle', {
        get: () => ({ push: () => {} }),
        set: () => {},
        configurable: false,
      });
    }
  } catch (_) {}

  // Spoof googletag (GPT)
  try {
    if (!window.googletag) {
      window.googletag = {
        cmd: [],
        defineSlot: () => ({ addService: () => ({}), setTargeting: () => ({}) }),
        defineOutOfPageSlot: () => ({ addService: () => ({}) }),
        pubads: () => ({
          enableSingleRequest: () => {}, collapseEmptyDivs: () => {},
          enableLazyLoad: () => {}, refresh: () => {}, clear: () => {},
          addEventListener: () => {}, setTargeting: () => {}, getTargeting: () => [],
          disableInitialLoad: () => {},
        }),
        enableServices: () => {},
        display: () => {},
        destroySlots: () => true,
        sizeMapping: () => ({ addSize: () => ({}) , build: () => [] }),
      };
    }
  } catch (_) {}

  // Proactively stub popular tracker APIs so sites don't error when we block their scripts
  try {
    var noop = function() {};
    if (!window.dataLayer) window.dataLayer = [];
    if (!window.gtag) window.gtag = function() { window.dataLayer.push(arguments); };
    if (!window.ga) { window.ga = noop; window.ga.q = []; }
    if (!window._gaq) window._gaq = { push: noop };
    if (!window.fbq) {
      window.fbq = noop;
      window.fbq.loaded = true; window.fbq.version = '2.0'; window.fbq.queue = [];
      window._fbq = window.fbq;
    }
    if (!window._hsq) window._hsq = { push: noop };
    if (!window.twq) window.twq = noop;
    if (!window.ttq) window.ttq = { track: noop, identify: noop, page: noop };
    if (!window.snaptr) window.snaptr = noop;
    if (!window.criteo_q) window.criteo_q = [];
    if (!window.hj) {
      window.hj = function() { (window.hj.q = window.hj.q || []).push(arguments); };
      window._hjSettings = window._hjSettings || {};
    }
    if (!window.heap) window.heap = { track: noop, identify: noop, addUserProperties: noop };
    if (!window.clarity) window.clarity = noop;
    if (!window.FS) window.FS = { identify: noop, setUserVars: noop, event: noop };
    if (!window.pintrk) {
      window.pintrk = function() { (window.pintrk.queue = window.pintrk.queue || []).push(Array.prototype.slice.call(arguments)); };
      window.pintrk.version = '3000'; window.pintrk.loaded = true;
    }
    if (!window.rdt) { window.rdt = noop; window.rdt.version = '1.0'; }
    if (!window.qp) window.qp = noop;
    if (!window._vwo_code) window._vwo_code = { run: noop, finished: noop };
    if (!window.MktoForms2) window.MktoForms2 = { loadForm: noop, whenReady: noop };
    if (!window.Munchkin) window.Munchkin = { init: noop, munchkinFunction: noop };
    if (!window.hbspt) window.hbspt = { forms: { create: noop } };
  } catch (_) {}

  // Note: getComputedStyle override removed — it caused adblock tests to falsely
  // see hidden ad elements as visible. Anti-adblock bypass handled by bait divs instead.

  // Block common tracker beacon methods
  try {
    const origSendBeacon = navigator.sendBeacon.bind(navigator);
    const BEACON_BLOCKLIST = [
      'google-analytics', 'doubleclick', 'googlesyndication', 'googletagmanager',
      'facebook.com/tr', 'pixel.facebook', 'bat.bing', 'ads.linkedin',
      'analytics.tiktok', 'tr.snapchat', 'sentry.io', 'bugsnag.com',
      'hotjar.com', 'mouseflow', 'logrocket', 'fullstory', 'clarity.ms',
      'mixpanel.com', 'amplitude.com', 'segment.io', 'heap.io',
      'scorecardresearch', 'quantserve', 'omtrdc.net', 'demdex.net',
    ];
    navigator.sendBeacon = function (url, data) {
      const u = String(url).toLowerCase();
      if (BEACON_BLOCKLIST.some(b => u.includes(b))) return true;
      return origSendBeacon(url, data);
    };
  } catch (_) {}

  // Announce DNT/GPC to reduce tracking on sites that respect it
  try {
    Object.defineProperty(navigator, 'doNotTrack', { get: () => '1', configurable: true });
    Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true, configurable: true });
  } catch (_) {}

  // AudioContext fingerprinting protection
  try {
    const origGetChannelData = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = function (channel) {
      const data = origGetChannelData.call(this, channel);
      // Add tiny noise only to short buffers used for fingerprinting, not music
      if (data.length < 10000) {
        for (let i = 0; i < data.length; i += 50) {
          data[i] += 1e-7 * (Math.floor(i * 1.1) % 3 - 1);
        }
      }
      return data;
    };
  } catch (_) {}

  // WebGL fingerprinting — return consistent but slightly altered vendor/renderer strings
  try {
    const origGetParam = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (param) {
      if (param === 37445) return 'Intel Inc.';
      if (param === 37446) return 'Intel Iris OpenGL Engine';
      return origGetParam.call(this, param);
    };
  } catch (_) {}

  try {
    const origGetParam2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function (param) {
      if (param === 37445) return 'Intel Inc.';
      if (param === 37446) return 'Intel Iris OpenGL Engine';
      return origGetParam2.call(this, param);
    };
  } catch (_) {}

  // Spoof canvas fingerprinting (subtle noise without breaking rendering)
  try {
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    HTMLCanvasElement.prototype.toDataURL = function (...args) {
      const result = origToDataURL.apply(this, args);
      // Only add noise if this looks like a fingerprint canvas (small, not user-drawn)
      if (this.width <= 16 && this.height <= 16) {
        return result.slice(0, -5) + 'XXXXX';
      }
      return result;
    };
    CanvasRenderingContext2D.prototype.getImageData = function (x, y, w, h) {
      const data = origGetImageData.apply(this, arguments);
      // Subtle noise on tiny fingerprint canvases
      if (w <= 16 && h <= 16) {
        for (let i = 0; i < data.data.length; i += 100) {
          data.data[i] ^= 1;
        }
      }
      return data;
    };
  } catch (_) {}
})();
