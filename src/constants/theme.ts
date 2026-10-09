export type ThemeKey = 'red' | 'purple' | 'blue' | 'emerald' | 'amber' | 'pink';

export interface ThemeOption {
  key: ThemeKey;
  name: string;
  primary: string;
  dark: string;
  glow: string;
  pill: string;
}

export const THEME_OPTIONS: Record<ThemeKey, ThemeOption> = {
  red: {
    key: 'red',
    name: 'Netflix Red',
    primary: '#FA243C',
    dark: '#B51527',
    glow: 'rgba(250, 36, 60, 0.35)',
    pill: 'rgba(250, 36, 60, 0.2)',
  },
  purple: {
    key: 'purple',
    name: 'Electric Purple',
    primary: '#8B5CF6',
    dark: '#6D28D9',
    glow: 'rgba(139, 92, 246, 0.35)',
    pill: 'rgba(139, 92, 246, 0.2)',
  },
  blue: {
    key: 'blue',
    name: 'Cyber Blue',
    primary: '#3B82F6',
    dark: '#1D4ED8',
    glow: 'rgba(59, 130, 246, 0.35)',
    pill: 'rgba(59, 130, 246, 0.2)',
  },
  emerald: {
    key: 'emerald',
    name: 'Emerald Green',
    primary: '#10B981',
    dark: '#047857',
    glow: 'rgba(16, 185, 129, 0.35)',
    pill: 'rgba(16, 185, 129, 0.2)',
  },
  amber: {
    key: 'amber',
    name: 'Amber Gold',
    primary: '#F59E0B',
    dark: '#B45309',
    glow: 'rgba(245, 158, 11, 0.35)',
    pill: 'rgba(245, 158, 11, 0.2)',
  },
  pink: {
    key: 'pink',
    name: 'Neon Pink',
    primary: '#EC4899',
    dark: '#BE185D',
    glow: 'rgba(236, 72, 153, 0.35)',
    pill: 'rgba(236, 72, 153, 0.2)',
  },
};

export const colors = {
  primary: THEME_OPTIONS.purple.primary,
  background: '#0F0C1B',
  surface: '#19152B',
  text: '#FFFFFF',
  secondaryText: '#A09DB1',
};

export const Colors = {
  primary: colors.primary,
  background: colors.background,
  surface: colors.surface,
  cardBackground: colors.surface,
  // Brand color - modern vibrant red or customizable theme
  netflixRed: colors.primary,
  primaryRed: colors.primary,
  primaryRedDark: THEME_OPTIONS.purple.dark,
  primaryRedGlow: THEME_OPTIONS.purple.glow,
  textPrimary: colors.text,
  textSecondary: colors.secondaryText,
  text: colors.text,
  secondaryText: colors.secondaryText,
  textMuted: '#6B677E',
  accent: colors.primary,
  badge: colors.primary,
  border: '#2A2440',
  overlay: 'rgba(15, 12, 27, 0.88)',
  translucent: 'rgba(255, 255, 255, 0.12)',
  translucentDark: 'rgba(25, 21, 43, 0.88)',
  navBg: '#0D0A18',
  navActivePill: THEME_OPTIONS.purple.pill,
};

export function applyTheme(key: ThemeKey) {
  const theme = THEME_OPTIONS[key] || THEME_OPTIONS.red;
  Colors.primary = theme.primary;
  Colors.netflixRed = theme.primary;
  Colors.primaryRed = theme.primary;
  Colors.primaryRedDark = theme.dark;
  Colors.primaryRedGlow = theme.glow;
  Colors.accent = theme.primary;
  Colors.badge = theme.primary;
  Colors.navActivePill = theme.pill;
  colors.primary = theme.primary;
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};
