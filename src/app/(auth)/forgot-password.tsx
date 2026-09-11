import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';
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
import { requestPasswordReset } from '@/services/auth';
import { getSafeErrorMessage } from '@/utils/errors';
import { isValidEmail, sanitizeEmail } from '@/utils/validation';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSendResetLink = async () => {
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await requestPasswordReset(sanitizeEmail(email));
      setSuccess(true);
    } catch (e: any) {
      setError(getSafeErrorMessage(e, 'Could not send reset link. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <GradientHeader title="Reset Password" subtitle="Enter your email to receive a reset link" />
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
            {success ? (
              <View style={styles.successBox}>
                <View style={styles.successIconWrap}>
                  <MaterialCommunityIcons name="check-circle" size={48} color={Brand.success} />
                </View>
                <Text style={styles.successText}>
                  If that email exists, a reset link has been sent.
                </Text>
                <Text style={styles.successHint}>
                  Check your inbox (and spam folder) for an email with instructions to reset your password.
                </Text>
              </View>
            ) : (
              <>
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

                <Text style={styles.hint}>
                  Enter the email associated with your Diilzo account and we'll send you a link to reset your password.
                </Text>

                {/* Send Reset Link button */}
                <Pressable
                  style={[styles.btn, loading && styles.btnDisabled]}
                  onPress={handleSendResetLink}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Text style={styles.btnText}>Send Reset Link</Text>
                      <MaterialCommunityIcons name="send" size={20} color="#FFFFFF" />
                    </>
                  )}
                </Pressable>
              </>
            )}
          </View>

          {/* Bottom section */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Remember your password?</Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text style={styles.linkText}>Back to Login</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
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

  // Success box
  successBox: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  successIconWrap: {
    marginBottom: 16,
  },
  successText: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  successHint: {
    fontSize: 13,
    color: Brand.textTertiary,
    textAlign: 'center',
    lineHeight: 19,
  },

  // Input wrapper (icon + input)
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

  // Hint
  hint: {
    fontSize: 12,
    color: Brand.textTertiary,
    lineHeight: 17,
    marginBottom: 4,
  },

  // Send Reset Link button
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
