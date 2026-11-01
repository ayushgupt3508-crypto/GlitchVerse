import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { ThermalVent, THERMAL_VENT_CONFIG } from '../entities/ThermalVent';

export class ThermalVentAbility {
    private player: Player;
    private vents: ThermalVent[];

    private onVentIgnited: (vent: ThermalVent) => void;
    private onFallback: () => void;

    constructor(
        player: Player,
        vents: ThermalVent[],
        onVentIgnited: (vent: ThermalVent) => void,
        onFallback: () => void
    ) {
        this.player = player;
        this.vents = vents;
        this.onVentIgnited = onVentIgnited;
        this.onFallback = onFallback;
    }

    activate(): boolean {
        let nearestVent: ThermalVent | null = null;
        let minDistance: number = THERMAL_VENT_CONFIG.ignitionRange;

        for (const vent of this.vents) {
            if (!vent.isDormant) continue;

            const distance = Phaser.Math.Distance.Between(
                this.player.x,
                this.player.y,
                vent.x,
                vent.y
            );

            if (distance <= minDistance) {
                minDistance = distance;
                nearestVent = vent;
            }
        }

        if (nearestVent) {
            nearestVent.ignite();
            this.onVentIgnited(nearestVent);
            return true;
        }

        this.onFallback();
        return false;
    }

    destroy(): void {
        // No keyboard listeners are registered here.
    }
}