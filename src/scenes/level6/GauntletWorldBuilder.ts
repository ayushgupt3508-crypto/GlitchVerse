import Phaser from 'phaser';
import { LEVEL6_CONFIG } from '../../config/level6Config';

export interface WaterHazardTile {
  sprite: Phaser.GameObjects.Sprite;
  spike?: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  floorY: number;
  isFrozen: boolean;
  channel: number;
}

export interface ChronalBarrier {
  sprites: Phaser.GameObjects.Sprite[]; // stacked static tile sprites — all solid, all must be removed on open
  x: number;
  isOpen: boolean;
  index: number;
}

export interface PhaseWall {
  sprites: Phaser.GameObjects.Sprite[];
  x: number;
  width: number;
  isPassed: boolean;
}

/**
 * GauntletWorldBuilder
 * ────────────────────
 * Builds all 6 visual sectors with mechanics that ENFORCE ability use:
 *  S1 – Water channels have NO bypass platforms. Player MUST freeze (E/J) to cross.
 *  S2 – Lava pits only crossable via high bridges (y=200). Requires VENT boost (E/J).
 *  S3 – Sentinel drones patrol every choke point. Returns spawn positions to scene.
 *  S4 – Full-height Chronal Barriers block forward progress. PULSE (E/J) to dissolve.
 *  S5 – Full-height Phase Walls block progress. PHASE SHIFT (E/J) teleports through.
 *  S6 – Frost flume + socket puzzle as before.
 */
export class GauntletWorldBuilder {
  private scene: Phaser.Scene;
  public staticGroup: Phaser.Physics.Arcade.StaticGroup;
  public hazardGroup: Phaser.Physics.Arcade.StaticGroup;

  // S1 – liquid nitrogen tiles for freeze mechanic
  public waterTiles: WaterHazardTile[] = [];

  // S4 – chronal barriers (full-height gates)
  public chronalBarriers: ChronalBarrier[] = [];

  // S5 – phase walls (full-height walls requiring teleport)
  public phaseWalls: PhaseWall[] = [];

  // S3 – sentinel spawn positions returned to scene for drone creation + overlap setup
  public sentinelSpawnPoints: Array<{
    x: number; y: number; patrolLeft: number; patrolRight: number;
  }> = [];

  constructor(
    scene: Phaser.Scene,
    staticGroup: Phaser.Physics.Arcade.StaticGroup,
    hazardGroup: Phaser.Physics.Arcade.StaticGroup
  ) {
    this.scene = scene;
    this.staticGroup = staticGroup;
    this.hazardGroup = hazardGroup;
  }

  public buildAll(): void {
    this.waterTiles = [];
    this.chronalBarriers = [];
    this.phaseWalls = [];
    this.sentinelSpawnPoints = [];
    this.buildStartPad();
    this.buildSection1FrozenAge();
    this.buildSection2HeatAge();
    this.buildSection3MedievalPalace();
    this.buildSection4AncientForest();
    this.buildSection5RealitySwap();
    this.buildSection6ConvergenceCore();
  }

  // ── PUBLIC API ──────────────────────────────────────────────────────────────

  /**
   * Converts liquid nitrogen (water) tiles into solid walkable ice platforms.
   * Called from Level6Scene when S1 / S6 ability is used.
   */
  public freezeWater(channel?: number): number {
    let count = 0;
    this.waterTiles.forEach(wt => {
      if (channel !== undefined && wt.channel !== channel) return;
      if (wt.isFrozen) return;
      wt.isFrozen = true;
      count++;

      // Swap texture to ice and reposition to floor surface
      wt.sprite.setTexture('tile_ice').setTint(0x00f0ff).setAlpha(1);
      wt.sprite.setPosition(wt.x, wt.floorY);

      // Remove hazard physics
      this.hazardGroup.remove(wt.sprite);
      if (wt.sprite.body) (wt.sprite.body as Phaser.Physics.Arcade.StaticBody).enable = false;

      if (wt.spike) {
        this.hazardGroup.remove(wt.spike);
        if (wt.spike.body) (wt.spike.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        wt.spike.setAlpha(0.1);
      }

      // Re-add as solid walkable platform
      this.scene.physics.add.existing(wt.sprite, true);
      this.staticGroup.add(wt.sprite);
      (wt.sprite.body as Phaser.Physics.Arcade.StaticBody).setSize(32, 20).setOffset(0, 0);

      // Frost burst particles
      this.scene.add.particles(wt.x, wt.floorY - 6, 'proto_tile', {
        speedY: { min: -50, max: -10 }, speedX: { min: -20, max: 20 },
        scale: { start: 0.4, end: 0 },
        tint: [0x00f0ff, 0xade8f4, 0xffffff],
        lifespan: 450, quantity: 6
      }).setDepth(15);
    });
    return count;
  }

  /**
   * Opens the chronal barrier nearest to playerX within `range` px.
   * Disables ALL stacked tile bodies so the gap is immediately passable.
   * Returns the barrier index opened, or -1 if none found.
   */
  public openNearestChronalBarrier(playerX: number, range = 280): number {
    let nearest = -1;
    let nearestDist = range;
    this.chronalBarriers.forEach((b, i) => {
      if (b.isOpen) return;
      const dist = Math.abs(b.x - playerX);
      if (dist < nearestDist) { nearestDist = dist; nearest = i; }
    });
    if (nearest === -1) return -1;

    const barrier = this.chronalBarriers[nearest];
    barrier.isOpen = true;

    // Immediately disable all physics bodies so player can walk through
    barrier.sprites.forEach(s => {
      this.staticGroup.remove(s);
      if (s.body) (s.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    });

    // Animate the visual tiles out (staggered)
    barrier.sprites.forEach((s, tileIdx) => {
      this.scene.tweens.add({
        targets: s,
        alpha: 0,
        scaleX: 0,
        x: barrier.x + (tileIdx % 2 === 0 ? -24 : 24),
        duration: 450 + tileIdx * 20,
        ease: 'Power2',
        onComplete: () => s.destroy()
      });
    });

    // Particle column at barrier x
    for (let py = 20; py <= 320; py += 48) {
      this.scene.add.particles(barrier.x, py, 'proto_tile', {
        speedY: { min: -60, max: 60 }, speedX: { min: -80, max: 80 },
        scale: { start: 0.5, end: 0 },
        tint: [0x52b788, 0x70e000, 0xffd166, 0xffffff],
        lifespan: 600, quantity: 5
      }).setDepth(20);
    }

    return nearest;
  }

  /**
   * Attempts to teleport the player through a phase wall directly ahead.
   * Returns new X position if a wall was found and passed, or -1 if none.
   */
  public teleportThroughPhaseWall(playerX: number, facingRight: boolean): number {
    const lookAhead = 140;
    for (const pw of this.phaseWalls) {
      if (pw.isPassed) continue;
      if (facingRight && playerX < pw.x && pw.x - playerX < lookAhead) {
        pw.isPassed = true;
        this._dissolvePhaseWall(pw);
        return pw.x + pw.width + 30; // land on far side
      }
      if (!facingRight && playerX > pw.x + pw.width && playerX - (pw.x + pw.width) < lookAhead) {
        pw.isPassed = true;
        this._dissolvePhaseWall(pw);
        return pw.x - 30; // land on far side
      }
    }
    return -1;
  }

  private _dissolvePhaseWall(pw: PhaseWall): void {
    pw.sprites.forEach(s => {
      this.staticGroup.remove(s);
      if (s.body) (s.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      this.scene.tweens.add({
        targets: s, alpha: 0, duration: 400, ease: 'Power2',
        onComplete: () => s.destroy()
      });
    });
    this.scene.add.particles(pw.x + pw.width / 2, 160, 'proto_tile', {
      speedY: { min: -80, max: 80 }, speedX: { min: -80, max: 80 },
      scale: { start: 0.5, end: 0 },
      tint: [0xff007f, 0x00f0ff, 0xffffff],
      lifespan: 600, quantity: 20
    }).setDepth(20);
  }

  /**
   * Builds an ornate relic altar at the end of each section.
   * The section's collectible key floats above this altar.
   * Player must approach and collect it, then bring it to S6.
   */
  private buildSectionRelicAltar(
    x: number,
    relicName: string,
    color: number,
    floorTile: string
  ): void {
    const floorY = LEVEL6_CONFIG.dimensions.floorY;

    // 3-tier altar base
    // Tier 3 (widest, floor level): 5 tiles wide at floorY
    for (let tx = x - 64; tx <= x + 64; tx += 32) {
      const t = this.scene.add.sprite(tx, floorY - 32, floorTile).setTint(color).setDepth(11);
      this.scene.physics.add.existing(t, true); this.staticGroup.add(t);
    }
    // Tier 2: 3 tiles wide at floorY-64
    for (let tx = x - 32; tx <= x + 32; tx += 32) {
      const t = this.scene.add.sprite(tx, floorY - 64, floorTile).setTint(color).setDepth(11);
      this.scene.physics.add.existing(t, true); this.staticGroup.add(t);
    }
    // Tier 1 (top, narrowest): 1 tile at floorY-96
    const topTile = this.scene.add.sprite(x, floorY - 96, floorTile).setTint(color).setDepth(11);
    this.scene.physics.add.existing(topTile, true); this.staticGroup.add(topTile);

    // Glowing altar light beam (decorative graphics)
    const gfx = this.scene.add.graphics().setDepth(10);
    gfx.fillStyle(color, 0.12);
    gfx.fillRect(x - 4, 0, 8, floorY - 96);

    // Color-coded outline
    gfx.lineStyle(1, color, 0.5);
    gfx.strokeRect(x - 6, floorY - 100, 12, 100);

    // Ambient particles rising from altar
    this.scene.add.particles(x, floorY - 100, 'proto_tile', {
      speedY: { min: -60, max: -20 },
      speedX: { min: -12, max: 12 },
      scale: { start: 0.3, end: 0 },
      tint: [color, 0xffffff],
      alpha: { start: 0.8, end: 0 },
      lifespan: 1200,
      quantity: 1,
      frequency: 180
    }).setDepth(13);

    // Relic label
    this.scene.add.text(x, floorY - 175, `★ ${relicName}\n  RELIC ALTAR  `, {
      fontFamily: '"Share Tech Mono", monospace',
      fontSize: '8px', fontStyle: 'bold',
      color: '#' + color.toString(16).padStart(6, '0'),
      backgroundColor: '#070b14',
      padding: { x: 4, y: 3 }
    }).setOrigin(0.5).setDepth(13);

    this.scene.add.text(x, floorY - 148, '⬆ COLLECT RELIC\nTHEN PLACE AT S6 ALTAR', {
      fontFamily: '"Share Tech Mono", monospace',
      fontSize: '7px',
      color: '#ffd166',
      backgroundColor: '#070b14',
      padding: { x: 3, y: 2 }
    }).setOrigin(0.5).setDepth(13);
  }

  // ── S0: Start Pad ───────────────────────────────────────────────────────────
  private buildStartPad(): void {
    const s = LEVEL6_CONFIG.sections.startPad;
    const floorY = LEVEL6_CONFIG.dimensions.floorY;

    const bg = this.scene.add.graphics().setDepth(-5);
    bg.fillStyle(0x020711, 1);
    bg.fillRect(s.startX, 0, s.endX - s.startX, 360);

    for (let x = s.startX; x <= s.endX; x += 32) {
      const tile = this.scene.add.sprite(x, floorY, 'tile_concrete_top').setDepth(10);
      this.scene.physics.add.existing(tile, true); this.staticGroup.add(tile);
      const sub = this.scene.add.sprite(x, floorY + 32, 'tile_concrete').setDepth(9);
      this.scene.physics.add.existing(sub, true); this.staticGroup.add(sub);
    }
    for (let y = 0; y <= floorY; y += 32) {
      const wall = this.scene.add.sprite(0, y, 'tile_concrete').setDepth(12);
      this.scene.physics.add.existing(wall, true); this.staticGroup.add(wall);
    }

    this.scene.add.text(60, 130, '// SECTOR 6: THE GAUNTLET //', {
      fontFamily: '"Share Tech Mono", monospace', fontSize: '12px', fontStyle: 'bold',
      color: '#00f0ff', backgroundColor: '#070b14', padding: { x: 6, y: 4 }
    }).setDepth(11);
    this.scene.add.text(60, 170, 'EACH WORLD REQUIRES ITS UNIQUE ABILITY TO ADVANCE', {
      fontFamily: '"Share Tech Mono", monospace', fontSize: '8px',
      color: '#8b9bb4', backgroundColor: '#070b14', padding: { x: 4, y: 2 }
    }).setDepth(11);
    this.scene.add.text(60, 195, '[A/D] MOVE   [W/SPACE] JUMP   [E/J] ABILITY', {
      fontFamily: '"Share Tech Mono", monospace', fontSize: '9px',
      color: '#70e000', backgroundColor: '#070b14', padding: { x: 4, y: 2 }
    }).setDepth(11);
    this.scene.add.text(60, 220, '> S1:FREEZE  S2:VENT  S3:CLOAK  S4:PULSE  S5:PHASE  S6:ALL', {
      fontFamily: '"Share Tech Mono", monospace', fontSize: '8px',
      color: '#ffd166', backgroundColor: '#070b14', padding: { x: 4, y: 2 }
    }).setDepth(11);
  }

  // ── S1: Frozen Age ──────────────────────────────────────────────────────────
  // MECHANIC: Two liquid nitrogen channels block the floor path.
  // There are NO stepping platforms over the channels.
  // Player MUST use [E/J] FREEZE to convert water → ice bridge.
  private buildSection1FrozenAge(): void {
    const s = LEVEL6_CONFIG.sections.s1;
    const floorY = LEVEL6_CONFIG.dimensions.floorY; // 320

    // Dark icy cave background with stalactites
    const bg = this.scene.add.graphics().setDepth(-5);
    bg.fillStyle(0x050d1a, 1);
    bg.fillRect(s.startX, 0, s.endX - s.startX, 360);
    bg.fillStyle(0x0e2238, 0.7);
    for (let x = s.startX + 20; x < s.endX; x += 110) {
      bg.fillTriangle(x, 0, x + 25, 100, x + 50, 0);
    }

    // Channel 1: x=880–1152 (9 tiles, 288px gap)
    const CH1_START = 880, CH1_END = 1152;
    // Channel 2: x=1440–1712 (9 tiles, 288px gap)
    const CH2_START = 1440, CH2_END = 1712;

    for (let x = s.startX; x <= s.endX; x += 32) {
      const inCh1 = x >= CH1_START && x <= CH1_END;
      const inCh2 = x >= CH2_START && x <= CH2_END;

      if (inCh1 || inCh2) {
        // Hazard: liquid nitrogen water tile
        const water = this.scene.add.sprite(x, floorY + 6, 'tile_water').setDepth(10).setAlpha(0.92);
        this.scene.physics.add.existing(water, true);
        this.hazardGroup.add(water);

        // Submerged spike
        const spike = this.scene.add.sprite(x, floorY + 28, 'hazard_icicle').setDepth(9);
        this.scene.physics.add.existing(spike, true);
        this.hazardGroup.add(spike);

        this.waterTiles.push({
          sprite: water, spike,
          x, y: floorY + 6, floorY,
          isFrozen: false,
          channel: inCh1 ? 1 : 2
        });
      } else {
        // Solid snow floor
        const top = this.scene.add.sprite(x, floorY, 'tile_snow_top').setDepth(10);
        this.scene.physics.add.existing(top, true); this.staticGroup.add(top);
        const sub = this.scene.add.sprite(x, floorY + 32, 'tile_ice').setDepth(9);
        this.scene.physics.add.existing(sub, true); this.staticGroup.add(sub);
      }
    }

    // Ceiling icicle hazards (decorative + lethal if jumped into)
    [940, 1020, 1090, 1490, 1570, 1640].forEach(ix => {
      const ic = this.scene.add.sprite(ix, 52, 'hazard_icicle').setAngle(180).setDepth(12);
      this.scene.physics.add.existing(ic, true); this.hazardGroup.add(ic);
    });

    // Small ledge platforms (approach edges only — NOT crossing the channels)
    // These help the player position to use the freeze ability
    [
      { x: 830, y: 285, w: 64 },   // Approach ledge before channel 1
      { x: 1200, y: 285, w: 64 },  // Landing ledge after channel 1
      { x: 1380, y: 285, w: 64 },  // Approach ledge before channel 2
      { x: 1760, y: 285, w: 64 },  // Landing ledge after channel 2
      { x: 1900, y: 265, w: 96 },  // Bonus cache ledge
    ].forEach(p => {
      for (let px = p.x - p.w / 2; px <= p.x + p.w / 2; px += 32) {
        const tile = this.scene.add.sprite(px, p.y, 'tile_ice').setDepth(10);
        this.scene.physics.add.existing(tile, true); this.staticGroup.add(tile);
      }
    });

    // Ornate Relic Altar at Section 1 end — holds the Frost Relic
    this.buildSectionRelicAltar(2080, 'FROST RELIC', 0x00f0ff, 'tile_ice_top');

    // Hint signs
    this.scene.add.text(640, 240, '⚠ LIQUID NITROGEN CHASM\n[E/J] FREEZE TO CROSS', {
      fontFamily: '"Share Tech Mono", monospace', fontSize: '8px',
      color: '#00f0ff', backgroundColor: '#070b14', padding: { x: 4, y: 2 }
    }).setDepth(11);
    this.scene.add.text(1250, 240, '⚠ SECOND NITROGEN CHANNEL\nFREEZE AGAIN TO CROSS', {
      fontFamily: '"Share Tech Mono", monospace', fontSize: '8px',
      color: '#00f0ff', backgroundColor: '#070b14', padding: { x: 4, y: 2 }
    }).setDepth(11);
  }

  // ── S2: Heat Age ────────────────────────────────────────────────────────────
  // MECHANIC: Lava pits with floating bridges at y=200.
  // Normal jump max rise = 76px → can only reach y=244. Cannot reach y=200.
  // VENT boost: setVelocityY(-480) → 144px rise → easily reaches y=200.
  // Therefore: player MUST use [E/J] VENT to cross both lava pits.
  private buildSection2HeatAge(): void {
    const s = LEVEL6_CONFIG.sections.s2;
    const floorY = LEVEL6_CONFIG.dimensions.floorY;

    // Volcanic background
    const bg = this.scene.add.graphics().setDepth(-5);
    bg.fillStyle(0x1a0604, 1);
    bg.fillRect(s.startX, 0, s.endX - s.startX, 360);
    bg.lineStyle(2, 0xff3300, 0.4);
    for (let x = s.startX + 40; x < s.endX; x += 130) {
      bg.lineBetween(x, 360, x + 30, 220);
      bg.lineBetween(x + 30, 220, x + 60, 280);
    }

    // Lava pit 1: x=2820–3060 (8 tiles = 256px gap)
    const LAVA1_START = 2820, LAVA1_END = 3060;
    // Lava pit 2: x=3480–3720 (8 tiles = 256px gap)
    const LAVA2_START = 3480, LAVA2_END = 3720;

    for (let x = s.startX; x <= s.endX; x += 32) {
      const inLava1 = x >= LAVA1_START && x <= LAVA1_END;
      const inLava2 = x >= LAVA2_START && x <= LAVA2_END;
      if (inLava1 || inLava2) {
        const l1 = this.scene.add.sprite(x, floorY + 12, 'tile_lava').setDepth(10);
        this.scene.physics.add.existing(l1, true); this.hazardGroup.add(l1);
        const l2 = this.scene.add.sprite(x, floorY + 36, 'tile_lava').setDepth(9);
        this.scene.physics.add.existing(l2, true); this.hazardGroup.add(l2);
      } else {
        const top = this.scene.add.sprite(x, floorY, 'tile_stone_top').setTint(0xff6b35).setDepth(10);
        this.scene.physics.add.existing(top, true); this.staticGroup.add(top);
        const sub = this.scene.add.sprite(x, floorY + 32, 'tile_obsidian').setDepth(9);
        this.scene.physics.add.existing(sub, true); this.staticGroup.add(sub);
      }
    }

    // VENT-ONLY BRIDGES at y=200 (110px above floor — impossible without vent)
    // Bridge 1 spans lava pit 1
    for (let bx = LAVA1_START; bx <= LAVA1_END; bx += 32) {
      const b = this.scene.add.sprite(bx, 200, 'tile_stone').setTint(0xff6b35).setDepth(10);
      this.scene.physics.add.existing(b, true); this.staticGroup.add(b);
    }
    // Bridge 2 spans lava pit 2
    for (let bx = LAVA2_START; bx <= LAVA2_END; bx += 32) {
      const b = this.scene.add.sprite(bx, 200, 'tile_stone').setTint(0xff6b35).setDepth(10);
      this.scene.physics.add.existing(b, true); this.staticGroup.add(b);
    }

    // Descent steps on the far side of each bridge (y=240 then floor)
    // Bridge 1 exit
    for (let dx = LAVA1_END + 32; dx <= LAVA1_END + 96; dx += 32) {
      const s1 = this.scene.add.sprite(dx, 255, 'tile_stone').setTint(0xff6b35).setDepth(10);
      this.scene.physics.add.existing(s1, true); this.staticGroup.add(s1);
    }
    // Bridge 2 exit
    for (let dx = LAVA2_END + 32; dx <= LAVA2_END + 96; dx += 32) {
      const s2 = this.scene.add.sprite(dx, 255, 'tile_stone').setTint(0xff6b35).setDepth(10);
      this.scene.physics.add.existing(s2, true); this.staticGroup.add(s2);
    }

    // Thermal vent emitters at floor just before each pit
    [LAVA1_START - 16, LAVA2_START - 16].forEach(vx => {
      this.scene.add.particles(vx, floorY - 8, 'proto_tile', {
        speedY: { min: -200, max: -100 }, speedX: { min: -12, max: 12 },
        scale: { start: 0.4, end: 0 },
        tint: [0xffaa00, 0xff3300, 0xffd166],
        lifespan: 700, quantity: 3, frequency: 150
      }).setDepth(11);
      this.scene.add.text(vx - 44, floorY - 70, '▲ VENT HERE\n[E/J] BOOST UP', {
        fontFamily: '"Share Tech Mono", monospace', fontSize: '7px',
        color: '#ff6b35', backgroundColor: '#070b14', padding: { x: 3, y: 2 }
      }).setDepth(12);
    });

    // Bridge level hint text
    this.scene.add.text(LAVA1_START + 20, 148, '↓ LAND HERE AFTER VENT', {
      fontFamily: '"Share Tech Mono", monospace', fontSize: '7px',
      color: '#ffd166', backgroundColor: '#1a0604', padding: { x: 3, y: 1 }
    }).setDepth(12);

    // Approach platforms
    [
      { x: 3870, y: 280, w: 80 },
      { x: 3990, y: 255, w: 96 }
    ].forEach(p => {
      for (let px = p.x - p.w / 2; px <= p.x + p.w / 2; px += 32) {
        const tile = this.scene.add.sprite(px, p.y, 'tile_stone').setTint(0xff6b35).setDepth(10);
        this.scene.physics.add.existing(tile, true); this.staticGroup.add(tile);
      }
    });

    // Ornate Relic Altar at Section 2 end — holds the Ember Relic
    this.buildSectionRelicAltar(4090, 'EMBER RELIC', 0xff6b35, 'tile_stone');

    this.scene.add.text(s.startX + 60, 240, 'S2: HEAT AGE — [E/J] THERMAL VENT TO BOOST ACROSS LAVA', {
      fontFamily: '"Share Tech Mono", monospace', fontSize: '8px',
      color: '#ff6b35', backgroundColor: '#070b14', padding: { x: 4, y: 2 }
    }).setDepth(11);
  }

  // ── S3: Medieval Palace ─────────────────────────────────────────────────────
  // MECHANIC: SentinelDrones patrol every corridor section.
  // detectRange = 110px, alertSpeed = 100. Player takes damage on contact.
  // [E/J] CAMOUFLAGE: scene passes fake coords to drones → they patrol away.
  // Drones spread 250-350px apart covering full S3 width — cannot be bypassed.
  private buildSection3MedievalPalace(): void {
    const s = LEVEL6_CONFIG.sections.s3;
    const floorY = LEVEL6_CONFIG.dimensions.floorY;

    // Castle background
    const bg = this.scene.add.graphics().setDepth(-5);
    bg.fillStyle(0x0c111d, 1);
    bg.fillRect(s.startX, 0, s.endX - s.startX, 360);
    bg.fillStyle(0x192132, 0.85);
    for (let x = s.startX; x < s.endX; x += 180) {
      bg.fillRect(x, 60, 60, 300); bg.fillRect(x - 10, 50, 80, 20);
    }

    // Castle brick floor
    for (let x = s.startX; x <= s.endX; x += 32) {
      if (x >= 5700 && x <= 5900) {
        // Moat chasm (hazard pit)
        const moat = this.scene.add.sprite(x, floorY + 24, 'tile_stone').setTint(0x050810).setDepth(8);
        this.scene.physics.add.existing(moat, true); this.hazardGroup.add(moat);
      } else {
        const top = this.scene.add.sprite(x, floorY, 'tile_castle_brick').setDepth(10);
        this.scene.physics.add.existing(top, true); this.staticGroup.add(top);
        const sub = this.scene.add.sprite(x, floorY + 32, 'tile_stone').setDepth(9);
        this.scene.physics.add.existing(sub, true); this.staticGroup.add(sub);
      }
    }

    // Drawbridge over moat at y=295 (25px drop from floor — easily jumped down onto)
    for (let bx = 5716; bx <= 5884; bx += 32) {
      const bridge = this.scene.add.sprite(bx, 295, 'tile_wood_drawbridge').setDepth(10);
      this.scene.physics.add.existing(bridge, true); this.staticGroup.add(bridge);
    }

    // Decorative pillars and torches
    for (let x = s.startX + 100; x < s.endX; x += 220) {
      this.scene.add.sprite(x, floorY - 48, 'tile_gold_pillar').setDepth(8);
      this.scene.add.sprite(x, floorY - 96, 'torch_sconce').setDepth(9);
      this.scene.add.particles(x, floorY - 104, 'proto_tile', {
        speed: { min: 5, max: 20 }, scale: { start: 0.3, end: 0 },
        tint: [0xffa500, 0xff3300, 0xffd166], lifespan: 400, quantity: 1, frequency: 250
      }).setDepth(10);
    }
    for (let x = s.startX + 160; x < s.endX; x += 360) {
      this.scene.add.sprite(x, 140, 'banner_royal').setDepth(7);
    }

    // 5 sentinel patrol spawn points — spread evenly across S3 (4600–6300)
    // Each drone patrols ±120px. Together they cover the full corridor.
    // Player can NOT walk past without entering detection range.
    this.sentinelSpawnPoints = [
      { x: 4800, y: 258, patrolLeft: 4680, patrolRight: 4960 },
      { x: 5060, y: 258, patrolLeft: 4970, patrolRight: 5200 },
      { x: 5320, y: 258, patrolLeft: 5210, patrolRight: 5460 },
      { x: 5680, y: 258, patrolLeft: 5470, patrolRight: 5810 }, // spans moat
      { x: 6020, y: 258, patrolLeft: 5860, patrolRight: 6180 },
    ];

    // Ornate Relic Altar at Section 3 end — holds the Royal Sigil
    this.buildSectionRelicAltar(6150, 'ROYAL SIGIL', 0xd4af37, 'tile_castle_brick');

    // Guard zone warning signs
    this.scene.add.text(s.startX + 60, 220, 'S3: PALACE — ROYAL GUARDS BLOCK THE WAY\n[E/J] CAMOUFLAGE TO SLIP PAST UNSEEN', {
      fontFamily: '"Share Tech Mono", monospace', fontSize: '8px',
      color: '#d4af37', backgroundColor: '#070b14', padding: { x: 4, y: 2 }
    }).setDepth(11);

    [4680, 5050, 5350, 5650, 5950].forEach(gx => {
      this.scene.add.text(gx, 190, '⚠ GUARD\nZONE', {
        fontFamily: '"Share Tech Mono", monospace', fontSize: '7px',
        color: '#ff4444', backgroundColor: '#070b14', padding: { x: 2, y: 1 }
      }).setDepth(12);
    });
  }

  // ── S4: Ancient Forest ──────────────────────────────────────────────────────
  // MECHANIC: 3 Chronal Barriers (full-height solid walls) block forward progress.
  // Normal jump max = 76px — walls are 300px tall, completely impassable.
  // [E/J] CHRONAL PULSE near a barrier dissolves it in a 500ms tween.
  // Player must use ability 3 times (one per barrier) to clear the path.
  private buildSection4AncientForest(): void {
    const s = LEVEL6_CONFIG.sections.s4;
    const floorY = LEVEL6_CONFIG.dimensions.floorY;

    const bg = this.scene.add.graphics().setDepth(-5);
    bg.fillStyle(0x04160e, 1);
    bg.fillRect(s.startX, 0, s.endX - s.startX, 360);
    bg.fillStyle(0x0e2e1f, 0.85);
    for (let x = s.startX + 60; x < s.endX; x += 220) {
      bg.fillRect(x, 0, 48, 360); bg.fillCircle(x + 24, 60, 80);
    }

    // Forest floor with ravine
    for (let x = s.startX; x <= s.endX; x += 32) {
      if (x >= 7500 && x <= 7700) {
        // Ravine chasm
        const ch = this.scene.add.sprite(x, floorY + 28, 'proto_tile')
          .setTint(0x020805).setDisplaySize(32, 48).setDepth(8);
        this.scene.physics.add.existing(ch, true); this.hazardGroup.add(ch);
      } else {
        const top = this.scene.add.sprite(x, floorY, 'tile_stone_top').setTint(0x52b788).setDepth(10);
        this.scene.physics.add.existing(top, true); this.staticGroup.add(top);
        const sub = this.scene.add.sprite(x, floorY + 32, 'tile_stone').setTint(0x1b4332).setDepth(9);
        this.scene.physics.add.existing(sub, true); this.staticGroup.add(sub);
      }
    }

    // Vine bridge across ravine at y=292 (drop 28px from floor)
    for (let bx = 7500; bx <= 7700; bx += 32) {
      const vine = this.scene.add.sprite(bx, 292, 'tile_stone').setTint(0x2d6a4f).setDepth(10);
      this.scene.physics.add.existing(vine, true); this.staticGroup.add(vine);
    }

    // Hanging vines decoration
    const vineGfx = this.scene.add.graphics().setDepth(7);
    vineGfx.lineStyle(2, 0x2d6a4f, 0.8);
    for (let vx = s.startX + 80; vx < s.endX; vx += 140) {
      vineGfx.lineBetween(vx, 0, vx + 10, 80);
    }

    // CHRONAL PILLARS / BARRIERS — 3 full-height, double-column SOLID WALLS (64px thick)
    // Stacked from y=-32 to y=360 using true static physics bodies.
    // Player cannot jump over or bypass without using [E/J] Chronal Pulse.
    const BARRIER_XS = [6960, 7300, 7800];
    BARRIER_XS.forEach((bx, idx) => {
      const barrierSprites: Phaser.GameObjects.Sprite[] = [];

      // Double-column solid static tiles (64px wide wall, -32px to 360px high)
      for (let by = -32; by <= 360; by += 32) {
        for (const colX of [bx - 16, bx + 16]) {
          const tile = this.scene.add.sprite(colX, by, 'tile_stone')
            .setTint(0x52b788)
            .setDepth(14);
          this.scene.physics.add.existing(tile, true);
          this.staticGroup.add(tile);
          barrierSprites.push(tile);
        }

        // Alternating glowing chronal runes on the pillar
        if (by >= 32 && by <= 280 && by % 64 === 0) {
          const rune = this.scene.add.text(bx, by, '⧖', {
            fontSize: '12px', color: '#70e000', fontStyle: 'bold'
          }).setOrigin(0.5).setDepth(15).setAlpha(0.85);
          this.scene.tweens.add({
            targets: rune, alpha: 0.35, yoyo: true, repeat: -1,
            duration: 650 + idx * 80
          });
        }
      }

      // Pulsing energy field on the barrier tiles
      this.scene.tweens.add({
        targets: barrierSprites,
        alpha: 0.7,
        yoyo: true, repeat: -1, duration: 750 + idx * 100
      });

      this.chronalBarriers.push({ sprites: barrierSprites, x: bx, isOpen: false, index: idx });

      this.scene.add.text(bx, 28, `⧖ CHRONAL PILLAR ${idx + 1}/3\n[E/J] PULSE TO DISSOLVE`, {
        fontFamily: '"Share Tech Mono", monospace', fontSize: '7px', fontStyle: 'bold',
        color: '#70e000', backgroundColor: '#04160e', padding: { x: 4, y: 2 }
      }).setOrigin(0.5).setDepth(15);
    });

    // Ornate Relic Altar at Section 4 end — holds the Chrono Seed
    this.buildSectionRelicAltar(8150, 'CHRONO SEED', 0x52b788, 'tile_stone_top');

    this.scene.add.text(s.startX + 60, 230, 'S4: FOREST — [E/J] CHRONAL PULSE\nTO DISSOLVE EACH ANCIENT LOCK', {
      fontFamily: '"Share Tech Mono", monospace', fontSize: '8px',
      color: '#52b788', backgroundColor: '#070b14', padding: { x: 4, y: 2 }
    }).setDepth(11);
  }

  // ── S5: Reality Swap ────────────────────────────────────────────────────────
  // MECHANIC: 3 Phase Walls (full-height 48px-wide solid walls) block progress.
  // Walls go from y=0 to y=360 — impossible to jump over.
  // [E/J] PHASE SHIFT teleports player 120px forward, through the 48px wall.
  // Player must use ability 3 times (one per wall) to clear the path.
  private buildSection5RealitySwap(): void {
    const s = LEVEL6_CONFIG.sections.s5;
    const floorY = LEVEL6_CONFIG.dimensions.floorY;

    const bg = this.scene.add.graphics().setDepth(-5);
    bg.fillStyle(0x070b14, 1);
    bg.fillRect(s.startX, 0, s.endX - s.startX, 360);
    bg.lineStyle(1, 0x00f0ff, 0.18);
    for (let x = s.startX; x < s.endX; x += 36) bg.lineBetween(x, 0, x, 360);
    for (let y = 0; y < 360; y += 36) bg.lineBetween(s.startX, y, s.endX, y);
    bg.fillStyle(0x111c30, 0.85);
    for (let x = s.startX + 120; x < s.endX; x += 260) {
      bg.fillRect(x, 40, 70, 320);
      bg.lineStyle(2, 0xff007f, 0.6);
      bg.strokeRect(x, 40, 70, 320);
    }

    // Cyber floor
    for (let x = s.startX; x <= s.endX; x += 32) {
      if ((x >= 9300 && x <= 9500) || (x >= 9900 && x <= 10100)) {
        // Void chasms
        const vt = this.scene.add.sprite(x, floorY + 20, 'proto_tile')
          .setTint(0xff007f).setDisplaySize(32, 40).setDepth(8);
        this.scene.physics.add.existing(vt, true); this.hazardGroup.add(vt);
      } else {
        const top = this.scene.add.sprite(x, floorY, 'tile_phase_a').setDepth(10);
        this.scene.physics.add.existing(top, true); this.staticGroup.add(top);
        const sub = this.scene.add.sprite(x, floorY + 32, 'tile_holo_data').setDepth(9);
        this.scene.physics.add.existing(sub, true); this.staticGroup.add(sub);
      }
    }

    // Narrow step platforms at void edges so player can position for phase shift
    [
      { x: 9264, y: 292 }, { x: 9296, y: 292 },
      { x: 9512, y: 292 }, { x: 9544, y: 292 },
      { x: 9864, y: 292 }, { x: 9896, y: 292 },
      { x: 10112, y: 292 }, { x: 10144, y: 292 },
    ].forEach(sp => {
      const tile = this.scene.add.sprite(sp.x, sp.y, 'tile_phase_b').setDepth(10);
      this.scene.physics.add.existing(tile, true); this.staticGroup.add(tile);
    });

    // PHASE WALLS — 3 full-height, double-column SOLID WALLS (64px thick)
    // Spans from y=-32 to y=360. Player MUST use [E/J] Phase Shift to teleport through.
    const PHASE_WALL_XS = [8790, 9200, 9780];

    PHASE_WALL_XS.forEach((wx, idx) => {
      const wallSprites: Phaser.GameObjects.Sprite[] = [];

      for (let wy = -32; wy <= 360; wy += 32) {
        for (const colX of [wx, wx + 32]) {
          const tile = this.scene.add.sprite(colX, wy, 'tile_phase_b')
            .setTint(0xff007f)
            .setDepth(14);
          this.scene.physics.add.existing(tile, true);
          this.staticGroup.add(tile);
          wallSprites.push(tile);
        }
      }

      this.phaseWalls.push({ sprites: wallSprites, x: wx, width: 64, isPassed: false });

      this.scene.tweens.add({
        targets: wallSprites,
        alpha: 0.65,
        yoyo: true, repeat: -1, duration: 400 + idx * 80
      });

      this.scene.add.text(wx + 16, 24, `⌀ PHASE WALL ${idx + 1}/3\n[E/J] PHASE SHIFT`, {
        fontFamily: '"Share Tech Mono", monospace', fontSize: '7px', fontStyle: 'bold',
        color: '#ff007f', backgroundColor: '#070b14', padding: { x: 3, y: 2 }
      }).setOrigin(0.5).setDepth(15);
    });

    // Ornate Relic Altar at Section 5 end — holds the Void Shard
    this.buildSectionRelicAltar(10170, 'VOID SHARD', 0xff007f, 'tile_phase_a');

    this.scene.add.text(s.startX + 60, 230, 'S5: REALITY SWAP — [E/J] PHASE SHIFT\nTO TELEPORT THROUGH PHASE WALLS', {
      fontFamily: '"Share Tech Mono", monospace', fontSize: '8px',
      color: '#ff007f', backgroundColor: '#070b14', padding: { x: 4, y: 2 }
    }).setDepth(11);
  }

  // ── S6: Convergence Core Finale ─────────────────────────────────────────────
  private buildSection6ConvergenceCore(): void {
    const s = LEVEL6_CONFIG.sections.s6;
    const floorY = LEVEL6_CONFIG.dimensions.floorY;

    const bg = this.scene.add.graphics().setDepth(-5);
    bg.fillStyle(0x02050b, 1);
    bg.fillRect(s.startX, 0, s.endX - s.startX, 360);
    bg.lineStyle(1.5, 0x00f0ff, 0.3);
    for (let x = s.startX; x < s.endX; x += 50) bg.lineBetween(x, 0, x + 30, 360);

    // S6 floor with frost flume channel
    for (let x = s.startX; x <= s.endX; x += 32) {
      if (x >= 10740 && x <= 10820) {
        const flume = this.scene.add.sprite(x, floorY + 6, 'tile_water').setDepth(10).setAlpha(0.9);
        this.scene.physics.add.existing(flume, true); this.hazardGroup.add(flume);
        this.waterTiles.push({ sprite: flume, x, y: floorY + 6, floorY, isFrozen: false, channel: 3 });
      } else {
        const top = this.scene.add.sprite(x, floorY, 'tile_metal').setDepth(10);
        this.scene.physics.add.existing(top, true); this.staticGroup.add(top);
        const sub = this.scene.add.sprite(x, floorY + 32, 'tile_concrete').setDepth(9);
        this.scene.physics.add.existing(sub, true); this.staticGroup.add(sub);
      }
    }

    // 5 Majestic Convergence Altars (pedestals at y=256-288, receptacle at y=224)
    const SOCKET_XS = [10900, 11230, 11550, 11870, 12190];
    const socketThemes = [
      { name: 'FROST ALTAR', color: 0x00f0ff, icon: '❄', relic: 'FROST RELIC' },
      { name: 'EMBER ALTAR', color: 0xff6b35, icon: '▲', relic: 'EMBER RELIC' },
      { name: 'ROYAL ALTAR', color: 0xd4af37, icon: '♜', relic: 'ROYAL SIGIL' },
      { name: 'CHRONO ALTAR', color: 0x52b788, icon: '✦', relic: 'CHRONO SEED' },
      { name: 'VOID ALTAR', color: 0xff007f, icon: '⌘', relic: 'VOID SHARD' }
    ];

    SOCKET_XS.forEach((sx, idx) => {
      const theme = socketThemes[idx];

      // 3-tier Altar Pedestal
      // Tier 3 (floor level, y=288, 5 tiles wide):
      for (let px = sx - 64; px <= sx + 64; px += 32) {
        const pt = this.scene.add.sprite(px, floorY - 32, 'tile_metal').setTint(theme.color).setDepth(11);
        this.scene.physics.add.existing(pt, true); this.staticGroup.add(pt);
      }
      // Tier 2 (mid level, y=256, 3 tiles wide):
      for (let px = sx - 32; px <= sx + 32; px += 32) {
        const pt = this.scene.add.sprite(px, floorY - 64, 'tile_metal').setTint(theme.color).setDepth(11);
        this.scene.physics.add.existing(pt, true); this.staticGroup.add(pt);
      }
      // Tier 1 (top altar, y=224, 1 tile wide):
      const topTile = this.scene.add.sprite(sx, floorY - 96, 'tile_metal').setTint(theme.color).setDepth(11);
      this.scene.physics.add.existing(topTile, true); this.staticGroup.add(topTile);

      // Receptacle glow beacon
      const gfx = this.scene.add.graphics().setDepth(10);
      gfx.fillStyle(theme.color, 0.15);
      gfx.fillRect(sx - 6, 0, 12, floorY - 96);
      gfx.lineStyle(1.5, theme.color, 0.7);
      gfx.strokeRect(sx - 10, floorY - 102, 20, 102);

      // Ambient rising energy particles
      this.scene.add.particles(sx, floorY - 100, 'proto_tile', {
        speedY: { min: -50, max: -20 }, speedX: { min: -8, max: 8 },
        scale: { start: 0.35, end: 0 },
        tint: [theme.color, 0xffffff], alpha: { start: 0.9, end: 0 },
        lifespan: 1100, quantity: 1, frequency: 160
      }).setDepth(13);

      // Altar Banner
      this.scene.add.text(sx, floorY - 160, `${theme.icon} ALTAR ${idx + 1}: ${theme.name}`, {
        fontFamily: '"Share Tech Mono", monospace', fontSize: '9px', fontStyle: 'bold',
        color: '#' + theme.color.toString(16).padStart(6, '0'),
        backgroundColor: '#070b14', padding: { x: 5, y: 3 }
      }).setOrigin(0.5).setDepth(13);

      this.scene.add.text(sx, floorY - 138, `[RECEPTACLE]\nPLACE ${theme.relic}`, {
        fontFamily: '"Share Tech Mono", monospace', fontSize: '7px',
        color: '#ffd166', backgroundColor: '#070b14', padding: { x: 3, y: 2 }
      }).setOrigin(0.5).setDepth(13);
    });

    this.scene.add.text(10530, 230, 'S6: CONVERGENCE — FILL ALL 5 SOCKETS\n[E/J] FREEZE FLUME · THEN WALK TO EACH SOCKET', {
      fontFamily: '"Share Tech Mono", monospace', fontSize: '8px',
      color: '#00f0ff', backgroundColor: '#070b14', padding: { x: 4, y: 2 }
    }).setDepth(11);

    // End wall
    for (let y = 0; y <= floorY; y += 32) {
      const wall = this.scene.add.sprite(s.endX, y, 'tile_metal').setDepth(15);
      this.scene.physics.add.existing(wall, true); this.staticGroup.add(wall);
    }
  }
}
