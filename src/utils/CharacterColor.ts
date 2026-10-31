export const CHARACTER_COLOR_KEY = 'glitchverse_character_color';

export class CharacterColorManager {
  private static cachedColor: string | null = null;

  public static getCharacterColor(): string | null {
    if (this.cachedColor !== null) {
      return this.cachedColor === '' ? null : this.cachedColor;
    }

    try {
      const stored = localStorage.getItem(CHARACTER_COLOR_KEY);
      if (stored && typeof stored === 'string') {
        const trimmed = stored.trim();
        if (this.isValidHex(trimmed)) {
          this.cachedColor = trimmed.toUpperCase();
          return this.cachedColor;
        }
      }
    } catch (e) {
      console.warn('Failed to read character color from localStorage:', e);
    }

    this.cachedColor = '';
    return null;
  }

  public static setCharacterColor(hex: string | null): void {
    try {
      if (hex && this.isValidHex(hex.trim())) {
        const formatted = hex.trim().toUpperCase();
        this.cachedColor = formatted;
        localStorage.setItem(CHARACTER_COLOR_KEY, formatted);
      } else {
        this.cachedColor = '';
        localStorage.removeItem(CHARACTER_COLOR_KEY);
      }
    } catch (e) {
      console.warn('Failed to save character color to localStorage:', e);
    }
  }

  public static hexToNumber(hex: string | null): number | null {
    if (!hex || !this.isValidHex(hex)) return null;
    const clean = hex.replace('#', '');
    return parseInt(clean, 16);
  }

  public static isValidHex(hex: string): boolean {
    return /^#?[0-9A-Fa-f]{6}$/.test(hex.trim());
  }

  public static normalizeHex(hex: string): string {
    const clean = hex.trim().replace('#', '').toUpperCase();
    return `#${clean}`;
  }
}