import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { createCoupon, deleteCoupon, getCoupons, type SellerCoupon } from '@/services/seller';

export default function SellerCouponsScreen() {
  const router = useRouter();
  const [coupons, setCoupons] = useState<SellerCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrder, setMinOrder] = useState('0');
  const [maxUses, setMaxUses] = useState('0');
  const [isActive, setIsActive] = useState(true);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await getCoupons();
      setCoupons(data);
    } catch (e: any) {
      console.error('Coupons error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!code.trim()) { Alert.alert('Validation', 'Code is required'); return; }
    if (!discountValue) { Alert.alert('Validation', 'Discount value is required'); return; }
    setCreating(true);
    try {
      await createCoupon({
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: parseFloat(discountValue),
        min_order_amount: parseFloat(minOrder) || 0,
        max_uses: parseInt(maxUses) || 0,
        is_active: isActive,
      });
      setShowModal(false);
      setCode(''); setDiscountValue(''); setMinOrder('0'); setMaxUses('0'); setIsActive(true);
      load();
      Alert.alert('Success', 'Coupon created');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to create coupon');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (item: SellerCoupon) => {
    Alert.alert('Delete Coupon', `Delete "${item.code}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteCoupon(item.id); setCoupons(prev => prev.filter(c => c.id !== item.id)); }
        catch { Alert.alert('Error', 'Failed to delete'); }
      }},
    ]);
  };

  const renderItem = ({ item }: { item: SellerCoupon }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.codeWrap}>
          <MaterialCommunityIcons name="ticket-percent" size={20} color={Brand.primary} />
          <Text style={styles.code}>{item.code}</Text>
        </View>
        <Switch value={item.is_active} disabled trackColor={{ false: '#E0E0E0', true: Brand.primary + '40' }} thumbColor={item.is_active ? Brand.primary : '#BDBDBD'} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.metricCol}>
          <Text style={styles.metricValue}>{item.discount_type === 'percentage' ? `${item.discount_value}%` : `UGX ${Number(item.discount_value).toLocaleString()}`}</Text>
          <Text style={styles.metricLabel}>Discount</Text>
        </View>
        <View style={styles.metricCol}>
          <Text style={styles.metricValue}>{item.used_count}/{item.max_uses || '∞'}</Text>
          <Text style={styles.metricLabel}>Used</Text>
        </View>
        {item.valid_to && (
          <View style={styles.metricCol}>
            <Text style={styles.metricValue}>{new Date(item.valid_to).toLocaleDateString()}</Text>
            <Text style={styles.metricLabel}>Expires</Text>
          </View>
        )}
      </View>
      <Pressable style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]} onPress={() => handleDelete(item)}>
        <MaterialCommunityIcons name="trash-can-outline" size={16} color={Brand.danger} />
        <Text style={styles.deleteText}>Delete</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[Brand.primary, Brand.primary, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}><MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" /></Pressable>
          <Text style={styles.headerTitle}>Coupons</Text>
          <Pressable onPress={() => setShowModal(true)} hitSlop={12}><MaterialCommunityIcons name="plus" size={26} color="#FFFFFF" /></Pressable>
        </LinearGradient>

        {loading ? (
          <View style={styles.centerBody}><ActivityIndicator size="large" color={Brand.primary} /></View>
        ) : (
          <FlatList
            data={coupons}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="ticket-outline" size={48} color={Brand.textTertiary} />
                <Text style={styles.emptyText}>No coupons yet</Text>
                <Text style={styles.emptySub}>Tap + to create one</Text>
              </View>
            }
          />
        )}

        <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create Coupon</Text>
                <Pressable onPress={() => setShowModal(false)} hitSlop={12}><MaterialCommunityIcons name="close" size={24} color={Brand.textTertiary} /></Pressable>
              </View>
              <Text style={styles.formLabel}>Code *</Text>
              <TextInput style={styles.formInput} value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="SUMMER2026" placeholderTextColor={Brand.textTertiary} autoCapitalize="characters" />
              <Text style={styles.formLabel}>Discount Type</Text>
              <View style={styles.typeRow}>
                <Pressable style={[styles.typeBtn, discountType === 'percentage' && styles.typeBtnActive]} onPress={() => setDiscountType('percentage')}>
                  <Text style={[styles.typeBtnText, discountType === 'percentage' && styles.typeBtnTextActive]}>Percentage</Text>
                </Pressable>
                <Pressable style={[styles.typeBtn, discountType === 'fixed' && styles.typeBtnActive]} onPress={() => setDiscountType('fixed')}>
                  <Text style={[styles.typeBtnText, discountType === 'fixed' && styles.typeBtnTextActive]}>Fixed</Text>
                </Pressable>
              </View>
              <Text style={styles.formLabel}>Discount Value *</Text>
              <TextInput style={styles.formInput} value={discountValue} onChangeText={setDiscountValue} placeholder="10" keyboardType="numeric" placeholderTextColor={Brand.textTertiary} />
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Min Order (UGX)</Text>
                  <TextInput style={styles.formInput} value={minOrder} onChangeText={setMinOrder} placeholder="0" keyboardType="numeric" placeholderTextColor={Brand.textTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Max Uses (0=∞)</Text>
                  <TextInput style={styles.formInput} value={maxUses} onChangeText={setMaxUses} placeholder="0" keyboardType="numeric" placeholderTextColor={Brand.textTertiary} />
                </View>
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.formLabel}>Active</Text>
                <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: '#E0E0E0', true: Brand.primary + '40' }} thumbColor={isActive ? Brand.primary : '#BDBDBD'} />
              </View>
              <Pressable style={({ pressed }) => [styles.createBtn, (creating || pressed) && { opacity: 0.85 }]} onPress={handleCreate} disabled={creating}>
                {creating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.createBtnText}>Create Coupon</Text>}
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  codeWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  code: { fontSize: 16, fontWeight: '800', color: Brand.text },
  cardBody: { flexDirection: 'row', gap: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Brand.borderLight },
  metricCol: { flex: 1 },
  metricValue: { fontSize: 14, fontWeight: '700', color: Brand.text },
  metricLabel: { fontSize: 10, color: Brand.textTertiary, marginTop: 2 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(220,38,38,0.08)' },
  deleteText: { fontSize: 13, fontWeight: '600', color: Brand.danger },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  emptySub: { fontSize: 13, color: Brand.textTertiary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
  formLabel: { fontSize: 13, fontWeight: '700', color: Brand.text, marginBottom: 6, marginTop: 12 },
  formInput: { borderWidth: 1.5, borderColor: Brand.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Brand.text },
  formRow: { flexDirection: 'row', gap: 12 },
  typeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Brand.border, alignItems: 'center' },
  typeBtnActive: { borderColor: Brand.primary, backgroundColor: Brand.primary + '12' },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: Brand.textTertiary },
  typeBtnTextActive: { color: Brand.primary },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  createBtn: { backgroundColor: Brand.primary, marginTop: 20, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  createBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
