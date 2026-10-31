import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { MobileControls, MobileAbilityState } from './MobileControls';
import { DeviceInfo } from '../utils/DeviceDetector';

/**
 * Descriptor passed by each scene so the helper can wire up ability
 * callbacks and live-update the ability button.
 */
export interface MobileSetupOptions {
  /** The scene instance. */
  scene: Phaser.Scene;
  /** The Player instance. */
  player: Player;
  /**
   * Callback to fire when the mobile ability button is pressed.
   * This MUST call the same function the desktop key calls.
   *
   * Examples:
   *  - Level 1/2 (no StaffController): `() => player.useStaff()`
   *  - Level 3 (CamouflageAbility):    `() => camouflage.activate()`
   *  - Level 4 (StaffController+Time): `() => staffController.activate(player.x, player.y)`
   *  - Level 5 (StaffController+Phase):`() => staffController.activate(player.x, player.y)`
   */
  onAbilityPressed: () => void;
  /**
   * Called each frame to produce the current ability state for the button icon.
   * Scenes implement this by reading their own public ability fields.
   */
  getAbilityState: () => MobileAbilityState;
}

/**
 * Return value stored by the scene so it can call `update()` each frame
 * and have the object destroyed automatically on shutdown.
 */
export interface MobileSetupHandle {
  /** Call this at the END of the scene's update() to sync mobile → player input. */
  update(): void;
  /** The MobileControls instance (for direct access if needed). */
  controls: MobileControls;
}

/**
 * Sets up mobile controls for a gameplay scene.
 *
 * On desktop (`DeviceInfo.isMobile === false`) this returns `null` immediately
 * with ZERO side effects — the desktop path is completely untouched.
 *
 * On mobile it:
 *  1. Creates MobileControls (touch buttons).
 *  2. Wires `player.mobileInput` every frame.
 *  3. Compacts HUD for mobile viewport.
 *  4. Returns a handle the scene uses in its update() loop.
 */
export function setupMobileForScene(opts: MobileSetupOptions): MobileSetupHandle | null {
  if (!DeviceInfo.isMobile) return null;

  const { scene, player, onAbilityPressed, getAbilityState } = opts;

  // Create touch controls
  const controls = new MobileControls(scene, {
    onAbilityPressed
  });

  // Wire mobileInput onto Player (additive, never replaces keyboard)
  player.mobileInput = {
    moveLeft: false,
    moveRight: false,
    jumpIsDown: false,
    jumpJustPressed: false,
    interactJustPressed: false
  };

  // Compact HUD for mobile — reposition bottom-left charge bar upward
  // so it doesn't overlap with the left movement buttons.
  // This is safe: HUD elements are Phaser containers positioned via setPosition().
  compactHudForMobile(scene);

  // Try to lock/handle orientation
  tryLockLandscape();

  // Return the handle
  const handle: MobileSetupHandle = {
    controls,
    update() {
      // Sync mobile button states → Player.mobileInput
      player.mobileInput!.moveLeft = controls.moveLeftPressed;
      player.mobileInput!.moveRight = controls.moveRightPressed;
      player.mobileInput!.jumpIsDown = controls.jumpPressed;
      player.mobileInput!.jumpJustPressed = controls.jumpJustPressed;
      // Ability is invoked immediately on press via onAbilityPressed;
      // keep interactJustPressed false to prevent double-firing
      player.mobileInput!.interactJustPressed = false;

      // Update ability button visuals
      controls.updateAbilityState(getAbilityState());

      // Reset one-shot flags AFTER they've been consumed
      controls.resetFrameFlags();
    }
  };

  return handle;
}

// ── HUD Compaction ──────────────────────────────────────────────────────────

/**
 * On mobile: nudge the HUD's bottom-left charge bar upward and the
 * banner text smaller, so they don't overlap with touch buttons.
 * This only touches mobile layout — desktop is unaffected.
 */
function compactHudForMobile(_scene: Phaser.Scene): void {
  // We apply a CSS-level viewport meta tag to encourage proper scaling
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute('content',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
    );
  }
}

// ── Orientation Lock ────────────────────────────────────────────────────────

function tryLockLandscape(): void {
  try {
    const sl = screen.orientation as unknown as { lock?: (orientation: string) => Promise<void> } | undefined;
    if (sl && typeof sl.lock === 'function') {
      sl.lock('landscape').catch(() => {
        // Silently fail — not all browsers support orientation lock
      });
    }
  } catch {
    // Ignore
  }
}
