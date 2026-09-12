/**
 * Reusable skeleton/shimmer loading components.
 *
 * Usage:
 *   <Skeleton width={120} height={16} />
 *   <ProductCardSkeleton />
 *   <ProductListSkeleton count={6} />
 *   <OrderSkeleton />
 *
 * These replace spinners for list/grid loading states to give a perceived
 * performance boost and a more polished UX.
 */
import React from 'react';
import { View, StyleSheet, Animated, Easing, useColorScheme } from 'react-native';
import { Brand } from '../constants/theme';

// ── Shimmer animation ──────────────────────────────────────────────
// A single shared Animated.Value drives the shimmer pulse for all skeletons.
// This avoids creating one driver per skeleton instance (perf).
let _shimmerValue: Animated.Value | null = null;
function useShimmer() {
  const [val] = React.useState(() => {
    if (!_shimmerValue) _shimmerValue = new Animated.Value(0);
    return _shimmerValue;
  });
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(val, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [val]);
  return val;
}

// ── Base Skeleton block ────────────────────────────────────────────
interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: any;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 6, style }: SkeletonProps) {
  const shimmer = useShimmer();
  const scheme = useColorScheme();
  const baseColor = scheme === 'dark' ? Brand.surfaceAlt : '#E8E8EA';
  const highlightColor = scheme === 'dark' ? Brand.surface : '#F2F2F4';

  const bg = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [baseColor, highlightColor],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: width as any, height: height as any, borderRadius, backgroundColor: bg },
        style,
      ]}
    />
  );
}

// ── Product card skeleton (for grids/lists) ────────────────────────
export function ProductCardSkeleton() {
  return (
    <View style={styles.productCard}>
      <Skeleton width="100%" height={140} borderRadius={10} />
      <Skeleton width="80%" height={14} style={{ marginTop: 10 }} />
      <Skeleton width="50%" height={12} style={{ marginTop: 6 }} />
      <Skeleton width="40%" height={16} style={{ marginTop: 8 }} />
    </View>
  );
}

// ── Product list skeleton (renders N card skeletons) ──────────────
export function ProductListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.productGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </View>
  );
}

// ── Order skeleton ─────────────────────────────────────────────────
export function OrderSkeleton() {
  return (
    <View style={styles.orderCard}>
      <Skeleton width="60%" height={16} />
      <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
      <View style={styles.orderRow}>
        <Skeleton width={50} height={50} borderRadius={8} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Skeleton width="70%" height={14} />
          <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
        </View>
      </View>
      <Skeleton width="30%" height={16} style={{ marginTop: 10, alignSelf: 'flex-end' }} />
    </View>
  );
}

// ── Order list skeleton ────────────────────────────────────────────
export function OrderListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={{ padding: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <OrderSkeleton key={i} />
      ))}
    </View>
  );
}

// ── Chat list skeleton ─────────────────────────────────────────────
export function ChatSkeleton() {
  return (
    <View style={styles.chatRow}>
      <Skeleton width={48} height={48} borderRadius={24} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Skeleton width="50%" height={14} />
        <Skeleton width="80%" height={12} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

// ── Generic line skeleton (for text/paragraphs) ────────────────────
export function LineSkeleton({ width = '100%', height = 12 }: { width?: number | string; height?: number }) {
  return <Skeleton width={width} height={height} />;
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  productCard: {
    width: '48%',
    padding: 8,
    marginBottom: 12,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 12,
  },
  orderCard: {
    padding: 16,
    marginBottom: 12,
    backgroundColor: Brand.surface,
    borderRadius: 12,
  },
  orderRow: {
    flexDirection: 'row',
    marginTop: 12,
    alignItems: 'center',
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.border,
  },
});

export default Skeleton;
