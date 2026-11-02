import Phaser from 'phaser';
import { GAME_FONTS } from '../../config';
import { CONVERGENCE_CONFIG } from '../../config/convergenceConfig';

export interface WorldBuildResult {
  platforms: Phaser.Physics.Arcade.StaticGroup;
  phasePlatformsA: Phaser.Physics.Arcade.StaticGroup;
  phasePlatformsB: Phaser.Physics.Arcade.StaticGroup;
  hazardGroup: Phaser.Physics.Arcade.StaticGroup;
  checkpoints: { x: number; y: number; bayId: number; active: boolean; sprite: Phaser.GameObjects.Sprite }[];
  seals: { bayId: number; name: string; x: number; y: number; completed: boolean; sprite: Phaser.GameObjects.Sprite }[];
  collectibles: { id: string; x: number; y: number; collected: boolean; sprite: Phaser.GameObjects.Sprite }[];
  conduits: { x: number; y: number; sprite: Phaser.GameObjects.Sprite }[];
  cryoGeyser: {
    x: number;
    y: number;
    waterSprite: Phaser.GameObjects.TileSprite;
    iceTiles: Phaser.Physics.Arcade.Sprite[];
    frozen: boolean;
  };
  thermalVent: {
    x: number;
    y: number;
    sprite: Phaser.GameObjects.Sprite;
    ignited: boolean;
    updraftZone: Phaser.GameObjects.Zone;
    particles?: Phaser.GameObjects.Particles.ParticleEmitter;
  };
  palaceSentry: {
    sprite: Phaser.Physics.Arcade.Sprite;
    visionGfx: Phaser.GameObjects.Graphics;
    minX: number;
    maxX: number;
  };
  tripwireLaser: Phaser.GameObjects.Rectangle;
  chronoVine: {
    saplingSprite: Phaser.GameObjects.Sprite;
    bridgeTiles: Phaser.Physics.Arcade.Sprite[];
    grown: boolean;
  };
  convergenceCore: Phaser.GameObjects.Sprite;
  finalMagma: {
    lavaSprite: Phaser.GameObjects.TileSprite;
    iceTiles: Phaser.Physics.Arcade.Sprite[];
    frozen: boolean;
  };
  finalVine: {
    saplingSprite: Phaser.GameObjects.Sprite;
    vineTiles: Phaser.Physics.Arcade.Sprite[];
    grown: boolean;
  };
  exitPortal: Phaser.GameObjects.Sprite;
}

export class ConvergenceWorldBuilder {
  public static build(scene: Phaser.Scene): WorldBuildResult {
    const FLR = CONVERGENCE_CONFIG.chamber.floorY; // 380
    const CH  = CONVERGENCE_CONFIG.chamber.height; // 480
    const CW  = CONVERGENCE_CONFIG.chamber.width;  // 3800

    // Groups
    const platforms       = scene.physics.add.staticGroup();
    const phasePlatformsA = scene.physics.add.staticGroup();
    const phasePlatformsB = scene.physics.add.staticGroup();
    const hazardGroup     = scene.physics.add.staticGroup();

    // ── Helper to lay 32x32 tiles ──────────────────────────────────────────
    const tile = (
      x: number,
      y: number,
      w: number,
      h: number,
      tex: string,
      grp: Phaser.Physics.Arcade.StaticGroup = platforms
    ): Phaser.Physics.Arcade.Sprite[] => {
      const sprites: Phaser.Physics.Arcade.Sprite[] = [];
      const n = Math.max(1, Math.ceil(w / 32));
      for (let i = 0; i < n; i++) {
        const segW = (i === n - 1 && w % 32 !== 0) ? (w % 32) : 32;
        const s = grp.create(x + i * 32 + segW / 2, y + h / 2, tex) as Phaser.Physics.Arcade.Sprite;
        s.setDisplaySize(segW, h);
        s.refreshBody();
        sprites.push(s);
      }
      return sprites;
    };

    // ── Helper to build glowing holographic signboards ─────────────────────
    const buildSignboard = (
      x: number,
      y: number,
      zoneNum: string,
      title: string,
      hint: string,
      color: number,
      icon: string
    ) => {
      const boardW = 210;
      const boardH = 54;
      const panel = scene.add.graphics().setDepth(2);

      // Semi-transparent dark background
      panel.fillStyle(0x060c18, 0.88);
      panel.fillRoundedRect(x, y, boardW, boardH, 6);
      panel.lineStyle(1.5, color, 0.8);
      panel.strokeRoundedRect(x, y, boardW, boardH, 6);

      // Corner tech accents
      panel.fillStyle(color, 1);
      panel.fillRect(x, y, 4, 4);
      panel.fillRect(x + boardW - 4, y, 4, 4);
      panel.fillRect(x, y + boardH - 4, 4, 4);
      panel.fillRect(x + boardW - 4, y + boardH - 4, 4, 4);

      // Icon & Zone title
      scene.add.text(x + 10, y + 8, `${icon} ${zoneNum}: ${title}`, {
        fontFamily: GAME_FONTS.primary,
        fontSize: '11px',
        fontStyle: 'bold',
        color: `#${color.toString(16).padStart(6, '0')}`
      }).setDepth(3);

      // Hint description
      scene.add.text(x + 10, y + 26, hint, {
        fontFamily: GAME_FONTS.mono,
        fontSize: '9px',
        color: '#e0fbfc',
        wordWrap: { width: boardW - 20 }
      }).setDepth(3);

      // Small pulsing antenna indicator above signboard
      const dot = scene.add.circle(x + boardW / 2, y - 4, 3, color, 0.9).setDepth(3);
      scene.tweens.add({
        targets: dot,
        alpha: 0.2,
        scale: 1.5,
        yoyo: true,
        repeat: -1,
        duration: 800
      });
    };

    // ── Background & Atmosphere ───────────────────────────────────────────
    const bgGfx = scene.add.graphics().setDepth(-20);
    CONVERGENCE_CONFIG.bays.forEach(bay => {
      bgGfx.fillStyle(bay.palette.bg, 1);
      bgGfx.fillRect(bay.startX, 0, bay.endX - bay.startX, CH);
      // Subtle edge ambient blending
      bgGfx.fillStyle(bay.palette.ambient, 0.4);
      bgGfx.fillRect(bay.endX - 32, 0, 32, CH);
    });
    const apex = CONVERGENCE_CONFIG.convergenceRoom;
    bgGfx.fillStyle(apex.palette.bg, 1);
    bgGfx.fillRect(apex.startX, 0, apex.endX - apex.startX, CH);

    // Parallax grid lines
    const grid = scene.add.graphics().setDepth(-15).setScrollFactor(0.2);
    grid.lineStyle(1, 0x1f2e4d, 0.18);
    for (let gx = 0; gx < CW; gx += 64) grid.lineBetween(gx, 0, gx, CH);
    for (let gy = 0; gy < CH; gy += 40) grid.lineBetween(0, gy, CW, gy);

    // ─────────────────────────────────────────────────────────────────────
    // BAY 1: FROZEN AGE (0–740)
    // ─────────────────────────────────────────────────────────────────────
    // Floor & Stepping Platforms
    tile(0,   FLR,       320, 40, 'tile_snow_top');   // Entry floor
    tile(400, FLR,       340, 40, 'tile_snow_top');   // Post-geyser floor
    tile(170, FLR - 48,   70, 20, 'tile_ice');        // Stepping ledge
    tile(500, FLR - 50,   80, 20, 'tile_crumble');    // Secret crumble step
    tile(610, FLR - 86,  120, 24, 'tile_ice');        // Altar platform for Cryo Seal

    // Icicle stalactites hanging from ceiling
    for (const ix of [200, 310, 470, 580]) {
      const ici = hazardGroup.create(ix, 24, 'hazard_icicle') as Phaser.Physics.Arcade.Sprite;
      ici.refreshBody();
    }

    // Signboard for Bay 1
    buildSignboard(
      40, 230,
      'ZONE 1', 'CRYO ENGINE',
      'Boiling Geyser ahead!\nPress [E] to FREEZE into solid ice.',
      0x48cae4, '❄'
    );

    // Cryo Geyser (X: 320 to 400, Y: FLR - 20)
    const geyserW = 80;
    const geyserH = 60;
    const waterSprite = scene.add.tileSprite(320 + geyserW / 2, FLR - geyserH / 2, geyserW, geyserH, 'tile_water').setDepth(1);
    // Hidden solid ice blocks created upfront but disabled until frozen
    const iceTiles = tile(320, FLR - 20, geyserW, 20, 'tile_ice');
    iceTiles.forEach(t => {
      t.setVisible(false);
      (t.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    });

    // ─────────────────────────────────────────────────────────────────────
    // BAY 2: HEAT AGE (740–1400)
    // ─────────────────────────────────────────────────────────────────────
    tile(740,  FLR,       240, 40, 'tile_ember');     // Entry floor
    tile(1200, FLR,       200, 40, 'tile_ember');     // Post-lava floor
    tile(880,  FLR - 56,   80, 20, 'tile_metal');     // Vent staging ledge
    tile(1060, FLR - 110, 100, 20, 'tile_obsidian');  // Upper catwalk
    tile(1240, FLR - 140, 140, 24, 'tile_obsidian');  // Flame Seal dais

    // Lava pit across X: 980 to 1200
    for (let lx = 980; lx < 1200; lx += 32) {
      const lava = hazardGroup.create(lx + 16, FLR + 16, 'tile_lava') as Phaser.Physics.Arcade.Sprite;
      lava.setDisplaySize(32, 32);
      lava.refreshBody();
    }

    // Signboard for Bay 2
    buildSignboard(
      770, 230,
      'ZONE 2', 'THERMAL CRUCIBLE',
      'Chasm of Lava! Press [E] at the\nVent to ignite an Updraft jump.',
      0xff6b00, '🔥'
    );

    // Thermal Vent (X: 940, FLR - 16)
    const thermalVentSprite = scene.add.sprite(940, FLR - 16, 'heat_conduit').setTint(0x777777).setDepth(2);
    const ventUpdraftZone = scene.add.zone(940, FLR - 80, 50, 140);
    scene.physics.add.existing(ventUpdraftZone, true);

    // Patrolling Ember Drone
    const emberDrone = scene.physics.add.sprite(1100, FLR - 150, 'ember_drone');
    emberDrone.body.setAllowGravity(false);
    emberDrone.body.setImmovable(true);
    scene.tweens.add({
      targets: emberDrone,
      x: 1220,
      yoyo: true,
      repeat: -1,
      duration: 2000,
      ease: 'Sine.easeInOut'
    });
    hazardGroup.add(emberDrone);

    // ─────────────────────────────────────────────────────────────────────
    // BAY 3: MEDIEVAL PALACE (1400–2060)
    // ─────────────────────────────────────────────────────────────────────
    tile(1400, FLR,       660, 40, 'tile_castle_brick'); // Palace floor
    tile(1520, FLR - 2,   420,  6, 'tile_red_carpet');   // Red carpet runner
    tile(1920, FLR - 40,  120, 20, 'tile_stone_top');    // Seal alcove

    // Pillars reaching toward the ceiling
    for (const px of [1500, 1720, 1900]) {
      const pillar = scene.add.tileSprite(px, FLR - 90, 20, 180, 'tile_gold_pillar').setDepth(0);
      pillar.setAlpha(0.85);
    }

    // Torch sconces on castle walls
    for (const tx of [1480, 1620, 1780, 1940]) {
      scene.add.sprite(tx, FLR - 90, 'torch_sconce').setDepth(1);
      // Flickering torch glow
      const glow = scene.add.pointlight(tx, FLR - 95, 0xffaa00, 40, 0.4);
      scene.tweens.add({
        targets: glow,
        intensity: { from: 0.35, to: 0.55 },
        yoyo: true,
        repeat: -1,
        duration: 300 + Math.random() * 200
      });
    }

    // Royal banners
    scene.add.sprite(1560, FLR - 90, 'banner_royal').setScale(1.2).setDepth(0);
    scene.add.sprite(1860, FLR - 90, 'banner_royal').setScale(1.2).setDepth(0);

    // Signboard for Bay 3
    buildSignboard(
      1430, 230,
      'ZONE 3', 'ROYAL VAULT',
      'High Security! Press [E] to CLOAK.\nLasers & Sentry cannot detect you.',
      0xd4af37, '🛡'
    );

    // Tripwire Laser (at X: 1680)
    const tripwireLaser = scene.add.rectangle(1680, FLR - 22, 6, 44, 0xff0044, 0.85).setDepth(2);
    scene.tweens.add({
      targets: tripwireLaser,
      alpha: { from: 0.5, to: 1.0 },
      yoyo: true,
      repeat: -1,
      duration: 400
    });

    // Patrolling Royal Sentry Drone
    const palaceSentry = scene.physics.add.sprite(1760, FLR - 26, 'drone_active').setTint(0xd4af37).setDepth(3);
    palaceSentry.body.setAllowGravity(false);
    palaceSentry.body.setImmovable(true);
    const sentryVisionGfx = scene.add.graphics().setDepth(2);

    // Vault chest near the Royal Seal
    scene.add.sprite(1980, FLR - 16, 'vault_chest').setScale(1.1).setDepth(1);

    // ─────────────────────────────────────────────────────────────────────
    // BAY 4: ANCIENT FOREST (2060–2720)
    // ─────────────────────────────────────────────────────────────────────
    tile(2060, FLR,       180, 40, 'tile_stone_top');  // Entry patch
    tile(2520, FLR,       200, 40, 'tile_stone_top');  // Far bank
    tile(2160, FLR - 60,   70, 20, 'tile_scaffold');   // Scenic scaffold
    tile(2580, FLR - 80,  120, 24, 'tile_stone');      // Seal pedestal

    // Bramble chasm hazards (X: 2240 to 2520)
    for (let bx = 2240; bx < 2520; bx += 32) {
      const thorn = hazardGroup.create(bx + 16, FLR + 16, 'tile_stone') as Phaser.Physics.Arcade.Sprite;
      thorn.setTint(0x1b4332);
      thorn.setDisplaySize(32, 32);
      thorn.refreshBody();
    }

    // Signboard for Bay 4
    buildSignboard(
      2090, 230,
      'ZONE 4', 'CHRONO FOREST',
      'Spike Chasm! Stand by Sapling and\nPress [E] for CHRONO GROWTH.',
      0x52b788, '🌿'
    );

    // Chrono Sapling (at edge X: 2240, FLR - 16)
    const saplingSprite = scene.add.sprite(2240, FLR - 16, 'checkpoint_crystal').setTint(0x52b788).setScale(0.9).setDepth(2);
    scene.tweens.add({
      targets: saplingSprite,
      scaleY: 1.05,
      yoyo: true,
      repeat: -1,
      duration: 1000
    });

    // Chrono Vine Bridge (created inactive across X: 2250 to 2520)
    const bridgeW = 270;
    const bridgeTiles = tile(2250, FLR - 12, bridgeW, 16, 'tile_stone_top');
    bridgeTiles.forEach(t => {
      t.setTint(0x2d6a4f);
      t.setVisible(false);
      (t.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    });

    // ─────────────────────────────────────────────────────────────────────
    // BAY 5: REALITY SWAP (2720–3380)
    // ─────────────────────────────────────────────────────────────────────
    tile(2720, FLR,       160, 40, 'tile_concrete_top'); // Entry platform
    tile(3260, FLR,       120, 40, 'tile_concrete_top'); // Landing floor
    tile(3300, FLR - 70,  100, 20, 'tile_holo_data');    // Quantum Seal altar

    // Cyberpunk billboards & power node props
    scene.add.sprite(2770, FLR - 90, 'power_node').setDepth(0);
    scene.add.sprite(3290, FLR - 120, 'billboard_neon1').setScale(0.85).setDepth(0);

    // Glitch void hazard at floor level between 2880 and 3260
    for (let gx = 2880; gx < 3260; gx += 32) {
      const gtile = hazardGroup.create(gx + 16, FLR + 16, 'tile_glitch') as Phaser.Physics.Arcade.Sprite;
      gtile.setDisplaySize(32, 32);
      gtile.refreshBody();
    }

    // Phase Platforms A (Cyan) and B (Magenta)
    // Reality A: 2900 (Y: FLR - 50) and 3140 (Y: FLR - 50)
    tile(2900, FLR - 50, 96, 20, 'tile_phase_a', phasePlatformsA);
    tile(3140, FLR - 50, 96, 20, 'tile_phase_a', phasePlatformsA);

    // Reality B: 3020 (Y: FLR - 90)
    tile(3020, FLR - 90, 100, 20, 'tile_phase_b', phasePlatformsB);

    // Set initial Reality A active (B ghosted)
    phasePlatformsB.children.iterate((c) => {
      const p = c as Phaser.Physics.Arcade.Sprite;
      p.setAlpha(0.2);
      if (p.body) (p.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      return null;
    });

    // Signboard for Bay 5
    buildSignboard(
      2750, 230,
      'ZONE 5', 'QUANTUM RIFT',
      'Alternate Realities! Press [E] to\ntoggle Phase Platforms (Cyan/Pink).',
      0xff007f, '⚛'
    );

    // ─────────────────────────────────────────────────────────────────────
    // ZONE 6: CONVERGENCE ROOM (3380–3800)
    // ─────────────────────────────────────────────────────────────────────
    tile(3380, FLR,       180, 40, 'tile_metal');
    tile(3640, FLR,       160, 40, 'tile_metal');
    tile(3640, FLR - 150, 160, 24, 'tile_metal'); // Exit portal high platform

    // Grand colonnade
    for (const px of [3420, 3580, 3740]) {
      const pillar = scene.add.tileSprite(px, FLR - 100, 24, 200, 'tile_gold_pillar').setDepth(0);
      pillar.setAlpha(0.85);
    }
    scene.add.sprite(3760, FLR - 80, 'failsafe_array').setScale(1.2).setDepth(0);

    // Signboard for Convergence Room
    buildSignboard(
      3400, 220,
      'APEX', 'THE CONVERGENCE',
      'Claim the Convergence Core!\nFreeze the magma, climb & escape!',
      0x70e000, '★'
    );

    // Floating Convergence Core
    const coreX = 3470;
    const coreY = FLR - 40;
    const convergenceCore = scene.add.sprite(coreX, coreY, 'relic_component5').setScale(1.2).setDepth(5);
    scene.tweens.add({
      targets: convergenceCore,
      y: coreY - 14,
      yoyo: true,
      repeat: -1,
      duration: 1200,
      ease: 'Sine.easeInOut'
    });
    // Rotating aura
    const coreAura = scene.add.circle(coreX, coreY, 18, 0x70e000, 0.35).setDepth(4);
    scene.tweens.add({
      targets: coreAura,
      scale: 1.5,
      alpha: 0.1,
      yoyo: true,
      repeat: -1,
      duration: 900
    });

    // Final Magma Pit (X: 3560 to 3640)
    const finalLavaW = 80;
    const finalLavaSprite = scene.add.tileSprite(3560 + finalLavaW / 2, FLR - 10, finalLavaW, 20, 'tile_lava').setDepth(1);
    const finalMagmaIce = tile(3560, FLR - 10, finalLavaW, 20, 'tile_obsidian');
    finalMagmaIce.forEach(t => {
      t.setVisible(false);
      (t.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    });

    // Final Vine Ladder (X: 3640, Y: FLR - 130 to FLR)
    const finalSapling = scene.add.sprite(3635, FLR - 16, 'checkpoint_crystal').setTint(0x52b788).setScale(0.8).setDepth(2);
    const finalVineTiles = tile(3640, FLR - 130, 20, 130, 'tile_stone_top');
    finalVineTiles.forEach(t => {
      t.setTint(0x2d6a4f);
      t.setVisible(false);
      (t.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    });

    // Exit Portal Door
    const exitPortal = scene.add.sprite(3720, FLR - 190, 'chamber_door').setDepth(3);
    exitPortal.setTint(0x555555); // Inactive dark tint initially

    // ─────────────────────────────────────────────────────────────────────
    // CHECKPOINTS & ENERGY CONDUITS
    // ─────────────────────────────────────────────────────────────────────
    const checkpoints: { x: number; y: number; bayId: number; active: boolean; sprite: Phaser.GameObjects.Sprite }[] = [];
    const conduits: { x: number; y: number; sprite: Phaser.GameObjects.Sprite }[] = [];

    CONVERGENCE_CONFIG.bays.forEach((bay) => {
      // Checkpoint crystal
      const cpSprite = scene.add.sprite(bay.checkpointX, bay.checkpointY, 'checkpoint_crystal')
        .setTint(bay.palette.accent)
        .setDepth(2);

      checkpoints.push({
        x: bay.checkpointX,
        y: bay.checkpointY,
        bayId: bay.id,
        active: bay.id === 1,
        sprite: cpSprite
      });

      // Energy conduit for refilling charges
      const condSprite = scene.add.sprite(bay.checkpointX + 36, bay.checkpointY, 'energy_conduit')
        .setTint(bay.palette.particles)
        .setDepth(2);
      conduits.push({ x: bay.checkpointX + 36, y: bay.checkpointY, sprite: condSprite });
    });

    // ─────────────────────────────────────────────────────────────────────
    // ELEMENTAL SEALS
    // ─────────────────────────────────────────────────────────────────────
    const seals: { bayId: number; name: string; x: number; y: number; completed: boolean; sprite: Phaser.GameObjects.Sprite }[] = [];

    CONVERGENCE_CONFIG.bays.forEach((bay) => {
      const sealSprite = scene.add.sprite(bay.sealX, bay.sealY, 'checkpoint_crystal')
        .setTint(bay.palette.accent)
        .setScale(1.2)
        .setDepth(3);

      // Rotating glow animation
      scene.tweens.add({
        targets: sealSprite,
        y: bay.sealY - 6,
        yoyo: true,
        repeat: -1,
        duration: 1000,
        ease: 'Sine.easeInOut'
      });

      // Floating label above seal
      scene.add.text(bay.sealX, bay.sealY - 24, `[ ${bay.sealName} ]`, {
        fontFamily: GAME_FONTS.primary,
        fontSize: '10px',
        fontStyle: 'bold',
        color: `#${bay.palette.accent.toString(16).padStart(6, '0')}`,
        stroke: '#040711',
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(4);

      seals.push({
        bayId: bay.id,
        name: bay.sealName,
        x: bay.sealX,
        y: bay.sealY,
        completed: false,
        sprite: sealSprite
      });
    });

    // ─────────────────────────────────────────────────────────────────────
    // DATA SHARD COLLECTIBLES (One in each bay in elevated/fun spots)
    // ─────────────────────────────────────────────────────────────────────
    const collectibles: { id: string; x: number; y: number; collected: boolean; sprite: Phaser.GameObjects.Sprite }[] = [];
    const collectiblePositions = [
      { id: 'shard1', x: 500,  y: FLR - 76 },
      { id: 'shard2', x: 1060, y: FLR - 136 },
      { id: 'shard3', x: 1640, y: FLR - 60 },
      { id: 'shard4', x: 2160, y: FLR - 86 },
      { id: 'shard5', x: 3020, y: FLR - 116 }
    ];

    collectiblePositions.forEach(pos => {
      const spr = scene.add.sprite(pos.x, pos.y, 'failsafe_component').setScale(0.9).setDepth(3);
      scene.tweens.add({
        targets: spr,
        y: pos.y - 6,
        yoyo: true,
        repeat: -1,
        duration: 900,
        ease: 'Sine.easeInOut'
      });
      collectibles.push({ id: pos.id, x: pos.x, y: pos.y, collected: false, sprite: spr });
    });

    return {
      platforms,
      phasePlatformsA,
      phasePlatformsB,
      hazardGroup,
      checkpoints,
      seals,
      collectibles,
      conduits,
      cryoGeyser: {
        x: 320 + geyserW / 2,
        y: FLR - geyserH / 2,
        waterSprite,
        iceTiles,
        frozen: false
      },
      thermalVent: {
        x: 940,
        y: FLR - 16,
        sprite: thermalVentSprite,
        ignited: false,
        updraftZone: ventUpdraftZone
      },
      palaceSentry: {
        sprite: palaceSentry,
        visionGfx: sentryVisionGfx,
        minX: 1720,
        maxX: 1880
      },
      tripwireLaser,
      chronoVine: {
        saplingSprite,
        bridgeTiles,
        grown: false
      },
      convergenceCore,
      finalMagma: {
        lavaSprite: finalLavaSprite,
        iceTiles: finalMagmaIce,
        frozen: false
      },
      finalVine: {
        saplingSprite: finalSapling,
        vineTiles: finalVineTiles,
        grown: false
      },
      exitPortal
    };
  }
}
