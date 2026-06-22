// StrixBlock v2 — Cosmetic engine (isolated world)

import { debounce } from '../shared/utils.js';

export class CosmeticEngine {
  private styleEl: HTMLStyleElement | null = null;
  private observer: MutationObserver | null = null;
  private inputFocused = false;
  private rules: string = '';
  private domainRules: Record<string, string[]> = {};
  private currentDomain: string = '';

  constructor(domain: string) {
    this.currentDomain = domain;
  }

  /**
   * Load cosmetic rules from chrome.storage.local (stored by background).
   */
  async loadRules(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_COSMETIC_RULES' });
      if (response?.success && response.data) {
        const css = response.data as string;

        // Extract domain rules embedded as a comment
        const domainMatch = css.match(/\/\* DOMAIN_RULES:(.*?) \*\//s);
        if (domainMatch) {
          try {
            this.domainRules = JSON.parse(domainMatch[1]) as Record<string, string[]>;
          } catch { /* ignore */ }
        }

        // Strip the comment from generic CSS
        this.rules = css.replace(/\/\* DOMAIN_RULES:.*? \*\//s, '').trim();
      }
    } catch {
      // Background may not be ready yet — that's okay
    }
  }

  /**
   * Inject the base cosmetic CSS as a <style> element.
   */
  injectBaseCSS(): void {
    if (this.styleEl) return; // Already injected

    this.styleEl = document.createElement('style');
    this.styleEl.id = 'strixblock-cosmetic';
    this.styleEl.textContent = this.buildCSS();

    const target = document.head ?? document.documentElement;
    if (target) {
      target.appendChild(this.styleEl);
    }
  }

  private buildCSS(): string {
    const parts: string[] = [this.rules];

    // Add domain-specific rules for the current domain
    for (const [domain, selectors] of Object.entries(this.domainRules)) {
      if (
        this.currentDomain === domain ||
        this.currentDomain.endsWith('.' + domain)
      ) {
        parts.push(`${selectors.join(',\n')} { display: none !important; }`);
      }
    }

    return parts.filter(Boolean).join('\n\n');
  }

  /**
   * Update CSS if domain rules change.
   */
  updateCSS(): void {
    if (!this.styleEl) return;
    this.styleEl.textContent = this.buildCSS();
  }

  /**
   * Start the MutationObserver to hide dynamically added ad elements.
   */
  startObserver(): void {
    if (this.observer) return;

    // Track input focus to avoid sweeping while user is typing
    document.addEventListener('focusin', this.onFocusIn, true);
    document.addEventListener('focusout', this.onFocusOut, true);

    const debouncedSweep = debounce(() => this.sweep(), 200);

    this.observer = new MutationObserver((mutations) => {
      if (this.inputFocused) return;

      let hasElementMutations = false;
      for (const m of mutations) {
        if (m.type === 'childList' && m.addedNodes.length > 0) {
          hasElementMutations = true;
          break;
        }
      }

      if (hasElementMutations) debouncedSweep();
    });

    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    // Initial sweep after DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.sweep(), { once: true });
    } else {
      this.sweep();
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
   * Perform a sweep to hide any ad elements in the current DOM.
   */
  sweep(): void {
    if (!this.styleEl) return; // CSS injection is the primary mechanism
    // The <style> tag handles hiding automatically via CSS selectors.
    // The sweep is for elements that might need imperative hiding
    // (e.g. elements using display:flex or inline styles that override CSS).
  }

  /**
   * Hide a single element imperatively.
   */
  hideElement(el: Element): void {
    if (this.isProtected(el)) return;
    (el as HTMLElement).style.setProperty('display', 'none', 'important');
  }

  /**
   * Returns true if the element should never be hidden.
   */
  isProtected(el: Element): boolean {
    const tag = el.tagName?.toLowerCase();

    // Never hide native media
    if (tag === 'video' || tag === 'audio') return true;

    // Never hide page structure elements
    if (tag === 'html' || tag === 'body' || tag === 'head') return true;

    // Never hide elements inside navigation, header, main content areas
    if (el.closest('nav, header, main, [role="main"], [role="navigation"]')) return true;

    // Never hide YouTube's core player and navigation
    const protectedIds = [
      'masthead', 'masthead-container', 'movie_player', 'player',
      'player-container', 'ytd-app', 'content', 'primary',
    ];
    const id = el.id?.toLowerCase();
    if (id && protectedIds.some((pid) => id === pid || id.startsWith(pid))) return true;

    return false;
  }

  /**
   * Stop the observer and clean up.
   */
  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    document.removeEventListener('focusin', this.onFocusIn, true);
    document.removeEventListener('focusout', this.onFocusOut, true);
  }
}
