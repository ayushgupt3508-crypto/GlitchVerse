export const GAME_CONFIG = {
  width: 640,
  height: 360,
  gravity: 800,
  debugPhysics: false,
  sceneKeys: {
    Boot: 'BootScene',
    Preload: 'PreloadScene',
    MainMenu: 'MainMenu',
    Tutorial: 'TutorialScene',
    Game: 'GameScene',
    Level3: 'Level3Scene',
    Level4: 'Level4Scene',
    Level5: 'Level5Scene',
    GameEnding: 'GameEnding',
    FinalScore: 'FinalScore',
    Credits: 'Credits',
    Ending: 'EndingScene'
  }
} as const;

export const GAME_FONTS = {
  primary: '"Pixelify Sans", "Share Tech Mono", monospace',
  heading: '"Pixelify Sans", "Press Start 2P", monospace',
  mono: '"Pixelify Sans", "Courier New", monospace'
};
