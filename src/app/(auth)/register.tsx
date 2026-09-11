import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
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
import { getSafeErrorMessage } from '@/utils/errors';
import { checkPasswordStrength, isPasswordValid, isValidEmail, isValidPhone, sanitizeEmail, sanitizeString } from '@/utils/validation';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordStrength = checkPasswordStrength(password);

  const handleRegister = async () => {
    // Validate all inputs
    if (!firstName || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!isPasswordValid(password)) {
      setError('Password must be at least 8 characters with letters and numbers.');
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setError('Please enter a valid phone number.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Sanitize all inputs before sending
      await register(
        sanitizeEmail(email),
        sanitizeString(password, 128),
        sanitizeString(firstName, 60),
        sanitizeString(lastName, 60),
        sanitizeString(phone, 20),
      );
      router.replace('/');
    } catch (e: any) {
      setError(getSafeErrorMessage(e, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <GradientHeader title="Create Account" subtitle="Join Diilzo" showBack={false} />
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
            {/* Social login buttons — 2x2 grid */}
            <View style={styles.socialRow}>
              <Pressable style={styles.socialBtn}>
                <MaterialCommunityIcons name="google" size={22} color="#4285F4" />
                <Text style={styles.socialText}>Google</Text>
              </Pressable>
              <Pressable style={styles.socialBtn}>
                <MaterialCommunityIcons name="facebook" size={22} color="#1877F2" />
                <Text style={styles.socialText}>Facebook</Text>
              </Pressable>
            </View>
            <View style={styles.socialRow}>
              <Pressable style={styles.socialBtn}>
                <MaterialCommunityIcons name="instagram" size={22} color="#d62976" />
                <Text style={styles.socialText}>Instagram</Text>
              </Pressable>
              <Pressable style={styles.socialBtn}>
                <MaterialCommunityIcons name="music-note" size={22} color="#000" />
                <Text style={styles.socialText}>TikTok</Text>
              </Pressable>
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or sign up with email</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Error box */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* First Name + Last Name */}
            <View style={styles.nameRow}>
              <View style={styles.inputWrap}>
                <MaterialCommunityIcons
                  name="account-outline"
                  size={20}
                  color={Brand.textTertiary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  placeholderTextColor={Brand.textTertiary}
                />
              </View>
              <View style={styles.inputWrap}>
                <MaterialCommunityIcons
                  name="account-outline"
                  size={20}
                  color={Brand.textTertiary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor={Brand.textTertiary}
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.inputWrap}>
              <MaterialCommunityIcons
                name="email-outline"
                size={20}
                color={Brand.textTertiary}
                style={styles.inputIcon}
              />
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

            {/* Phone */}
            <View style={styles.inputWrap}>
              <MaterialCommunityIcons
                name="phone-outline"
                size={20}
                color={Brand.textTertiary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+256 700 000 000"
                placeholderTextColor={Brand.textTertiary}
                keyboardType="phone-pad"
              />
            </View>

            {/* Password */}
            <View style={styles.inputWrap}>
              <MaterialCommunityIcons
                name="lock-outline"
                size={20}
                color={Brand.textTertiary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password"
                placeholderTextColor={Brand.textTertiary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                style={styles.eyeBtn}
                hitSlop={8}
              >
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Brand.textTertiary}
                />
              </Pressable>
            </View>
            {/* Password strength indicator */}
            {password.length > 0 && (
              <View style={styles.strengthWrap}>
                <View style={styles.strengthBars}>
                  {[0, 1, 2, 3].map((i) => (
                    <View
                      key={`strength-${i}`}
                      style={[
                        styles.strengthBar,
                        {
                          backgroundColor:
                            passwordStrength.score > i
                              ? passwordStrength.score <= 1
                                ? Brand.danger
                                : passwordStrength.score <= 2
                                  ? Brand.rating
                                  : passwordStrength.score <= 3
                                    ? '#3B82F6'
                                    : '#16A34A'
                              : Brand.border,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text
                  style={[
                    styles.strengthLabel,
                    {
                      color:
                        passwordStrength.score <= 1 ? Brand.danger
                          : passwordStrength.score <= 2 ? Brand.rating
                            : passwordStrength.score <= 3 ? '#3B82F6'
                              : '#16A34A',
                    },
                  ]}
                >
                  {passwordStrength.label}
                </Text>
              </View>
            )}
            <Text style={styles.hint}>Minimum 8 characters with letters and numbers</Text>

            {/* Sign Up button */}
            <Pressable
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.btnText}>Create Account</Text>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#FFFFFF" />
                </>
              )}
            </Pressable>
          </View>

          {/* Bottom section */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text style={styles.linkText}>Sign In</Text>
              </Pressable>
            </Link>
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

  // White form card
  card: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    backgroundColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },

  // Social login buttons
  socialRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingVertical: 12,
  },
  socialText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.text,
  },

  // Divider
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
    fontSize: 13,
    color: Brand.textTertiary,
    marginHorizontal: 10,
  },

  // Error box
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

  // Name row (first + last)
  nameRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },

  // Input wrapper (icon + input)
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 10,
    backgroundColor: Brand.surfaceAlt,
    marginBottom: 10,
    height: 48,
  },
  inputIcon: {
    marginLeft: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 15,
    color: Brand.text,
    backgroundColor: 'transparent',
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  // Password hint
  hint: {
    fontSize: 11,
    color: Brand.textTertiary,
    marginTop: 4,
  },
  strengthWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Sign Up button
  btn: {
    backgroundColor: Brand.primary,
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Footer
  footer: {
    marginTop: 24,
    alignItems: 'center',
    paddingBottom: 24,
  },
  footerText: {
    fontSize: 14,
    color: Brand.textSecondary,
  },
  linkText: {
    color: Brand.primary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
});
