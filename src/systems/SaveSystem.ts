export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
}

export interface GameProgress {
  unlockedLevel: number;
  completedLevels: number[];
  highestUnlockedIndex: number;
  bestScore?: number;
  lastScore?: number;
}

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  musicVolume: 0.7,
  sfxVolume: 0.9
};

const SETTINGS_KEY = 'glitchverse_settings';
const PROGRESS_KEY = 'glitchverse_progress';
const TOTAL_LEVELS = 5;

export class SaveSystem {
  private static cachedSettings: GameSettings | null = null;
  private static cachedProgress: GameProgress | null = null;

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

  public static getProgress(): GameProgress {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          unlockedLevel: typeof parsed.unlockedLevel === 'number' ? parsed.unlockedLevel : 1,
          completedLevels: Array.isArray(parsed.completedLevels) ? parsed.completedLevels : [],
          highestUnlockedIndex: typeof parsed.highestUnlockedIndex === 'number' ? parsed.highestUnlockedIndex : 0,
          bestScore: typeof parsed.bestScore === 'number' ? parsed.bestScore : undefined,
          lastScore: typeof parsed.lastScore === 'number' ? parsed.lastScore : undefined
        };
      }
    } catch (e) {
      console.warn('Failed to read progress from localStorage.', e);
    }

    return {
      unlockedLevel: 1,
      completedLevels: [],
      highestUnlockedIndex: 0
    };
  }

  public static saveProgress(progress: GameProgress): void {
    this.cachedProgress = progress;
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch (e) {
      console.warn('Failed to persist progress to localStorage.', e);
    }
  }

  public static markLevelCompleted(levelNumber: number, score?: number): void {
    const progress = this.getProgress();
    if (!progress.completedLevels.includes(levelNumber)) {
      progress.completedLevels.push(levelNumber);
    }
    progress.highestUnlockedIndex = Math.max(progress.highestUnlockedIndex, levelNumber);
    progress.unlockedLevel = Math.max(progress.unlockedLevel, levelNumber + 1);

    if (score !== undefined) {
      progress.lastScore = score;
      if (progress.bestScore === undefined || score > progress.bestScore) {
        progress.bestScore = score;
      }
    }

    this.saveProgress(progress);
  }

  public static resetProgress(): void {
    const progress = this.getProgress();
    // Keep bestScore across resets, but reset completed levels and unlocked level
    const resetData: GameProgress = {
      unlockedLevel: 1,
      completedLevels: [],
      highestUnlockedIndex: 0,
      bestScore: progress.bestScore,
      lastScore: undefined
    };
    this.saveProgress(resetData);
  }

public static isAllLevelsCompleted(): boolean {
  const progress = this.getProgress();

  return [1, 2, 3, 4, 5].every(level =>
    progress.completedLevels.includes(level)
  );
}

  public static getBestScore(): number | undefined {
    return this.getProgress().bestScore;
  }

  public static getLastScore(): number | undefined {
    return this.getProgress().lastScore;
  }

  public static recordScore(score: number): void {
    const progress = this.getProgress();
    progress.lastScore = score;
    if (progress.bestScore === undefined || score > progress.bestScore) {
      progress.bestScore = score;
    }
    this.saveProgress(progress);
  }
}
