/**
 * GradientHeader — Reusable header with gradient top (like home) + white header bar.
 * Matches the home screen's visual style: a LinearGradient strip behind the
 * safe-area inset, with a white header bar containing back button + title.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';

interface GradientHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightIcon?: string;
  onRightPress?: () => void;
  rightBadge?: number;
  showBack?: boolean;
  accentColor?: string;
  style?: ViewStyle;
}

export function GradientHeader({
  title,
  subtitle,
  onBack,
  rightIcon,
  onRightPress,
  rightBadge,
  showBack = true,
  accentColor = Brand.primary,
  style,
}: GradientHeaderProps) {
  const router = useRouter();
  const handleBack = onBack || (() => router.back());

  return (
    <LinearGradient
      colors={[Brand.dark, Brand.accent, Brand.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.headerBg}
    >
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={[styles.headerBar, style]}>
          {showBack ? (
            <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={22} color={Brand.text} />
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}
          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
          {rightIcon ? (
            <Pressable onPress={onRightPress} hitSlop={12} style={styles.rightBtn}>
              <MaterialCommunityIcons name={rightIcon as any} size={22} color={accentColor} />
              {rightBadge !== undefined && rightBadge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{rightBadge > 99 ? '99+' : rightBadge}</Text>
                </View>
              ) : null}
            </Pressable>
          ) : (
            <View style={styles.rightBtn} />
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  headerBg: {
    width: '100%',
  },
  safeArea: {
    flex: 0,
    backgroundColor: 'transparent',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: Brand.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11,
    color: Brand.textTertiary,
    marginTop: 1,
    fontWeight: '500',
  },
  rightBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: Brand.danger,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
