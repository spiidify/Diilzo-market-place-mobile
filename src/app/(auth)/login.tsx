import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
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
      const result = await authenticateWithBiometrics('Use biometrics to sign in to Diilzo');
      if (result) {
        router.replace('/');
      }
    } catch (e: any) {
      Alert.alert('Biometric Login', 'Biometric authentication failed. Please use email/password.');
    }
  };

  const handleSocialLogin = async (provider: string) => {
    const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://diilzo-market-place-production.up.railway.app/api/v1';
    const webUrl = baseUrl.replace('/api/v1', '');
    const oauthUrl = `${webUrl}/accounts/${provider}/login/`;
    try {
      const result = await WebBrowser.openAuthSessionAsync(oauthUrl, 'diilzomobile://');
      if (result.type === 'success' && result.url) {
        // The redirect should contain tokens; parse them
        const url = new URL(result.url);
        const accessToken = url.searchParams.get('access') || url.searchParams.get('access_token');
        const refreshToken = url.searchParams.get('refresh') || url.searchParams.get('refresh_token');
        if (accessToken && refreshToken) {
          // Store tokens directly via the auth service
          const { setTokens } = await import('@/services/api');
          await setTokens(accessToken, refreshToken);
          // Reload the app to let AuthContext pick up the new tokens
          router.replace('/');
        } else {
          Alert.alert('Social Login', 'Authentication was cancelled or did not return tokens.');
        }
      }
    } catch (e: any) {
      Alert.alert('Social Login', `${provider} login is not yet configured. Please use email/password.`);
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
      await login(sanitizeEmail(email), sanitizeString(password, 128));
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
            {/* Social login grid */}
            <View style={styles.socialGrid}>
              <Pressable style={styles.socialBtn} onPress={() => handleSocialLogin('google')}>
                <MaterialCommunityIcons name="google" size={22} color="#4285F4" />
                <Text style={styles.socialText}>Google</Text>
              </Pressable>
              <Pressable style={styles.socialBtn} onPress={() => handleSocialLogin('facebook')}>
                <MaterialCommunityIcons name="facebook" size={22} color="#1877F2" />
                <Text style={styles.socialText}>Facebook</Text>
              </Pressable>
              <Pressable style={styles.socialBtn} onPress={() => handleSocialLogin('instagram')}>
                <MaterialCommunityIcons name="instagram" size={22} color="#d62976" />
                <Text style={styles.socialText}>Instagram</Text>
              </Pressable>
              <Pressable style={styles.socialBtn} onPress={() => handleSocialLogin('tiktok')}>
                <MaterialCommunityIcons name="music-note" size={22} color="#000" />
                <Text style={styles.socialText}>TikTok</Text>
              </Pressable>
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or sign in with email</Text>
              <View style={styles.dividerLine} />
            </View>

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
            <Pressable style={styles.forgotBtn}>
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
              <Pressable style={styles.biometricBtn} onPress={handleBiometricLogin}>
                <MaterialCommunityIcons
                  name={bioType === 'FaceID' ? 'face-recognition' : 'fingerprint'}
                  size={22}
                  color={Brand.primary}
                />
                <Text style={styles.biometricText}>Sign in with {bioType || 'Biometrics'}</Text>
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
  socialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  socialBtn: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: '#FFFFFF',
  },
  socialText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.text,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Brand.border,
  },
  dividerText: {
    fontSize: 12,
    color: Brand.textTertiary,
    marginHorizontal: 10,
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
