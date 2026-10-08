/**
 * Diilzo theme — Vibrant Purple e-commerce palette.
 * 60% white canvas, 30% deep indigo text, 10% vivid violet accents.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1E1B4B',
    background: '#FFFFFF',
    backgroundElement: '#F5F3FF',
    backgroundSelected: '#EDE9FE',
    textSecondary: '#5B4EA6',
  },
  dark: {
    text: '#FFFFFF',
    background: '#1E1B4B',
    backgroundElement: '#312E81',
    backgroundSelected: '#3730A3',
    textSecondary: '#A78BFA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// ── Diilzo Vibrant Purple palette ────────────────────────────────────
export const Brand = {
  primary: '#7C3AED',       // Vibrant Violet — Add to Cart, Checkout, CTA, active states
  primaryDark: '#6D28D9',   // Violet — pressed/hover, gradient mid
  accent: '#5B21B6',        // Deep Violet — gradient end, highlights, badges
  dark: '#1E1B4B',          // Deep Indigo — headers, primary text
  darkLight: '#312E81',
  yellow: '#5B21B6',        // alias to accent
  yellowDark: '#4C1D95',
  link: '#7C3AED',          // links use vibrant violet
  linkHover: '#6D28D9',
  success: '#16A34A',       // semantic green — in stock, delivered (distinct from brand)
  danger: '#DC2626',        // red (error, cancel)
  rating: '#F59E0B',        // amber for star ratings
  surface: '#FFFFFF',       // Pure White — cards
  surfaceAlt: '#F5F3FF',    // Off-White with violet tint — dividers, containers
  border: '#DDD6FE',
  borderLight: '#E9E3FC',
  text: '#1E1B4B',          // Deep Indigo
  textSecondary: '#5B4EA6', // muted violet
  textTertiary: '#7C72B8',
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
  three: 8,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
