import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@/services/notifications';

// Map notification type to icon + color
const TYPE_CONFIG: Record<string, {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
}> = {
  order: { icon: 'shopping', color: '#3B82F6' },
  payment: { icon: 'credit-card-outline', color: '#8B5CF6' },
  shipping: { icon: 'truck-fast-outline', color: '#06B6D4' },
  promo: { icon: 'tag-outline', color: Brand.rating },
  review: { icon: 'star-outline', color: Brand.rating },
  system: { icon: 'bell-outline', color: Brand.textSecondary },
  message: { icon: 'chat-outline', color: '#EC4899' },
  default: { icon: 'bell-outline', color: Brand.primary },
};

function getIcon(type: string) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.default;
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await fetchNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Notifications load error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePressNotification = async (item: AppNotification) => {
    // Mark as read if unread
    if (!item.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      try {
        await markNotificationRead(item.id);
      } catch {
        // revert on failure
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: false } : n))
        );
      }
    }
    // Navigate if link_url present
    if (item.link_url) {
      // link_url may be a route path like /buyer/orders/123
      const route = item.link_url.startsWith('/') ? item.link_url : `/${item.link_url}`;
      try {
        router.push(route as any);
      } catch {
        // ignore navigation errors
      }
    }
  };

  const handleMarkAllRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    const prev = notifications;
    // Optimistically update
    setNotifications((items) => items.map((n) => ({ ...n, is_read: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      // revert
      setNotifications(prev);
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const renderItem = ({ item }: { item: AppNotification }) => {
    const config = getIcon(item.notification_type);
    return (
      <Pressable
        style={({ pressed }) => [
          styles.notifCard,
          !item.is_read && styles.notifCardUnread,
          pressed && { opacity: 0.85 },
        ]}
        onPress={() => handlePressNotification(item)}
      >
        <View style={[styles.notifIcon, { backgroundColor: config.color + '20' }]}>
          <MaterialCommunityIcons name={config.icon} size={22} color={config.color} />
        </View>
        <View style={styles.notifContent}>
          <View style={styles.notifHeader}>
            <Text style={[styles.notifTitle, !item.is_read && styles.notifTitleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notifMessage} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={styles.notifTime}>{formatTimestamp(item.created_at)}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient
          colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Pressable
            onPress={handleMarkAllRead}
            disabled={markingAll || unreadCount === 0}
            hitSlop={12}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text
                style={[
                  styles.markAllText,
                  unreadCount === 0 && styles.markAllTextDisabled,
                ]}
              >
                Mark all read
              </Text>
            )}
          </Pressable>
        </LinearGradient>

        {loading ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="bell-off-outline" size={56} color={Brand.textTertiary} />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>You'll see updates about your orders here</Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => `${item.id}`}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            maxToRenderPerBatch={10}
            windowSize={11}
            initialNumToRender={10}
            removeClippedSubviews={true}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={load}
                colors={[Brand.primary]}
                tintColor={Brand.primary}
              />
            }
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  markAllText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  markAllTextDisabled: { opacity: 0.5 },

  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.four },
  emptyText: { marginTop: Spacing.three, fontSize: 16, fontWeight: '700', color: Brand.text },
  emptySubtext: { marginTop: Spacing.one + 2, fontSize: 14, color: Brand.textSecondary, textAlign: 'center' },

  list: { padding: Spacing.three, paddingBottom: Spacing.six },

  notifCard: {
    flexDirection: 'row',
    gap: Spacing.three - 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: Spacing.three,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  notifCardUnread: {
    backgroundColor: Brand.surfaceAlt,
    borderLeftWidth: 3,
    borderLeftColor: Brand.primary,
  },
  notifIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifContent: { flex: 1, gap: 4 },
  notifHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  notifTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: Brand.textSecondary },
  notifTitleUnread: { fontWeight: '700', color: Brand.text },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Brand.primary },
  notifMessage: { fontSize: 14, color: Brand.textSecondary, lineHeight: 20 },
  notifTime: { fontSize: 12, color: Brand.textTertiary, marginTop: 2 },
});
