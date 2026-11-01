import Phaser from 'phaser';

export class WaterAbility {
    private scene: Phaser.Scene;
    private onActivate: () => boolean;
    private cooldown = 500;
    private lastActivation = 0;

    constructor(
        scene: Phaser.Scene,
        onActivate: () => boolean
    ) {
        this.scene = scene;
        this.onActivate = onActivate;
    }

    activate(): boolean {
        const now = this.scene.time.now;

        if (now - this.lastActivation < this.cooldown) {
            return false;
        }

        const activated = this.onActivate();

        if (!activated) {
            return false;
        }

        this.lastActivation = now;
        return true;
    }

    destroy(): void {
        // No keyboard listeners are registered by this ability.
    }
}