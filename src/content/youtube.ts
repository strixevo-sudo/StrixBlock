// StrixBlock v2 — YouTube ad skip + mute handler

const PLAYER_SELECTOR = '#movie_player, .html5-video-player';
const SKIP_BTN_SELECTOR = '.ytp-skip-ad-button, .ytp-ad-skip-button, [class*="skip-button"]';
const ENFORCEMENT_DIALOG_SELECTOR = 'ytd-enforcement-message-view-model';

export class YouTubeAdHandler {
  private skipTimer: ReturnType<typeof setInterval> | null = null;
  private muteTimer: ReturnType<typeof setInterval> | null = null;
  private pageObserver: MutationObserver | null = null;
  private savedVolume: number | null = null;
  private active = true;

  start(): void {
    this.active = true;
    this.startTimers();
    this.startPageObserver();

    // Re-initialise on YouTube SPA navigation
    window.addEventListener('yt-navigate-finish', this.onNavigate);
  }

  private onNavigate = (): void => {
    this.stopTimers();
    // Small delay to let the new page settle
    setTimeout(() => {
      if (this.active) this.startTimers();
    }, 500);
  };

  private startTimers(): void {
    this.skipTimer = setInterval(() => this.trySkipAd(), 150);
    this.muteTimer = setInterval(() => this.muteGuard(), 250);
  }

  private stopTimers(): void {
    if (this.skipTimer !== null) clearInterval(this.skipTimer);
    if (this.muteTimer !== null) clearInterval(this.muteTimer);
    this.skipTimer = null;
    this.muteTimer = null;
  }

  private startPageObserver(): void {
    if (this.pageObserver) return;

    this.pageObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' || (m.type === 'childList' && m.addedNodes.length > 0)) {
          this.handleEnforcementDialog();
          break;
        }
      }
    });

    this.pageObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden'],
    });
  }

  // ─── Player helpers ─────────────────────────────────────────────────────

  private getPlayer(): Element | null {
    return document.querySelector(PLAYER_SELECTOR);
  }

  private getVideo(): HTMLVideoElement | null {
    const player = this.getPlayer();
    if (!player) return null;
    return player.querySelector<HTMLVideoElement>('video');
  }

  // ─── Ad detection ───────────────────────────────────────────────────────

  /**
   * ONLY checks player class names — no DOM element lookups that cause
   * false positives on normal video playback.
   */
  private isAdShowing(): boolean {
    const player = this.getPlayer();
    if (!player) return false;
    return (
      player.classList.contains('ad-showing') ||
      player.classList.contains('ad-interrupting')
    );
  }

  // ─── Skip logic ─────────────────────────────────────────────────────────

  trySkipAd(): void {
    if (!this.isAdShowing()) return;

    // 1. Try skip button first
    const skipBtn = document.querySelector<HTMLElement>(SKIP_BTN_SELECTOR);
    if (skipBtn && !skipBtn.hidden) {
      skipBtn.click();
      return;
    }

    // 2. Jump to end of ad (works for non-skippable ads)
    const video = this.getVideo();
    if (video && isFinite(video.duration) && video.duration > 0) {
      video.currentTime = video.duration;
    }
  }

  // ─── Mute guard ─────────────────────────────────────────────────────────

  muteGuard(): void {
    const video = this.getVideo();
    if (!video) return;

    if (this.isAdShowing()) {
      // Save volume and mute during ad
      if (!video.muted) {
        this.savedVolume = video.volume;
        video.muted = true;
        video.volume = 0;
      }
    } else {
      // Restore volume after ad
      if (video.muted && this.savedVolume !== null) {
        video.muted = false;
        video.volume = this.savedVolume;
        this.savedVolume = null;
      }
    }
  }

  // ─── Enforcement dialog ─────────────────────────────────────────────────

  /**
   * Only act on the YouTube enforcement dialog (ad-blocker wall)
   * if it is actually present. NEVER remove backdrop unconditionally.
   */
  handleEnforcementDialog(): void {
    const dialog = document.querySelector(ENFORCEMENT_DIALOG_SELECTOR);
    if (!dialog) return;

    const text = dialog.textContent?.toLowerCase() ?? '';
    const isEnforcement =
      text.includes('ad blocker') ||
      text.includes('adblock') ||
      text.includes('allow ads') ||
      text.includes('without ads');

    if (!isEnforcement) return;

    // Now it is safe to hide the backdrop — it belongs to this enforcement dialog
    const backdrop = document.querySelector<HTMLElement>(
      'ytd-popup-container tp-yt-iron-overlay-backdrop'
    );
    if (backdrop) {
      backdrop.style.setProperty('display', 'none', 'important');
    }

    // Try to dismiss the dialog programmatically
    const dismissBtns = document.querySelectorAll<HTMLElement>(
      'ytd-enforcement-message-view-model button, ' +
      '[class*="enforcement"] paper-button, ' +
      '[class*="enforcement"] button'
    );
    dismissBtns.forEach((btn) => {
      const label = btn.textContent?.toLowerCase() ?? '';
      if (label.includes('dismiss') || label.includes('skip') || label.includes('close') || label.includes('allow')) {
        btn.click();
      }
    });
  }

  stop(): void {
    this.active = false;
    this.stopTimers();
    this.pageObserver?.disconnect();
    this.pageObserver = null;
    window.removeEventListener('yt-navigate-finish', this.onNavigate);

    // Restore volume if muted
    const video = this.getVideo();
    if (video && video.muted && this.savedVolume !== null) {
      video.muted = false;
      video.volume = this.savedVolume;
    }
  }
}
