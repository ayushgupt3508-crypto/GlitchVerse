import { DeviceInfo } from './DeviceDetector';

/**
 * OrientationManager — Enforces horizontal landscape mode on mobile devices.
 *
 * Responsibilities:
 *  1. Attempts screen.orientation.lock('landscape') immediately and on first user gesture.
 *  2. Toggles the #landscape-barrier overlay on portrait mobile viewports.
 *  3. Connects the "ENTER LANDSCAPE" fullscreen button to lock landscape orientation.
 *  4. Completely inert on desktop (zero interference with keyboard/mouse play).
 */
export class OrientationManager {
  private static instance: OrientationManager;
  private barrierEl: HTMLElement | null = null;
  private btnEl: HTMLButtonElement | null = null;

  private constructor() {
    if (typeof window === 'undefined') return;

    if (DeviceInfo.isMobile && document.body) {
      document.body.classList.add('is-mobile-device');
    }

    this.barrierEl = document.getElementById('landscape-barrier');
    this.btnEl = document.getElementById('barrier-fullscreen-btn') as HTMLButtonElement | null;

    this.setupListeners();
    this.checkOrientation();
    this.tryLockLandscape();
  }

  public static init(): OrientationManager {
    if (!OrientationManager.instance) {
      OrientationManager.instance = new OrientationManager();
    }
    return OrientationManager.instance;
  }

  private setupListeners(): void {
    // Attempt lock on ANY user gesture (first touch/click anywhere on screen)
    const gestureHandler = () => {
      this.tryLockLandscape();
    };
    window.addEventListener('pointerdown', gestureHandler, { passive: true });
    window.addEventListener('touchstart', gestureHandler, { passive: true });

    // Handle orientation & resize changes
    window.addEventListener('resize', () => this.checkOrientation());
    window.addEventListener('orientationchange', () => this.checkOrientation());
    if (screen.orientation) {
      screen.orientation.addEventListener('change', () => this.checkOrientation());
    }

    // Button on the orientation barrier overlay
    if (this.btnEl) {
      const onBtnPress = async (e: Event) => {
        e.preventDefault();
        await this.requestLandscapeFullscreen();
        this.checkOrientation();
      };
      this.btnEl.addEventListener('click', onBtnPress);
      this.btnEl.addEventListener('touchend', onBtnPress);
    }
  }

  public async tryLockLandscape(): Promise<boolean> {
    if (!DeviceInfo.isMobile) return true;

    try {
      const sl = screen.orientation as unknown as { lock?: (orientation: string) => Promise<void> } | undefined;
      if (sl && typeof sl.lock === 'function') {
        await sl.lock('landscape');
        return true;
      }
    } catch {
      // Browsers often require fullscreen before screen.orientation.lock succeeds
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
      return;
    }

    const isPortrait = window.innerHeight > window.innerWidth;
    if (this.barrierEl) {
      this.barrierEl.style.display = isPortrait ? 'flex' : 'none';
    }

    if (!isPortrait) {
      // Trigger resize to update Phaser canvas dimensions
      window.dispatchEvent(new Event('resize'));
    }
  }
}
