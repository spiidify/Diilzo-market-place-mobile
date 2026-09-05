import { StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';

type DiilzoLogoProps = {
  size?: number;
  showText?: boolean;
  showSubtitle?: boolean;
};

/** Reusable Diilzo logo — circular "D" badge + wordmark. */
export function DiilzoLogo({ size = 36, showText = true, showSubtitle = true }: DiilzoLogoProps) {
  const fontSize = Math.round(size * 0.55);
  const dotSize = Math.round(size * 0.18);

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: Math.max(2, size * 0.06),
          },
        ]}
      >
        <Text style={[styles.letter, { fontSize }]}>D</Text>
        <View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              bottom: Math.max(2, size * 0.08),
              right: Math.max(2, size * 0.08),
              borderColor: Brand.primary,
            },
          ]}
        />
      </View>
      {showText && (
        <View style={styles.textWrap}>
          <Text style={styles.wordmark}>Diilzo</Text>
          {showSubtitle && <Text style={styles.subtitle}>Marketplace</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circle: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  letter: {
    fontWeight: '900',
    color: '#FFFFFF',
  },
  dot: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
  },
  textWrap: {
    gap: 0,
  },
  wordmark: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
  },
});
