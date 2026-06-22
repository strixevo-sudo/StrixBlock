// StrixBlock v2 — MAIN world spoof script
// Runs in the page's JavaScript context. No Chrome APIs available here.
// All code wrapped in IIFE to avoid polluting global scope.

(function strixSpoof() {
  'use strict';

  // ─── Utility ───────────────────────────────────────────────────────────────

  const noop = (): void => {};

  function defineProperty(
    obj: object,
    key: string,
    value: unknown,
    writable = false
  ): void {
    try {
      Object.defineProperty(obj, key, {
        get: () => value,
        set: writable ? (v: unknown) => { value = v; } : noop,
        configurable: true,
        enumerable: false,
      });
    } catch {
      // Ignore — some properties may be non-configurable
    }
  }

  // ─── Fetch Interception (YouTube ad endpoints) ────────────────────────────

  const AD_FETCH_PATTERNS = [
    '/pagead/',
    '/api/stats/ads',
    '/pcs/activeview',
    '/api/stats/qoe',
    'doubleclick.net',
    'googleads.g.',
    'ads.youtube.com',
    'googlesyndication.com',
    '/api/lounge/',
    '/youtubei/v1/next?',
  ];

  const _origFetch = window.fetch;
  if (typeof _origFetch === 'function') {
    (window as typeof window & { fetch: typeof fetch }).fetch = function (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      for (const pattern of AD_FETCH_PATTERNS) {
        if (url.includes(pattern)) {
          return Promise.resolve(new Response('', { status: 200 }));
        }
      }
      return _origFetch.call(this, input, init);
    };
  }

  // ─── XHR Interception ────────────────────────────────────────────────────

  const _origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: [boolean?, string?, string?]
  ): void {
    const urlStr = typeof url === 'string' ? url : url.href;
    const origCall = _origOpen as (...args: unknown[]) => void;
    for (const pattern of AD_FETCH_PATTERNS) {
      if (urlStr.includes(pattern)) {
        return origCall.call(this, method, 'data:text/plain,', ...rest);
      }
    }
    return origCall.call(this, method, url, ...rest);
  };

  // ─── sendBeacon Block for tracker domains ────────────────────────────────

  const BEACON_BLOCK_PATTERNS = [
    'doubleclick.net', 'google-analytics.com', 'facebook.com/tr',
    'hotjar.com', 'mouseflow.com', 'mixpanel.com', 'amplitude.com',
    'segment.com', 'segment.io', 'fullstory.com', 'logrocket.com',
    'bat.bing.com', 'ads.linkedin.com', 'analytics.tiktok.com',
    'tr.snapchat.com', 'ct.pinterest.com',
  ];

  if (navigator.sendBeacon) {
    const _origSendBeacon = navigator.sendBeacon.bind(navigator);
    Object.defineProperty(navigator, 'sendBeacon', {
      value: function (url: string, data?: BodyInit | null): boolean {
        for (const p of BEACON_BLOCK_PATTERNS) {
          if (url.includes(p)) return true; // Silently swallow
        }
        return _origSendBeacon(url, data ?? undefined);
      },
      configurable: true,
      writable: true,
    });
  }

  // ─── google.ima Spoof ────────────────────────────────────────────────────

  const imaEventTypes = {
    COMPLETE: 'complete',
    CONTENT_PAUSE_REQUESTED: 'contentPauseRequested',
    CONTENT_RESUME_REQUESTED: 'contentResumeRequested',
    ALL_ADS_COMPLETED: 'allAdsCompleted',
    LOADED: 'loaded',
    STARTED: 'started',
    PAUSED: 'paused',
    RESUMED: 'resumed',
    SKIPPED: 'skipped',
    SKIPPABLE_STATE_CHANGED: 'skippableStateChanged',
  };

  class FakeAdsManager {
    private listeners: Map<string, Array<() => void>> = new Map();

    addEventListener(type: string, handler: () => void): void {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type)!.push(handler);
    }
    removeEventListener(type: string, handler: () => void): void {
      const arr = this.listeners.get(type);
      if (arr) {
        const idx = arr.indexOf(handler);
        if (idx !== -1) arr.splice(idx, 1);
      }
    }
    private emit(type: string): void {
      const handlers = this.listeners.get(type) ?? [];
      for (const h of handlers) {
        try { h(); } catch { /* ignore */ }
      }
    }
    init(): void { this.start(); }
    start(): void {
      // Immediately signal that all ads are complete
      setTimeout(() => {
        this.emit(imaEventTypes.CONTENT_RESUME_REQUESTED);
        this.emit(imaEventTypes.ALL_ADS_COMPLETED);
      }, 0);
    }
    stop(): void { noop(); }
    destroy(): void { noop(); }
    pause(): void { noop(); }
    resume(): void { noop(); }
    skip(): void { noop(); }
    getVolume(): number { return 1; }
    setVolume(): void { noop(); }
    getRemainingTime(): number { return 0; }
    getCurrentAd(): null { return null; }
    getAdSkippableState(): boolean { return true; }
    getCuePoints(): number[] { return []; }
    isCustomPlaybackUsed(): boolean { return false; }
  }

  class FakeAdsLoader {
    addEventListener(): void { noop(); }
    removeEventListener(): void { noop(); }
    requestAds(): void {
      // Do nothing — no ads to load
    }
    contentComplete(): void { noop(); }
    destroy(): void { noop(); }
    getSettings(): object { return {}; }
  }

  class FakeAdsRenderingSettings {}
  class FakeAdsRequest { adTagUrl = ''; }
  class FakeImaSdkSettings {
    setAutoPlayAdBreaks(): void { noop(); }
    setDisableCustomPlaybackForIOS10Plus(): void { noop(); }
    setLocale(): void { noop(); }
    setNumRedirects(): void { noop(); }
    setPlayerType(): void { noop(); }
    setPlayerVersion(): void { noop(); }
    setPpid(): void { noop(); }
    setVpaidMode(): void { noop(); }
  }

  const fakeIma = {
    AdDisplayContainer: class {
      initialize(): void { noop(); }
      destroy(): void { noop(); }
    },
    AdError: class extends Error {
      getErrorCode(): number { return 0; }
      getInnerError(): null { return null; }
      getMessage(): string { return ''; }
      getType(): string { return ''; }
      getVastErrorCode(): number { return 0; }
    },
    AdErrorEvent: { Type: { AD_ERROR: 'adError' } },
    AdEvent: { Type: imaEventTypes },
    AdsLoader: FakeAdsLoader,
    AdsManager: FakeAdsManager,
    AdsManagerLoadedEvent: { Type: { ADS_MANAGER_LOADED: 'adsManagerLoaded' } },
    AdsRenderingSettings: FakeAdsRenderingSettings,
    AdsRequest: FakeAdsRequest,
    CompanionAdSelectionSettings: class {},
    ImaSdkSettings: { VpaidMode: { DISABLED: 0, ENABLED: 1, INSECURE: 2 } },
    OmidVerificationVendor: { OTHER: 1 },
    OmidAccessMode: { FULL: 'full', DOMAIN: 'domain', LIMITED: 'limited' },
    UiElements: { AD_ATTRIBUTION: 'adAttribution', COUNTDOWN: 'countdown' },
    ViewMode: { FULLSCREEN: 'fullscreen', NORMAL: 'normal' },
    VERSION: '3.569.0',
    settings: new FakeImaSdkSettings(),
  };

  try {
    if (!('google' in window)) {
      defineProperty(window, 'google', { ima: fakeIma });
    } else {
      const g = (window as unknown as { google: Record<string, unknown> }).google;
      if (!g.ima) {
        g.ima = fakeIma;
      }
    }
  } catch { /* ignore */ }

  // ─── adsbygoogle / googletag Spoof ───────────────────────────────────────

  try {
    // adsbygoogle: make push() a no-op
    if (!(window as unknown as Record<string, unknown>)['adsbygoogle']) {
      const fakeAdsbyGoogle: unknown[] & { push: (o: unknown) => void; loaded?: boolean } = Object.assign([], {
        push: noop,
        loaded: true,
      });
      defineProperty(window, 'adsbygoogle', fakeAdsbyGoogle, true);
    }
  } catch { /* ignore */ }

  try {
    // googletag
    const fakeGoogletag = {
      cmd: { push: (fn: () => void) => { try { fn(); } catch { /* ignore */ } } },
      defineSlot: () => null,
      enableServices: noop,
      display: noop,
      destroySlots: noop,
      pubads: () => ({
        addEventListener: noop,
        removeEventListener: noop,
        enableLazyLoad: noop,
        setTargeting: noop,
        collapseEmptyDivs: noop,
        refresh: noop,
        disableInitialLoad: noop,
        enableVideoAds: noop,
        getTargeting: () => [],
        getTargetingKeys: () => [],
        updateCorrelator: noop,
        clear: noop,
        setPrivacySettings: noop,
      }),
      sizeMapping: () => ({ addSize: () => ({}), build: () => null }),
      companionAds: () => ({ setRefreshUnfilledSlots: noop }),
      content: () => ({ setContent: noop }),
      apiReady: true,
      openConsole: noop,
    };

    if (!(window as unknown as Record<string, unknown>)['googletag']) {
      defineProperty(window, 'googletag', fakeGoogletag, true);
    }
  } catch { /* ignore */ }

  // ─── Tracker API Spoof ────────────────────────────────────────────────────

  const trackerNoops: string[] = [
    'fbq', '_fbq',       // Facebook pixel
    'ga', '_ga',         // Google Analytics (legacy)
    '_hsq',              // HubSpot
    'ttq',               // TikTok
    'snaptr',            // Snapchat
    'hj', '_hj',         // Hotjar
    'heap',              // Heap
    'clarity',           // Microsoft Clarity
    'mixpanel',          // Mixpanel
    'amplitude',         // Amplitude
    '_vis_opt_queue',    // VWO
    '_kiq',              // Kissmetrics
    'Intercom',          // Intercom
    'zaius',             // Zaius
    'pintrk',            // Pinterest tag
  ];

  for (const name of trackerNoops) {
    if (!(window as unknown as Record<string, unknown>)[name]) {
      try {
        const fn = function (): void { noop(); };
        (fn as unknown as Record<string, unknown>)['q'] = [];
        (fn as unknown as Record<string, unknown>)['push'] = noop;
        defineProperty(window, name, fn, true);
      } catch { /* ignore */ }
    }
  }

  // gtag
  try {
    if (!(window as unknown as Record<string, unknown>)['gtag']) {
      const fakeGtag = function (): void { noop(); };
      defineProperty(window, 'gtag', fakeGtag, true);
      defineProperty(window, 'dataLayer', { push: noop }, true);
    }
  } catch { /* ignore */ }

  // ─── Privacy: doNotTrack, globalPrivacyControl ────────────────────────────

  try {
    defineProperty(navigator, 'doNotTrack', '1');
  } catch { /* ignore */ }

  try {
    defineProperty(navigator, 'globalPrivacyControl', true);
  } catch { /* ignore */ }

  // ─── AudioBuffer Fingerprint Noise ───────────────────────────────────────

  try {
    const _origGetChannelData = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = function (channel: number): Float32Array<ArrayBuffer> {
      const data = _origGetChannelData.call(this, channel);
      // Add tiny imperceptible noise to defeat audio fingerprinting
      for (let i = 0; i < data.length; i += 100) {
        data[i] += Math.random() * 1e-9;
      }
      return data;
    };
  } catch { /* ignore */ }

  // ─── WebGL Fingerprint Spoof ──────────────────────────────────────────────

  try {
    const getParam = WebGLRenderingContext.prototype.getParameter;
    const UNMASKED_VENDOR = 0x9245;
    const UNMASKED_RENDERER = 0x9246;
    WebGLRenderingContext.prototype.getParameter = function (param: number): unknown {
      if (param === UNMASKED_VENDOR) return 'Intel Inc.';
      if (param === UNMASKED_RENDERER) return 'Intel Iris OpenGL Engine';
      return getParam.call(this, param);
    };
  } catch { /* ignore */ }

  try {
    const getParam2 = WebGL2RenderingContext.prototype.getParameter;
    const UNMASKED_VENDOR = 0x9245;
    const UNMASKED_RENDERER = 0x9246;
    WebGL2RenderingContext.prototype.getParameter = function (param: number): unknown {
      if (param === UNMASKED_VENDOR) return 'Intel Inc.';
      if (param === UNMASKED_RENDERER) return 'Intel Iris OpenGL Engine';
      return getParam2.call(this, param);
    };
  } catch { /* ignore */ }

  // ─── Canvas Fingerprint Noise ─────────────────────────────────────────────

  try {
    const _origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (
      type?: string,
      quality?: unknown
    ): string {
      // Only noise small canvases used for fingerprinting (large ones are real content)
      if (this.width * this.height < 16384) {
        const ctx = this.getContext('2d');
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, this.width, this.height);
          // Flip one pixel value by 1 — imperceptible but breaks fingerprint
          if (imageData.data.length > 3) {
            imageData.data[0] = (imageData.data[0] + 1) % 256;
            ctx.putImageData(imageData, 0, 0);
          }
        }
      }
      return _origToDataURL.call(this, type, quality as number | undefined);
    };
  } catch { /* ignore */ }

})();
