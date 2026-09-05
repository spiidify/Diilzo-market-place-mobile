import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Keyframe
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Brand } from '@/constants/theme';

const DURATION = 1800;

// ── Orange background fade out ────────────────────────────────────
const bgKeyframe = new Keyframe({
  0: { opacity: 1 },
  60: { opacity: 1 },
  100: {
    opacity: 0,
    easing: Easing.out(Easing.ease),
  },
});

// ── Logo container — scale in with bounce ────────────────────────
const logoKeyframe = new Keyframe({
  0: {
    transform: [{ scale: 0.3 }, { translateY: 0 }],
    opacity: 0,
  },
  20: {
    transform: [{ scale: 0.5 }, { translateY: 0 }],
    opacity: 0.5,
    easing: Easing.out(Easing.exp),
  },
  50: {
    transform: [{ scale: 1.1 }, { translateY: -8 }],
    opacity: 1,
    easing: Easing.bounce,
  },
  70: {
    transform: [{ scale: 1 }, { translateY: 0 }],
    opacity: 1,
    easing: Easing.out(Easing.ease),
  },
  100: {
    transform: [{ scale: 1 }, { translateY: 0 }],
    opacity: 1,
  },
});

// ── "Marketplace" subtitle — fade in from below ──────────────────
const subtitleKeyframe = new Keyframe({
  0: {
    opacity: 0,
    transform: [{ translateY: 20 }],
  },
  40: {
    opacity: 0,
    transform: [{ translateY: 20 }],
  },
  70: {
    opacity: 1,
    transform: [{ translateY: 0 }],
    easing: Easing.out(Easing.exp),
  },
  100: {
    opacity: 1,
    transform: [{ translateY: 0 }],
  },
});

// ── Orange dot pulse ──────────────────────────────────────────────
const dotKeyframe = new Keyframe({
  0: { transform: [{ scale: 0 }], opacity: 0 },
  30: { transform: [{ scale: 0 }], opacity: 0 },
  50: {
    transform: [{ scale: 1.4 }],
    opacity: 1,
    easing: Easing.bounce,
  },
  65: { transform: [{ scale: 1 }], opacity: 1 },
  100: { transform: [{ scale: 1 }], opacity: 1 },
});

// ── Loading bar — slides in from left ────────────────────────────
const barKeyframe = new Keyframe({
  0: { transform: [{ scaleX: 0 }], opacity: 0 },
  50: { transform: [{ scaleX: 0 }], opacity: 0 },
  60: { opacity: 1, transform: [{ scaleX: 0 }] },
  90: {
    transform: [{ scaleX: 1 }],
    opacity: 1,
    easing: Easing.inOut(Easing.ease),
  },
  100: { transform: [{ scaleX: 1 }], opacity: 0.6 },
});

export function DiilzoSplash() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return animate ? (
    <Animated.View
      entering={bgKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.overlay}
    >
      <LinearGradient
        colors={[Brand.primary, Brand.primary, Brand.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Logo */}
        <Animated.View
          entering={logoKeyframe.duration(DURATION)}
          style={styles.logoWrap}
        >
          <View style={styles.logoCircle}>
            <Text style={styles.logoD}>D</Text>
            <Animated.View entering={dotKeyframe.duration(DURATION)} style={styles.dot} />
          </View>
          <Text style={styles.logoText}>Diilzo</Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View entering={subtitleKeyframe.duration(DURATION)}>
          <Text style={styles.subtitle}>MARKETPLACE</Text>
        </Animated.View>

        {/* Loading bar */}
        <Animated.View entering={barKeyframe.duration(DURATION)} style={styles.loadingBarWrap}>
          <View style={styles.loadingBar} />
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => {
          setAnimate(true);
        });
      }}
      style={styles.overlay}
    >
      <LinearGradient
        colors={[Brand.primary, Brand.primary, Brand.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoD}>D</Text>
          </View>
          <Text style={styles.logoText}>Diilzo</Text>
        </View>
        <Text style={styles.subtitle}>MARKETPLACE</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoWrap: {
    alignItems: 'center',
    gap: 16,
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  logoD: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  dot: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: Brand.primary,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 6,
    marginTop: 4,
  },
  loadingBarWrap: {
    marginTop: 24,
    width: 120,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  loadingBar: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    transformOrigin: 'left',
  },
});
