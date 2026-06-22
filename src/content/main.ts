// StrixBlock v2 — Content script entry (isolated world)

import type { Settings } from '../shared/types.js';
import { extractDomain } from '../shared/utils.js';
import { CosmeticEngine } from './cosmetic-engine.js';
import { AntiAdblockHandler } from './anti-adblock.js';
import { SweepEngine } from './sweep.js';
import { YouTubeAdHandler } from './youtube.js';
import { TwitchAdHandler } from './twitch.js';

const domain = extractDomain(location.href);
const isYouTube = domain.includes('youtube.com') || domain.includes('youtu.be');
const isTwitch = domain.includes('twitch.tv');

// ─── Module instances ─────────────────────────────────────────────────────────

let cosmeticEngine: CosmeticEngine | null = null;
let antiAdblock: AntiAdblockHandler | null = null;
let sweepEngine: SweepEngine | null = null;
let youtubeHandler: YouTubeAdHandler | null = null;
let twitchHandler: TwitchAdHandler | null = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  let settings: Settings | null = null;

  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    if (response?.success) {
      settings = response.data as Settings;
    }
  } catch {
    // Background may not be ready on first load — use defaults
    settings = null;
  }

  // If extension is disabled globally or site is whitelisted, bail out
  if (settings && !settings.enabled) return;

  // Check if this domain is whitelisted
  if (settings?.whitelist?.some((w) => domain === w || domain.endsWith('.' + w))) return;

  // ─── Cosmetic Engine ───────────────────────────────────────────────────

  if (!settings || settings.features.cosmetic) {
    cosmeticEngine = new CosmeticEngine(domain);
    await cosmeticEngine.loadRules();
    cosmeticEngine.injectBaseCSS();
    cosmeticEngine.startObserver();
  }

  // ─── DOM Sweep ─────────────────────────────────────────────────────────

  if (!settings || settings.features.ads) {
    sweepEngine = new SweepEngine();
    sweepEngine.start();
  }

  // ─── Anti-Adblock ──────────────────────────────────────────────────────

  if (settings?.features.antiAdblock) {
    antiAdblock = new AntiAdblockHandler();
    antiAdblock.start();
  }

  // ─── YouTube Handler ───────────────────────────────────────────────────

  if (isYouTube && (!settings || settings.features.youtube)) {
    youtubeHandler = new YouTubeAdHandler();
    youtubeHandler.start();
  }

  // ─── Twitch Handler ────────────────────────────────────────────────────

  if (isTwitch && (!settings || settings.features.twitch)) {
    twitchHandler = new TwitchAdHandler();
    twitchHandler.start();
  }
}

// ─── Settings Change Listener ────────────────────────────────────────────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (!('settings' in changes)) return;

  const newSettings = changes['settings']?.newValue as Settings | undefined;
  if (!newSettings) return;

  // If extension was disabled, tear everything down
  if (!newSettings.enabled) {
    teardown();
    return;
  }

  // Handle cosmetic feature toggle
  if (newSettings.features.cosmetic && !cosmeticEngine) {
    cosmeticEngine = new CosmeticEngine(domain);
    cosmeticEngine.loadRules().then(() => {
      cosmeticEngine?.injectBaseCSS();
      cosmeticEngine?.startObserver();
    });
  } else if (!newSettings.features.cosmetic && cosmeticEngine) {
    cosmeticEngine.stop();
    cosmeticEngine = null;
  }

  // Handle ads/sweep toggle
  if (newSettings.features.ads && !sweepEngine) {
    sweepEngine = new SweepEngine();
    sweepEngine.start();
  } else if (!newSettings.features.ads && sweepEngine) {
    sweepEngine.stop();
    sweepEngine = null;
  }

  // Handle anti-adblock toggle
  if (newSettings.features.antiAdblock && !antiAdblock) {
    antiAdblock = new AntiAdblockHandler();
    antiAdblock.start();
  } else if (!newSettings.features.antiAdblock && antiAdblock) {
    antiAdblock.stop();
    antiAdblock = null;
  }

  // YouTube
  if (isYouTube) {
    if (newSettings.features.youtube && !youtubeHandler) {
      youtubeHandler = new YouTubeAdHandler();
      youtubeHandler.start();
    } else if (!newSettings.features.youtube && youtubeHandler) {
      youtubeHandler.stop();
      youtubeHandler = null;
    }
  }

  // Twitch
  if (isTwitch) {
    if (newSettings.features.twitch && !twitchHandler) {
      twitchHandler = new TwitchAdHandler();
      twitchHandler.start();
    } else if (!newSettings.features.twitch && twitchHandler) {
      twitchHandler.stop();
      twitchHandler = null;
    }
  }
});

// ─── Teardown ─────────────────────────────────────────────────────────────────

function teardown(): void {
  cosmeticEngine?.stop();
  sweepEngine?.stop();
  antiAdblock?.stop();
  youtubeHandler?.stop();
  twitchHandler?.stop();
  cosmeticEngine = null;
  sweepEngine = null;
  antiAdblock = null;
  youtubeHandler = null;
  twitchHandler = null;
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

init().catch((err) => {
  console.error('[StrixBlock] Content script init error:', err);
});
