// ── Social Login Buttons ───────────────────────────────────────────
// Google-only social login matching the web storefront.
// Uses expo-auth-session for the OAuth flow, then exchanges the
// Google token for Diilzo JWT tokens via the backend.
//
// The button is always visible. If Google isn't configured (no
// client ID in env), tapping shows an alert explaining how to set it up.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { useGoogleAuth } from '@/services/socialAuth';

export function SocialLoginButtons() {
  const router = useRouter();
  const { socialLogin } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(false);

  const googleAuth = useGoogleAuth();

  const handleGoogle = async () => {
    if (!googleAuth.configured) {
      Alert.alert(
        'Google Sign-In Not Configured',
        'Add EXPO_PUBLIC_GOOGLE_CLIENT_ID to your .env file to enable Google sign-in.',
      );
      return;
    }
    try {
      setLoading(true);
      const result = await googleAuth.promptAsync();
      if (result?.type !== 'success') return;
      const idToken = result.params?.id_token;
      const accessToken = result.params?.access_token;
      if (!idToken && !accessToken) {
        Alert.alert('Error', 'No token received from Google.');
        return;
      }
      await socialLogin('google', { id_token: idToken, access_token: accessToken });
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Google Sign-In Failed', e?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.divider} />
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.socialBtn, loading && styles.socialBtnDisabled]}
          onPress={handleGoogle}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <MaterialCommunityIcons name="google" size={22} color={colors.text} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    marginTop: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: c.border,
  },
  dividerText: {
    fontSize: 13,
    color: c.textTertiary,
    marginHorizontal: 12,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  socialBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialBtnDisabled: {
    opacity: 0.5,
  },
});
