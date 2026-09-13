// ── Social Login Buttons ───────────────────────────────────────────
// Reusable social login buttons for Google and Facebook.
// Used on both the login and register screens.
// Uses expo-auth-session for the OAuth flow, then exchanges the
// provider token for Diilzo JWT tokens via the backend.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  isFacebookConfigured,
  isGoogleConfigured,
  useFacebookAuth,
  useGoogleAuth,
} from '@/services/socialAuth';

export function SocialLoginButtons() {
  const router = useRouter();
  const { socialLogin } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const googleAuth = useGoogleAuth();
  const facebookAuth = useFacebookAuth();

  const handleGoogle = async () => {
    if (!googleAuth) {
      Alert.alert('Not Configured', 'Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_CLIENT_ID in your environment.');
      return;
    }
    try {
      setLoadingProvider('google');
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
      setLoadingProvider(null);
    }
  };

  const handleFacebook = async () => {
    if (!facebookAuth) {
      Alert.alert('Not Configured', 'Facebook sign-in is not configured. Set EXPO_PUBLIC_FACEBOOK_CLIENT_ID in your environment.');
      return;
    }
    try {
      setLoadingProvider('facebook');
      const result = await facebookAuth.promptAsync();
      if (result?.type !== 'success') return;
      const accessToken = result.params?.access_token;
      if (!accessToken) {
        Alert.alert('Error', 'No access token received from Facebook.');
        return;
      }
      await socialLogin('facebook', { access_token: accessToken });
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Facebook Sign-In Failed', e?.message || 'Something went wrong.');
    } finally {
      setLoadingProvider(null);
    }
  };

  // Only show buttons for configured providers
  const showGoogle = isGoogleConfigured();
  const showFacebook = isFacebookConfigured();
  const anyConfigured = showGoogle || showFacebook;

  if (!anyConfigured) return null;

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.divider} />
      </View>

      <View style={styles.buttonRow}>
        {showGoogle && (
          <Pressable
            style={[styles.socialBtn, loadingProvider === 'google' && styles.socialBtnDisabled]}
            onPress={handleGoogle}
            disabled={loadingProvider !== null}
          >
            {loadingProvider === 'google' ? (
              <ActivityIndicator size="small" color={Brand.text} />
            ) : (
              <MaterialCommunityIcons name="google" size={22} color={Brand.text} />
            )}
          </Pressable>
        )}

        {showFacebook && (
          <Pressable
            style={[styles.socialBtn, loadingProvider === 'facebook' && styles.socialBtnDisabled]}
            onPress={handleFacebook}
            disabled={loadingProvider !== null}
          >
            {loadingProvider === 'facebook' ? (
              <ActivityIndicator size="small" color={Brand.text} />
            ) : (
              <MaterialCommunityIcons name="facebook" size={22} color="#1877F2" />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: Brand.border,
  },
  dividerText: {
    fontSize: 13,
    color: Brand.textTertiary,
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
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialBtnDisabled: {
    opacity: 0.5,
  },
});
