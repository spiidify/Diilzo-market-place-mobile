import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Brand } from '@/constants/theme';

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Brand.primary,
        tabBarInactiveTintColor: Brand.textTertiary,
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
          title: 'Videos',
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
      {/* Hidden routes */}
      <Tabs.Screen name="cart" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="checkout" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="search" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="product/[slug]" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="store/[slug]" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="(auth)/login" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="(auth)/register" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="chat/index" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="chat/[id]" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="buyer" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="buyer/orders" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="buyer/orders/[id]" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="buyer/wishlist" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="buyer/addresses" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="buyer/notifications" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="buyer/payments" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="buyer/privacy" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="buyer/support" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="buyer/tracking" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="seller" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="seller/products" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="seller/products/add" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="seller/products/edit" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="seller/promotions" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="seller/orders" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="seller/earnings" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="seller/analytics" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="seller/settings" options={{ href: null, tabBarItemStyle: { display: 'none' } }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 2,
    borderTopColor: Brand.border,
    height: 88,
    paddingBottom: 24,
    paddingTop: 10,
    shadowColor: Brand.primary,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
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
