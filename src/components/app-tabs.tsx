import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Brand } from '@/constants/theme';

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Brand.primary,
        tabBarInactiveTintColor: '#848688',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIconStyle: styles.tabBarIcon,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="home" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="magnify" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="suppliers"
        options={{
          title: 'Suppliers',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="factory" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="account" size={28} color={color} />
          ),
        }}
      />
      {/* Hidden routes */}
      <Tabs.Screen name="cart" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="explore" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="product/[slug]" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="store/[slug]" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="(auth)/login" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="(auth)/register" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="chat/index" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="chat/[id]" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Brand.borderLight,
    height: 88,
    paddingBottom: 24,
    paddingTop: 10,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  tabBarIcon: {
    marginTop: 2,
  },
});
