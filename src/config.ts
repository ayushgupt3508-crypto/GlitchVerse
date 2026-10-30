export const GAME_CONFIG = {
  width: 640,
  height: 360,
  gravity: 800,
  debugPhysics: false,
  sceneKeys: {
    Boot: 'BootScene',
    Preload: 'PreloadScene',
    MainMenu: 'MainMenu',
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
