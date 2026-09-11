import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
import { confirmPasswordReset } from '@/services/auth';
import { getSafeErrorMessage } from '@/utils/errors';
import { sanitizeString } from '@/utils/validation';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { uid, token } = useLocalSearchParams<{ uid: string; token: string }>();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      setError('Please enter and confirm your new password.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!uid || !token) {
      setError('This reset link is invalid or has expired. Please request a new one.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await confirmPasswordReset(uid, token, sanitizeString(newPassword, 128));
      setSuccess(true);
    } catch (e: any) {
      setError(getSafeErrorMessage(e, 'Could not reset your password. The link may have expired.'));
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <GradientHeader title="Set New Password" subtitle="Enter your new password" />
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
                <Text style={styles.successText}>Password reset successfully!</Text>
                <Text style={styles.successHint}>
                  You can now sign in with your new password.
                </Text>
                <Pressable style={styles.btn} onPress={goToLogin}>
                  <Text style={styles.btnText}>Back to Login</Text>
                  <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : (
              <>
                {/* Error box */}
                {error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* New password input */}
                <View style={styles.inputWrap}>
                  <MaterialCommunityIcons name="lock-outline" size={20} color={Brand.textTertiary} />
                  <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="New password"
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

                {/* Confirm password input */}
                <View style={styles.inputWrap}>
                  <MaterialCommunityIcons name="lock-check-outline" size={20} color={Brand.textTertiary} />
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor={Brand.textTertiary}
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none"
                  />
                  <Pressable onPress={() => setShowConfirm((s) => !s)} hitSlop={8}>
                    <MaterialCommunityIcons
                      name={showConfirm ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color={Brand.textTertiary}
                    />
                  </Pressable>
                </View>

                <Text style={styles.hint}>Minimum 8 characters</Text>

                {/* Reset Password button */}
                <Pressable
                  style={[styles.btn, loading && styles.btnDisabled]}
                  onPress={handleResetPassword}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Text style={styles.btnText}>Reset Password</Text>
                      <MaterialCommunityIcons name="check-circle" size={20} color="#FFFFFF" />
                    </>
                  )}
                </Pressable>
              </>
            )}
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
    fontSize: 16,
    fontWeight: '700',
    color: Brand.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  successHint: {
    fontSize: 13,
    color: Brand.textTertiary,
    textAlign: 'center',
    marginBottom: 24,
  },

  // Input wrapper (icon + input + eye toggle)
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
    fontSize: 11,
    color: Brand.textTertiary,
    marginTop: 4,
  },

  // Reset Password button
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
});
