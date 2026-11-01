export const GAME_CONFIG = {
  width: 640,
  height: 360,
  gravity: 800,
  debugPhysics: false,
  sceneKeys: {
    Boot: 'BootScene',
    Preload: 'PreloadScene',
    MainMenu: 'MainMenu',
    LevelSelect: 'LevelSelectScene',

    Tutorial: 'TutorialScene',

    Game: 'GameScene',
    Level2: 'Sector2Scene',
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
  primary: '"Oxanium", sans-serif',
  heading: '"Oxanium", sans-serif',
  mono: '"Share Tech Mono", monospace'
};
