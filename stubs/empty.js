// StrixBlock — silent tracking stub
// This file is served in place of blocked tracking/ad scripts to prevent errors.
(function() {
  'use strict';

  var noop = function() {};
  var noopReturn = function() { return {}; };

  // GA4 / gtag stub
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function() { window.dataLayer.push(arguments); };

    // UA stub
    window.ga = window.ga || function() {};
    window.ga.q = [];
    window.ga.l = Date.now ? Date.now() : +new Date();
    window._gaq = window._gaq || { push: noop };

    // Facebook Pixel stub
    window.fbq = window.fbq || function() {};
    window._fbq = window._fbq || window.fbq;
    window.fbq.loaded = true;
    window.fbq.version = '2.0';
    window.fbq.queue = [];

    // HubSpot stub
    window._hsq = window._hsq || { push: noop };

    // Mixpanel stub
    window.mixpanel = window.mixpanel || {
      track: noop, identify: noop, people: { set: noop }, init: noop,
      track_links: noop, track_forms: noop, register: noop, opt_out_tracking: noop,
    };

    // Amplitude stub
    window.amplitude = window.amplitude || {
      getInstance: function() {
        return { logEvent: noop, identify: noop, setUserId: noop, init: noop };
      }
    };

    // Segment / analytics.js stub
    window.analytics = window.analytics || {
      track: noop, page: noop, identify: noop, group: noop, alias: noop,
      ready: function(fn) { if (fn) setTimeout(fn, 0); },
    };

    // Hotjar stub
    window.hj = window.hj || function() { (window.hj.q = window.hj.q || []).push(arguments); };
    window._hjSettings = window._hjSettings || {};

    // FullStory stub
    window.FS = window.FS || {
      identify: noop, setUserVars: noop, event: noop, shutdown: noop,
    };

    // Clarity stub
    window.clarity = window.clarity || function() {};

    // Heap stub
    window.heap = window.heap || {
      track: noop, identify: noop, addUserProperties: noop, addEventProperties: noop,
    };

    // Sentry stub
    if (!window.Sentry) {
      window.Sentry = {
        init: noop, captureException: noop, captureMessage: noop,
        withScope: function(fn) { fn({ setTag: noop, setUser: noop, setExtra: noop }); },
        configureScope: function(fn) { fn({ setTag: noop, setUser: noop }); },
        setUser: noop, setTag: noop,
      };
    }

    // Twitter Pixel stub
    window.twq = window.twq || function() {};

    // LinkedIn Insight stub
    window._linkedin_partner_id = window._linkedin_partner_id || '';
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];

    // TikTok Pixel stub
    window.ttq = window.ttq || { track: noop, identify: noop, page: noop };

    // Snap Pixel stub
    window.snaptr = window.snaptr || function() {};

    // Criteo stub
    window.criteo_q = window.criteo_q || [];

    // Outbrain stub
    window.OBR = window.OBR || { extern: { researchWidget: noop } };
    window.obtrack = window.obtrack || function() {};

    // Pinterest Tag stub (pintrk)
    window.pintrk = window.pintrk || function() {
      (window.pintrk.queue = window.pintrk.queue || []).push(Array.prototype.slice.call(arguments));
    };
    window.pintrk.version = '3000';
    window.pintrk.loaded = true;

    // Reddit Pixel stub
    window.rdt = window.rdt || function() {};
    window.rdt.version = '1.0';

    // Quora Pixel stub
    window.qp = window.qp || function() {};

    // VWO (Visual Website Optimizer) stub
    window._vwo_code = window._vwo_code || { run: noop, finished: noop };

    // Drift chat (tracking portion) stub
    window.drift = window.drift || {
      load: noop, on: noop, track: noop, identify: noop, setUserAttributes: noop,
      q: [], SNIPPET_VERSION: '3.1',
    };

    // Intercom stub (extended)
    window.Intercom = window.Intercom || function() {};
    window.intercomSettings = window.intercomSettings || {};

    // Typekit / Adobe Fonts (tracking portion) stub
    window.Typekit = window.Typekit || { load: noop };

    // Marketo Munchkin stub
    window.MktoForms2 = window.MktoForms2 || { loadForm: noop, whenReady: noop };
    window.Munchkin = window.Munchkin || { init: noop, munchkinFunction: noop };

    // HubSpot forms stub
    window.hbspt = window.hbspt || { forms: { create: noop } };
  }
})();
