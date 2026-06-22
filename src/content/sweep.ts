// StrixBlock v2 — DOM sweep for ad elements

import { debounce } from '../shared/utils.js';

// ─── Known ad network class/ID fragments ─────────────────────────────────────

const AD_FRAGMENTS: string[] = [
  'doubleclick', 'adsense', 'adsbygoogle', 'adnxs', 'googlesyndication',
  'taboola', 'outbrain', 'criteo', 'appnexus', 'pubmatic', 'openx',
  'rubiconproject', 'sharethrough', 'spotx', 'sovrn', 'mgid', 'revcontent',
  'districtm', 'indexexchange', '33across', 'intentiq', 'teads', 'vidazoo',
  'connatix', 'magnite', 'seedtag', 'triplelift', 'ezoic', 'mediavine',
  'raptive', 'adthrive', 'smartadserver', 'adform', 'sizmek', 'xandr',
  'yieldmo', 'springserve', 'freewheel', 'improvedigital',
  // Generic
  'ad-slot', 'ad-unit', 'adslot', 'adunit', 'div-gpt-ad', 'gpt-ad',
  'dfp-ad', 'prebid', 'header-bidding',
];

// ─── IAB standard ad sizes (width x height) ──────────────────────────────────

const AD_SIZES: Set<string> = new Set([
  '300x250', '728x90', '160x600', '300x600', '970x250', '970x90',
  '320x50', '320x100', '300x50', '250x250', '200x200', '468x60',
  '120x600', '120x240', '240x400', '336x280', '580x400',
  '750x200', '750x100', '750x300',
]);

// ─── Elements whose IDs/classes should never be touched ──────────────────────

const PROTECTED_IDS: Set<string> = new Set([
  'masthead', 'masthead-container', 'movie_player', 'player',
  'player-container', 'ytd-app', 'content', 'primary', 'secondary',
  'page-manager', 'header', 'search', 'searchbox', 'search-form',
]);

// ─── SweepEngine class ────────────────────────────────────────────────────────

export class SweepEngine {
  private observer: MutationObserver | null = null;
  private inputFocused = false;

  start(): void {
    document.addEventListener('focusin', this.onFocusIn, true);
    document.addEventListener('focusout', this.onFocusOut, true);

    const debouncedSweep = debounce(() => {
      if (!this.inputFocused) this.sweepAds();
    }, 250);

    this.observer = new MutationObserver((mutations) => {
      let hasNewElements = false;
      for (const m of mutations) {
        if (m.type === 'childList' && m.addedNodes.length > 0) {
          for (const node of m.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              hasNewElements = true;
              break;
            }
          }
        }
        if (hasNewElements) break;
      }
      if (hasNewElements) debouncedSweep();
    });

    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    // Initial sweep
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.sweepAds(), { once: true });
    } else {
      this.sweepAds();
    }
  }

  private onFocusIn = (e: FocusEvent): void => {
    const target = e.target as Element;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      this.inputFocused = true;
    }
  };

  private onFocusOut = (): void => {
    this.inputFocused = false;
  };

  /**
   * Sweep the DOM for ad elements and hide them.
   */
  sweepAds(): void {
    // 1. Ad iframes
    document.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
      if (this.isAdElement(iframe) && !this.isProtected(iframe)) {
        this.hideElement(iframe);
      }
    });

    // 2. Divs/spans with ad class/id patterns
    document.querySelectorAll<HTMLElement>('div, span, section, aside').forEach((el) => {
      if (this.isAdElement(el) && !this.isProtected(el)) {
        this.hideElement(el);
      }
    });

    // 3. ins.adsbygoogle
    document.querySelectorAll<HTMLElement>('ins[class*="adsby"]').forEach((el) => {
      if (!this.isProtected(el)) this.hideElement(el);
    });
  }

  /**
   * Determine if an element looks like an ad element.
   */
  isAdElement(el: Element): boolean {
    const tag = el.tagName?.toLowerCase();

    // ─── Type-specific checks ───

    if (tag === 'iframe') {
      const src = (el as HTMLIFrameElement).src ?? '';
      if (!src || src === 'about:blank') {
        // Check IAB sizes
        const w = (el as HTMLIFrameElement).width;
        const h = (el as HTMLIFrameElement).height;
        if (w && h && AD_SIZES.has(`${w}x${h}`)) return true;
      }
      // Check src against ad fragments
      if (src && AD_FRAGMENTS.some((f) => src.includes(f))) return true;
    }

    // ─── ID / class matching ───

    const id = el.id?.toLowerCase() ?? '';
    const className = typeof el.className === 'string' ? el.className.toLowerCase() : '';
    const combined = `${id} ${className}`;

    if (AD_FRAGMENTS.some((f) => combined.includes(f))) return true;

    // ─── data attributes ───

    const adClient = el.getAttribute('data-ad-client');
    const adSlot = el.getAttribute('data-ad-slot');
    if (adClient || adSlot) return true;

    // ─── aria-label ───

    const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() ?? '';
    if (ariaLabel.includes('advertisement') || ariaLabel.includes('sponsored')) return true;

    return false;
  }

  /**
   * Returns true if the element must never be hidden.
   */
  isProtected(el: Element): boolean {
    const tag = el.tagName?.toLowerCase();

    // Never hide native media
    if (tag === 'video' || tag === 'audio' || tag === 'picture') return true;

    // Never hide navigation/structural elements
    if (el.closest('nav, header, main, footer, [role="main"], [role="navigation"]')) return true;

    // Never hide elements with protected IDs
    const id = el.id?.toLowerCase();
    if (id && PROTECTED_IDS.has(id)) return true;

    // Never hide elements with data-strixblock-protected
    if (el.hasAttribute('data-strixblock-protected')) return true;

    return false;
  }

  /**
   * Hide an element with !important to override inline styles.
   */
  hideElement(el: Element): void {
    if (this.isProtected(el)) return;
    (el as HTMLElement).style.setProperty('display', 'none', 'important');
    (el as HTMLElement).setAttribute('data-strixblock-hidden', '1');
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    document.removeEventListener('focusin', this.onFocusIn, true);
    document.removeEventListener('focusout', this.onFocusOut, true);
  }
}
