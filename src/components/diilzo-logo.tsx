import { Image as RNImage, StyleSheet, Text, View } from 'react-native';

type DiilzoLogoProps = {
  size?: number;
  variant?: 'white' | 'color';
  showSubtitle?: boolean;
};

const WHITE_LOGO = require('@/assets/logos/DIILZO-LOGO-WHITE.png');
const COLOR_LOGO = require('@/assets/logos/DIILZO-LOGO-COLOR.png');

/** Reusable Diilzo logo — renders the actual logo image file with
 *  optional "Marketplace" subtitle below the wordmark. */
export function DiilzoLogo({ size = 22, variant = 'white', showSubtitle = true }: DiilzoLogoProps) {
  const source = variant === 'white' ? WHITE_LOGO : COLOR_LOGO;
  const textColor = variant === 'white' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.55)';
  const logoWidth = size * 3.19;

  return (
    <View style={styles.wrap}>
      <View style={[styles.logoBox, { height: size, width: logoWidth }]}>
        <RNImage
          source={source}
          style={{ width: '100%', height: '100%' }}
          resizeMode="contain"
        />
      </View>
      {showSubtitle && (
        <Text style={[styles.subtitle, { color: textColor, width: logoWidth }]} numberOfLines={1}>Marketplace</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
  },
  logoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    aspectRatio: 3.19,
  },
  subtitle: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
