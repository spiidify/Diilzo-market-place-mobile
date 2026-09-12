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
let initStarted = false;
let initDone = false;

// Player cache — one AudioPlayer per sound, reused for rapid replay
const players: Partial<Record<Sounds, AudioPlayer>> = {};

// ── Init ──────────────────────────────────────────────────────────
async function init(): Promise<void> {
  if (initDone) return;
  initStarted = true;
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
  initDone = true;
}

// Pre-create a player for a single sound (synchronous if init is done)
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
 *
 * If the audio system is already initialized, plays SYNCHRONOUSLY
 * (no async delay). If not yet initialized, falls back to async.
 */
export function playSound(sound: Sounds): void {
  if (!soundEnabled) return;

  if (initDone) {
    // Already initialized — play synchronously, no delay
    const player = getPlayer(sound);
    if (!player) return;
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // Non-critical
    }
    return;
  }

  // Not yet initialized — async fallback
  init().then(() => {
    if (!soundEnabled) return;
    const player = getPlayer(sound);
    if (!player) return;
    try {
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
 * Preload a single sound player for instant synchronous playback.
 * Call this before you need the sound to play with zero delay.
 */
export async function preloadSound(sound: Sounds): Promise<void> {
  await init();
  getPlayer(sound);
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
