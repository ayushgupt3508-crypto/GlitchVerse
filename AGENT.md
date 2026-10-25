# AGENT.md — GlitchVerse Engineering & Architectural Context

> **CRITICAL RULE FOR ALL AGENTS:**
> **DO NOT CREATE GIT COMMITS OR PUSH TO REPOSITORIES** unless the user explicitly asks to do so in the active prompt.
> Always keep changes in the working tree and verify with `npm run build` before reporting to the user.

---

## 1. Project Overview & Tech Stack
- **Game Title:** **GlitchVerse** (formerly Project Z)
- **Genre:** 2D Cyberpunk Reality-Manipulation Platformer
- **Engine / Core:** Phaser 3.88.2, TypeScript 5.8+, Vite 6+
- **Rendering & Resolution:**
  - Viewport: $640 \times 360$ px scaled to window with `Phaser.Scale.FIT` and `autoCenter: CENTER_BOTH`
  - Style: Authentically pixelated retro-cyber aesthetic with `image-rendering: pixelated` and scanline overlays
- **Storage:** LocalStorage via `SaveSystem.ts` (volume preferences, checkpoints, failsafe collection)
- **Audio:** 100% procedural Web Audio API engine (`AudioManager.ts`) with zero external audio file dependencies

---

## 2. Typography & Readability Design System
To preserve the 8-bit / 16-bit cyber-retro feel without suffering from illegible or blurry text when scaled up on modern displays, all scenes and UI components adhere to the centralized font configuration in [src/config.ts](file:///c:/Users/ayush%20gupta/Downloads/Project_Z_Web/src/config.ts):

```typescript
export const GAME_FONTS = {
  primary: '"Pixelify Sans", "Share Tech Mono", monospace',
  heading: '"Pixelify Sans", "Press Start 2P", monospace',
  mono: '"Pixelify Sans", "Courier New", monospace'
};
```

### Readability Guidelines
1. **Never use generic un-outlined `Courier New` at small sizes ($< 10\text{px}$).**
2. **Font Sizes:**
   - In-game floating signs / tooltips: $\ge 10\text{px}$, bold (`fontStyle: 'bold'`).
   - Modal body text / sliders / buttons: $12\text{px} - 14\text{px}$, bold.
   - Scene Titles / Banners: $18\text{px} - 28\text{px}$, bold.
3. **Contrast Outlines:**
   - Always apply dark outlines: `stroke: '#040711'`, `strokeThickness: 2` (or `3` for titles).
   - For floating signs on bright backgrounds, use a dark pill background (`backgroundColor: '#070b14'`, `padding: { x: 4, y: 2 }`).
4. **Offline & Online Font Support:**
   - Google Fonts CDN in [index.html](file:///c:/Users/ayush%20gupta/Downloads/Project_Z_Web/index.html) (`Pixelify Sans`, `Press Start 2P`, `Share Tech Mono`).
   - Local `@font-face` fallback bundled in `public/assets/fonts/` (`PixelifySans-VariableFont_wght.ttf`, `PressStart2P-Regular.ttf`).

---

## 3. Directory Map & Core Modules

```
Project_Z_Web/
├── index.html                  # Canvas shell, Google Fonts, font-face rules
├── package.json                # Scripts: "dev", "build", "preview"
├── vite.config.ts              # Vite config (port 3000)
├── public/assets/fonts/        # Local TTF fonts for offline playback
└── src/
    ├── config.ts               # GAME_CONFIG (640x360, gravity 800) + GAME_FONTS
    ├── main.ts                 # Phaser.Game initialization
    ├── abilities/              # Reality manipulation abilities
    │   ├── CamouflageAbility.ts
    │   ├── ElectromagneticAbility.ts
    │   ├── PhasingAbility.ts
    │   └── TimeAbility.ts
    ├── entities/               # Game characters and interactive obstacles
    │   ├── Player.ts           # Movement, jump, staff interactions, health/hearts
    │   ├── SentinelDrone.ts    # Patrolling enemy drone, alert state, stun/freeze reaction
    │   ├── Guard.ts            # Sector 3 patrol guard
    │   ├── FireJet.ts          # Sector 2 timed fire column hazard
    │   └── Fireball.ts
    ├── scenes/                 # Phaser Scenes
    │   ├── BootScene.ts        # Initial setup
    │   ├── PreloadScene.ts     # Texture generation and font loading
    │   ├── MainMenuScene.ts    # Main menu with PLAY, SETTINGS, CREDITS, EXIT + [1..5] level skips
    │   ├── StoryScene.ts       # Lore narration with soothing ambient track
    │   ├── GameScene.ts        # Sector 1: Frozen Age (4 distinct zones)
    │   ├── Sector2Scene.ts     # Sector 2: Heat Age (lava rafts, fire jets)
    │   ├── Sector2TeaserScene.ts # Sector 2 incoming transmission screen
    │   ├── level3.ts           # Sector 3: Medieval Palace
    │   ├── level4.ts / Level4Scene.ts # Sector 4: Ancient Forest
    │   ├── level5.ts / Level5Scene.ts # Sector 5: Futuristic Core
    │   ├── LevelCompleteScene.ts # Sector victory summary & rank badge (S/A/B/C/D)
    │   └── EndingScene.ts      # Grand finale (5 sectors freed, master rank, twist lore)
    ├── systems/                # Core systems
    │   ├── AudioManager.ts     # Procedural matrix & story soundtracks + SFX + volume ducking
    │   ├── SaveSystem.ts       # LocalStorage saving/loading of settings & checkpoints
    │   ├── CircuitGraph.ts     # Interactive circuit conduit graph
    │   └── staff/              # StaffController and HUD charge crystal contracts
    ├── ui/                     # UI components
    │   ├── HUD.ts              # Top bar, ♥♥♥ integrity, failsafe count, '?' guide button, staff crystals
    │   ├── GuideModal.ts       # Compact player field guide (controls, abilities, objectives)
    │   ├── PauseMenu.ts        # Resume, Start at Checkpoint, Restart, Settings, Main Menu
    │   ├── SettingsModal.ts    # Master, Music, and SFX volume sliders
    │   ├── CreditsModal.ts     # Scrolling developer and engine archive
    │   ├── ExitModal.ts        # Safe exit modal
    │   └── GameOverScreen.ts   # Respawn at checkpoint [Space/Enter], Restart [R], Menu [Esc]
    └── utils/
        └── TextureGenerator.ts # Procedural pixel art sprites (scientist, crystals, conduits, tiles)
```

---

## 4. Key Gameplay Mechanics & Puzzle Rules

### Reality Staff Abilities (`[J]` or `[E]` key)
- **Water Freezing:** Converts flowing water bodies into solid, walkable ice runways and platforms.
- **Selective Slab Conversion (Sector 1 Zone 2):** Converts specific water slab tiles to ice, allowing traversal across abyss lakes without triggering low trap slabs.
- **Suspended Aquifer (Sector 1 Zone 3):** Freezes suspended falling water overhead, creating an ice block that drops onto the hydraulic pressure plate to open **Cryo-Barrier 1**.
- **Player Standing on Blocks:** Players can stand and jump off frozen blocks and ice platforms.
- **Proximity Freezing / Thawing:** Staff ability affects water/ice tiles not only beneath the player's feet but also within a generous radius around the player.
- **Cryo-Door Melting:** Timed melting (e.g. 4.5s countdown before refreezing) to allow rapid dash through airlocks.
- **Drone Stun/Freeze:** Freezes nearby patrolling Sentinel Drones in ice blocks for safe passage.
- **Lava Solidification (Sector 2):** Solidifies molten lava into basalt stone walkways.

### Sector 1 (Frozen Age) Map Layout
- **Zone 1 (Vault):** Moving platform, crumbling platforms, Sentinel Drone patrol, Failsafe #01 pedestal.
- **Zone 2 (Frozen Lake):** Selective slab conversion (Slab A, Slab B trap, Slab C), decoy reservoir.
- **Zone 3 (Ice Cave):** Upper maintenance gantry, checkpoint crystal #2, hydraulic pressure plate shaft, suspended aquifer freeze block, floor icicle spikes, moving frost hazard, ceiling falling icicles, Frost Bulwark.
- **Zone 4 (Buried Facility Approach):** Slippery runway, floor spikes, facility airlock bunker, timed cryo-lock (4.5s melt), Failsafe #02, Exit Portal.

---

## 5. Audio Architecture (`AudioManager.ts`)
- **Soundtrack 1 — Matrix Cyberpunk:**
  - Active in: `MainMenuScene`, `GameScene`, `Sector2Scene`, other action sectors.
  - Composition: 126 BPM, TB-303 style acid bassline (cutoff & resonance automation), 16th-note data arpeggios, synthesized punch kick, noise snare, closed/open hats, glitch accents.
- **Soundtrack 2 — Calm Soothing Story:**
  - Active in: `StoryScene`.
  - Composition: 70 BPM, warm ambient low-pass pads, crystalline celesta melody, sub-bass swell, stardust shimmers.
- **Dynamic Control:**
  - `startMatrixMusic()` / `startStoryMusic()` / `stopMusic()`.
  - `setMusicDucked(true/false)`: Applies a low-pass filter (500Hz) and softens volume by 50% during pause menu, modals, and game over.
  - `applyVolume()`: Adjusts master, music, and SFX gain nodes in real time based on `SaveSystem.getSettings()`.
- **Procedural SFX:**
  - Jump, Staff Cast, Water Freeze, Ice Melt, Player Hit, Drone Alert, Crystal Checkpoint, Menu Hover, Menu Select, Game Over.

---

## 6. Development Workflow Rules
1. **Verification Command:** Always run `npm run build` after editing to ensure TypeScript compiles with 0 errors.
2. **Local Dev Server:** Runs on `http://localhost:3000` via `npm run dev`.
3. **No Commits Without Explicit Confirmation:** The user must explicitly request a commit before `git commit` is executed.
