import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { registerStore } from '@/services/seller';

const BUSINESS_TYPES = [
  { key: 'individual', label: 'Individual' },
  { key: 'retailer', label: 'Retailer' },
  { key: 'wholesaler', label: 'Wholesaler' },
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'distributor', label: 'Distributor' },
  { key: 'trading_company', label: 'Trading Co.' },
];

const PAYOUT_METHODS = [
  { key: 'mtn_momo', label: 'MTN MoMo' },
  { key: 'airtel', label: 'Airtel Money' },
  { key: 'bank', label: 'Bank' },
];

export default function SellerRegisterScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [storeName, setStoreName] = useState('');
  const [businessType, setBusinessType] = useState('individual');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [city, setCity] = useState('Kampala');
  const [country, setCountry] = useState('Uganda');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('mtn_momo');
  const [payoutPhone, setPayoutPhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isB2B = ['wholesaler', 'manufacturer', 'distributor', 'trading_company'].includes(businessType);

  const handleSubmit = async () => {
    if (!storeName.trim()) {
      setError('Store name is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await registerStore({
        name: storeName.trim(),
        business_type: businessType,
        is_wholesaler: isB2B,
        phone: phone.trim(),
        email: email.trim(),
        city: city.trim(),
        country: country.trim(),
        address: address.trim(),
        description: description.trim(),
        payout_method: payoutMethod,
        payout_phone: payoutPhone.trim(),
        bank_name: bankName.trim(),
        bank_account: bankAccount.trim(),
        bank_holder: bankHolder.trim(),
      });
      router.replace('/seller/pending' as any);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}{required && <Text style={{ color: Brand.danger }}> *</Text>}
      </Text>
      {children}
    </View>
  );

  const input = (value: string, setter: (v: string) => void, placeholder: string, opts?: any) => (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={setter}
      placeholder={placeholder}
      placeholderTextColor={colors.textTertiary}
      {...opts}
    />
  );

  return (
    <View style={styles.screen}>
      <ModernHeader title="Become a Seller" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.heroCard}>
          <MaterialCommunityIcons name="store-plus" size={30} color={Brand.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Open your store on Diilzo</Text>
            <Text style={styles.heroSub}>Fill in your details — our team reviews and approves stores within 1–2 business days.</Text>
          </View>
        </View>

        {/* Store basics */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Store Details</Text>
          <Field label="Store name" required>
            {input(storeName, setStoreName, 'e.g. Kampala Electronics')}
          </Field>
          <Field label="Business type">
            <View style={styles.chipsWrap}>
              {BUSINESS_TYPES.map((t) => (
                <Pressable
                  key={t.key}
                  style={[styles.chip, businessType === t.key && styles.chipActive]}
                  onPress={() => setBusinessType(t.key)}
                >
                  <Text style={[styles.chipText, businessType === t.key && styles.chipTextActive]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
            {isB2B && (
              <View style={styles.b2bHint}>
                <MaterialCommunityIcons name="factory" size={13} color={Brand.primary} />
                <Text style={styles.b2bHintText}>Your store will be listed as a B2B supplier.</Text>
              </View>
            )}
          </Field>
          <Field label="Description">
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="What does your store sell?"
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
            />
          </Field>
        </View>

        {/* Contact */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Contact & Location</Text>
          <Field label="Phone">
            {input(phone, setPhone, '+256 700 000 000', { keyboardType: 'phone-pad' })}
          </Field>
          <Field label="Email">
            {input(email, setEmail, 'store@example.com', { keyboardType: 'email-address', autoCapitalize: 'none' })}
          </Field>
          <View style={styles.rowFields}>
            <View style={{ flex: 1 }}>
              <Field label="City">{input(city, setCity, 'Kampala')}</Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Country">{input(country, setCountry, 'Uganda')}</Field>
            </View>
          </View>
          <Field label="Address">
            {input(address, setAddress, 'Street / building')}
          </Field>
        </View>

        {/* Payout */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Payout Method</Text>
          <Text style={styles.sectionHint}>Where Diilzo sends your earnings.</Text>
          <View style={styles.chipsWrap}>
            {PAYOUT_METHODS.map((m) => (
              <Pressable
                key={m.key}
                style={[styles.chip, payoutMethod === m.key && styles.chipActive]}
                onPress={() => setPayoutMethod(m.key)}
              >
                <Text style={[styles.chipText, payoutMethod === m.key && styles.chipTextActive]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
          {payoutMethod === 'bank' ? (
            <>
              <Field label="Bank name">{input(bankName, setBankName, 'e.g. Stanbic Bank')}</Field>
              <Field label="Account number">{input(bankAccount, setBankAccount, 'Account number', { keyboardType: 'number-pad' })}</Field>
              <Field label="Account holder">{input(bankHolder, setBankHolder, 'Name on account')}</Field>
            </>
          ) : (
            <Field label="Mobile money number">
              {input(payoutPhone, setPayoutPhone, '+256 700 000 000', { keyboardType: 'phone-pad' })}
            </Field>
          )}
        </View>

        {error && (
          <View style={styles.errorBox}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color={Brand.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.submitBtn, (pressed || submitting) && { opacity: 0.85 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="check-circle" size={18} color="#FFFFFF" />
              <Text style={styles.submitText}>Submit for Review</Text>
            </>
          )}
        </Pressable>
        <Text style={styles.footerNote}>By submitting you agree to Diilzo's seller terms and commission policy.</Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  body: { padding: 10, paddingBottom: 40 },

  heroCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Brand.primary + '12', borderRadius: 14, padding: 14, marginBottom: 10,
  },
  heroTitle: { fontSize: 15, fontWeight: '800', color: c.text },
  heroSub: { fontSize: 12, color: c.textSecondary, marginTop: 2, lineHeight: 17 },

  sectionCard: {
    backgroundColor: c.surface, borderRadius: 14, padding: 12, marginBottom: 10,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: c.text, marginBottom: 8 },
  sectionHint: { fontSize: 11, color: c.textTertiary, marginTop: -4, marginBottom: 8 },

  field: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: c.textSecondary, marginBottom: 5 },
  input: {
    backgroundColor: c.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: c.border,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: c.text,
  },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  rowFields: { flexDirection: 'row', gap: 10 },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border,
  },
  chipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: c.textSecondary },
  chipTextActive: { color: '#FFFFFF' },
  b2bHint: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  b2bHintText: { fontSize: 11, color: Brand.primary, fontWeight: '600' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Brand.danger + '12', borderRadius: 10, padding: 10, marginBottom: 10,
  },
  errorText: { flex: 1, fontSize: 12, color: Brand.danger, fontWeight: '600' },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Brand.primary, borderRadius: 12, paddingVertical: 14, marginTop: 4,
    elevation: 2, shadowColor: Brand.primary, shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  footerNote: { fontSize: 11, color: c.textTertiary, textAlign: 'center', marginTop: 12 },
});
