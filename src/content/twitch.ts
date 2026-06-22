// StrixBlock v2 — Twitch ad mute + reload handler

const TWITCH_PURPLE = '#9147ff';

export class TwitchAdHandler {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private observer: MutationObserver | null = null;
  private overlay: HTMLElement | null = null;
  private adActive = false;
  private savedVolume = 1;
  private reloadAttempted = false;
  private currentPath = location.pathname;

  start(): void {
    this.createOverlay();
    this.pollTimer = setInterval(() => this.check(), 300);
    this.startObserver();
    this.startNavDetection();
  }

  // ─── Ad detection ───────────────────────────────────────────────────────

  isAdPlaying(): boolean {
    // Method 1: Ad countdown element
    if (document.querySelector('[data-a-target="ad-countdown"]')) return true;

    // Method 2: Ad banner
    if (document.querySelector('[class*="ad-banner"]')) return true;

    // Method 3: Screen reader text
    const srTexts = document.querySelectorAll('[class*="tw-sr-only"], .sr-only');
    for (const el of srTexts) {
      if (el.textContent?.toLowerCase().includes('advertisement')) return true;
    }

    // Method 4: Aria label on video area
    const videoArea = document.querySelector('[aria-label*="Advertisement"]');
    if (videoArea) return true;

    // Method 5: Purple "Ad" pill in the player
    const adPill = document.querySelector('[class*="ad-pill"], [class*="AdBanner"]');
    if (adPill) return true;

    return false;
  }

  private check(): void {
    const adShowing = this.isAdPlaying();

    if (adShowing && !this.adActive) {
      this.onAdStart();
    } else if (!adShowing && this.adActive) {
      this.onAdEnd();
    }
  }

  // ─── Ad start/end ────────────────────────────────────────────────────────

  onAdStart(): void {
    this.adActive = true;
    this.reloadAttempted = false;

    const video = this.getVideo();
    if (video) {
      this.savedVolume = video.volume;
      video.muted = true;
      video.volume = 0;
    }

    this.showOverlay();

    // Try to skip/reload the stream after 600ms
    setTimeout(() => {
      if (this.adActive) this.tryReloadStream();
    }, 600);
  }

  onAdEnd(): void {
    this.adActive = false;

    const video = this.getVideo();
    if (video) {
      video.muted = false;
      video.volume = this.savedVolume;
    }

    this.hideOverlay();
  }

  // ─── Stream reload strategies ────────────────────────────────────────────

  tryReloadStream(): void {
    if (this.reloadAttempted) return;
    this.reloadAttempted = true;

    // Strategy 1: Theatre mode toggle (forces stream quality reset)
    this.theatreModeToggle();

    setTimeout(() => {
      if (!this.adActive) return;
      // Strategy 2: Pause + play
      const video = this.getVideo();
      if (video) {
        video.pause();
        setTimeout(() => {
          if (!this.adActive) return;
          video.play().catch(() => {});

          setTimeout(() => {
            if (!this.adActive) return;
            // Strategy 3: Reset src if ad still playing
            const src = video.src;
            if (src) {
              video.src = '';
              video.load();
              video.src = src;
              video.play().catch(() => {});
            }
          }, 800);
        }, 300);
      }
    }, 400);
  }

  private theatreModeToggle(): void {
    // Twitch theatre mode button
    const btn = document.querySelector<HTMLElement>(
      '[data-a-target="player-theatre-mode-button"], ' +
      '[aria-label*="Theatre Mode"], [aria-label*="Theater Mode"]'
    );
    if (btn) {
      btn.click();
      setTimeout(() => btn.click(), 200);
    }
  }

  // ─── Video element ──────────────────────────────────────────────────────

  private getVideo(): HTMLVideoElement | null {
    return document.querySelector<HTMLVideoElement>('video');
  }

  // ─── Overlay UI ─────────────────────────────────────────────────────────

  private createOverlay(): void {
    if (this.overlay) return;

    const overlay = document.createElement('div');
    overlay.id = 'strixblock-twitch-overlay';
    overlay.style.cssText = `
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      z-index: 2147483647;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;

    overlay.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 24 24" fill="${TWITCH_PURPLE}">
        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
      </svg>
      <div style="color: #efeff1; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">
        Skipping Ad…
      </div>
      <div style="color: #adadb8; font-size: 12px;">
        StrixBlock is handling this
      </div>
    `;

    this.overlay = overlay;

    // Inject after body is available
    if (document.body) {
      document.body.appendChild(overlay);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body?.appendChild(overlay);
      }, { once: true });
    }
  }

  private showOverlay(): void {
    if (!this.overlay) this.createOverlay();
    if (this.overlay) {
      this.overlay.style.display = 'flex';
    }
  }

  private hideOverlay(): void {
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
  }

  // ─── MutationObserver ────────────────────────────────────────────────────

  private startObserver(): void {
    this.observer = new MutationObserver(() => {
      this.check();
    });

    const target = document.querySelector('.persistent-player, .video-player, [data-a-target="video-player"]') ?? document.body;
    if (target) {
      this.observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-a-target', 'aria-label'],
      });
    }
  }

  // ─── SPA navigation detection ─────────────────────────────────────────

  private startNavDetection(): void {
    const checkPath = () => {
      if (location.pathname !== this.currentPath) {
        this.currentPath = location.pathname;
        this.reloadAttempted = false;
        if (this.adActive) this.onAdEnd();
      }
    };

    // Twitch uses pushState for navigation
    const origPushState = history.pushState.bind(history);
    history.pushState = function (...args) {
      origPushState(...args);
      setTimeout(checkPath, 500);
    };

    window.addEventListener('popstate', () => setTimeout(checkPath, 500));
  }

  stop(): void {
    if (this.pollTimer !== null) clearInterval(this.pollTimer);
    this.observer?.disconnect();
    this.overlay?.remove();
    this.overlay = null;
    if (this.adActive) this.onAdEnd();
  }
}
