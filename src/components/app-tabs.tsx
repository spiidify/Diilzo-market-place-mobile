import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';

import { Colors } from '@/constants/theme';

const ORANGE = '#ff6a00';

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ORANGE,
        tabBarInactiveTintColor: '#999',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Image source={require('@/assets/images/tabIcons/home.png')} style={{ width: 24, height: 24, tintColor: color }} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => (
            <Image source={require('@/assets/images/tabIcons/explore.png')} style={{ width: 24, height: 24, tintColor: color }} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color }) => (
            <Image source={require('@/assets/images/tabIcons/explore.png')} style={{ width: 24, height: 24, tintColor: color }} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => (
            <Image source={require('@/assets/images/tabIcons/home.png')} style={{ width: 24, height: 24, tintColor: color }} />
          ),
        }}
      />
      {/* Hidden routes */}
      <Tabs.Screen name="explore" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="product/[slug]" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    height: 56,
    paddingBottom: 4,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
