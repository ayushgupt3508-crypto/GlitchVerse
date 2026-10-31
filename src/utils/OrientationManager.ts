import Phaser from 'phaser';
import { DeviceInfo } from './DeviceDetector';

/**
 * OrientationManager — Enforces horizontal landscape mode and ensures
 * the game canvas seamlessly expands to fit the mobile screen on any device.
 *
 * Architecture:
 *  1. Attaches a ResizeObserver to #game-container so any change in viewport,
 *     fullscreen, or orientation immediately prompts Phaser to recalculate scale.
 *  2. Executes staged scale refreshes (50ms - 1200ms) to ensure asynchronous
 *     mobile rotation/fullscreen transitions finish at full size.
 *  3. Connects the orientation barrier's "ENTER LANDSCAPE" button to dismiss
 *     the overlay, request landscape fullscreen, and expand the game to full screen.
 */
export class OrientationManager {
  private static instance: OrientationManager;
  private game?: Phaser.Game;
  private barrierEl: HTMLElement | null = null;
  private btnEl: HTMLButtonElement | null = null;
  private userDismissed = false;
  private resizeObserver?: ResizeObserver;

  private constructor(game?: Phaser.Game) {
    if (typeof window === 'undefined') return;

    this.game = game;

    if (DeviceInfo.isMobile && document.body) {
      document.body.classList.add('is-mobile-device');
    }

    this.barrierEl = document.getElementById('landscape-barrier');
    this.btnEl = document.getElementById('barrier-fullscreen-btn') as HTMLButtonElement | null;

    this.setupListeners();
    this.checkOrientation();
    this.tryLockLandscape();
  }

  public static init(game?: Phaser.Game): OrientationManager {
    if (!OrientationManager.instance) {
      OrientationManager.instance = new OrientationManager(game);
    } else if (game) {
      OrientationManager.instance.game = game;
      OrientationManager.instance.refreshGameScale();
    }
    return OrientationManager.instance;
  }

  private setupListeners(): void {
    // Attempt landscape lock on first touch anywhere on screen
    const gestureHandler = () => {
      this.tryLockLandscape();
    };
    window.addEventListener('pointerdown', gestureHandler, { passive: true });
    window.addEventListener('touchstart', gestureHandler, { passive: true });

    // Handle orientation & resize changes
    const onViewportChange = () => {
      this.checkOrientation();
      this.refreshGameScale();
    };

    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);

    if (screen.orientation) {
      screen.orientation.addEventListener('change', onViewportChange);
    }

    document.addEventListener('fullscreenchange', onViewportChange);
    document.addEventListener('webkitfullscreenchange', onViewportChange);

    // Attach ResizeObserver to #game-container for 100% reliable layout tracking
    const container = document.getElementById('game-container');
    if (container && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.refreshGameScale();
      });
      this.resizeObserver.observe(container);
    }

    // Button on the orientation barrier overlay
    if (this.btnEl) {
      const onBtnPress = async (e: Event) => {
        e.preventDefault();
        e.stopPropagation();

        // 1. Immediately dismiss barrier overlay
        this.dismissBarrier();

        // 2. Request landscape fullscreen & orientation lock
        await this.requestLandscapeFullscreen();

        // 3. Force multi-stage scale refreshes to expand game to full screen
        this.refreshGameScale();
        this.checkOrientation();
      };

      this.btnEl.addEventListener('click', onBtnPress);
      this.btnEl.addEventListener('touchend', onBtnPress);
    }
  }

  public dismissBarrier(): void {
    this.userDismissed = true;
    if (document.body) {
      document.body.classList.remove('barrier-active');
    }
    if (this.barrierEl) {
      this.barrierEl.style.display = 'none';
    }
    this.refreshGameScale();
  }

  public async tryLockLandscape(): Promise<boolean> {
    if (!DeviceInfo.isMobile) return true;

    try {
      const sl = screen.orientation as unknown as { lock?: (orientation: string) => Promise<void> } | undefined;
      if (sl && typeof sl.lock === 'function') {
        await sl.lock('landscape');
        this.refreshGameScale();
        return true;
      }
    } catch {
      // Ignored if device/browser requires fullscreen before locking
    }

    // Fallback for vendor-prefixed older APIs
    try {
      const scr = screen as unknown as {
        lockOrientation?: (o: string) => boolean;
        mozLockOrientation?: (o: string) => boolean;
        msLockOrientation?: (o: string) => boolean;
      };
      if (scr.lockOrientation) scr.lockOrientation('landscape');
      else if (scr.mozLockOrientation) scr.mozLockOrientation('landscape');
      else if (scr.msLockOrientation) scr.msLockOrientation('landscape');
    } catch {
      // Silently ignore
    }

    return false;
  }

  public async requestLandscapeFullscreen(): Promise<void> {
    try {
      const elem = document.documentElement as unknown as {
        requestFullscreen?: () => Promise<void>;
        webkitRequestFullscreen?: () => Promise<void>;
        msRequestFullscreen?: () => Promise<void>;
      };
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      }
    } catch {
      // Ignore
    }

    await this.tryLockLandscape();
  }

  public checkOrientation(): void {
    if (!DeviceInfo.isMobile) {
      if (this.barrierEl) this.barrierEl.style.display = 'none';
      document.body.classList.remove('barrier-active');
      return;
    }

    const isPortrait = window.innerHeight > window.innerWidth;

    if (!isPortrait) {
      // In landscape orientation — hide barrier and reset dismissed state
      if (this.barrierEl) {
        this.barrierEl.style.display = 'none';
      }
      document.body.classList.remove('barrier-active');
      this.userDismissed = false;
      this.refreshGameScale();
    } else {
      // In portrait orientation — show barrier unless user explicitly dismissed it
      if (!this.userDismissed) {
        document.body.classList.add('barrier-active');
        if (this.barrierEl) {
          this.barrierEl.style.display = 'flex';
        }
      } else {
        if (this.barrierEl) {
          this.barrierEl.style.display = 'none';
        }
        document.body.classList.remove('barrier-active');
      }
    }
  }

  /**
   * Refreshes Phaser's ScaleManager across multiple staged intervals.
   * Mobile browsers update their viewport dimensions asynchronously over 100-800ms
   * after rotation or entering fullscreen.
   */
  public refreshGameScale(): void {
    if (!this.game) return;

    const doRefresh = () => {
      if (!this.game) return;
      try {
        this.game.scale.refresh();
      } catch {
        // Ignore
      }
    };

    doRefresh();

    // Staged triggers catch the end of rotation animations and browser chrome hide events
    const stages = [40, 100, 200, 350, 500, 800, 1200];
    stages.forEach(ms => setTimeout(doRefresh, ms));
  }
}
