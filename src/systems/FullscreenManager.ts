import Phaser from 'phaser';

export class FullscreenManager {
  private static initialized = false;
  private static scaleManager: Phaser.Scale.ScaleManager | null = null;
  public static isFullscreen = false;
  public static justExited = false;
  private static exitTimer: number | null = null;

  /**
   * Initializes the global fullscreen toggle and event sync.
   * Can be safely called multiple times (idempotent).
   */
  public static init(scaleOrGame: Phaser.Scale.ScaleManager | Phaser.Game): void {
    if (this.initialized) return;

    const scale = scaleOrGame instanceof Phaser.Scale.ScaleManager
      ? scaleOrGame
      : scaleOrGame.scale;

    this.scaleManager = scale;
    this.initialized = true;

    // Keep state in sync with Phaser scale events
    scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, () => {
      FullscreenManager.isFullscreen = true;
      FullscreenManager.justExited = false;
      console.log('[FullscreenManager] entered fullscreen');
    });

    scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, () => {
      FullscreenManager.isFullscreen = false;
      FullscreenManager.justExited = true;
      console.log('[FullscreenManager] left fullscreen');

      if (FullscreenManager.exitTimer !== null) {
        window.clearTimeout(FullscreenManager.exitTimer);
      }
      FullscreenManager.exitTimer = window.setTimeout(() => {
        FullscreenManager.justExited = false;
        FullscreenManager.exitTimer = null;
      }, 300);
    });

    // Native browser fullscreen change fallback to guarantee state sync
    document.addEventListener('fullscreenchange', () => {
      const active = !!document.fullscreenElement;
      if (!active && FullscreenManager.isFullscreen) {
        FullscreenManager.isFullscreen = false;
        FullscreenManager.justExited = true;
        if (FullscreenManager.exitTimer !== null) {
          window.clearTimeout(FullscreenManager.exitTimer);
        }
        FullscreenManager.exitTimer = window.setTimeout(() => {
          FullscreenManager.justExited = false;
          FullscreenManager.exitTimer = null;
        }, 300);
      } else if (active) {
        FullscreenManager.isFullscreen = true;
      }
    });

    // Persistent keyboard handler for 'F' toggle and Esc safety
    window.addEventListener('keydown', (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // F key toggles fullscreen globally
      if (event.code === 'KeyF' || event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        console.log('[FullscreenManager] F pressed, toggling fullscreen via Phaser ScaleManager');
        FullscreenManager.toggleFullscreen();
        return;
      }

      // If Escape is pressed while in fullscreen, ensure fullscreen exits without triggering menus
      if (event.code === 'Escape' || event.key === 'Escape') {
        if (FullscreenManager.shouldBlockEsc()) {
          console.log('[FullscreenManager] Esc pressed while fullscreen, stopping fullscreen');
          if (scale.isFullscreen || document.fullscreenElement) {
            scale.stopFullscreen();
          }
        }
      }
    });
  }

  /**
   * Toggles fullscreen using Phaser's ScaleManager
   */
  public static toggleFullscreen(): void {
    if (!this.scaleManager) return;

    if (this.scaleManager.isFullscreen || document.fullscreenElement) {
      this.scaleManager.stopFullscreen();
    } else {
      this.scaleManager.startFullscreen();
    }
  }

  /**
   * Checks if fullscreen is currently active (via Phaser or DOM)
   */
  public static isFullscreenActive(): boolean {
    return (
      (this.scaleManager?.isFullscreen ?? false) ||
      document.fullscreenElement !== null ||
      this.isFullscreen
    );
  }

  /**
   * Returns true if Esc should ONLY exit fullscreen and NOT trigger pause/menu.
   */
  public static shouldBlockEsc(): boolean {
    return this.isFullscreenActive() || this.justExited;
  }
}

