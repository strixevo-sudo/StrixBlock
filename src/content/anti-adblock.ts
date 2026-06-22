// StrixBlock v2 — Anti-adblock wall removal

import { debounce } from '../shared/utils.js';

// ─── Selectors for known anti-adblock overlay walls ──────────────────────────

const WALL_SELECTORS: string[] = [
  // Generic overlay patterns
  '[class*="adblock-wall"]',
  '[class*="adblock-overlay"]',
  '[id*="adblock-wall"]',
  '[id*="adblock-overlay"]',
  '[class*="ad-block-wall"]',
  '[class*="adblocker-detected"]',
  '[class*="adblocker-notice"]',
  '[id*="adblocker"]',
  '[class*="no-ad-blocker"]',
  '[class*="disable-adblock"]',
  // Forbes
  '#vm-av-overlay',
  '.zrgyfx',
  // Wired
  '.paywall-bar',
  // Forbes-style walls
  '#PromptModal',
  '#interstitial-overlay',
  // Common popup overlays used for adblock detection
  '.adblock-modal',
  '.adblock-message',
  '.ad-blocker-popup',
  '.ad-blocker-modal',
  '.adblock-popup',
  '#adblock-popup',
  '#adblock-modal',
  '#ad-blocker-modal',
  '.anti-adblock',
  '#anti-adblock',
  '[class*="antiAdblock"]',
  '[id*="antiAdblock"]',
  // Overlay backdrops that are specifically for adblock walls
  '.modal-backdrop.adblock',
  // Site-specific
  '#fuckadblock',
  '.fuckadblock',
  '#PageCheck',
  '.vc_adblock_detect',
];

// ─── Text phrases that indicate anti-adblock walls ───────────────────────────

const WALL_PHRASES: string[] = [
  'adblock',
  'ad blocker',
  'ad-blocker',
  'disable your ad',
  'turn off your ad',
  'whitelist',
  'white-list',
  'please allow ads',
  'please enable ads',
  'ad blocking',
  'ad-blocking',
  'we noticed you',
  'ads help us',
  'support us by',
  'ad free',
];

let inputFocused = false;

export class AntiAdblockHandler {
  private observer: MutationObserver | null = null;
  private baitInjected = false;

  start(): void {
    document.addEventListener('focusin', this.onFocusIn, true);
    document.addEventListener('focusout', this.onFocusOut, true);

    this.injectBaitElements();
    this.removeWalls();

    const debouncedRemove = debounce(() => {
      if (!inputFocused) this.removeWalls();
    }, 300);

    this.observer = new MutationObserver((mutations) => {
      let hasNewElements = false;
      for (const m of mutations) {
        if (m.type === 'childList' && m.addedNodes.length > 0) {
          hasNewElements = true;
          break;
        }
        if (m.type === 'attributes' && (m.attributeName === 'style' || m.attributeName === 'class')) {
          hasNewElements = true;
          break;
        }
      }
      if (hasNewElements) debouncedRemove();
    });

    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden'],
    });
  }

  private onFocusIn = (e: FocusEvent): void => {
    const target = e.target as Element;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      inputFocused = true;
    }
  };

  private onFocusOut = (): void => {
    inputFocused = false;
  };

  /**
   * Inject bait elements that ad-detection scripts look for.
   * These are positioned off-screen so they have no visual impact.
   */
  injectBaitElements(): void {
    if (this.baitInjected) return;
    this.baitInjected = true;

    try {
      const style = document.createElement('style');
      style.id = 'strixblock-bait-style';
      style.textContent = `
        #strixblock-bait,
        .strixblock-bait,
        #adsense-bait,
        .adsbygoogle-bait {
          position: absolute !important;
          top: -9999px !important;
          left: -9999px !important;
          width: 1px !important;
          height: 1px !important;
          pointer-events: none !important;
        }
      `;
      (document.head ?? document.documentElement).appendChild(style);

      // Bait div that looks like an ad container
      const bait = document.createElement('div');
      bait.id = 'strixblock-bait';
      bait.className = 'ads adsbygoogle ad adsbox doubleclick ad-placement carbon-ads';
      bait.setAttribute('data-ad-client', 'pub-0000000000000000');
      bait.setAttribute('data-ad-slot', '1234567890');
      bait.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:1px;height:1px';
      document.body?.appendChild(bait);

      // Bait ins element (adsbygoogle style)
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:300px;height:250px;display:block';
      ins.setAttribute('data-ad-client', 'pub-0000000000000000');
      ins.setAttribute('data-ad-slot', '1234567890');
      document.body?.appendChild(ins);
    } catch { /* ignore */ }
  }

  /**
   * Remove anti-adblock walls and restore body scroll.
   */
  removeWalls(): void {
    // 1. Remove known wall selectors
    for (const selector of WALL_SELECTORS) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => this.removeWallElement(el));
      } catch { /* invalid selector — skip */ }
    }

    // 2. Scan for text-based walls in overlays/modals
    const overlaySelectors = [
      '[class*="modal"]', '[class*="overlay"]', '[class*="popup"]',
      '[class*="paywall"]', '[class*="wall"]', '[role="dialog"]',
      '[role="alertdialog"]',
    ];

    for (const sel of overlaySelectors) {
      try {
        document.querySelectorAll(sel).forEach((el) => {
          if (this.looksLikeAdblockWall(el)) {
            this.removeWallElement(el);
          }
        });
      } catch { /* skip */ }
    }

    // 3. Handle YouTube enforcement dialog
    this.handleYouTubeWall();

    // 4. Restore body scroll if it was locked
    this.restoreBodyScroll();
  }

  private looksLikeAdblockWall(el: Element): boolean {
    const text = el.textContent?.toLowerCase() ?? '';
    const phraseCount = WALL_PHRASES.filter((p) => text.includes(p)).length;
    if (phraseCount < 2) return false;

    // Extra check: must be a visible blocking overlay
    const style = window.getComputedStyle(el);
    const pos = style.position;
    return (
      (pos === 'fixed' || pos === 'absolute' || pos === 'sticky') &&
      parseInt(style.zIndex, 10) > 100
    );
  }

  private removeWallElement(el: Element): void {
    try {
      el.remove();
    } catch { /* ignore */ }
  }

  /**
   * Only remove tp-yt-iron-overlay-backdrop if a YouTube enforcement dialog
   * is ALSO present. Never remove it unconditionally.
   */
  handleYouTubeWall(): void {
    if (!location.hostname.includes('youtube.com')) return;

    // Check for enforcement dialog
    const enforcementDialog = document.querySelector(
      'ytd-enforcement-message-view-model, [class*="enforcement-dialog"]'
    );
    if (!enforcementDialog) return;

    // Only now is it safe to remove the backdrop
    const backdrop = document.querySelector(
      'ytd-popup-container tp-yt-iron-overlay-backdrop'
    );
    if (backdrop) {
      try {
        (backdrop as HTMLElement).style.setProperty('display', 'none', 'important');
      } catch { /* ignore */ }
    }

    // Also try to dismiss the dialog
    const dismissBtn = document.querySelector<HTMLElement>(
      'ytd-enforcement-message-view-model .dismiss-button, ' +
      '[class*="enforcement"] button[aria-label*="dismiss"], ' +
      '[class*="enforcement"] button[aria-label*="skip"]'
    );
    dismissBtn?.click();
  }

  private restoreBodyScroll(): void {
    try {
      const bodyStyle = document.body?.style;
      if (!bodyStyle) return;
      if (bodyStyle.overflow === 'hidden') bodyStyle.overflow = '';
      if (bodyStyle.position === 'fixed') bodyStyle.position = '';

      const htmlStyle = document.documentElement.style;
      if (htmlStyle.overflow === 'hidden') htmlStyle.overflow = '';
    } catch { /* ignore */ }
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    document.removeEventListener('focusin', this.onFocusIn, true);
    document.removeEventListener('focusout', this.onFocusOut, true);
  }
}
