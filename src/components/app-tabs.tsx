import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { TABLET_NAV_WIDTH, useResponsiveLayout } from '@/hooks/useResponsiveLayout';

export default function AppTabs() {
  const { colors } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsiveLayout();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Brand.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarPosition: isTablet ? 'left' : 'bottom',
        tabBarVariant: isTablet ? 'material' : 'uikit',
        tabBarLabelPosition: isTablet ? 'beside-icon' : 'below-icon',
        tabBarStyle: isTablet ? styles.tabletTabBar : styles.tabBar,
        tabBarLabelStyle: isTablet ? styles.tabletTabBarLabel : styles.tabBarLabel,
        tabBarIconStyle: isTablet ? styles.tabletTabBarIcon : styles.tabBarIcon,
        tabBarItemStyle: isTablet ? styles.tabletTabBarItem : undefined,
        sceneStyle: isTablet ? {
          flex: 1,
          width: '100%',
          maxWidth: contentMaxWidth,
          alignSelf: 'center',
        } : undefined,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="home" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Categories',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="format-list-bulleted" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          title: 'Reels',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="play-circle" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="suppliers"
        options={{
          title: 'Suppliers',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="factory" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="account" size={26} color={color} />
          ),
        }}
      />
      {/* Hidden top-level routes — each subdirectory has its own Stack layout */}
      <Tabs.Screen name="cart" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="checkout" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="search" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="product/[slug]" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="store/[slug]" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="(auth)/login" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="(auth)/register" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="(auth)/forgot-password" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="(auth)/reset-password" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="(auth)/two-factor" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      {/* Subdirectory routes — handled by their own Stack layouts */}
      <Tabs.Screen name="chat" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="buyer" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="seller" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="admin" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="adminops" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="merchant-studio" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="adpulse" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
    </Tabs>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  tabBar: {
    backgroundColor: c.surface,
    borderTopWidth: 2,
    borderTopColor: c.border,
    height: 88,
    paddingBottom: 24,
    paddingTop: 10,
    shadowColor: Brand.primary,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  tabletTabBar: {
    width: TABLET_NAV_WIDTH,
    backgroundColor: c.surface,
    borderTopWidth: 0,
    borderRightWidth: 1,
    borderRightColor: c.border,
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 8,
  },
  tabletTabBarItem: {
    minHeight: 52,
    borderRadius: 12,
    marginVertical: 4,
  },
  tabletTabBarLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  tabletTabBarIcon: {
    marginTop: 0,
    marginRight: 8,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  tabBarIcon: {
    marginTop: 2,
  },
});
