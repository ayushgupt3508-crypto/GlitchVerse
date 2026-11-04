# GlitchVerse

> **A 2D Cyberpunk Reality-Manipulation Platformer**  
> Navigate fractured timelines, manipulate reality, and escape a glitching simulation across six distinct sectors.

---

## Overview

**GlitchVerse** is a browser-based 2D platformer built with **Phaser 3**, **TypeScript**, and **Vite**. Players control a scientist wielding a reality-warping staff, using it to freeze water, phase through walls, manipulate time, possess enemy sentinels, and cloak themselves, all to traverse increasingly complex environments pulled from different eras of history.

The game features six unique sectors, a bonus gauntlet level, procedurally generated audio, mobile touch support, and a fully retro-cyberpunk pixel aesthetic.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Game Engine | [Phaser 3.88.2](https://phaser.io/) |
| Language | TypeScript 5.7+ |
| Bundler | Vite 6+ |
| Audio | Web Audio API (100% procedural, no audio files) |
| Storage | `localStorage` via `SaveSystem` |
| Resolution | 640 × 360 px, scaled with `Phaser.Scale.FIT` |
| Rendering | `image-rendering: pixelated` — authentic retro-pixel look |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- npm or pnpm

### Install & Run

```bash
# Install dependencies
npm install

# Start the dev server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview the production build
npm run preview
```

> [!NOTE]
> The game requires a modern browser with Web Audio API support. For best results, use Chrome or Firefox in landscape orientation.

---

## Gameplay

### The Story

You are **Vance**, a scientist trapped inside a glitching simulation called **GlitchVerse**. Armed with a reality-manipulation staff, you must traverse five corrupted eras of history and collect hidden **Failsafe Components** to stabilize the simulation and escape. Completing all five sectors unlocks the ultimate challenge: **The Convergence**.

### Controls

| Action | Keyboard | Mobile |
|---|---|---|
| Move | `←` / `→` or `A` / `D` | On-screen D-pad |
| Jump | `↑` / `W` / `Space` | Jump button |
| Staff Ability | `E` or `J` | Ability button |
| Pause | `Escape` or Pause icon | Pause button |

> [!TIP]
> The player has **coyote time** (140ms) and **jump buffering** (140ms) for forgiving, game-feel-focused platforming.

---

## Sectors

GlitchVerse features **5 main sectors** plus a bonus gauntlet level, each with a unique theme, palette, and staff mechanic.

### Sector 1 — Frozen Age
**Mechanic:** Water Freezing  
Freeze flowing water and suspended aquifers into solid ice runways and pressure-plate blocks. Navigate crumbling platforms, Sentinel Drones, and timed cryo-airlocks across four zones: the Vault, Frozen Lake, Ice Cave, and Buried Facility.

### Sector 2 — Heat Age  
**Mechanic:** Lava Solidification  
Solidify molten lava into basalt walkways. Dodge timed fire jets and navigate lava-raft crossings.

### Sector 3 — Medieval Palace  
**Mechanic:** Camouflage  
Cloak Vance to sneak past patrol guards and laser tripwires in an ancient palace environment with trap doors and drawbridges.

### Sector 4 — Ancient Forest  
**Mechanic:** Time Manipulation  
Rewind and fast-forward time to restore broken bridges, re-grow vines, and tame a rampaging Forest Golem. Features a lush overgrown-ruins aesthetic with waterfalls and ancient machinery.

### Sector 5 — Futuristic Core  
**Mechanic:** Phasing + Echo Possession (Reality Swap)  
Phase through solid walls by toggling reality states. Possess Echo Sentinel clones at Rift Nodes to reach objectives and teleport Vance across spatial gaps. Escape a glitching neon cityscape floating above the void.

### Sector 6 — The Convergence *(Bonus Gauntlet)*
**Unlocked by:** Completing all 5 sectors  
A timed gauntlet that remixes all five sector worlds in sequence, culminating in the **Convergence Core** finale. Players get **3 attempts** and a **6-minute timer**. Death does not reset the run — only running out of attempts does.

---

## Reality Staff Abilities

| Ability | Sector | Description |
|---|---|---|
| **Water Freeze** | S1 | Converts water/suspended aquifers into solid ice, opens cryo-barriers |
| **Drone Stun** | S1 | Freezes nearby Sentinel Drones inside ice blocks |
| **Lava Solidification** | S2 | Hardens lava into walkable basalt |
| **Camouflage** | S3 | Renders Vance invisible to guards and sensors |
| **Time Rewind / Accelerate** | S4 | Manipulates time-state objects (bridges, vines, bosses) |
| **Phase Shift** | S5 | Toggles between two reality states, phasing through certain walls |
| **Echo Possession** | S5/S6 | Possesses an Echo Sentinel via Rift Nodes to reach remote objectives and teleport |

---

## Architecture

```
GlitchVerse/
├── index.html                  # Canvas shell, fonts, mobile orientation barrier
├── vite.config.ts              # Vite config (port 3000, dist output)
├── src/
│   ├── config.ts               # GAME_CONFIG (640×360, gravity 800) + GAME_FONTS
│   ├── main.ts                 # Phaser.Game initialization, scene registry
│   ├── abilities/              # Reality manipulation ability modules
│   │   ├── CamouflageAbility.ts
│   │   ├── ElectromagneticAbility.ts
│   │   ├── PhasingAbility.ts
│   │   └── TimeAbility.ts
│   ├── entities/               # Game characters & interactive entities
│   │   ├── Player.ts           # Movement, jump feel, staff, health, mobile input
│   │   ├── SentinelDrone.ts    # Patrolling enemy with alert state & stun/freeze reactions
│   │   ├── Guard.ts            # Sector 3 patrol guard
│   │   ├── FireJet.ts          # Sector 2 timed fire column hazard
│   │   └── Fireball.ts
│   ├── scenes/                 # Phaser Scene modules (one per sector + UI scenes)
│   │   ├── BootScene.ts
│   │   ├── PreloadScene.ts
│   │   ├── MainMenuScene.ts
│   │   ├── StoryScene.ts
│   │   ├── GameScene.ts        # Sector 1: Frozen Age
│   │   ├── Sector2Scene.ts     # Sector 2: Heat Age
│   │   ├── level3.ts           # Sector 3: Medieval Palace
│   │   ├── level4.ts           # Sector 4: Ancient Forest
│   │   ├── level5.ts           # Sector 5: Futuristic Core
│   │   ├── Level6Scene.ts      # Sector 6: The Convergence (Gauntlet)
│   │   ├── LevelSelectScene.ts
│   │   ├── LevelCompleteScene.ts
│   │   ├── TutorialScene.ts
│   │   ├── EndingScene.ts
│   │   └── level6/             # Gauntlet sub-systems
│   │       ├── GauntletWorldBuilder.ts
│   │       ├── GauntletPuzzleManager.ts
│   │       └── SeamTransition.ts
│   ├── systems/                # Core engine systems
│   │   ├── AudioManager.ts     # Procedural Web Audio soundtracks + SFX + ducking
│   │   ├── SaveSystem.ts       # LocalStorage progress, settings & scores
│   │   ├── CircuitGraph.ts     # Interactive circuit conduit puzzle graph
│   │   ├── RealitySwapSystem.ts# Echo Possession, Ghost Platforms, Rift Nodes
│   │   ├── LevelSoundtracks.ts
│   │   ├── FullscreenManager.ts
│   │   ├── staff/              # Staff charge management & interactable contracts
│   │   └── time/               # Time-state interfaces and GrowthClock objects
│   ├── ui/                     # UI components (all Phaser GameObjects)
│   │   ├── HUD.ts              # Health/integrity, staff crystals, failsafe counter, '?' button
│   │   ├── PauseMenu.ts
│   │   ├── GameOverScreen.ts
│   │   ├── SettingsModal.ts    # Master, Music, SFX volume sliders
│   │   ├── GuideModal.ts       # In-game field guide (controls, abilities, objectives)
│   │   ├── CreditsModal.ts
│   │   ├── ExitModal.ts
│   │   ├── TutorialModal.ts
│   │   ├── MobileControls.ts   # Touch D-pad + action buttons
│   │   └── MobileSetup.ts
│   └── utils/
│       ├── TextureGenerator.ts # Procedural pixel-art sprites (scientist, crystals, tiles, golems)
│       ├── CharacterColor.ts   # Custom player color tinting
│       ├── DeviceDetector.ts   # Mobile/desktop detection
│       └── OrientationManager.ts # Landscape enforcement on mobile
```

---

## Audio System

GlitchVerse uses **zero external audio files**. All music and sound effects are generated in real time via the **Web Audio API** in [`AudioManager.ts`](src/systems/AudioManager.ts).

### Soundtracks

| Track | Active In | Style |
|---|---|---|
| **Matrix Cyberpunk** | Main Menu, all action sectors | 126 BPM · TB-303 acid bass · 16th-note data arpeggios · glitch accents |
| **Calm Story** | Story Scene | 70 BPM · ambient low-pass pads · crystalline celesta melody · sub-bass swell |

### Procedural SFX

Jump · Staff Cast · Water Freeze · Ice Melt · Player Hit · Drone Alert · Crystal Checkpoint · Menu Hover · Menu Select · Game Over

### Dynamic Audio Control

- **Volume ducking:** Low-pass filter at 500 Hz + 50% volume reduction during pause menus and modals
- **Real-time volume:** Master, Music, and SFX gain nodes adjustable live from Settings

---

## Save System

Progress and settings are persisted in `localStorage` under two keys:

| Key | Contents |
|---|---|
| `glitchverse_settings` | Master, Music, SFX volume (0–1) |
| `glitchverse_progress` | Unlocked/completed levels, best score, last score |
| `glitchverse_level6_best` | Best score for The Convergence gauntlet |

---

## Mobile Support

- **Orientation Barrier:** Portrait-mode devices see a "Rotate Device" overlay until switched to landscape.
- **Touch Controls:** Virtual D-pad (move left/right), jump button, and ability button rendered as Phaser game objects.
- **Input merging:** Mobile touch input is OR'd with keyboard input at the `Player` level — desktop and mobile paths share the same update logic.

---

## Level Rank System

Each sector awards a rank on completion based on performance:

| Rank | Description |
|---|---|
| **S** | Perfect / Elite |
| **A** | Excellent |
| **B** | Good |
| **C** | Average |
| **D** | Completed |

---

## Developer Notes

> [!IMPORTANT]
> Always run `npm run build` after editing to verify TypeScript compiles with 0 errors before reporting a change as complete.

### Dev Shortcuts (from Main Menu)

| Key | Action |
|---|---|
| `1` | Jump to Sector 1 |
| `2` | Jump to Sector 2 |
| `3` | Jump to Sector 3 |
| `4` | Jump to Sector 4 |
| `5` | Jump to Sector 5 |
| `6` | Jump to Sector 6 (The Convergence) |

> [!WARNING]
> The `DEV_UNLOCK_KEY` shortcut for Sector 6 (`6` key) is currently **enabled** in `MainMenuScene.ts`. Set `DEV_UNLOCK_KEY = null` before a production release to disable it.

---

## Typography

All text uses a centralized font stack defined in [`src/config.ts`](src/config.ts):

- **Primary / Heading:** `Oxanium` (Google Fonts CDN + local TTF fallback)
- **Mono:** `Share Tech Mono`
- **Minimum font size:** 10px with `fontStyle: 'bold'` for in-world signs
- **All text** must have a dark outline (`stroke: '#040711'`, `strokeThickness: 2–3`) to stay readable against bright backgrounds

---

## License

This project is private (`"private": true` in `package.json`). All rights reserved.

