export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
}

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  musicVolume: 0.7,
  sfxVolume: 0.9
};

const SETTINGS_KEY = 'glitchverse_settings';

export class SaveSystem {
  private static cachedSettings: GameSettings | null = null;

  public static getSettings(): GameSettings {
    if (this.cachedSettings) {
      return { ...this.cachedSettings };
    }

    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.cachedSettings = {
          masterVolume: typeof parsed.masterVolume === 'number' ? Math.max(0, Math.min(1, parsed.masterVolume)) : DEFAULT_SETTINGS.masterVolume,
          musicVolume: typeof parsed.musicVolume === 'number' ? Math.max(0, Math.min(1, parsed.musicVolume)) : DEFAULT_SETTINGS.musicVolume,
          sfxVolume: typeof parsed.sfxVolume === 'number' ? Math.max(0, Math.min(1, parsed.sfxVolume)) : DEFAULT_SETTINGS.sfxVolume
        };
        return { ...this.cachedSettings };
      }
    } catch (e) {
      console.warn('Failed to read settings from localStorage, using defaults.', e);
    }

    this.cachedSettings = { ...DEFAULT_SETTINGS };
    return { ...this.cachedSettings };
  }

  public static saveSettings(settings: Partial<GameSettings>): void {
    const current = this.getSettings();
    const updated: GameSettings = {
      masterVolume: settings.masterVolume !== undefined ? Math.max(0, Math.min(1, settings.masterVolume)) : current.masterVolume,
      musicVolume: settings.musicVolume !== undefined ? Math.max(0, Math.min(1, settings.musicVolume)) : current.musicVolume,
      sfxVolume: settings.sfxVolume !== undefined ? Math.max(0, Math.min(1, settings.sfxVolume)) : current.sfxVolume
    };

    this.cachedSettings = updated;

    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to persist settings to localStorage.', e);
    }
  }
}
