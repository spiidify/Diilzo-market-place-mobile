import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Brand } from '@/constants/theme';

interface ScrollToTopButtonProps {
  visible: boolean;
  onPress: () => void;
}

export function ScrollToTopButton({ visible, onPress }: ScrollToTopButtonProps) {
  if (!visible) return null;
  return (
    <View style={styles.wrap}>
      <Pressable
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
        onPress={onPress}
      >
        <MaterialCommunityIcons name="arrow-up" size={24} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 100,
    right: 8,
    zIndex: 999,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
