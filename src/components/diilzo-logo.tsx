import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

type DiilzoLogoProps = {
  size?: number;
  variant?: 'white' | 'color';
};

const WHITE_LOGO = require('@/assets/logos/DIILZO-LOGO-WHITE.png');
const COLOR_LOGO = require('@/assets/logos/DIILZO-LOGO-COLOR.png');

/** Reusable Diilzo logo — renders the actual logo image file. */
export function DiilzoLogo({ size = 36, variant = 'white' }: DiilzoLogoProps) {
  const source = variant === 'white' ? WHITE_LOGO : COLOR_LOGO;

  return (
    <View style={[styles.wrap, { height: size }]}>
      <Image
        source={source}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
        transition={150}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    aspectRatio: 3.2,
  },
});
