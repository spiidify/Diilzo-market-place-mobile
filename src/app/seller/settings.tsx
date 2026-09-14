import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { LocationPicker } from '@/components/LocationPicker';
import { ModernHeader } from '@/components/ModernHeader';
import { Brand, Spacing } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { getMyStore, updateStoreSettings } from '@/services/seller';

interface StoreSettings {
  name: string;
  description: string;
  logo_url?: string | null;
  banner_url?: string | null;
  contact_email?: string;
  contact_phone?: string;
  business_type?: string;
  shipping_enabled?: boolean;
  free_shipping_threshold?: string;
  notification_orders?: boolean;
  notification_messages?: boolean;
  notification_marketing?: boolean;
  payout_method?: string;
  payout_details?: string;
}

const BUSINESS_TYPES = [
  { key: 'individual', label: 'Individual Seller' },
  { key: 'retail', label: 'Retail Business' },
  { key: 'wholesale', label: 'Wholesale' },
  { key: 'manufacturer', label: 'Manufacturer' },
];

const PAYOUT_METHODS = [
  { key: 'mobile_money', label: 'Mobile Money', icon: 'cellphone' as const },
  { key: 'bank', label: 'Bank Transfer', icon: 'bank' as const },
  { key: 'paypal', label: 'PayPal', icon: 'credit-card-outline' as const },
];

export default function SellerSettingsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ── Form state ──────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [businessType, setBusinessType] = useState('individual');
  const [shippingEnabled, setShippingEnabled] = useState(true);
  const [freeShipThreshold, setFreeShipThreshold] = useState('');
  const [notifOrders, setNotifOrders] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifMarketing, setNotifMarketing] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState('mobile_money');
  const [payoutDetails, setPayoutDetails] = useState('');
  const [storeSlug, setStoreSlug] = useState<string | null>(null);

  // ── Location state (Phase 2 — Alibaba-style hierarchy) ─────────
  const [location, setLocation] = useState<{
    country_ref?: number | null;
    region_ref?: number | null;
    city_ref?: number | null;
    country?: string;
    country_code?: string;
    region?: string;
    city?: string;
    latitude?: number | null;
    longitude?: number | null;
  }>({});

  // ── UI state ────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);

  // ── Load store data ─────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const dashboard = await getMyStore();
      const store = dashboard?.store || {};
      setStoreSlug(store.slug ?? null);
      setName(store.name || '');
      setDescription(store.description || '');
      setLogoUri(store.logo_url || null);
      setBannerUri(store.banner_url || null);
      setContactEmail(store.contact_email || store.email || '');
      setContactPhone(store.contact_phone || store.phone || '');
      setBusinessType(store.business_type || 'individual');
      setShippingEnabled(store.shipping_enabled ?? true);
      setFreeShipThreshold(store.free_shipping_threshold || '');
      setNotifOrders(store.notification_orders ?? true);
      setNotifMessages(store.notification_messages ?? true);
      setNotifMarketing(store.notification_marketing ?? false);
      setPayoutMethod(store.payout_method || 'mobile_money');
      setPayoutDetails(store.payout_details || '');
      setLocation({
        country_ref: store.country_ref || null,
        region_ref: store.region_ref || null,
        city_ref: store.city_ref || null,
        country: store.country || '',
        country_code: store.country_code || '',
        region: store.region || '',
        city: store.city || '',
        latitude: store.latitude ? parseFloat(store.latitude) : null,
        longitude: store.longitude ? parseFloat(store.longitude) : null,
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to load store settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Image pickers ───────────────────────────────────────────────
  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) setLogoUri(result.assets[0].uri);
  };

  const pickBanner = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [3, 1],
    });
    if (!result.canceled) setBannerUri(result.assets[0].uri);
  };

  // ── Save ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Missing field', 'Store name is required');
      return;
    }
    try {
      setSaving(true);
      setError(null);

      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('description', description.trim());
      formData.append('contact_email', contactEmail.trim());
      formData.append('contact_phone', contactPhone.trim());
      formData.append('business_type', businessType);
      formData.append('shipping_enabled', shippingEnabled ? 'true' : 'false');
      if (freeShipThreshold.trim()) formData.append('free_shipping_threshold', freeShipThreshold.trim());
      formData.append('notification_orders', notifOrders ? 'true' : 'false');
      formData.append('notification_messages', notifMessages ? 'true' : 'false');
      formData.append('notification_marketing', notifMarketing ? 'true' : 'false');
      formData.append('payout_method', payoutMethod);
      formData.append('payout_details', payoutDetails.trim());

      // Location FKs (Phase 2 — Alibaba-style hierarchy)
      if (location.country_ref) formData.append('country_ref', String(location.country_ref));
      if (location.region_ref) formData.append('region_ref', String(location.region_ref));
      if (location.city_ref) formData.append('city_ref', String(location.city_ref));
      if (location.country) formData.append('country', location.country);
      if (location.country_code) formData.append('country_code', location.country_code);
      if (location.region) formData.append('region', location.region);
      if (location.city) formData.append('city', location.city);
      if (location.latitude != null) formData.append('latitude', String(location.latitude));
      if (location.longitude != null) formData.append('longitude', String(location.longitude));

      // Only append image files if they are local (not remote URLs)
      if (logoUri && !logoUri.startsWith('http')) {
        formData.append('logo', {
          uri: logoUri,
          name: 'logo.jpg',
          type: 'image/jpeg',
        } as any);
      }
      if (bannerUri && !bannerUri.startsWith('http')) {
        formData.append('banner', {
          uri: bannerUri,
          name: 'banner.jpg',
          type: 'image/jpeg',
        } as any);
      }

      await updateStoreSettings(formData);

      Alert.alert('Saved', 'Store settings updated successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ||
        e?.response?.data?.name?.[0] ||
        e?.message ||
        'Failed to save settings';
      setError(typeof msg === 'string' ? msg : 'Failed to save settings');
      Alert.alert('Error', typeof msg === 'string' ? msg : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const selectedBusiness = BUSINESS_TYPES.find((b) => b.key === businessType);
  const selectedPayout = PAYOUT_METHODS.find((p) => p.key === payoutMethod);

  return (
    <View style={styles.screen}>
      <ModernHeader
        title="Store Settings"
        rightIcon={saving ? undefined : 'content-save'}
        onRightPress={handleSave}
      />

      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.centerBody}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.loadingText}>Loading settings...</Text>
          </View>
        ) : (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* ── Banner & logo ──────────────────────────────────── */}
              <Text style={styles.sectionTitle}>Store Profile</Text>
              <View style={styles.card}>
                <Pressable onPress={pickBanner}>
                  {bannerUri ? (
                    <Image source={{ uri: bannerUri }} style={styles.banner} resizeMode="cover" />
                  ) : (
                    <View style={[styles.banner, styles.bannerFallback]}>
                      <MaterialCommunityIcons name="image-plus" size={28} color={colors.textTertiary} />
                      <Text style={styles.bannerText}>Add Banner</Text>
                    </View>
                  )}
                </Pressable>

                <Pressable onPress={pickLogo} style={styles.logoWrap}>
                  {logoUri ? (
                    <Image source={{ uri: logoUri }} style={styles.logo} resizeMode="cover" />
                  ) : (
                    <View style={[styles.logo, styles.logoFallback]}>
                      <MaterialCommunityIcons name="store" size={26} color="#FFFFFF" />
                    </View>
                  )}
                  <View style={styles.logoEditBadge}>
                    <MaterialCommunityIcons name="pencil" size={12} color="#FFFFFF" />
                  </View>
                </Pressable>

                <Text style={styles.label}>Store Name *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="My Store"
                  placeholderTextColor={colors.textTertiary}
                />

                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Tell buyers about your store..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* ── Contact info ───────────────────────────────────── */}
              <Text style={styles.sectionTitle}>Contact Information</Text>
              <View style={styles.card}>
                <Text style={styles.label}>Contact Email</Text>
                <TextInput
                  style={styles.input}
                  value={contactEmail}
                  onChangeText={setContactEmail}
                  placeholder="store@example.com"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={styles.label}>Contact Phone</Text>
                <TextInput
                  style={styles.input}
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  placeholder="+256 7XX XXX XXX"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="phone-pad"
                />
              </View>

              {/* ── Location (Alibaba-style hierarchy) ─────────────── */}
              <Text style={styles.sectionTitle}>Store Location</Text>
              <View style={styles.card}>
                <LocationPicker value={location} onChange={setLocation} label="Country / Region / City" />
              </View>

              {/* ── Business type ──────────────────────────────────── */}
              <Text style={styles.sectionTitle}>Business</Text>
              <View style={styles.card}>
                <Text style={styles.label}>Business Type</Text>
                <Pressable style={styles.dropdown} onPress={() => setShowBusinessModal(true)}>
                  <Text style={styles.dropdownText} numberOfLines={1}>
                    {selectedBusiness?.label || 'Select type'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              {/* ── Shipping ───────────────────────────────────────── */}
              <Text style={styles.sectionTitle}>Shipping</Text>
              <View style={styles.card}>
                <View style={styles.switchRow}>
                  <View style={styles.switchInfo}>
                    <MaterialCommunityIcons name="truck-delivery-outline" size={20} color={Brand.primary} />
                    <Text style={styles.switchLabel}>Enable Shipping</Text>
                  </View>
                  <Switch
                    value={shippingEnabled}
                    onValueChange={setShippingEnabled}
                    trackColor={{ false: colors.border, true: Brand.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <Text style={styles.label}>Free Shipping Threshold (UGX)</Text>
                <TextInput
                  style={styles.input}
                  value={freeShipThreshold}
                  onChangeText={setFreeShipThreshold}
                  placeholder="e.g. 100000"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                />
              </View>

              {/* ── Notifications ──────────────────────────────────── */}
              <Text style={styles.sectionTitle}>Notifications</Text>
              <View style={styles.card}>
                <View style={styles.switchRow}>
                  <View style={styles.switchInfo}>
                    <MaterialCommunityIcons name="clipboard-list-outline" size={20} color={Brand.primary} />
                    <Text style={styles.switchLabel}>New Orders</Text>
                  </View>
                  <Switch
                    value={notifOrders}
                    onValueChange={setNotifOrders}
                    trackColor={{ false: colors.border, true: Brand.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.switchRow}>
                  <View style={styles.switchInfo}>
                    <MaterialCommunityIcons name="chat-outline" size={20} color={Brand.primary} />
                    <Text style={styles.switchLabel}>Messages</Text>
                  </View>
                  <Switch
                    value={notifMessages}
                    onValueChange={setNotifMessages}
                    trackColor={{ false: colors.border, true: Brand.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.switchRow}>
                  <View style={styles.switchInfo}>
                    <MaterialCommunityIcons name="bullhorn-outline" size={20} color={Brand.primary} />
                    <Text style={styles.switchLabel}>Marketing & Promotions</Text>
                  </View>
                  <Switch
                    value={notifMarketing}
                    onValueChange={setNotifMarketing}
                    trackColor={{ false: colors.border, true: Brand.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              {/* ── Payout ─────────────────────────────────────────── */}
              <Text style={styles.sectionTitle}>Payout Method</Text>
              <View style={styles.card}>
                <Text style={styles.label}>Payout Method</Text>
                <Pressable style={styles.dropdown} onPress={() => setShowPayoutModal(true)}>
                  <View style={styles.dropdownLeft}>
                    <MaterialCommunityIcons
                      name={selectedPayout?.icon || 'credit-card-outline'}
                      size={20}
                      color={Brand.primary}
                    />
                    <Text style={styles.dropdownText} numberOfLines={1}>
                      {selectedPayout?.label || 'Select method'}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} />
                </Pressable>

                <Text style={styles.label}>Payout Details</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={payoutDetails}
                  onChangeText={setPayoutDetails}
                  placeholder={
                    payoutMethod === 'mobile_money'
                      ? 'MTN/Airtel number registered for payments'
                      : payoutMethod === 'bank'
                        ? 'Bank name, account number, account name'
                        : 'PayPal email address'
                  }
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <MaterialCommunityIcons name="alert-circle" size={18} color={Brand.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* ── Save button ────────────────────────────────────── */}
              <Pressable
                style={({ pressed }) => [
                  styles.submitBtn,
                  pressed && { opacity: 0.85 },
                  saving && { opacity: 0.6 },
                ]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="content-save" size={20} color="#FFFFFF" />
                    <Text style={styles.submitText}>Save Changes</Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* ── Business type modal ─────────────────────────────────── */}
        <Modal visible={showBusinessModal} transparent animationType="slide" onRequestClose={() => setShowBusinessModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Business Type</Text>
                <Pressable onPress={() => setShowBusinessModal(false)} hitSlop={12}>
                  <MaterialCommunityIcons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
              <ScrollView style={styles.modalList}>
                {BUSINESS_TYPES.map((bt) => (
                  <Pressable
                    key={bt.key}
                    style={[
                      styles.modalItem,
                      bt.key === businessType && { backgroundColor: colors.surfaceAlt },
                    ]}
                    onPress={() => {
                      setBusinessType(bt.key);
                      setShowBusinessModal(false);
                    }}
                  >
                    <Text style={styles.modalItemText}>{bt.label}</Text>
                    {bt.key === businessType && (
                      <MaterialCommunityIcons name="check" size={20} color={Brand.primary} />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ── Payout method modal ─────────────────────────────────── */}
        <Modal visible={showPayoutModal} transparent animationType="slide" onRequestClose={() => setShowPayoutModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Payout Method</Text>
                <Pressable onPress={() => setShowPayoutModal(false)} hitSlop={12}>
                  <MaterialCommunityIcons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
              <ScrollView style={styles.modalList}>
                {PAYOUT_METHODS.map((pm) => (
                  <Pressable
                    key={pm.key}
                    style={[
                      styles.modalItem,
                      pm.key === payoutMethod && { backgroundColor: colors.surfaceAlt },
                    ]}
                    onPress={() => {
                      setPayoutMethod(pm.key);
                      setShowPayoutModal(false);
                    }}
                  >
                    <View style={styles.modalItemLeft}>
                      <MaterialCommunityIcons name={pm.icon} size={20} color={Brand.primary} />
                      <Text style={styles.modalItemText}>{pm.label}</Text>
                    </View>
                    {pm.key === payoutMethod && (
                      <MaterialCommunityIcons name="check" size={20} color={Brand.primary} />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },

  body: { flex: 1 },
  bodyContent: { padding: Spacing.three, paddingBottom: Spacing.six },

  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: Spacing.two, color: c.textSecondary, fontSize: 14 },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },

  card: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two + Spacing.half,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },

  label: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.three - Spacing.half,
    paddingVertical: Spacing.two + Spacing.half,
    fontSize: 15,
    color: c.text,
    backgroundColor: c.surfaceAlt,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },

  // ── Banner & logo ─────────────────────────────────────────────
  banner: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  bannerFallback: {
    backgroundColor: c.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
  },
  bannerText: { fontSize: 13, color: c.textTertiary, fontWeight: '600' },

  logoWrap: {
    width: 76,
    height: 76,
    alignSelf: 'flex-start',
    marginTop: -28,
    marginLeft: Spacing.three - Spacing.half,
  },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: c.surface,
  },
  logoFallback: {
    backgroundColor: Brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: c.surface,
  },

  // ── Dropdown ──────────────────────────────────────────────────
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.three - Spacing.half,
    paddingVertical: Spacing.two + Spacing.half,
    backgroundColor: c.surfaceAlt,
  },
  dropdownLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flex: 1 },
  dropdownText: { fontSize: 15, color: c.text },

  // ── Switch ────────────────────────────────────────────────────
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  switchInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + Spacing.half },
  switchLabel: { fontSize: 14, fontWeight: '600', color: c.text },

  // ── Error ─────────────────────────────────────────────────────
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: Spacing.three - Spacing.half,
    marginTop: Spacing.three,
  },
  errorText: { flex: 1, fontSize: 13, color: Brand.danger, fontWeight: '500' },

  // ── Submit ────────────────────────────────────────────────────
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: Brand.primary,
    borderRadius: 14,
    paddingVertical: Spacing.three + Spacing.half,
    marginTop: Spacing.four,
  },
  submitText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },

  // ── Modal ─────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three + Spacing.half,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  modalList: { paddingVertical: Spacing.two },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three + Spacing.half,
    paddingVertical: Spacing.three - Spacing.half,
  },
  modalItemLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + Spacing.half },
  modalItemText: { fontSize: 15, color: c.text },
});
