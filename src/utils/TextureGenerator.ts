import Phaser from 'phaser';

export class TextureGenerator {
  public static generatePlayerTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists('scientist_idle')) return;

    // Helper to draw the tall, slender scientist
    const drawScientist = (frameType: 'idle' | 'walk1' | 'walk2' | 'walk3' | 'jump' | 'fall'): string => {
      const key = `scientist_${frameType}`;
      const width = 20;
      const height = 36;
      const gfx = scene.make.graphics({ x: 0, y: 0 });

      // Offsets for walking animation
      let leg1X = 7, leg1Y = 26, leg1H = 9;
      let leg2X = 11, leg2Y = 26, leg2H = 9;
      let coatSway = 0;
      let headY = 4;
      let staffY = 2;

      if (frameType === 'walk1') {
        leg1X = 5; leg1H = 8;
        leg2X = 12; leg2H = 10;
        coatSway = -1;
      } else if (frameType === 'walk2') {
        leg1X = 7; leg1H = 9;
        leg2X = 10; leg2H = 9;
      } else if (frameType === 'walk3') {
        leg1X = 10; leg1H = 10;
        leg2X = 5; leg2H = 8;
        coatSway = 1;
      } else if (frameType === 'jump') {
        leg1Y = 24; leg1H = 8;
        leg2Y = 25; leg2H = 7;
        headY = 3;
        staffY = 0;
        coatSway = 2;
      } else if (frameType === 'fall') {
        leg1Y = 27; leg1H = 8;
        leg2Y = 27; leg2H = 8;
        coatSway = -2;
      }

      // 1. Staff (Wooden/Carbon shaft with glowing cyan power core)
      gfx.fillStyle(0x4a3b32, 1);
      gfx.fillRect(3, staffY + 6, 2, 28);
      // Staff Head & Crystal
      gfx.fillStyle(0x1f3554, 1);
      gfx.fillRect(2, staffY + 2, 4, 4);
      gfx.fillStyle(0x00f0ff, 1); // Glowing cyan energy crystal
      gfx.fillRect(3, staffY + 1, 2, 3);
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillRect(3, staffY + 2, 1, 1); // Specular glint

      // 2. Legs / Boots (Dark navy trousers, black boots)
      gfx.fillStyle(0x192231, 1);
      gfx.fillRect(leg1X, leg1Y, 3, leg1H);
      gfx.fillRect(leg2X, leg2Y, 3, leg2H);
      gfx.fillStyle(0x0e131b, 1); // Boots
      gfx.fillRect(leg1X - 1, leg1Y + leg1H - 2, 4, 3);
      gfx.fillRect(leg2X - 1, leg2Y + leg2H - 2, 4, 3);

      // 3. Torso / Lab Coat (Long scientist coat)
      gfx.fillStyle(0xe2eafc, 1); // White lab coat
      gfx.fillRect(6, headY + 8, 8, 12);
      // Coat tails flowing down
      gfx.fillRect(5 + coatSway, headY + 18, 9, 7);
      // Coat inner shadow / collar
      gfx.fillStyle(0xc1d3fe, 1);
      gfx.fillRect(8, headY + 8, 4, 10);
      gfx.fillStyle(0x192231, 1); // Dark inner vest
      gfx.fillRect(9, headY + 10, 2, 8);

      // 4. Head & Visor (Mysterious faceless look with glowing cyan slit)
      gfx.fillStyle(0x2b2d42, 1); // Dark hair / cowl
      gfx.fillRect(7, headY, 6, 7);
      gfx.fillStyle(0xedf2f4, 1); // Pale face shadow
      gfx.fillRect(8, headY + 2, 5, 5);
      gfx.fillStyle(0x00f0ff, 1); // Mysterious glowing sensor visor
      gfx.fillRect(10, headY + 3, 3, 2);

      // 5. Arm holding staff
      gfx.fillStyle(0xe2eafc, 1);
      gfx.fillRect(4, headY + 11, 4, 4);

      gfx.generateTexture(key, width, height);
      gfx.destroy();
      return key;
    };

    drawScientist('idle');
    drawScientist('walk1');
    drawScientist('walk2');
    drawScientist('walk3');
    drawScientist('jump');
    drawScientist('fall');

    // Register animations
    if (!scene.anims.exists('player_idle')) {
      scene.anims.create({
        key: 'player_idle',
        frames: [{ key: 'scientist_idle' }],
        frameRate: 1
      });
    }

    if (!scene.anims.exists('player_run')) {
      scene.anims.create({
        key: 'player_run',
        frames: [
          { key: 'scientist_walk1' },
          { key: 'scientist_walk2' },
          { key: 'scientist_walk3' },
          { key: 'scientist_walk2' }
        ],
        frameRate: 10,
        repeat: -1
      });
    }

    if (!scene.anims.exists('player_jump')) {
      scene.anims.create({
        key: 'player_jump',
        frames: [{ key: 'scientist_jump' }],
        frameRate: 1
      });
    }

    if (!scene.anims.exists('player_fall')) {
      scene.anims.create({
        key: 'player_fall',
        frames: [{ key: 'scientist_fall' }],
        frameRate: 1
      });
    }
  }

  public static generateEnvironmentTextures(scene: Phaser.Scene): void {
    // 1. Snow platform — thick white cap, dark cave-rock body (matches reference)
    if (!scene.textures.exists('tile_snow_top')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Dark cave rock body
      gfx.fillStyle(0x1a2535, 1);
      gfx.fillRect(0, 0, 32, 32);
      // Rock texture variation
      gfx.fillStyle(0x0f1a26, 1);
      gfx.fillRect(0, 16, 8, 16);
      gfx.fillRect(20, 12, 12, 8);
      // Subtle cyan mineral vein
      gfx.fillStyle(0x0096c7, 0.3);
      gfx.fillRect(10, 18, 12, 2);
      // Thick bright snow cap (like reference — wide white cap)
      gfx.fillStyle(0xf0f8ff, 1);
      gfx.fillRect(0, 0, 32, 8);
      // Snow shadow / blue undertone
      gfx.fillStyle(0xade8f4, 1);
      gfx.fillRect(0, 8, 32, 3);
      // Snow depth shading
      gfx.fillStyle(0x90cfe4, 0.7);
      gfx.fillRect(0, 11, 32, 2);
      // Icicle drips hanging below snow cap
      gfx.fillStyle(0x48cae4, 0.9);
      gfx.fillTriangle(4, 13, 8, 13, 6, 20);
      gfx.fillTriangle(14, 13, 18, 13, 16, 22);
      gfx.fillTriangle(24, 13, 28, 13, 26, 18);
      // Icicle highlights
      gfx.fillStyle(0xffffff, 0.5);
      gfx.fillRect(5, 13, 1, 4);
      gfx.fillRect(15, 13, 1, 6);
      gfx.fillRect(25, 13, 1, 3);
      gfx.generateTexture('tile_snow_top', 32, 32);
      gfx.destroy();
    }

    // 2. Floating Ice Tile — glowing translucent cyan (like reference floating platform)
    if (!scene.textures.exists('tile_ice')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Deep translucent cyan body
      gfx.fillStyle(0x00b4d8, 0.7);
      gfx.fillRect(0, 0, 32, 32);
      // Glowing inner fill
      gfx.fillStyle(0x48cae4, 0.5);
      gfx.fillRect(2, 2, 28, 28);
      // Bright highlight on top surface (matches reference glow)
      gfx.fillStyle(0xade8f4, 0.9);
      gfx.fillRect(2, 2, 28, 6);
      // Specular gleam
      gfx.fillStyle(0xffffff, 0.7);
      gfx.fillRect(4, 3, 14, 2);
      // Internal refraction lines
      gfx.lineStyle(1, 0xcaf0f8, 0.5);
      gfx.lineBetween(4, 12, 18, 24);
      gfx.lineBetween(18, 24, 28, 14);
      // Cyan border glow
      gfx.lineStyle(2, 0x00f0ff, 0.8);
      gfx.strokeRect(0, 0, 32, 32);
      gfx.generateTexture('tile_ice', 32, 32);
      gfx.destroy();
    }

    // 3. Deep cave water (darker, more abyss-like)
    if (!scene.textures.exists('tile_water')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Abyss dark water body
      gfx.fillStyle(0x001830, 0.9);
      gfx.fillRect(0, 0, 32, 32);
      // Glowing cyan surface ripple
      gfx.fillStyle(0x0096c7, 0.8);
      gfx.fillRect(0, 0, 32, 5);
      gfx.fillStyle(0x48cae4, 0.5);
      gfx.fillRect(0, 0, 32, 2);
      // Depth glow
      gfx.fillStyle(0x00f0ff, 0.08);
      gfx.fillRect(0, 5, 32, 27);
      gfx.generateTexture('tile_water', 32, 32);
      gfx.destroy();
    }

    // 4. Ice spike hazard — upward-pointing cyan crystal spikes (like reference bottom spikes)
    if (!scene.textures.exists('hazard_icicle')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Three spike cluster
      // Left spike
      gfx.fillStyle(0x00b4d8, 1);
      gfx.fillTriangle(0, 32, 8, 32, 4, 8);
      gfx.fillStyle(0xade8f4, 0.9);
      gfx.fillTriangle(2, 32, 6, 32, 4, 12);
      // Center spike (tallest)
      gfx.fillStyle(0x00d4ff, 1);
      gfx.fillTriangle(6, 32, 16, 32, 11, 0);
      gfx.fillStyle(0xcaf0f8, 0.8);
      gfx.fillTriangle(8, 32, 14, 32, 11, 5);
      // Right spike
      gfx.fillStyle(0x00b4d8, 1);
      gfx.fillTriangle(14, 32, 22, 32, 18, 10);
      gfx.fillStyle(0xade8f4, 0.9);
      gfx.fillTriangle(16, 32, 20, 32, 18, 14);
      // Cyan glow at tips
      gfx.fillStyle(0x00f0ff, 0.5);
      gfx.fillCircle(4, 8, 3);
      gfx.fillCircle(11, 0, 4);
      gfx.fillCircle(18, 10, 3);
      gfx.generateTexture('hazard_icicle', 22, 32);
      gfx.destroy();
    }

    // 5. Failsafe Component #01 (Glowing golden/cyan technological relic)
    if (!scene.textures.exists('failsafe_component')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Outer energy diamond
      gfx.fillStyle(0xffd166, 1);
      gfx.fillRect(4, 4, 16, 16);
      gfx.lineStyle(2, 0x06d6a0, 1);
      gfx.strokeRect(4, 4, 16, 16);
      // Core glowing chip
      gfx.fillStyle(0x00f0ff, 1);
      gfx.fillRect(8, 8, 8, 8);
      gfx.fillStyle(0xffffff, 1);
      gfx.fillRect(10, 10, 4, 4);
      gfx.generateTexture('failsafe_component', 24, 24);
      gfx.destroy();
    }

    // 6. Crumbling Ice Platform (orange-red cracked warning tint)
    if (!scene.textures.exists('tile_crumble')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x1a3045, 1);
      gfx.fillRect(0, 0, 32, 32);
      // crack lines
      gfx.lineStyle(1, 0xff6b35, 0.9);
      gfx.lineBetween(0, 10, 14, 22);
      gfx.lineBetween(14, 22, 32, 8);
      gfx.lineBetween(8, 0, 20, 32);
      // Snow top
      gfx.fillStyle(0xe2f1ff, 1);
      gfx.fillRect(0, 0, 32, 5);
      gfx.fillStyle(0xbde0fe, 1);
      gfx.fillRect(0, 5, 32, 2);
      // Warning orange tint overlay
      gfx.fillStyle(0xff6b35, 0.15);
      gfx.fillRect(0, 0, 32, 32);
      gfx.generateTexture('tile_crumble', 32, 32);
      gfx.destroy();
    }

    // 7. Energy Recharge Conduit (standing station, 16x32)
    if (!scene.textures.exists('energy_conduit')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Base pillar
      gfx.fillStyle(0x1f3554, 1);
      gfx.fillRect(4, 14, 8, 18);
      // Glowing core
      gfx.fillStyle(0x70e000, 1);
      gfx.fillRect(6, 6, 4, 10);
      gfx.fillStyle(0xffffff, 0.8);
      gfx.fillRect(7, 7, 2, 4); // specular
      // Top antenna
      gfx.fillStyle(0x70e000, 0.6);
      gfx.fillRect(5, 2, 6, 4);
      gfx.fillRect(7, 0, 2, 3);
      // Base plate
      gfx.fillStyle(0x0d1f35, 1);
      gfx.fillRect(2, 30, 12, 2);
      gfx.generateTexture('energy_conduit', 16, 32);
      gfx.destroy();
    }

    // 8. Checkpoint Crystal (tall glowing pillar, 16x32)
    if (!scene.textures.exists('checkpoint_crystal')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Crystal body
      gfx.fillStyle(0x7b2d8b, 1);
      gfx.fillRect(5, 8, 6, 22);
      // Diamond top
      gfx.fillTriangle(5, 8, 11, 8, 8, 0);
      // Inner glow
      gfx.fillStyle(0xd85ef5, 0.7);
      gfx.fillRect(7, 10, 2, 16);
      // Base
      gfx.fillStyle(0x1f3554, 1);
      gfx.fillRect(3, 28, 10, 4);
      gfx.generateTexture('checkpoint_crystal', 16, 32);
      gfx.destroy();
    }

    // 9. Activated Checkpoint Crystal (bright cyan)
    if (!scene.textures.exists('checkpoint_active')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x00f0ff, 1);
      gfx.fillRect(5, 8, 6, 22);
      gfx.fillTriangle(5, 8, 11, 8, 8, 0);
      gfx.fillStyle(0xffffff, 0.8);
      gfx.fillRect(7, 10, 2, 16);
      gfx.fillStyle(0x1f3554, 1);
      gfx.fillRect(3, 28, 10, 4);
      gfx.generateTexture('checkpoint_active', 16, 32);
      gfx.destroy();
    }

    // 10. Proto tile (general placeholder used in particles)
    if (!scene.textures.exists('proto_tile')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x48cae4, 1);
      gfx.fillRect(0, 0, 8, 8);
      gfx.generateTexture('proto_tile', 8, 8);
      gfx.destroy();
    }

    // 11. Sentinel Drone (active — red eye, angular body, 24x16)
    if (!scene.textures.exists('drone_active')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Angular body shell
      gfx.fillStyle(0x2b2d42, 1);
      gfx.fillRect(4, 4, 16, 10);
      // Wings / stabilizers
      gfx.fillStyle(0x3d405b, 1);
      gfx.fillRect(0, 6, 4, 4);
      gfx.fillRect(20, 6, 4, 4);
      // Intake vents
      gfx.fillStyle(0x1a1b2e, 1);
      gfx.fillRect(6, 12, 3, 2);
      gfx.fillRect(14, 12, 3, 2);
      // Red eye
      gfx.fillStyle(0xff2222, 1);
      gfx.fillRect(15, 6, 4, 3);
      gfx.fillStyle(0xffffff, 0.8);
      gfx.fillRect(17, 7, 1, 1);
      // Top antenna
      gfx.fillStyle(0x5c5f80, 1);
      gfx.fillRect(11, 0, 2, 5);
      gfx.fillStyle(0xff2222, 0.7);
      gfx.fillRect(11, 0, 2, 2);
      gfx.generateTexture('drone_active', 24, 16);
      gfx.destroy();
    }

    // 12. Sentinel Drone (stunned — cyan/frozen overlay)
    if (!scene.textures.exists('drone_stunned')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x48cae4, 0.6);
      gfx.fillRect(4, 4, 16, 10);
      gfx.fillStyle(0x90e0ef, 0.5);
      gfx.fillRect(0, 6, 4, 4);
      gfx.fillRect(20, 6, 4, 4);
      gfx.fillStyle(0x00f0ff, 1);
      gfx.fillRect(15, 6, 4, 3);
      gfx.fillStyle(0xffffff, 1);
      gfx.fillRect(17, 7, 1, 1);
      gfx.fillStyle(0x90e0ef, 0.5);
      gfx.fillRect(11, 0, 2, 5);
      gfx.generateTexture('drone_stunned', 24, 16);
      gfx.destroy();
    }

    // ── Heat Age Sector 2 Textures ─────────────────────────────────────────

    // H1. Metal grate platform (dark industrial, orange glow edges)
    if (!scene.textures.exists('tile_metal')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Dark steel body
      gfx.fillStyle(0x1a1a20, 1);
      gfx.fillRect(0, 0, 32, 32);
      // Metal plates
      gfx.fillStyle(0x252530, 1);
      gfx.fillRect(1, 1, 14, 14);
      gfx.fillRect(17, 1, 14, 14);
      gfx.fillRect(1, 17, 14, 14);
      gfx.fillRect(17, 17, 14, 14);
      // Grate lines
      gfx.lineStyle(1, 0x111118, 1);
      gfx.lineBetween(0, 8, 32, 8);
      gfx.lineBetween(0, 16, 32, 16);
      gfx.lineBetween(0, 24, 32, 24);
      gfx.lineBetween(8, 0, 8, 32);
      gfx.lineBetween(16, 0, 16, 32);
      gfx.lineBetween(24, 0, 24, 32);
      // Orange ember glow on top edge
      gfx.fillStyle(0xff6b00, 0.7);
      gfx.fillRect(0, 0, 32, 3);
      gfx.fillStyle(0xff9900, 0.4);
      gfx.fillRect(0, 3, 32, 2);
      // Rivet dots
      gfx.fillStyle(0x555560, 1);
      gfx.fillCircle(4, 4, 2);
      gfx.fillCircle(28, 4, 2);
      gfx.fillCircle(4, 28, 2);
      gfx.fillCircle(28, 28, 2);
      gfx.generateTexture('tile_metal', 32, 32);
      gfx.destroy();
    }

    // H2. Lava tile (glowing molten orange-red)
    if (!scene.textures.exists('tile_lava')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Deep lava body
      gfx.fillStyle(0x8b0000, 1);
      gfx.fillRect(0, 0, 32, 32);
      // Molten veins
      gfx.fillStyle(0xcc2200, 1);
      gfx.fillRect(0, 8, 32, 8);
      gfx.fillRect(10, 0, 12, 32);
      // Hot bright crust
      gfx.fillStyle(0xff6600, 0.8);
      gfx.fillRect(4, 6, 8, 4);
      gfx.fillRect(18, 16, 10, 4);
      gfx.fillRect(8, 22, 6, 4);
      // Glowing surface (top shimmer)
      gfx.fillStyle(0xff8800, 0.9);
      gfx.fillRect(0, 0, 32, 4);
      // Bright orange highlight
      gfx.fillStyle(0xffaa00, 0.6);
      gfx.fillRect(0, 0, 32, 2);
      gfx.generateTexture('tile_lava', 32, 32);
      gfx.destroy();
    }

    // H3. Ember/crumbling platform (dark with orange-red crack network)
    if (!scene.textures.exists('tile_ember')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x1a0e08, 1);
      gfx.fillRect(0, 0, 32, 32);
      // Molten crack lines
      gfx.lineStyle(1, 0xff4400, 0.9);
      gfx.lineBetween(0, 12, 12, 20);
      gfx.lineBetween(12, 20, 32, 6);
      gfx.lineBetween(6, 0, 18, 32);
      gfx.lineBetween(20, 0, 28, 24);
      // Ember glow top
      gfx.fillStyle(0xff4400, 1);
      gfx.fillRect(0, 0, 32, 5);
      gfx.fillStyle(0xff6600, 0.5);
      gfx.fillRect(0, 5, 32, 3);
      // Warning overlay
      gfx.fillStyle(0xff2200, 0.1);
      gfx.fillRect(0, 0, 32, 32);
      gfx.generateTexture('tile_ember', 32, 32);
      gfx.destroy();
    }

    // H4. Heat conduit (orange recharge station — like energy_conduit but fire-themed)
    if (!scene.textures.exists('heat_conduit')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x2a1206, 1);
      gfx.fillRect(4, 14, 8, 18);
      // Glowing fire core
      gfx.fillStyle(0xff6600, 1);
      gfx.fillRect(6, 6, 4, 10);
      gfx.fillStyle(0xffaa00, 0.9);
      gfx.fillRect(7, 7, 2, 6);
      gfx.fillStyle(0xffffff, 0.7);
      gfx.fillRect(7, 7, 1, 3);
      // Top flame shape
      gfx.fillStyle(0xff4400, 0.8);
      gfx.fillRect(5, 2, 6, 4);
      gfx.fillTriangle(5, 6, 11, 6, 8, 0);
      gfx.fillStyle(0xffaa00, 0.6);
      gfx.fillRect(7, 0, 2, 3);
      // Base plate
      gfx.fillStyle(0x1a0a04, 1);
      gfx.fillRect(2, 30, 12, 2);
      gfx.generateTexture('heat_conduit', 16, 32);
      gfx.destroy();
    }

    // H5. Ember drone (same body as drone_active but red/orange tinted)
    if (!scene.textures.exists('ember_drone')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x2a1008, 1);
      gfx.fillRect(0, 4, 24, 8);
      gfx.fillStyle(0x1a0806, 1);
      gfx.fillTriangle(0, 4, 5, 0, 5, 8);
      gfx.fillTriangle(24, 4, 19, 0, 19, 8);
      gfx.fillStyle(0xff2200, 1);
      gfx.fillCircle(6, 8, 3);
      gfx.fillCircle(18, 8, 3);
      gfx.fillStyle(0xff6600, 0.6);
      gfx.fillRect(5, 6, 14, 4);
      gfx.fillStyle(0xffaa00, 0.9);
      gfx.fillRect(6, 7, 2, 2);
      gfx.fillRect(16, 7, 2, 2);
      gfx.fillStyle(0xff4400, 0.5);
      gfx.fillRect(11, 0, 2, 5);
      gfx.generateTexture('ember_drone', 24, 16);
      gfx.destroy();
    }

    // H6. Obsidian tile — solidified lava bridge (dark with blue+orange crack glow)
    if (!scene.textures.exists('tile_obsidian')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Dark basalt body
      gfx.fillStyle(0x0e0810, 1);
      gfx.fillRect(0, 0, 32, 32);
      // Volcanic glass facets
      gfx.fillStyle(0x1a1220, 1);
      gfx.fillRect(1, 1, 13, 13);
      gfx.fillRect(18, 1, 13, 13);
      gfx.fillRect(2, 18, 11, 11);
      gfx.fillRect(19, 20, 10, 10);
      // Blue-cyan crack network (cryo-crystallised)
      gfx.lineStyle(1, 0x00c8ff, 0.85);
      gfx.lineBetween(0, 10, 14, 22);
      gfx.lineBetween(14, 22, 32, 8);
      gfx.lineBetween(8, 0, 20, 32);
      gfx.lineBetween(22, 0, 30, 20);
      // Orange residual heat seams
      gfx.lineStyle(1, 0xff4400, 0.55);
      gfx.lineBetween(0, 26, 10, 16);
      gfx.lineBetween(24, 28, 32, 14);
      // Top surface glow (cryo-blue shimmer)
      gfx.fillStyle(0x00c8ff, 0.25);
      gfx.fillRect(0, 0, 32, 4);
      gfx.fillStyle(0x48cae4, 0.15);
      gfx.fillRect(0, 4, 32, 3);
      // Faint orange heat-glow bottom edge
      gfx.fillStyle(0xff4400, 0.2);
      gfx.fillRect(0, 28, 32, 4);
      gfx.generateTexture('tile_obsidian', 32, 32);
      gfx.destroy();
    }
  }

  // ── Medieval Palace Sector 3 Textures ──────────────────────────────────

  public static generateMedievalTextures(scene: Phaser.Scene): void {
    // M1. Stone Corridor Block (stone gray, beveled mortar, granite flecks)
    if (!scene.textures.exists('tile_stone')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x323640, 1);
      gfx.fillRect(0, 0, 32, 32);
      // Stone bevels
      gfx.fillStyle(0x3d4350, 1);
      gfx.fillRect(1, 1, 30, 2);
      gfx.fillRect(1, 1, 2, 30);
      gfx.fillStyle(0x23262d, 1);
      gfx.fillRect(1, 29, 30, 2);
      gfx.fillRect(29, 1, 2, 30);
      // Mortar lines / brick division
      gfx.lineStyle(1, 0x1d2026, 1);
      gfx.lineBetween(0, 16, 32, 16);
      gfx.lineBetween(16, 0, 16, 16);
      gfx.lineBetween(8, 16, 8, 32);
      gfx.lineBetween(24, 16, 24, 32);
      // Stone texture flecks
      gfx.fillStyle(0x4a5160, 0.6);
      gfx.fillRect(4, 4, 3, 2);
      gfx.fillRect(20, 8, 4, 2);
      gfx.fillRect(12, 22, 3, 2);
      gfx.fillStyle(0x20232a, 0.7);
      gfx.fillRect(8, 10, 2, 2);
      gfx.fillRect(22, 24, 3, 2);
      gfx.generateTexture('tile_stone', 32, 32);
      gfx.destroy();
    }

    // M2. Stone Top / Battlement Floor (smooth polished stone with muted gold inlay)
    if (!scene.textures.exists('tile_stone_top')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x363b46, 1);
      gfx.fillRect(0, 0, 32, 32);
      // Polished top ledge
      gfx.fillStyle(0x484f5d, 1);
      gfx.fillRect(0, 0, 32, 4);
      // Muted gold inlay strip
      gfx.fillStyle(0xc5a059, 0.85);
      gfx.fillRect(0, 4, 32, 2);
      gfx.fillStyle(0x8c6d2d, 0.9);
      gfx.fillRect(0, 6, 32, 1);
      // Stone body
      gfx.fillStyle(0x2d323b, 1);
      gfx.fillRect(0, 7, 32, 25);
      // Subtle masonry grooves
      gfx.lineStyle(1, 0x1e2127, 1);
      gfx.lineBetween(16, 7, 16, 32);
      gfx.lineBetween(0, 20, 32, 20);
      gfx.generateTexture('tile_stone_top', 32, 32);
      gfx.destroy();
    }

    // M3. Castle Brick Wall (background masonry)
    if (!scene.textures.exists('tile_castle_brick')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x1e2128, 1);
      gfx.fillRect(0, 0, 32, 32);
      // Individual dark gray bricks
      gfx.fillStyle(0x272b34, 1);
      gfx.fillRect(1, 1, 14, 6);
      gfx.fillRect(17, 1, 14, 6);
      gfx.fillRect(1, 9, 6, 6);
      gfx.fillRect(9, 9, 14, 6);
      gfx.fillRect(25, 9, 6, 6);
      gfx.fillRect(1, 17, 14, 6);
      gfx.fillRect(17, 17, 14, 6);
      gfx.fillRect(1, 25, 8, 6);
      gfx.fillRect(11, 25, 14, 6);
      gfx.fillRect(27, 25, 4, 6);
      // Mortar shading
      gfx.lineStyle(1, 0x14161b, 0.9);
      gfx.strokeRect(0, 0, 32, 32);
      gfx.generateTexture('tile_castle_brick', 32, 32);
      gfx.destroy();
    }

    // M4. Wood Drawbridge Platform (heavy oak planks with iron bands & studs)
    if (!scene.textures.exists('tile_wood_drawbridge')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Oak wood grain
      gfx.fillStyle(0x4a3222, 1);
      gfx.fillRect(0, 0, 32, 32);
      gfx.fillStyle(0x3d2719, 1);
      gfx.fillRect(0, 8, 32, 2);
      gfx.fillRect(0, 18, 32, 2);
      gfx.fillRect(0, 28, 32, 2);
      // Wood plank highlights
      gfx.fillStyle(0x5a3e2c, 0.8);
      gfx.fillRect(0, 1, 32, 2);
      gfx.fillRect(0, 11, 32, 2);
      gfx.fillRect(0, 21, 32, 2);
      // Iron reinforcement brackets
      gfx.fillStyle(0x22242b, 1);
      gfx.fillRect(4, 0, 4, 32);
      gfx.fillRect(24, 0, 4, 32);
      // Iron rivets
      gfx.fillStyle(0x606575, 1);
      gfx.fillCircle(6, 5, 1);
      gfx.fillCircle(6, 15, 1);
      gfx.fillCircle(6, 25, 1);
      gfx.fillCircle(26, 5, 1);
      gfx.fillCircle(26, 15, 1);
      gfx.fillCircle(26, 25, 1);
      gfx.generateTexture('tile_wood_drawbridge', 32, 32);
      gfx.destroy();
    }

    // M5. Muted Gold Palace Pillar (royal columns)
    if (!scene.textures.exists('tile_gold_pillar')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x1a1c22, 1);
      gfx.fillRect(0, 0, 32, 32);
      // Pillar shaft
      gfx.fillStyle(0x8c6d2d, 1);
      gfx.fillRect(6, 0, 20, 32);
      // Fluted highlights
      gfx.fillStyle(0xc5a059, 1);
      gfx.fillRect(8, 0, 4, 32);
      gfx.fillRect(16, 0, 4, 32);
      gfx.fillStyle(0xecd08e, 0.8);
      gfx.fillRect(9, 0, 2, 32);
      gfx.fillRect(17, 0, 2, 32);
      // Capital / Base trim
      gfx.fillStyle(0xd4af37, 1);
      gfx.fillRect(4, 0, 24, 4);
      gfx.fillRect(4, 28, 24, 4);
      gfx.fillStyle(0xffe082, 0.7);
      gfx.fillRect(5, 1, 22, 1);
      gfx.generateTexture('tile_gold_pillar', 32, 32);
      gfx.destroy();
    }

    // M6. Royal Dark Red Carpet (crimson velvet with gold border)
    if (!scene.textures.exists('tile_red_carpet')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Stone floor under
      gfx.fillStyle(0x282c34, 1);
      gfx.fillRect(0, 0, 32, 32);
      // Dark red velvet carpet
      gfx.fillStyle(0x75161c, 1);
      gfx.fillRect(0, 0, 32, 8);
      gfx.fillStyle(0x8f2027, 1);
      gfx.fillRect(0, 2, 32, 4);
      // Muted gold brocade trim
      gfx.fillStyle(0xd4af37, 1);
      gfx.fillRect(0, 0, 32, 1);
      gfx.fillRect(0, 7, 32, 1);
      // Gold tassel dots
      for (let x = 2; x < 32; x += 6) {
        gfx.fillStyle(0xffd166, 0.9);
        gfx.fillRect(x, 1, 2, 1);
        gfx.fillRect(x, 6, 2, 1);
      }
      gfx.generateTexture('tile_red_carpet', 32, 32);
      gfx.destroy();
    }

    // M7. Palace Wall Torch Sconce
    if (!scene.textures.exists('torch_sconce')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Wrought iron mount
      gfx.fillStyle(0x22242b, 1);
      gfx.fillRect(6, 12, 4, 10);
      gfx.fillRect(4, 14, 8, 3);
      gfx.fillRect(5, 10, 6, 3);
      // Torch wooden handle
      gfx.fillStyle(0x5c3d28, 1);
      gfx.fillRect(6, 7, 4, 6);
      // Burning flame head
      gfx.fillStyle(0xff4400, 1);
      gfx.fillTriangle(4, 8, 12, 8, 8, 1);
      gfx.fillStyle(0xff8800, 1);
      gfx.fillTriangle(5, 8, 11, 8, 8, 3);
      gfx.fillStyle(0xffdd00, 1);
      gfx.fillCircle(8, 6, 2);
      gfx.fillStyle(0xffffff, 0.8);
      gfx.fillCircle(8, 6, 1);
      gfx.generateTexture('torch_sconce', 16, 24);
      gfx.destroy();
    }

    // M8. Locked Chamber Door (reinforced iron gate / portcullis with massive gold padlock)
    if (!scene.textures.exists('chamber_door')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Stone frame border
      gfx.fillStyle(0x252830, 1);
      gfx.fillRect(0, 0, 32, 64);
      // Heavy iron door body
      gfx.fillStyle(0x181a20, 1);
      gfx.fillRect(2, 2, 28, 60);
      // Vertical iron bars
      gfx.fillStyle(0x2e323d, 1);
      gfx.fillRect(6, 4, 4, 56);
      gfx.fillRect(14, 4, 4, 56);
      gfx.fillRect(22, 4, 4, 56);
      // Horizontal cross braces
      gfx.fillStyle(0x3a404e, 1);
      gfx.fillRect(2, 10, 28, 5);
      gfx.fillRect(2, 30, 28, 5);
      gfx.fillRect(2, 50, 28, 5);
      // Iron rivets
      gfx.fillStyle(0x70788c, 1);
      for (let y = 11; y <= 51; y += 20) {
        gfx.fillCircle(8, y + 1, 1.5);
        gfx.fillCircle(16, y + 1, 1.5);
        gfx.fillCircle(24, y + 1, 1.5);
      }
      // Massive ornate gold padlock
      gfx.fillStyle(0xd4af37, 1);
      gfx.fillRect(10, 26, 12, 13);
      gfx.lineStyle(2, 0xd4af37, 1);
      gfx.strokeCircle(16, 24, 4);
      // Keyhole
      gfx.fillStyle(0x111216, 1);
      gfx.fillCircle(16, 31, 2);
      gfx.fillRect(15, 31, 2, 4);
      // Padlock shine
      gfx.fillStyle(0xffe082, 0.8);
      gfx.fillRect(11, 27, 2, 4);
      gfx.generateTexture('chamber_door', 32, 64);
      gfx.destroy();
    }

    // M9. Gilded Chamber Key
    if (!scene.textures.exists('chamber_key')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Golden aura
      gfx.fillStyle(0xffd166, 0.25);
      gfx.fillCircle(12, 12, 10);
      // Key head (royal crest loop)
      gfx.lineStyle(2, 0xd4af37, 1);
      gfx.strokeCircle(7, 12, 5);
      gfx.fillStyle(0xffe082, 1);
      gfx.fillCircle(7, 12, 2);
      // Key shaft
      gfx.fillStyle(0xd4af37, 1);
      gfx.fillRect(11, 11, 10, 2);
      // Key teeth
      gfx.fillRect(18, 13, 2, 4);
      gfx.fillRect(15, 13, 2, 3);
      // Specular shine
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillRect(6, 9, 2, 2);
      gfx.generateTexture('chamber_key', 24, 24);
      gfx.destroy();
    }

    // M10. Failsafe Component 3 (The Chrono-Prism — Clockwork Gimbal & Amber Core)
    if (!scene.textures.exists('relic_component3')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Outer aura
      gfx.fillStyle(0xffaa00, 0.2);
      gfx.fillCircle(16, 16, 15);
      // Golden gimbal rings
      gfx.lineStyle(2, 0xd4af37, 1);
      gfx.strokeCircle(16, 16, 12);
      gfx.lineStyle(1.5, 0xc5a059, 1);
      gfx.strokeEllipse(16, 16, 12, 5);
      gfx.strokeEllipse(16, 16, 5, 12);
      // Core glowing amber crystal
      gfx.fillStyle(0xff6600, 1);
      gfx.fillRect(11, 11, 10, 10);
      gfx.fillStyle(0xffaa00, 1);
      gfx.fillRect(13, 13, 6, 6);
      gfx.fillStyle(0xffffff, 0.95);
      gfx.fillRect(14, 14, 4, 4);
      // Radial tech pips
      gfx.fillStyle(0x00f0ff, 0.9);
      gfx.fillRect(15, 2, 2, 3);
      gfx.fillRect(15, 27, 2, 3);
      gfx.fillRect(2, 15, 3, 2);
      gfx.fillRect(27, 15, 3, 2);
      gfx.generateTexture('relic_component3', 32, 32);
      gfx.destroy();
    }

    // M11. Hanging Royal Tapestry Banner (dark red velvet, gold crest)
    if (!scene.textures.exists('banner_royal')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Wooden support rod & finials
      gfx.fillStyle(0xd4af37, 1);
      gfx.fillRect(0, 0, 24, 3);
      gfx.fillCircle(1, 1.5, 2);
      gfx.fillCircle(23, 1.5, 2);
      // Crimson banner cloth
      gfx.fillStyle(0x75161c, 1);
      gfx.fillRect(2, 3, 20, 36);
      // Swallowtail V-cut at bottom
      gfx.fillTriangle(2, 39, 12, 39, 2, 46);
      gfx.fillTriangle(12, 39, 22, 39, 22, 46);
      gfx.fillStyle(0x8f2027, 1);
      gfx.fillRect(4, 5, 16, 32);
      // Gold lion / crest insignia
      gfx.fillStyle(0xd4af37, 1);
      gfx.fillCircle(12, 14, 4);
      gfx.fillRect(10, 17, 4, 8);
      gfx.fillTriangle(7, 20, 17, 20, 12, 26);
      // Gold bottom fringe
      gfx.fillStyle(0xffd166, 0.85);
      gfx.fillRect(2, 38, 20, 2);
      gfx.generateTexture('banner_royal', 24, 48);
      gfx.destroy();
    }

    // M12. Royal Vault Chest
    if (!scene.textures.exists('vault_chest')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Oak chest base
      gfx.fillStyle(0x3a2214, 1);
      gfx.fillRect(2, 8, 28, 16);
      // Chest lid
      gfx.fillStyle(0x4a2e1d, 1);
      gfx.fillRect(1, 2, 30, 8);
      // Gold bands
      gfx.fillStyle(0xd4af37, 1);
      gfx.fillRect(6, 2, 3, 22);
      gfx.fillRect(23, 2, 3, 22);
      gfx.fillRect(1, 9, 30, 2);
      // Gold lock latch
      gfx.fillRect(14, 8, 4, 6);
      gfx.fillStyle(0x1a1a20, 1);
      gfx.fillRect(15, 11, 2, 2);
      gfx.generateTexture('vault_chest', 32, 24);
      gfx.destroy();
    }

    // M13. Holographic Decoy Sprite (shimmering phantom clone)
    if (!scene.textures.exists('decoy_hologram')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Holographic glowing phantom of Vance
      gfx.fillStyle(0x00f0ff, 0.4);
      gfx.fillRect(4, 4, 12, 28);
      // Visor
      gfx.fillStyle(0xffffff, 0.85);
      gfx.fillRect(8, 7, 5, 2);
      // Staff phantom
      gfx.fillStyle(0xffd166, 0.7);
      gfx.fillRect(2, 4, 2, 28);
      // Staff crystal
      gfx.fillStyle(0x00f0ff, 1);
      gfx.fillCircle(3, 4, 3);
      // Scanlines
      gfx.fillStyle(0x00ffff, 0.6);
      for (let y = 5; y < 32; y += 4) {
        gfx.fillRect(3, y, 14, 1);
      }
      gfx.generateTexture('decoy_hologram', 20, 36);
      gfx.destroy();
    }

    // M14. Medieval Palace Guard Textures (Armored Sentinel with Halberd)
    const drawGuard = (frame: 'idle' | 'walk1' | 'walk2' | 'alert'): void => {
      const key = `guard_${frame}`;
      if (scene.textures.exists(key)) return;

      const gfx = scene.make.graphics({ x: 0, y: 0 });
      const width = 24;
      const height = 36;

      let leg1X = 8, leg1H = 9, leg2X = 13, leg2H = 9;
      let spearAngle = 0; // vertical
      let eyeColor = 0xffd166; // glowing amber in idle/walk

      if (frame === 'walk1') {
        leg1X = 6; leg1H = 10;
        leg2X = 14; leg2H = 8;
      } else if (frame === 'walk2') {
        leg1X = 10; leg1H = 8;
        leg2X = 11; leg2H = 10;
      } else if (frame === 'alert') {
        eyeColor = 0xff2200; // piercing red
        spearAngle = 2; // thrust forward
      }

      // 1. Halberd / Spear shaft
      gfx.fillStyle(0x4a3222, 1); // Dark ashwood pole
      gfx.fillRect(3 + spearAngle, 4, 2, 30);
      // Halberd steel axe head & spike
      gfx.fillStyle(0x9aa0b0, 1);
      gfx.fillRect(1 + spearAngle, 1, 6, 4); // axe collar
      gfx.fillTriangle(4 + spearAngle, 0, 4 + spearAngle, 5, 1 + spearAngle, 3); // curved blade
      gfx.fillRect(3 + spearAngle, 0, 2, 4); // top spear spike
      gfx.fillStyle(0xd4af37, 1); // Gold collar ring
      gfx.fillRect(2 + spearAngle, 5, 4, 1);

      // 2. Greaves & Sabatons (Plate armor legs)
      gfx.fillStyle(0x3a404c, 1); // Dark steel legs
      gfx.fillRect(leg1X, 26, 4, leg1H);
      gfx.fillRect(leg2X, 26, 4, leg2H);
      gfx.fillStyle(0x5a6275, 1); // Knee couters & shine
      gfx.fillRect(leg1X, 26, 3, 2);
      gfx.fillRect(leg2X, 26, 3, 2);
      gfx.fillStyle(0x22262e, 1); // Sabatons
      gfx.fillRect(leg1X - 1, 26 + leg1H - 2, 5, 2);
      gfx.fillRect(leg2X - 1, 26 + leg2H - 2, 5, 2);

      // 3. Torso & Tabard (Steel cuirass + Dark red royal tabard)
      gfx.fillStyle(0x444b59, 1); // Steel cuirass
      gfx.fillRect(7, 12, 10, 14);
      // Dark red tabard front
      gfx.fillStyle(0x75161c, 1);
      gfx.fillRect(9, 13, 6, 13);
      // Gold tabard lion crest
      gfx.fillStyle(0xd4af37, 1);
      gfx.fillRect(11, 16, 2, 4);
      gfx.fillRect(10, 17, 4, 2);
      // Steel Pauldrons (shoulder guards)
      gfx.fillStyle(0x6b7489, 1);
      gfx.fillRect(6, 12, 3, 5);
      gfx.fillRect(15, 12, 3, 5);
      gfx.fillStyle(0x8c97ad, 1);
      gfx.fillRect(6, 12, 3, 1);
      gfx.fillRect(15, 12, 3, 1);

      // 4. Armored Greathelm
      gfx.fillStyle(0x444b59, 1); // Helm dome
      gfx.fillRect(8, 4, 8, 8);
      // Visor slit
      gfx.fillStyle(0x16181e, 1);
      gfx.fillRect(9, 8, 7, 2);
      // Glowing eye slit
      gfx.fillStyle(eyeColor, 1);
      gfx.fillRect(11, 8, 4, 1);
      // Helm crest & plume (dark red + gold)
      gfx.fillStyle(0xd4af37, 1);
      gfx.fillRect(11, 2, 2, 3);
      gfx.fillStyle(0x8f2027, 1); // Crimson plume feather
      gfx.fillRect(8, 1, 5, 3);
      gfx.fillRect(7, 2, 2, 2);

      gfx.generateTexture(key, width, height);
      gfx.destroy();
    };

    drawGuard('idle');
    drawGuard('walk1');
    drawGuard('walk2');
    drawGuard('alert');

    // Animations
    if (!scene.anims.exists('guard_walk')) {
      scene.anims.create({
        key: 'guard_walk',
        frames: [
          { key: 'guard_walk1' },
          { key: 'guard_idle' },
          { key: 'guard_walk2' },
          { key: 'guard_idle' }
        ],
        frameRate: 6,
        repeat: -1
      });
    }

    if (!scene.anims.exists('guard_idle')) {
      scene.anims.create({
        key: 'guard_idle',
        frames: [{ key: 'guard_idle' }],
        frameRate: 1
      });
    }
  }

  // ── Modern City Sector 4 Textures ──────────────────────────────────────

  public static generateCityTextures(scene: Phaser.Scene): void {
    // C1. Concrete Block
    if (!scene.textures.exists('tile_concrete')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x383c46, 1);
      gfx.fillRect(0, 0, 32, 32);
      // Seam / chamfer
      gfx.fillStyle(0x282b32, 1);
      gfx.fillRect(0, 30, 32, 2);
      gfx.fillRect(30, 0, 2, 32);
      gfx.fillStyle(0x484d59, 1);
      gfx.fillRect(0, 0, 32, 2);
      gfx.fillRect(0, 0, 2, 32);
      // Concrete aggregate speckles
      gfx.fillStyle(0x22242a, 0.6);
      gfx.fillRect(6, 8, 2, 2);
      gfx.fillRect(20, 14, 3, 2);
      gfx.fillRect(10, 22, 2, 2);
      gfx.fillStyle(0x525866, 0.7);
      gfx.fillRect(14, 6, 2, 2);
      gfx.fillRect(24, 24, 2, 2);
      gfx.generateTexture('tile_concrete', 32, 32);
      gfx.destroy();
    }

    // C2. Concrete Top / Curb
    if (!scene.textures.exists('tile_concrete_top')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x3d424e, 1);
      gfx.fillRect(0, 0, 32, 32);
      // Smooth sidewalk curb top
      gfx.fillStyle(0x555c6d, 1);
      gfx.fillRect(0, 0, 32, 4);
      // Cyan embedded fiber-optic trace line
      gfx.fillStyle(0x00f0ff, 0.4);
      gfx.fillRect(0, 4, 32, 1);
      // Shaded concrete body
      gfx.fillStyle(0x323640, 1);
      gfx.fillRect(0, 5, 32, 27);
      gfx.generateTexture('tile_concrete_top', 32, 32);
      gfx.destroy();
    }

    // C3. Asphalt Street
    if (!scene.textures.exists('tile_asphalt')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x1a1c22, 1);
      gfx.fillRect(0, 0, 32, 32);
      // Yellow dashed lane marking
      gfx.fillStyle(0xffcc00, 0.85);
      gfx.fillRect(4, 14, 24, 4);
      gfx.fillStyle(0x2b2e38, 0.5);
      gfx.fillRect(2, 4, 6, 3);
      gfx.fillRect(18, 22, 8, 3);
      gfx.generateTexture('tile_asphalt', 32, 32);
      gfx.destroy();
    }

    // C4. Construction Scaffold Girder
    if (!scene.textures.exists('tile_scaffold')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Steel truss frame
      gfx.fillStyle(0x2d323c, 1);
      gfx.fillRect(0, 0, 32, 4);
      gfx.fillRect(0, 28, 32, 4);
      gfx.fillRect(0, 0, 4, 32);
      gfx.fillRect(28, 0, 4, 32);
      // Cross braces
      gfx.lineStyle(2, 0xffcc00, 0.9); // Hazard yellow truss
      gfx.lineBetween(2, 2, 30, 30);
      gfx.lineBetween(30, 2, 2, 30);
      // Rivets
      gfx.fillStyle(0xffffff, 0.8);
      gfx.fillRect(1, 1, 2, 2);
      gfx.fillRect(29, 1, 2, 2);
      gfx.fillRect(1, 29, 2, 2);
      gfx.fillRect(29, 29, 2, 2);
      gfx.generateTexture('tile_scaffold', 32, 32);
      gfx.destroy();
    }

    // C5. Electric Floor Hazard
    if (!scene.textures.exists('tile_electric_floor')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x11131a, 1);
      gfx.fillRect(0, 0, 32, 32);
      // High-voltage electrode coils
      gfx.fillStyle(0x00f0ff, 0.8);
      gfx.fillRect(2, 2, 28, 6);
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillRect(4, 3, 24, 2);
      // Sparking arcs
      gfx.lineStyle(1.5, 0x00f0ff, 1);
      gfx.lineBetween(6, 12, 12, 24);
      gfx.lineBetween(12, 24, 18, 14);
      gfx.lineBetween(18, 14, 26, 26);
      gfx.fillStyle(0xff007f, 0.6); // Warning neon flare
      gfx.fillCircle(16, 20, 3);
      gfx.generateTexture('tile_electric_floor', 32, 32);
      gfx.destroy();
    }

    // C6. Moving Machinery (Industrial Piston / Motor)
    if (!scene.textures.exists('tile_machinery')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x222630, 1);
      gfx.fillRect(0, 0, 32, 32);
      // Hazard diagonal yellow/black warning stripes
      for (let i = -16; i < 48; i += 8) {
        gfx.lineStyle(3, 0xffea00, 0.9);
        gfx.lineBetween(i, 0, i + 8, 8);
        gfx.lineBetween(i, 24, i + 8, 32);
      }
      // Steel piston core
      gfx.fillStyle(0x4e5566, 1);
      gfx.fillRect(4, 8, 24, 16);
      gfx.fillStyle(0x00f0ff, 0.85); // glowing pneumatic pressure chamber
      gfx.fillRect(8, 12, 16, 8);
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillRect(10, 14, 12, 2);
      gfx.generateTexture('tile_machinery', 32, 32);
      gfx.destroy();
    }

    // C7. Electronic Security Door (32x64)
    if (!scene.textures.exists('electronic_door')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Frame
      gfx.fillStyle(0x161820, 1);
      gfx.fillRect(0, 0, 32, 64);
      // Sliding blast panels
      gfx.fillStyle(0x262a36, 1);
      gfx.fillRect(2, 2, 28, 60);
      // Cyan circuit lines etched into door
      gfx.lineStyle(1.5, 0x00f0ff, 0.8);
      gfx.lineBetween(6, 8, 16, 18);
      gfx.lineBetween(16, 18, 16, 46);
      gfx.lineBetween(16, 46, 26, 56);
      // Central status LED
      gfx.fillStyle(0x00f0ff, 1);
      gfx.fillCircle(16, 32, 4);
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillCircle(16, 32, 2);
      gfx.generateTexture('electronic_door', 32, 64);
      gfx.destroy();
    }

    // C8. Elevator Platform (48x16)
    if (!scene.textures.exists('elevator_cab')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Platform deck
      gfx.fillStyle(0x20242e, 1);
      gfx.fillRect(0, 0, 48, 16);
      // Hazard trim
      gfx.fillStyle(0xffea00, 0.9);
      gfx.fillRect(0, 0, 48, 2);
      gfx.fillRect(0, 14, 48, 2);
      // Grip grating
      gfx.lineStyle(1, 0x111318, 1);
      for (let x = 4; x < 48; x += 6) {
        gfx.lineBetween(x, 2, x, 14);
      }
      // Cyan power indicator beacon
      gfx.fillStyle(0x00f0ff, 1);
      gfx.fillCircle(24, 8, 3);
      gfx.generateTexture('elevator_cab', 48, 16);
      gfx.destroy();
    }

    // C9. Power Node Junction Terminal (24x24)
    if (!scene.textures.exists('power_node')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Octagonal transformer housing
      gfx.fillStyle(0x11131a, 1);
      gfx.fillRect(2, 2, 20, 20);
      gfx.lineStyle(2, 0x00f0ff, 1);
      gfx.strokeRect(2, 2, 20, 20);
      // High voltage core
      gfx.fillStyle(0xffea00, 1);
      gfx.fillTriangle(12, 5, 8, 13, 14, 13);
      gfx.fillTriangle(10, 12, 16, 12, 12, 19);
      // Glowing dual-circuit routing pips
      gfx.fillStyle(0x00f0ff, 1);
      gfx.fillRect(4, 4, 3, 3);
      gfx.fillStyle(0xff007f, 1);
      gfx.fillRect(17, 4, 3, 3);
      gfx.generateTexture('power_node', 24, 24);
      gfx.destroy();
    }

    // C10. Neon Billboards
    if (!scene.textures.exists('billboard_neon1')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Dark backing
      gfx.fillStyle(0x08090f, 0.9);
      gfx.fillRect(0, 0, 80, 36);
      gfx.lineStyle(2, 0xff007f, 0.9); // Neon pink border
      gfx.strokeRect(0, 0, 80, 36);
      // Inner glowing cyan accents
      gfx.fillStyle(0x00f0ff, 0.85);
      gfx.fillRect(8, 8, 64, 4);
      gfx.fillRect(8, 24, 64, 4);
      gfx.fillStyle(0xff007f, 1);
      gfx.fillRect(20, 15, 40, 6);
      gfx.generateTexture('billboard_neon1', 80, 36);
      gfx.destroy();
    }

    if (!scene.textures.exists('billboard_neon2')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x08090f, 0.9);
      gfx.fillRect(0, 0, 80, 36);
      gfx.lineStyle(2, 0x00a8ff, 0.9); // Neon blue border
      gfx.strokeRect(0, 0, 80, 36);
      // Yellow & Cyan neon arrow
      gfx.fillStyle(0xffea00, 1);
      gfx.fillTriangle(50, 8, 68, 18, 50, 28);
      gfx.fillStyle(0x00f0ff, 0.85);
      gfx.fillRect(12, 14, 38, 8);
      gfx.generateTexture('billboard_neon2', 80, 36);
      gfx.destroy();
    }

    // C11. Failsafe Component 4: The Quantum Flux Core
    if (!scene.textures.exists('relic_component4')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Cyan flux field
      gfx.fillStyle(0x00f0ff, 0.25);
      gfx.fillCircle(16, 16, 15);
      // Dynamo housing
      gfx.lineStyle(2, 0x00f0ff, 1);
      gfx.strokeRect(4, 4, 24, 24);
      // Golden electromagnetic inductor coils
      gfx.fillStyle(0xffea00, 1);
      gfx.fillRect(6, 6, 6, 20);
      gfx.fillRect(20, 6, 6, 20);
      // High-voltage central core
      gfx.fillStyle(0xffffff, 1);
      gfx.fillCircle(16, 16, 5);
      gfx.fillStyle(0x00f0ff, 1);
      gfx.fillCircle(16, 16, 3);
      gfx.generateTexture('relic_component4', 32, 32);
      gfx.destroy();
    }
  }

  // ── Futuristic City / Core Sector 5 Textures ───────────────────────────

  public static generateFuturisticTextures(scene: Phaser.Scene): void {
    // F1. Reality A Platform (Electric Blue / Cyan Cyber Matrix)
    if (!scene.textures.exists('tile_phase_a')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x061124, 1);
      gfx.fillRect(0, 0, 32, 32);
      // Electric blue matrix grid
      gfx.lineStyle(1.5, 0x00f0ff, 0.95);
      gfx.strokeRect(1, 1, 30, 30);
      gfx.lineStyle(1, 0x00a8ff, 0.6);
      gfx.lineBetween(0, 16, 32, 16);
      gfx.lineBetween(16, 0, 16, 32);
      // Corner node dots
      gfx.fillStyle(0xffffff, 1);
      gfx.fillCircle(4, 4, 2);
      gfx.fillCircle(28, 4, 2);
      gfx.fillCircle(4, 28, 2);
      gfx.fillCircle(28, 28, 2);
      // Top radiant glow
      gfx.fillStyle(0x00f0ff, 0.4);
      gfx.fillRect(2, 2, 28, 4);
      gfx.generateTexture('tile_phase_a', 32, 32);
      gfx.destroy();
    }

    // F2. Reality B Platform (Neon Magenta / Purple Dimensional Grid)
    if (!scene.textures.exists('tile_phase_b')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x1a0624, 1);
      gfx.fillRect(0, 0, 32, 32);
      // Neon magenta grid
      gfx.lineStyle(1.5, 0xff007f, 0.95);
      gfx.strokeRect(1, 1, 30, 30);
      gfx.lineStyle(1, 0x9d4edd, 0.6);
      gfx.lineBetween(0, 16, 32, 16);
      gfx.lineBetween(16, 0, 16, 32);
      // Corner node dots
      gfx.fillStyle(0xffffff, 1);
      gfx.fillCircle(4, 4, 2);
      gfx.fillCircle(28, 4, 2);
      gfx.fillCircle(4, 28, 2);
      gfx.fillCircle(28, 28, 2);
      // Top radiant glow
      gfx.fillStyle(0xff007f, 0.4);
      gfx.fillRect(2, 2, 28, 4);
      gfx.generateTexture('tile_phase_b', 32, 32);
      gfx.destroy();
    }

    // F3. Holographic Data Stream Lattice
    if (!scene.textures.exists('tile_holo_data')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x030814, 0.7);
      gfx.fillRect(0, 0, 32, 32);
      // Vertical streaming data bits
      gfx.fillStyle(0x00f0ff, 0.8);
      for (let x = 4; x < 32; x += 8) {
        for (let y = 2; y < 32; y += 6) {
          gfx.fillRect(x, y, 3, 2);
        }
      }
      gfx.lineStyle(1, 0x00f0ff, 0.5);
      gfx.strokeRect(0, 0, 32, 32);
      gfx.generateTexture('tile_holo_data', 32, 32);
      gfx.destroy();
    }

    // F4. Glitch / Shifting Platform
    if (!scene.textures.exists('tile_glitch')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x0a0c16, 1);
      gfx.fillRect(0, 0, 32, 32);
      // Chromatic aberration offset bars
      gfx.fillStyle(0xff0055, 0.85); // Red shift
      gfx.fillRect(2, 6, 24, 4);
      gfx.fillRect(6, 18, 24, 4);
      gfx.fillStyle(0x00f0ff, 0.85); // Cyan shift
      gfx.fillRect(4, 8, 24, 4);
      gfx.fillRect(8, 20, 24, 4);
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillRect(10, 10, 12, 2);
      gfx.generateTexture('tile_glitch', 32, 32);
      gfx.destroy();
    }

    // F5. Failsafe Component 5: The Singularity Core (Final Failsafe)
    if (!scene.textures.exists('relic_component5')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Hyper-dimensional radiant aura
      gfx.fillStyle(0x9d4edd, 0.3);
      gfx.fillCircle(16, 16, 15);
      // Rotating outer diamond
      gfx.fillStyle(0x7209b7, 1);
      gfx.fillRect(6, 6, 20, 20);
      gfx.lineStyle(2, 0x00f0ff, 1);
      gfx.strokeRect(6, 6, 20, 20);
      // Concentrated singularity
      gfx.fillStyle(0xffffff, 1);
      gfx.fillCircle(16, 16, 6);
      gfx.fillStyle(0xff007f, 1);
      gfx.fillCircle(16, 16, 3);
      gfx.generateTexture('relic_component5', 32, 32);
      gfx.destroy();
    }

    // F6. Assembled Failsafe Matrix Array (48x48)
    if (!scene.textures.exists('failsafe_array')) {
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      // Central pedestal & housing
      gfx.fillStyle(0x090e1a, 0.95);
      gfx.fillCircle(24, 24, 22);
      gfx.lineStyle(2, 0x00f0ff, 1);
      gfx.strokeCircle(24, 24, 22);
      // 5 Orbital Crystals: Cyan, Orange, Gold, Yellow, Magenta
      const colors = [0x00f0ff, 0xff6600, 0xd4af37, 0xffea00, 0xff007f];
      colors.forEach((col, idx) => {
        const ang = (idx / 5) * Math.PI * 2 - Math.PI / 2;
        const cx = 24 + Math.cos(ang) * 14;
        const cy = 24 + Math.sin(ang) * 14;
        gfx.fillStyle(col, 1);
        gfx.fillCircle(cx, cy, 4);
        gfx.fillStyle(0xffffff, 0.9);
        gfx.fillCircle(cx, cy, 2);
      });
      // Center singularity
      gfx.fillStyle(0xffffff, 1);
      gfx.fillCircle(24, 24, 5);
      gfx.generateTexture('failsafe_array', 48, 48);
      gfx.destroy();
    }
  }

  /**
   * Generates a circular clipped version of the user profile icon for the HUD.
   */
  public static generateCircularProfileTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists('profile_icon_circle')) return;
    if (!scene.textures.exists('profile_icon')) return;

    try {
      const source = scene.textures.get('profile_icon').getSourceImage() as HTMLImageElement;
      if (!source || !source.width || !source.height) return;

      const size = 128;
      const canvas = scene.textures.createCanvas('profile_icon_circle', size, size);
      if (!canvas) return;

      const ctx = canvas.getContext();
      ctx.clearRect(0, 0, size, size);

      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(source, 0, 0, size, size);
      ctx.restore();

      canvas.refresh();
    } catch {
      // Fallback silently if canvas texture cannot be created
    }
  }
}


