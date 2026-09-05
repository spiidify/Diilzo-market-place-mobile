/**
 * Diilzo theme — Amazon-inspired marketplace design.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F1111',
    background: '#ffffff',
    backgroundElement: '#F3F4F6',
    backgroundSelected: '#E7E9EC',
    textSecondary: '#565959',
  },
  dark: {
    text: '#ffffff',
    background: '#0F1111',
    backgroundElement: '#1E2222',
    backgroundSelected: '#2A2E2E',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// ── Diilzo brand palette (matches backend CSS variables) ──────────
export const Brand = {
  primary: '#ff6a00',      // --diilzo-primary: Diilzo orange
  primaryDark: '#e55f00',
  accent: '#ff9500',       // --diilzo-accent: lighter orange
  dark: '#131921',         // --diilzo-dark: dark navy (header)
  darkLight: '#232F3E',
  yellow: '#FEBD69',       // search bar yellow accent
  yellowDark: '#F3A847',
  link: '#007185',         // teal link
  linkHover: '#C7511F',
  success: '#16a34a',      // green (in stock, delivered)
  danger: '#B12704',       // red (sale price, error)
  rating: '#ffa41c',       // --diilzo-star: star yellow
  surface: '#FFFFFF',
  surfaceAlt: '#F7F8F8',   // light gray bg
  border: '#D5D9D9',
  borderLight: '#e7e7e7',  // --diilzo-border
  text: '#0f1111',         // --diilzo-text
  textSecondary: '#565959',// --diilzo-muted
  textTertiary: '#848688',
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
