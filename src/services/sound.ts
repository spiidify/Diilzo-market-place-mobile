/**
 * Sound Effects Service
 *
 * Plays short sound effects for UI interactions, notifications, and
 * business events throughout the Diilzo app. Uses expo-audio's
 * createAudioPlayer (imperative API) so sounds can be played from
 * anywhere — no React component or hook required.
 *
 * Sound files live in /assets/sounds/ and are bundled with the app.
 *
 * Usage:
 *   import { playSound, Sounds } from '@/services/sound';
 *   playSound(Sounds.TAP);
 *   playSound(Sounds.SUCCESS);
 *   playSound(Sounds.NOTIFICATION);
 *
 * Sounds respect a user preference (stored in AsyncStorage) — when
 * disabled, all playSound() calls are silent no-ops.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// ── Sound file map ────────────────────────────────────────────────
const SOUND_FILES = {
  tap: require('@/assets/sounds/tap.wav'),
  success: require('@/assets/sounds/success.wav'),
  error: require('@/assets/sounds/error.wav'),
  notification: require('@/assets/sounds/notification.wav'),
  add_to_cart: require('@/assets/sounds/add_to_cart.wav'),
  order_placed: require('@/assets/sounds/order_placed.wav'),
  swipe: require('@/assets/sounds/swipe.wav'),
  whoosh: require('@/assets/sounds/whoosh.wav'),
  payment: require('@/assets/sounds/payment.wav'),
  message: require('@/assets/sounds/message.wav'),
} as const;

export enum Sounds {
  TAP = 'tap',
  SUCCESS = 'success',
  ERROR = 'error',
  NOTIFICATION = 'notification',
  ADD_TO_CART = 'add_to_cart',
  ORDER_PLACED = 'order_placed',
  SWIPE = 'swipe',
  WHOOSH = 'whoosh',
  PAYMENT = 'payment',
  MESSAGE = 'message',
}

// ── Settings ──────────────────────────────────────────────────────
const PREF_KEY = 'diilzo:sound_enabled';
let soundEnabled = true;
let initialized = false;

// Player cache — one AudioPlayer per sound, reused for rapid replay
const players: Partial<Record<Sounds, AudioPlayer>> = {};

// ── Init ──────────────────────────────────────────────────────────
async function init() {
  if (initialized) return;
  initialized = true;
  try {
    // Load user preference
    const pref = await AsyncStorage.getItem(PREF_KEY);
    if (pref !== null) soundEnabled = pref === 'true';

    // Configure audio session for short SFX playback
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    });
  } catch {
    // Non-critical — sounds just won't play
  }
}

// Pre-create players lazily on first play
function getPlayer(sound: Sounds): AudioPlayer | null {
  if (players[sound]) return players[sound]!;
  try {
    const source = SOUND_FILES[sound];
    if (!source) return null;
    const player = createAudioPlayer(source);
    players[sound] = player;
    return player;
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Play a sound effect by name. Safe to call from anywhere.
 * Silently no-ops if sounds are disabled or the player fails.
 */
export function playSound(sound: Sounds): void {
  if (!soundEnabled) return;
  init().then(() => {
    if (!soundEnabled) return;
    const player = getPlayer(sound);
    if (!player) return;
    try {
      // Seek to start for rapid replay (sound may have just played)
      player.seekTo(0);
      player.play();
    } catch {
      // Non-critical
    }
  });
}

/**
 * Check if sounds are enabled.
 */
export function isSoundEnabled(): boolean {
  return soundEnabled;
}

/**
 * Toggle sound effects on/off. Persists to AsyncStorage.
 */
export async function setSoundEnabled(enabled: boolean): Promise<void> {
  soundEnabled = enabled;
  await AsyncStorage.setItem(PREF_KEY, String(enabled));
}

/**
 * Preload all sound players for instant playback with no first-play delay.
 * Call this on app launch (e.g. in the root layout) for best UX.
 */
export async function preloadSounds(): Promise<void> {
  await init();
  for (const sound of Object.values(Sounds)) {
    getPlayer(sound);
  }
}

/**
 * Release all audio players (call on app shutdown if needed).
 */
export function releaseSounds(): void {
  for (const sound of Object.keys(players) as Sounds[]) {
    try {
      players[sound]?.release?.();
    } catch { }
    delete players[sound];
  }
}
