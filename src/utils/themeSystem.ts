export type ThemeMode = 'light' | 'dark' | 'system';

export type ThemePresetId =
  | 'emerald'
  | 'ocean'
  | 'royal'
  | 'crimson'
  | 'earth'
  | 'minimal'
  | 'custom';

export interface ThemeIdentity {
  primary: string;
  secondary: string;
  tertiary: string;
}

export interface ModePalette {
  background: string;
  surface: string;
  surfaceSubtle: string;
  white: string;
  heading: string;
  body: string;
  muted: string;
  disabled: string;
  border: string;
  borderSubtle: string;
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryForeground: string;
  secondary: string;
  secondaryHover: string;
  secondaryLight: string;
  secondaryForeground: string;
  tertiary: string;
  tertiaryHover: string;
  tertiaryLight: string;
  tertiaryForeground: string;
  accent: string;
  accentHover: string;
  accentLight: string;
  accentText: string;
  accentForeground: string;
}

export interface ThemePreset {
  id: Exclude<ThemePresetId, 'custom'>;
  name: string;
  tagline: string;
  identity: ThemeIdentity;
  light: ModePalette;
  dark: ModePalette;
}

export interface ResolvedTheme {
  presetId: ThemePresetId;
  mode: ThemeMode;
  identity: ThemeIdentity;
  light: ModePalette;
  dark: ModePalette;
}

export const DEFAULT_THEME_PRESET: Exclude<ThemePresetId, 'custom'> = 'emerald';
export const DEFAULT_THEME_MODE: ThemeMode = 'light';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function normalizeHex(input: string | undefined | null, fallback: string): string {
  const val = (input || '').trim();
  if (HEX_RE.test(val)) return val.toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(val)) return `#${val.toUpperCase()}`;
  return fallback.toUpperCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = normalizeHex(hex, '#000000').slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l: l * 100 };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;

  return { h: h * 60, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const hn = ((h % 360) + 360) % 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (hn < 60) [r, g, b] = [c, x, 0];
  else if (hn < 120) [r, g, b] = [x, c, 0];
  else if (hn < 180) [r, g, b] = [0, c, x];
  else if (hn < 240) [r, g, b] = [0, x, c];
  else if (hn < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function getContrastRatio(hexA: string, hexB: string): number {
  const lumA = getRelativeLuminance(hexA);
  const lumB = getRelativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function mixHex(hexA: string, hexB: string, weightA: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const w = Math.max(0, Math.min(1, weightA));
  return rgbToHex(
    a.r * w + b.r * (1 - w),
    a.g * w + b.g * (1 - w),
    a.b * w + b.b * (1 - w),
  );
}

/**
 * Pick WCAG-safe foreground text color (tinted near-black or crisp white) for a background hex.
 */
export function getContrastForeground(bgHex: string, darkNeutral = '#111815'): string {
  const whiteContrast = getContrastRatio(bgHex, '#FFFFFF');
  const darkContrast = getContrastRatio(bgHex, darkNeutral);
  if (darkContrast >= 4.5 || whiteContrast >= 4.5) {
    return darkContrast > whiteContrast ? darkNeutral : '#FFFFFF';
  }
  // Edge zone (e.g. pure red/orange): use ultra-dark neutral if it achieves higher contrast
  const deepContrast = getContrastRatio(bgHex, '#09090B');
  return deepContrast > whiteContrast ? '#09090B' : '#FFFFFF';
}

function buildAccentAlias(
  secondary: string,
  secondaryHover: string,
  secondaryLight: string,
  secondaryForeground: string,
  surface: string,
  isDark: boolean,
): Pick<ModePalette, 'accent' | 'accentHover' | 'accentLight' | 'accentText' | 'accentForeground'> {
  const surfaceContrast = getContrastRatio(secondary, surface);
  if (surfaceContrast >= 3.2) {
    return {
      accent: secondary,
      accentHover: secondaryHover,
      accentLight: secondaryLight,
      accentText: isDark ? secondary : secondaryForeground,
      accentForeground: secondaryForeground,
    };
  }

  // Secondary is a soft tint (e.g. Mint #E0FFC2 or Deep Tint #294638);
  // derive a readable accent color for existing text-accent/bg-accent consumers.
  const { h, s } = rgbToHsl(...Object.values(hexToRgb(secondary)) as [number, number, number]);
  const readableAccent = isDark
    ? hslToHex(h, Math.min(82, Math.max(38, s)), 68)
    : hslToHex(h, Math.min(78, Math.max(42, s)), 34);
  return {
    accent: readableAccent,
    accentHover: isDark ? mixHex(readableAccent, '#FFFFFF', 0.85) : mixHex(readableAccent, '#000000', 0.85),
    accentLight: secondaryLight,
    accentText: isDark ? mixHex(readableAccent, '#FFFFFF', 0.7) : secondaryForeground,
    accentForeground: getContrastForeground(readableAccent),
  };
}

/**
 * Auto-generate calibrated Light & Dark Mode semantic palettes from 3 school identity colors.
 */
export function generateCustomThemePalettes(identity: ThemeIdentity): {
  light: ModePalette;
  dark: ModePalette;
} {
  const primaryBase = normalizeHex(identity.primary, '#064734');
  const secondaryBase = normalizeHex(identity.secondary, '#E0FFC2');
  const tertiaryBase = normalizeHex(identity.tertiary, '#D9F45B');

  const pRgb = hexToRgb(primaryBase);
  const pHsl = rgbToHsl(pRgb.r, pRgb.g, pRgb.b);
  const sRgb = hexToRgb(secondaryBase);
  const sHsl = rgbToHsl(sRgb.r, sRgb.g, sRgb.b);
  const tRgb = hexToRgb(tertiaryBase);
  const tHsl = rgbToHsl(tRgb.r, tRgb.g, tRgb.b);

  const neutralSat = pHsl.s < 8 ? 0 : Math.min(10, pHsl.s * 0.25);

  // Light Mode system neutrals subtly harmonized with primary hue
  const lightBg = hslToHex(pHsl.h, neutralSat, 97.5);
  const lightSurface = '#FFFFFF';
  const lightSurfaceSubtle = hslToHex(pHsl.h, neutralSat, 94.5);
  const lightHeading = hslToHex(pHsl.h, Math.min(18, neutralSat * 1.6), 11);
  const lightBody = hslToHex(pHsl.h, Math.min(12, neutralSat), 20);
  const lightMuted = hslToHex(pHsl.h, Math.min(10, neutralSat), 43);
  const lightDisabled = hslToHex(pHsl.h, Math.min(8, neutralSat), 62);
  const lightBorder = hslToHex(pHsl.h, Math.min(12, neutralSat), 90);
  const lightBorderSubtle = hslToHex(pHsl.h, Math.min(10, neutralSat), 94);

  const lightPrimaryHover = mixHex(primaryBase, '#000000', 0.85);
  const lightPrimaryLight = mixHex(primaryBase, '#FFFFFF', 0.14);
  const lightPrimaryFg = getContrastForeground(primaryBase, lightHeading);

  const lightSecondaryHover =
    getRelativeLuminance(secondaryBase) > 0.65
      ? mixHex(secondaryBase, '#000000', 0.9)
      : mixHex(secondaryBase, '#000000', 0.85);
  const lightSecondaryLight =
    getRelativeLuminance(secondaryBase) > 0.72
      ? secondaryBase
      : mixHex(secondaryBase, '#FFFFFF', 0.18);
  const lightSecondaryFg =
    getRelativeLuminance(secondaryBase) > 0.5
      ? hslToHex(sHsl.h, Math.min(60, Math.max(25, sHsl.s)), 18)
      : getContrastForeground(secondaryBase, lightHeading);

  const lightTertiaryHover =
    getRelativeLuminance(tertiaryBase) > 0.6
      ? mixHex(tertiaryBase, '#000000', 0.9)
      : mixHex(tertiaryBase, '#000000', 0.85);
  const lightTertiaryLight = mixHex(tertiaryBase, '#FFFFFF', 0.22);
  const lightTertiaryFg = getContrastForeground(tertiaryBase, lightHeading);

  const lightAccent = buildAccentAlias(
    secondaryBase,
    lightSecondaryHover,
    lightSecondaryLight,
    lightSecondaryFg,
    lightSurface,
    false,
  );

  // Dark Mode system neutrals (near-black with subtle hue tint, comfortable contrast)
  const darkBg = hslToHex(pHsl.h, Math.min(18, neutralSat * 1.8), 8);
  const darkSurface = hslToHex(pHsl.h, Math.min(18, neutralSat * 1.6), 12);
  const darkSurfaceSubtle = hslToHex(pHsl.h, Math.min(16, neutralSat * 1.5), 16.5);
  const darkHeading = hslToHex(pHsl.h, Math.min(12, neutralSat), 95);
  const darkBody = hslToHex(pHsl.h, Math.min(10, neutralSat), 85);
  const darkMuted = hslToHex(pHsl.h, Math.min(10, neutralSat), 66);
  const darkDisabled = hslToHex(pHsl.h, Math.min(8, neutralSat), 42);
  const darkBorder = hslToHex(pHsl.h, Math.min(16, neutralSat * 1.5), 22.5);
  const darkBorderSubtle = hslToHex(pHsl.h, Math.min(14, neutralSat * 1.4), 18);

  // Dark Mode Primary: lift dark primaries to comfortable luminous brand accent
  const darkPrimary =
    pHsl.l < 48
      ? hslToHex(pHsl.h, pHsl.s < 8 ? 0 : Math.min(72, Math.max(36, pHsl.s * 0.85)), 68)
      : pHsl.l > 78
        ? hslToHex(pHsl.h, pHsl.s, 72)
        : primaryBase;
  const darkPrimaryHover = mixHex(darkPrimary, '#FFFFFF', 0.84);
  const darkPrimaryLight = mixHex(darkPrimary, darkSurface, 0.22);
  const darkPrimaryFg = getContrastForeground(darkPrimary, hslToHex(pHsl.h, Math.min(40, pHsl.s), 11));

  // Dark Mode Secondary: deep supporting surface tint + bright readable foreground
  const darkSecondary =
    sHsl.s < 8
      ? hslToHex(pHsl.h, 10, 23)
      : hslToHex(sHsl.h, Math.min(48, Math.max(22, sHsl.s * 0.6)), 23);
  const darkSecondaryHover = mixHex(darkSecondary, '#FFFFFF', 0.88);
  const darkSecondaryLight = mixHex(darkSecondary, darkSurface, 0.55);
  const darkSecondaryFg =
    sHsl.s < 8
      ? darkHeading
      : hslToHex(sHsl.h, Math.min(85, Math.max(45, sHsl.s)), 88);

  // Dark Mode Tertiary: keep vibrant highlight readable on dark surfaces
  const darkTertiary =
    tHsl.l < 45
      ? hslToHex(tHsl.h, Math.min(85, Math.max(48, tHsl.s)), 64)
      : tertiaryBase;
  const darkTertiaryHover = mixHex(darkTertiary, '#FFFFFF', 0.86);
  const darkTertiaryLight = mixHex(darkTertiary, darkSurface, 0.24);
  const darkTertiaryFg = getContrastForeground(darkTertiary, darkBg);

  const darkAccent = buildAccentAlias(
    darkSecondary,
    darkSecondaryHover,
    darkSecondaryLight,
    darkSecondaryFg,
    darkSurface,
    true,
  );

  return {
    light: {
      background: lightBg,
      surface: lightSurface,
      surfaceSubtle: lightSurfaceSubtle,
      white: '#FFFDF7',
      heading: lightHeading,
      body: lightBody,
      muted: lightMuted,
      disabled: lightDisabled,
      border: lightBorder,
      borderSubtle: lightBorderSubtle,
      primary: primaryBase,
      primaryHover: lightPrimaryHover,
      primaryLight: lightPrimaryLight,
      primaryForeground: lightPrimaryFg,
      secondary: secondaryBase,
      secondaryHover: lightSecondaryHover,
      secondaryLight: lightSecondaryLight,
      secondaryForeground: lightSecondaryFg,
      tertiary: tertiaryBase,
      tertiaryHover: lightTertiaryHover,
      tertiaryLight: lightTertiaryLight,
      tertiaryForeground: lightTertiaryFg,
      ...lightAccent,
    },
    dark: {
      background: darkBg,
      surface: darkSurface,
      surfaceSubtle: darkSurfaceSubtle,
      white: '#FFFFFF',
      heading: darkHeading,
      body: darkBody,
      muted: darkMuted,
      disabled: darkDisabled,
      border: darkBorder,
      borderSubtle: darkBorderSubtle,
      primary: darkPrimary,
      primaryHover: darkPrimaryHover,
      primaryLight: darkPrimaryLight,
      primaryForeground: darkPrimaryFg,
      secondary: darkSecondary,
      secondaryHover: darkSecondaryHover,
      secondaryLight: darkSecondaryLight,
      secondaryForeground: darkSecondaryFg,
      tertiary: darkTertiary,
      tertiaryHover: darkTertiaryHover,
      tertiaryLight: darkTertiaryLight,
      tertiaryForeground: darkTertiaryFg,
      ...darkAccent,
    },
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'emerald',
    name: 'Emerald',
    tagline: 'Deep Green, Mint & Lime',
    identity: { primary: '#064734', secondary: '#E0FFC2', tertiary: '#D9F45B' },
    light: {
      background: '#F8FAF8',
      surface: '#FFFFFF',
      surfaceSubtle: '#EEF3EF',
      white: '#FFFDF7',
      heading: '#17251F',
      body: '#24352D',
      muted: '#64746B',
      disabled: '#9CA8A1',
      border: '#E2E9E4',
      borderSubtle: '#EDF2EE',
      primary: '#064734',
      primaryHover: '#053829',
      primaryLight: '#E5F2EC',
      primaryForeground: '#FFFFFF',
      secondary: '#E0FFC2',
      secondaryHover: '#CEF5A9',
      secondaryLight: '#E0FFC2',
      secondaryForeground: '#173D31',
      tertiary: '#D9F45B',
      tertiaryHover: '#C8E642',
      tertiaryLight: '#F4FCD4',
      tertiaryForeground: '#17251F',
      accent: '#15803D',
      accentHover: '#166534',
      accentLight: '#E0FFC2',
      accentText: '#173D31',
      accentForeground: '#FFFFFF',
    },
    dark: {
      background: '#101A16',
      surface: '#18251F',
      surfaceSubtle: '#203129',
      white: '#FFFFFF',
      heading: '#F1F5F2',
      body: '#D4E0D8',
      muted: '#A1B0A6',
      disabled: '#5A6D63',
      border: '#304239',
      borderSubtle: '#24342C',
      primary: '#8CCFA8',
      primaryHover: '#A3DCBA',
      primaryLight: '#213B2F',
      primaryForeground: '#10271B',
      secondary: '#294638',
      secondaryHover: '#325645',
      secondaryLight: '#223A2E',
      secondaryForeground: '#E0FFC2',
      tertiary: '#D9F45B',
      tertiaryHover: '#E3F87E',
      tertiaryLight: '#2E3A1D',
      tertiaryForeground: '#17251F',
      accent: '#8CCFA8',
      accentHover: '#A3DCBA',
      accentLight: '#294638',
      accentText: '#E0FFC2',
      accentForeground: '#10271B',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    tagline: 'Navy, Sky Blue & Cyan',
    identity: { primary: '#0F294A', secondary: '#DBEAFE', tertiary: '#22D3EE' },
    light: {
      background: '#F6F9FC',
      surface: '#FFFFFF',
      surfaceSubtle: '#EDF2F7',
      white: '#FFFDF7',
      heading: '#0F1C2E',
      body: '#243447',
      muted: '#607085',
      disabled: '#99A6B5',
      border: '#DFEAEE',
      borderSubtle: '#ECF1F6',
      primary: '#0F294A',
      primaryHover: '#0A1E38',
      primaryLight: '#E7EEF7',
      primaryForeground: '#FFFFFF',
      secondary: '#DBEAFE',
      secondaryHover: '#BFDBFE',
      secondaryLight: '#DBEAFE',
      secondaryForeground: '#1E3A5F',
      tertiary: '#22D3EE',
      tertiaryHover: '#06B6D4',
      tertiaryLight: '#E0F9FD',
      tertiaryForeground: '#082F49',
      accent: '#0369A1',
      accentHover: '#075985',
      accentLight: '#DBEAFE',
      accentText: '#1E3A5F',
      accentForeground: '#FFFFFF',
    },
    dark: {
      background: '#0C1420',
      surface: '#132033',
      surfaceSubtle: '#1B2C45',
      white: '#FFFFFF',
      heading: '#F0F6FC',
      body: '#CFDBE8',
      muted: '#93A6BD',
      disabled: '#54667D',
      border: '#263852',
      borderSubtle: '#1D2D44',
      primary: '#93C5FD',
      primaryHover: '#BFDBFE',
      primaryLight: '#1E3352',
      primaryForeground: '#0B1D36',
      secondary: '#1E3A5F',
      secondaryHover: '#264875',
      secondaryLight: '#182E4D',
      secondaryForeground: '#DBEAFE',
      tertiary: '#22D3EE',
      tertiaryHover: '#67E8F9',
      tertiaryLight: '#163847',
      tertiaryForeground: '#082F49',
      accent: '#60A5FA',
      accentHover: '#93C5FD',
      accentLight: '#1E3A5F',
      accentText: '#DBEAFE',
      accentForeground: '#0B1D36',
    },
  },
  {
    id: 'royal',
    name: 'Royal',
    tagline: 'Purple, Lavender & Gold',
    identity: { primary: '#4C1D95', secondary: '#EDE9FE', tertiary: '#F59E0B' },
    light: {
      background: '#F9F8FC',
      surface: '#FFFFFF',
      surfaceSubtle: '#F2EFF8',
      white: '#FFFDF7',
      heading: '#1B142B',
      body: '#2E2640',
      muted: '#6B6280',
      disabled: '#A39BB3',
      border: '#E7E2F0',
      borderSubtle: '#F1EEF7',
      primary: '#4C1D95',
      primaryHover: '#3B1578',
      primaryLight: '#EFEAF9',
      primaryForeground: '#FFFFFF',
      secondary: '#EDE9FE',
      secondaryHover: '#DDD6FE',
      secondaryLight: '#EDE9FE',
      secondaryForeground: '#3B1D74',
      tertiary: '#F59E0B',
      tertiaryHover: '#D97706',
      tertiaryLight: '#FEF3C7',
      tertiaryForeground: '#1F1605',
      accent: '#7C3AED',
      accentHover: '#6D28D9',
      accentLight: '#EDE9FE',
      accentText: '#3B1D74',
      accentForeground: '#FFFFFF',
    },
    dark: {
      background: '#130F1D',
      surface: '#1C162B',
      surfaceSubtle: '#261F3A',
      white: '#FFFFFF',
      heading: '#F5F3FA',
      body: '#D9D2EB',
      muted: '#A69CBE',
      disabled: '#62587A',
      border: '#342B4D',
      borderSubtle: '#28203D',
      primary: '#C4B5FD',
      primaryHover: '#DDD6FE',
      primaryLight: '#2E224D',
      primaryForeground: '#1B0E36',
      secondary: '#312354',
      secondaryHover: '#3E2D69',
      secondaryLight: '#271C44',
      secondaryForeground: '#EDE9FE',
      tertiary: '#FBBF24',
      tertiaryHover: '#FCD34D',
      tertiaryLight: '#3D2E14',
      tertiaryForeground: '#1F1605',
      accent: '#A78BFA',
      accentHover: '#C4B5FD',
      accentLight: '#312354',
      accentText: '#EDE9FE',
      accentForeground: '#1B0E36',
    },
  },
  {
    id: 'crimson',
    name: 'Crimson',
    tagline: 'Burgundy, Rose & Orange',
    identity: { primary: '#881337', secondary: '#FFE4E6', tertiary: '#FB923C' },
    light: {
      background: '#FCF8F8',
      surface: '#FFFFFF',
      surfaceSubtle: '#F6EEEE',
      white: '#FFFDF7',
      heading: '#261318',
      body: '#3B2329',
      muted: '#7A6268',
      disabled: '#AF9CA1',
      border: '#EFE2E4',
      borderSubtle: '#F6ECEE',
      primary: '#881337',
      primaryHover: '#6F0F2C',
      primaryLight: '#FAE8ED',
      primaryForeground: '#FFFFFF',
      secondary: '#FFE4E6',
      secondaryHover: '#FECDD3',
      secondaryLight: '#FFE4E6',
      secondaryForeground: '#6E142C',
      tertiary: '#FB923C',
      tertiaryHover: '#F97316',
      tertiaryLight: '#FFEDD5',
      tertiaryForeground: '#241205',
      accent: '#E11D48',
      accentHover: '#BE123C',
      accentLight: '#FFE4E6',
      accentText: '#6E142C',
      accentForeground: '#FFFFFF',
    },
    dark: {
      background: '#1B1014',
      surface: '#26171C',
      surfaceSubtle: '#331F26',
      white: '#FFFFFF',
      heading: '#FAF2F4',
      body: '#E8D2D7',
      muted: '#BA9FA5',
      disabled: '#745A60',
      border: '#452A33',
      borderSubtle: '#362028',
      primary: '#FDA4AF',
      primaryHover: '#FECDD3',
      primaryLight: '#471F2C',
      primaryForeground: '#330B17',
      secondary: '#4A202D',
      secondaryHover: '#5C2838',
      secondaryLight: '#3A1923',
      secondaryForeground: '#FFE4E6',
      tertiary: '#FB923C',
      tertiaryHover: '#FDBA74',
      tertiaryLight: '#422818',
      tertiaryForeground: '#241205',
      accent: '#FB7185',
      accentHover: '#FDA4AF',
      accentLight: '#4A202D',
      accentText: '#FFE4E6',
      accentForeground: '#330B17',
    },
  },
  {
    id: 'earth',
    name: 'Earth',
    tagline: 'Brown, Sand & Terracotta',
    identity: { primary: '#5C3A21', secondary: '#F5EBE0', tertiary: '#E07A5F' },
    light: {
      background: '#FAF8F5',
      surface: '#FFFFFF',
      surfaceSubtle: '#F3EEE8',
      white: '#FFFDF7',
      heading: '#241A13',
      body: '#382B22',
      muted: '#75665B',
      disabled: '#AA9E95',
      border: '#EAE2DA',
      borderSubtle: '#F3EDE7',
      primary: '#5C3A21',
      primaryHover: '#472C19',
      primaryLight: '#F2EBE5',
      primaryForeground: '#FFFFFF',
      secondary: '#F5EBE0',
      secondaryHover: '#EAD9C8',
      secondaryLight: '#F5EBE0',
      secondaryForeground: '#4A2F1B',
      tertiary: '#E07A5F',
      tertiaryHover: '#D16244',
      tertiaryLight: '#FBEAE5',
      tertiaryForeground: '#1D0F0B',
      accent: '#B45309',
      accentHover: '#92400E',
      accentLight: '#F5EBE0',
      accentText: '#4A2F1B',
      accentForeground: '#FFFFFF',
    },
    dark: {
      background: '#18130F',
      surface: '#221B16',
      surfaceSubtle: '#2D241E',
      white: '#FFFFFF',
      heading: '#F7F3EE',
      body: '#E2D8CE',
      muted: '#B3A69A',
      disabled: '#6E6157',
      border: '#3D3128',
      borderSubtle: '#2F251E',
      primary: '#E6B89C',
      primaryHover: '#F0CCB5',
      primaryLight: '#3B2C22',
      primaryForeground: '#26160B',
      secondary: '#3D2E23',
      secondaryHover: '#4C392C',
      secondaryLight: '#30241B',
      secondaryForeground: '#F5EBE0',
      tertiary: '#E07A5F',
      tertiaryHover: '#EB9780',
      tertiaryLight: '#40261F',
      tertiaryForeground: '#1D0F0B',
      accent: '#F59E0B',
      accentHover: '#FBBF24',
      accentLight: '#3D2E23',
      accentText: '#F5EBE0',
      accentForeground: '#26160B',
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    tagline: 'Charcoal, Gray & Blue',
    identity: { primary: '#18181B', secondary: '#E4E4E7', tertiary: '#2563EB' },
    light: {
      background: '#F7F7F8',
      surface: '#FFFFFF',
      surfaceSubtle: '#F0F0F2',
      white: '#FFFDF7',
      heading: '#09090B',
      body: '#27272A',
      muted: '#6B6B73',
      disabled: '#A1A1AA',
      border: '#E4E4E7',
      borderSubtle: '#EFEFF1',
      primary: '#18181B',
      primaryHover: '#27272A',
      primaryLight: '#F4F4F5',
      primaryForeground: '#FFFFFF',
      secondary: '#E4E4E7',
      secondaryHover: '#D4D4D8',
      secondaryLight: '#E4E4E7',
      secondaryForeground: '#18181B',
      tertiary: '#2563EB',
      tertiaryHover: '#1D4ED8',
      tertiaryLight: '#DBEAFE',
      tertiaryForeground: '#FFFFFF',
      accent: '#2563EB',
      accentHover: '#1D4ED8',
      accentLight: '#DBEAFE',
      accentText: '#1E40AF',
      accentForeground: '#FFFFFF',
    },
    dark: {
      background: '#0C0C0E',
      surface: '#141417',
      surfaceSubtle: '#1E1E22',
      white: '#FFFFFF',
      heading: '#FAFAFA',
      body: '#D4D4D8',
      muted: '#9898A2',
      disabled: '#52525B',
      border: '#27272C',
      borderSubtle: '#1E1E23',
      primary: '#F4F4F5',
      primaryHover: '#E4E4E7',
      primaryLight: '#27272C',
      primaryForeground: '#09090B',
      secondary: '#27272C',
      secondaryHover: '#34343B',
      secondaryLight: '#1E1E22',
      secondaryForeground: '#E4E4E7',
      tertiary: '#60A5FA',
      tertiaryHover: '#93C5FD',
      tertiaryLight: '#1E2D45',
      tertiaryForeground: '#09152B',
      accent: '#60A5FA',
      accentHover: '#93C5FD',
      accentLight: '#1E2D45',
      accentText: '#DBEAFE',
      accentForeground: '#09152B',
    },
  },
];

export function getThemePreset(id: string | undefined | null): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.id === id);
}

export function normalizeThemeMode(mode: string | undefined | null): ThemeMode {
  if (mode === 'dark' || mode === 'system' || mode === 'light') return mode;
  return DEFAULT_THEME_MODE;
}

export function resolveThemeConfig(settingsMap: Record<string, string>): ResolvedTheme {
  const mode = normalizeThemeMode(settingsMap['theme_mode']);
  const rawPreset = (settingsMap['theme_preset'] || '').trim().toLowerCase();
  const hasSavedCustomColors =
    Boolean(settingsMap['primary_color']) || Boolean(settingsMap['secondary_color']);

  const matchedPreset = getThemePreset(rawPreset);
  const fallbackPreset = getThemePreset(DEFAULT_THEME_PRESET)!;

  // Fresh install without saved preset/colors uses default preset (Emerald)
  if (!rawPreset && !hasSavedCustomColors) {
    return {
      presetId: fallbackPreset.id,
      mode,
      identity: { ...fallbackPreset.identity },
      light: fallbackPreset.light,
      dark: fallbackPreset.dark,
    };
  }

  // Legacy install with saved colors but no theme_preset yet -> treat as custom
  const identity: ThemeIdentity = {
    primary: normalizeHex(
      settingsMap['primary_color'],
      matchedPreset?.identity.primary || '#0F172A',
    ),
    secondary: normalizeHex(
      settingsMap['secondary_color'],
      matchedPreset?.identity.secondary || '#D97706',
    ),
    tertiary: normalizeHex(
      settingsMap['tertiary_color'],
      matchedPreset?.identity.tertiary || fallbackPreset.identity.tertiary,
    ),
  };

  if (
    matchedPreset &&
    identity.primary === matchedPreset.identity.primary &&
    identity.secondary === matchedPreset.identity.secondary &&
    identity.tertiary === matchedPreset.identity.tertiary
  ) {
    return {
      presetId: matchedPreset.id,
      mode,
      identity,
      light: matchedPreset.light,
      dark: matchedPreset.dark,
    };
  }

  const generated = generateCustomThemePalettes(identity);
  return {
    presetId: 'custom',
    mode,
    identity,
    light: generated.light,
    dark: generated.dark,
  };
}

function serializeModeVars(p: ModePalette): string {
  return [
    `--color-background: ${p.background};`,
    `--color-surface: ${p.surface};`,
    `--color-surface-subtle: ${p.surfaceSubtle};`,
    `--color-white: ${p.white};`,
    `--color-heading: ${p.heading};`,
    `--color-body: ${p.body};`,
    `--color-muted: ${p.muted};`,
    `--color-disabled: ${p.disabled};`,
    `--color-border: ${p.border};`,
    `--color-border-subtle: ${p.borderSubtle};`,
    `--color-primary: ${p.primary};`,
    `--color-primary-hover: ${p.primaryHover};`,
    `--color-primary-light: ${p.primaryLight};`,
    `--color-primary-foreground: ${p.primaryForeground};`,
    `--color-secondary: ${p.secondary};`,
    `--color-secondary-hover: ${p.secondaryHover};`,
    `--color-secondary-light: ${p.secondaryLight};`,
    `--color-secondary-foreground: ${p.secondaryForeground};`,
    `--color-tertiary: ${p.tertiary};`,
    `--color-tertiary-hover: ${p.tertiaryHover};`,
    `--color-tertiary-light: ${p.tertiaryLight};`,
    `--color-tertiary-foreground: ${p.tertiaryForeground};`,
    `--color-accent: ${p.accent};`,
    `--color-accent-hover: ${p.accentHover};`,
    `--color-accent-light: ${p.accentLight};`,
    `--color-accent-text: ${p.accentText};`,
    `--color-accent-foreground: ${p.accentForeground};`,
  ].join('\n  ');
}

export function buildThemeCss(resolved: ResolvedTheme): string {
  return `html:root {\n  color-scheme: light;\n  ${serializeModeVars(resolved.light)}\n}\n\nhtml.dark:root {\n  color-scheme: dark;\n  ${serializeModeVars(resolved.dark)}\n}`;
}
