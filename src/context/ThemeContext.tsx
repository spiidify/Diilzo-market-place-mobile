// ── Theme Context (Light / Dark / System) ─────────────────────────
// Provides theme-aware colors that change between light and dark mode.
// Accent colors (primary, danger, rating) stay the same in both modes.
// Semantic colors (background, surface, text, border) change.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { Brand } from '@/constants/theme';

// ── Theme modes ────────────────────────────────────────────────────
export type ThemeMode = 'light' | 'dark' | 'system';

// ── Semantic color palette ─────────────────────────────────────────
// These are the colors that CHANGE between light and dark mode.
// Accent colors like Brand.primary, Brand.danger, Brand.rating
// stay the same and are accessed via Brand directly.
export interface ThemeColors {
  // Backgrounds
  background: string;       // app background
  surface: string;          // cards, sheets
  surfaceAlt: string;       // dividers, input backgrounds, subtle containers
  surfaceElevated: string;  // modals, elevated cards

  // Text
  text: string;             // primary text
  textSecondary: string;    // secondary text
  textTertiary: string;     // placeholder, hints
  textInverse: string;      // text on colored backgrounds

  // Borders
  border: string;           // standard borders
  borderLight: string;     // subtle borders

  // Header / hero gradient (these stay the same in both modes
  // because they use Brand.dark → Brand.primary gradients)
  headerText: string;
  headerSurface: string;    // header background if not using gradient
}

// ── Light palette ──────────────────────────────────────────────────
const lightColors: ThemeColors = {
  background: '#F2F4F6',
  surface: '#FFFFFF',
  surfaceAlt: '#F0FBF5',
  surfaceElevated: '#FFFFFF',
  text: '#0A2E1A',
  textSecondary: '#1A6B45',
  textTertiary: '#4A8A6A',
  textInverse: '#FFFFFF',
  border: '#C5E8D5',
  borderLight: '#E0F5EC',
  headerText: '#FFFFFF',
  headerSurface: '#0A2E1A',
};

// ── Dark palette ────────────────────────────────────────────────────
const darkColors: ThemeColors = {
  background: '#0A1A12',
  surface: '#0F2419',
  surfaceAlt: '#143020',
  surfaceElevated: '#1A3A28',
  text: '#E8F5EE',
  textSecondary: '#9CCBB0',
  textTertiary: '#6A9A80',
  textInverse: '#0A2E1A',
  border: '#1F4530',
  borderLight: '#1A3A28',
  headerText: '#FFFFFF',
  headerSurface: '#0A2E1A',
};

// ── Context type ────────────────────────────────────────────────────
interface ThemeContextType {
  mode: ThemeMode;           // user's preference
  isDark: boolean;            // resolved dark mode
  colors: ThemeColors;        // semantic colors for current mode
  brand: typeof Brand;        // accent colors (same in both modes)
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;         // toggles between light and dark
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  isDark: false,
  colors: lightColors,
  brand: Brand,
  setMode: () => {},
  toggle: () => {},
});

const STORAGE_KEY = 'diilzo_theme_mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Load saved preference on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setModeState(saved);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // Resolve actual dark mode
  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  const colors = isDark ? darkColors : lightColors;

  const setMode = useCallback(async (newMode: ThemeMode) => {
    setModeState(newMode);
    try { await AsyncStorage.setItem(STORAGE_KEY, newMode); } catch { /* ignore */ }
  }, []);

  const toggle = useCallback(() => {
    setMode(isDark ? 'light' : 'dark');
  }, [isDark, setMode]);

  return (
    <ThemeContext.Provider value={{ mode, isDark, colors, brand: Brand, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
