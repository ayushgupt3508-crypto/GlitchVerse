import { SaveSystem } from '../systems/SaveSystem';

/**
 * Checks whether all levels in GlitchVerse have been completed.
 * Derived from level progress storage (persisted in localStorage).
 * Returns true when the last level (level 5) is marked completed
 * or highest unlocked index > last index (4).
 */
export function hasCompletedAllLevels(): boolean {
  return SaveSystem.isAllLevelsCompleted();
}

