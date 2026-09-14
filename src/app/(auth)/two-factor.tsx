import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GradientHeader } from '@/components/GradientHeader';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { setTokens } from '@/services/api';
import { resendTwoFactor, verifyTwoFactor } from '@/services/auth';
import { getSafeErrorMessage } from '@/utils/errors';

export default function TwoFactorScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // tempToken is passed via router params
  const params = useLocalSearchParams<{ temp_token?: string; email?: string }>();
  const [tempToken, setTempToken] = useState(params.temp_token || '');
  const [email, setEmail] = useState(params.email || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      setError('Please enter the 6-digit code.');
      return;
    }
    if (!tempToken) {
      setError('Session expired. Please login again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await verifyTwoFactor(tempToken, code);
      await setTokens(result.access, result.refresh);
      await refreshUser();
      router.replace('/');
    } catch (e: any) {
      setError(getSafeErrorMessage(e, 'Invalid or expired code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!tempToken) {
      setError('Session expired. Please login again.');
      return;
    }
    setResending(true);
    setError(null);
    try {
      const result = await resendTwoFactor(tempToken);
      setTempToken(result.temp_token);
      Alert.alert('Code Sent', 'A new code has been sent to your email.');
    } catch (e: any) {
      setError(getSafeErrorMessage(e, 'Failed to resend code.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <GradientHeader title="Verify Your Identity" subtitle="Two-Factor Authentication" showBack />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name="email-lock-outline" size={56} color={Brand.primary} />
          </View>

          <Text style={styles.title}>Enter Your Code</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.emailText}>{email || 'your email'}</Text>
          </Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="shield-key-outline" size={20} color={colors.textTertiary} />
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
          </View>

          <Pressable
            style={[styles.verifyBtn, loading && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.verifyBtnText}>Verify & Sign In</Text>
            )}
          </Pressable>

          <Pressable
            style={[styles.resendBtn, resending && styles.btnDisabled]}
            onPress={handleResend}
            disabled={resending}
          >
            {resending ? (
              <ActivityIndicator size="small" color={Brand.primary} />
            ) : (
              <Text style={styles.resendText}>Resend Code</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.replace('/(auth)/login' as any)}
            style={styles.backBtn}
          >
            <MaterialCommunityIcons name="arrow-left" size={18} color={colors.textSecondary} />
            <Text style={styles.backText}>Back to Login</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', paddingTop: 30, paddingHorizontal: 24 },

  iconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: c.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: '800', color: c.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: c.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  emailText: { fontWeight: '700', color: c.text },

  errorBox: {
    backgroundColor: 'rgba(220,38,38,0.08)',
    borderLeftWidth: 3,
    borderLeftColor: Brand.danger,
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    width: '100%',
  },
  errorText: { color: Brand.danger, fontSize: 13 },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: c.surface,
    width: '100%',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: c.text,
    letterSpacing: 8,
    textAlign: 'center',
    padding: 0,
  },

  verifyBtn: {
    backgroundColor: Brand.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  verifyBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  resendBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
  },
  resendText: { color: Brand.primary, fontSize: 14, fontWeight: '600' },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
  },
  backText: { color: c.textSecondary, fontSize: 14, fontWeight: '500' },

  btnDisabled: { opacity: 0.6 },
});
