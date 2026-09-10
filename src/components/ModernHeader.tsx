/**
 * ModernHeader — Reusable white-background header for all Diilzo screens.
 * Replaces the old gradient headers with a clean, compact, modern design.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';

interface ModernHeaderProps {
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

export function ModernHeader({
  title,
  subtitle,
  onBack,
  rightIcon,
  onRightPress,
  rightBadge,
  showBack = true,
  accentColor = Brand.primary,
  style,
}: ModernHeaderProps) {
  const router = useRouter();
  const handleBack = onBack || (() => router.back());

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={[styles.header, style]}>
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
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Brand.borderLight,
    minHeight: 52,
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
