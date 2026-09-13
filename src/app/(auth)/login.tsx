import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
  View
} from 'react-native';

import { GradientHeader } from '@/components/GradientHeader';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  authenticateWithBiometrics,
  enableBiometric,
  getBiometricCredentials,
  getBiometricType,
  isBiometricAvailable,
  isBiometricEnabled,
} from '@/services/biometric';
import { getSafeErrorMessage } from '@/utils/errors';
import { isValidEmail, sanitizeEmail, sanitizeString } from '@/utils/validation';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioType, setBioType] = useState<string>('');

  const [bioLoading, setBioLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const available = await isBiometricAvailable();
      setBioAvailable(available);
      if (available) {
        setBioType(await getBiometricType());
        setBioEnabled(await isBiometricEnabled());
      }
    })();
  }, []);

  const handleBiometricLogin = async () => {
    try {
      setBioLoading(true);
      // 1. Authenticate with device biometrics (Face ID / fingerprint)
      const result = await authenticateWithBiometrics('Use biometrics to sign in to Diilzo');
      if (!result) {
        return;
      }
      // 2. Retrieve stored credentials from SecureStore
      const credentials = await getBiometricCredentials();
      if (!credentials) {
        Alert.alert('Biometric Login', 'No saved credentials found. Please sign in with email/password first.');
        return;
      }
      // 3. Log in with the stored credentials
      await login(credentials.email, credentials.password);
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Biometric Login', 'Biometric authentication failed. Please use email/password.');
    } finally {
      setBioLoading(false);
    }
  };

  const handleLogin = async () => {
    // Validate inputs
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    // Note: no minimum password length on login — existing accounts with
    // shorter passwords should be able to sign in. The server validates.

    setLoading(true);
    setError(null);
    try {
      // Sanitize inputs before sending
      const cleanEmail = sanitizeEmail(email);
      const cleanPassword = sanitizeString(password, 128);
      await login(cleanEmail, cleanPassword);

      // After successful login, offer to enable biometric if available and not yet enabled
      if (bioAvailable && !bioEnabled) {
        Alert.alert(
          `Enable ${bioType || 'Biometrics'}?`,
          `Sign in faster next time with ${bioType || 'biometrics'}.`,
          [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Enable',
              onPress: async () => {
                try {
                  await enableBiometric(cleanEmail, cleanPassword);
                  setBioEnabled(true);
                } catch {
                  // Non-critical — just skip enabling
                }
              },
            },
          ],
        );
      }

      router.replace('/');
    } catch (e: any) {
      setError(getSafeErrorMessage(e, 'Login failed. Please check your credentials.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <GradientHeader title="Sign In" subtitle="Welcome back" showBack={false} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* White form card */}
          <View style={styles.card}>
            {/* Error box */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Email input */}
            <View style={styles.inputWrap}>
              <MaterialCommunityIcons name="email-outline" size={20} color={Brand.textTertiary} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={Brand.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password input */}
            <View style={styles.inputWrap}>
              <MaterialCommunityIcons name="lock-outline" size={20} color={Brand.textTertiary} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={Brand.textTertiary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={Brand.textTertiary}
                />
              </Pressable>
            </View>

            {/* Forgot password */}
            <Pressable
              style={styles.forgotBtn}
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>

            {/* Sign In button */}
            <Pressable
              style={[styles.signInBtn, loading && styles.signInBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.signInText}>Sign In</Text>
                  <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
                </>
              )}
            </Pressable>

            {/* Biometric login */}
            {bioAvailable && bioEnabled && (
              <Pressable
                style={[styles.biometricBtn, bioLoading && styles.signInBtnDisabled]}
                onPress={handleBiometricLogin}
                disabled={bioLoading}
              >
                {bioLoading ? (
                  <ActivityIndicator color={Brand.primary} />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name={bioType === 'Face ID' ? 'face-recognition' : 'fingerprint'}
                      size={22}
                      color={Brand.primary}
                    />
                    <Text style={styles.biometricText}>Sign in with {bioType || 'Biometrics'}</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
          <View style={styles.bottomSection}>
            <Text style={styles.newText}>New to Diilzo?</Text>
            <Link href="/(auth)/register" asChild>
              <Pressable>
                <Text style={styles.createAccountText}>Create a Free Account</Text>
              </Pressable>
            </Link>
            <Pressable onPress={() => router.replace('/')}>
              <Text style={styles.guestText}>Continue as guest</Text>
            </Pressable>
          </View>

          {/* Trust badges */}
          <View style={styles.trustRow}>
            <View style={styles.trustItem}>
              <MaterialCommunityIcons name="shield-check-outline" size={14} color={Brand.textTertiary} />
              <Text style={styles.trustText}>SSL Secured</Text>
            </View>
            <View style={styles.trustItem}>
              <MaterialCommunityIcons name="handshake-outline" size={14} color={Brand.textTertiary} />
              <Text style={styles.trustText}>Buyer Protection</Text>
            </View>
            <View style={styles.trustItem}>
              <MaterialCommunityIcons name="headset" size={14} color={Brand.textTertiary} />
              <Text style={styles.trustText}>24/7 Support</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F6' },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, paddingTop: 16 },
  card: {
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  errorBox: {
    backgroundColor: '#FFF3F3',
    borderLeftWidth: 3,
    borderLeftColor: Brand.danger,
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  errorText: {
    color: Brand.danger,
    fontSize: 13,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: Brand.surfaceAlt,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Brand.text,
    padding: 0,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  forgotText: {
    color: Brand.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Brand.primary,
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 20,
  },
  signInBtnDisabled: { opacity: 0.6 },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Brand.primary,
    borderRadius: 12,
    backgroundColor: Brand.surfaceAlt,
  },
  biometricText: {
    color: Brand.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomSection: {
    marginTop: 24,
    alignItems: 'center',
  },
  newText: {
    fontSize: 14,
    color: Brand.textSecondary,
  },
  createAccountText: {
    color: Brand.primary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  guestText: {
    color: Brand.textTertiary,
    fontSize: 13,
    marginTop: 16,
  },
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 24,
    marginBottom: 16,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustText: {
    fontSize: 11,
    color: Brand.textTertiary,
  },
});
