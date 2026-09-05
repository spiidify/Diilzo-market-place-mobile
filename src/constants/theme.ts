/**
 * Diilzo theme — Vibrant Green e-commerce palette.
 * 60% white canvas, 30% deep green text, 10% vibrant green/teal accents.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0A2E1A',
    background: '#FFFFFF',
    backgroundElement: '#F0FBF5',
    backgroundSelected: '#DCF5EC',
    textSecondary: '#1A6B45',
  },
  dark: {
    text: '#FFFFFF',
    background: '#0A2E1A',
    backgroundElement: '#0F3D26',
    backgroundSelected: '#1A5233',
    textSecondary: '#5AB58A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// ── Diilzo Vibrant Green palette ─────────────────────────────────────
export const Brand = {
  primary: '#32C700',       // Vibrant Green — Add to Cart, Checkout, CTA, active states
  primaryDark: '#00C732',   // Green — pressed/hover, gradient mid
  accent: '#008525',        // Deep Green — gradient end, highlights, badges
  dark: '#0A2E1A',          // Deep Green — headers, primary text
  darkLight: '#0F3D26',
  yellow: '#008525',        // alias to accent
  yellowDark: '#006B1E',
  link: '#32C700',          // links use vibrant green
  linkHover: '#00C732',
  success: '#32C700',       // same as primary — vibrant green (in stock, delivered)
  danger: '#DC2626',        // red (error, cancel)
  rating: '#F59E0B',        // amber for star ratings
  surface: '#FFFFFF',       // Pure White — cards
  surfaceAlt: '#F0FBF5',    // Off-White with green tint — dividers, containers
  border: '#C5E8D5',
  borderLight: '#E0F5EC',
  text: '#0A2E1A',          // Deep Green
  textSecondary: '#1A6B45', // muted green
  textTertiary: '#4A8A6A',
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
