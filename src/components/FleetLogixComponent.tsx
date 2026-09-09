// ── FleetLogix Component ──────────────────────────────────────────
// Pickup station clerk mobile component for releasing packages.
// Renders two input forms (Order ID + 6-Digit Collection PIN) and
// fires a network call to /api/v1/fleet/release-package/.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import {
  isValidCollectionPin,
  isValidOrderId,
  releasePackage,
  type ReleasePackageResponse,
} from '@/services/fleetApi';

type ResultState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; data: ReleasePackageResponse }
  | { type: 'error'; message: string };

export function FleetLogixComponent() {
  const router = useRouter();
  const [orderId, setOrderId] = useState('');
  const [collectionPin, setCollectionPin] = useState('');
  const [result, setResult] = useState<ResultState>({ type: 'idle' });
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleRelease = useCallback(async () => {
    // ── Client-side validation ───────────────────────────────────
    setValidationError(null);

    if (!isValidOrderId(orderId)) {
      setValidationError('Please enter a valid Order ID (numbers only).');
      return;
    }

    if (!isValidCollectionPin(collectionPin)) {
      setValidationError('Collection PIN must be exactly 6 digits.');
      return;
    }

    setResult({ type: 'loading' });

    try {
      const response = await releasePackage(
        parseInt(orderId.trim(), 10),
        collectionPin.trim()
      );
      setResult({ type: 'success', data: response });
      // Clear inputs on success
      setOrderId('');
      setCollectionPin('');
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to release package. Please try again.';
      setResult({ type: 'error', message });
    }
  }, [orderId, collectionPin]);

  const handleClear = useCallback(() => {
    setOrderId('');
    setCollectionPin('');
    setResult({ type: 'idle' });
    setValidationError(null);
  }, []);

  const isLoading = result.type === 'loading';

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient
          colors={[Brand.dark, Brand.accent, Brand.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>FleetLogix</Text>
            <Text style={styles.headerSub}>Release Package — Pickup Station</Text>
          </View>
          <View style={{ width: 24 }} />
        </LinearGradient>
      </SafeAreaView>

      <View style={styles.body}>
        {/* ── Icon banner ────────────────────────────────────────── */}
        <View style={styles.iconBanner}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="package-variant-closed" size={48} color={Brand.primary} />
          </View>
          <Text style={styles.bannerTitle}>Package Collection</Text>
          <Text style={styles.bannerSub}>
            Enter the Order ID and the 6-digit collection PIN from the customer
            to release their package.
          </Text>
        </View>

        {/* ── Input form ─────────────────────────────────────────── */}
        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Order ID</Text>
            <View style={styles.inputWrap}>
              <MaterialCommunityIcons name="clipboard-list" size={20} color={Brand.textTertiary} />
              <TextInput
                style={styles.input}
                value={orderId}
                onChangeText={(text) => {
                  setOrderId(text.replace(/[^0-9]/g, ''));
                  setResult({ type: 'idle' });
                  setValidationError(null);
                }}
                placeholder="e.g. 12345"
                placeholderTextColor={Brand.textTertiary}
                keyboardType="numeric"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>6-Digit Collection PIN</Text>
            <View style={styles.inputWrap}>
              <MaterialCommunityIcons name="lock" size={20} color={Brand.textTertiary} />
              <TextInput
                style={styles.input}
                value={collectionPin}
                onChangeText={(text) => {
                  setCollectionPin(text.replace(/[^0-9]/g, '').slice(0, 6));
                  setResult({ type: 'idle' });
                  setValidationError(null);
                }}
                placeholder="e.g. 123456"
                placeholderTextColor={Brand.textTertiary}
                keyboardType="numeric"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={6}
                secureTextEntry={false}
                editable={!isLoading}
              />
            </View>
          </View>

          {/* ── Validation error ──────────────────────────────────── */}
          {validationError && (
            <View style={styles.validationError}>
              <MaterialCommunityIcons name="alert-circle" size={16} color={Brand.danger} />
              <Text style={styles.validationErrorText}>{validationError}</Text>
            </View>
          )}

          {/* ── Submit button ─────────────────────────────────────── */}
          <Pressable
            style={({ pressed }) => [
              styles.submitBtn,
              (isLoading || !orderId || !collectionPin) && styles.submitBtnDisabled,
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleRelease}
            disabled={isLoading || !orderId || !collectionPin}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="package-variant" size={20} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>Release Package</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.7 }]}
            onPress={handleClear}
            disabled={isLoading}
          >
            <Text style={styles.clearBtnText}>Clear</Text>
          </Pressable>
        </View>

        {/* ── Success card ──────────────────────────────────────── */}
        {result.type === 'success' && (
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <MaterialCommunityIcons name="check-circle" size={40} color={Brand.success} />
            </View>
            <Text style={styles.successTitle}>Package Released!</Text>
            <Text style={styles.successDetail}>
              Order <Text style={styles.successBold}>{result.data.order_number}</Text> has been
              marked as <Text style={styles.successBold}>COLLECTED</Text>.
            </Text>
            {result.data.collected_at && (
              <Text style={styles.successTimestamp}>
                Collected at: {new Date(result.data.collected_at).toLocaleString()}
              </Text>
            )}
          </View>
        )}

        {/* ── Error card ────────────────────────────────────────── */}
        {result.type === 'error' && (
          <View style={styles.errorCard}>
            <View style={styles.errorIconWrap}>
              <MaterialCommunityIcons name="alert-circle" size={40} color={Brand.danger} />
            </View>
            <Text style={styles.errorTitle}>Release Failed</Text>
            <Text style={styles.errorDetail}>{result.message}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F4F6',
  },
  safeArea: {
    backgroundColor: Brand.dark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  headerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  body: {
    flex: 1,
    padding: 20,
  },
  iconBanner: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 10,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,107,53,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Brand.dark,
    marginBottom: 6,
  },
  bannerSub: {
    fontSize: 13,
    color: Brand.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.dark,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: Brand.dark,
  },
  validationError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(220,53,69,0.08)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  validationErrorText: {
    fontSize: 12,
    color: Brand.danger,
    fontWeight: '600',
    flex: 1,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Brand.primary,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 4,
  },
  submitBtnDisabled: {
    backgroundColor: Brand.textTertiary,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  clearBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  clearBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.textSecondary,
  },
  successCard: {
    backgroundColor: 'rgba(39,174,96,0.08)',
    borderWidth: 2,
    borderColor: Brand.success,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  successIconWrap: {
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Brand.success,
    marginBottom: 8,
  },
  successDetail: {
    fontSize: 14,
    color: Brand.dark,
    textAlign: 'center',
    lineHeight: 20,
  },
  successBold: {
    fontWeight: '800',
  },
  successTimestamp: {
    fontSize: 12,
    color: Brand.textSecondary,
    marginTop: 8,
  },
  errorCard: {
    backgroundColor: 'rgba(220,53,69,0.08)',
    borderWidth: 2,
    borderColor: Brand.danger,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  errorIconWrap: {
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Brand.danger,
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 14,
    color: Brand.dark,
    textAlign: 'center',
    lineHeight: 20,
  },
});
