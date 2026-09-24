// ── Social Login Buttons ───────────────────────────────────────────
// Reusable social login buttons matching the web storefront:
// Google, Facebook, Instagram, TikTok (+ Apple placeholder).
// Used on both the login and register screens.
// Uses expo-auth-session for the OAuth flow, then exchanges the
// provider token/code for Diilzo JWT tokens via the backend.
//
// Buttons are ALWAYS visible. If a provider is not configured (no
// client ID in env), tapping the button shows an alert explaining
// how to configure it.

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import {
  useFacebookAuth,
  useGoogleAuth,
  useInstagramAuth,
  useTiktokAuth,
} from '@/services/socialAuth';

export function SocialLoginButtons() {
  const router = useRouter();
  const { socialLogin } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  // Hooks are always called — no conditional returns before them
  const googleAuth = useGoogleAuth();
  const facebookAuth = useFacebookAuth();
  const instagramAuth = useInstagramAuth();
  const tiktokAuth = useTiktokAuth();

  const handleGoogle = async () => {
    if (!googleAuth.configured) {
      Alert.alert(
        'Google Sign-In Not Configured',
        'Add EXPO_PUBLIC_GOOGLE_CLIENT_ID to your .env file to enable Google sign-in.',
      );
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
    if (!facebookAuth.configured) {
      Alert.alert(
        'Facebook Sign-In Not Configured',
        'Add EXPO_PUBLIC_FACEBOOK_CLIENT_ID to your .env file to enable Facebook sign-in.',
      );
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

  const handleInstagram = async () => {
    if (!instagramAuth.configured) {
      Alert.alert(
        'Instagram Sign-In Not Configured',
        'Add EXPO_PUBLIC_INSTAGRAM_CLIENT_ID to your .env file to enable Instagram sign-in.',
      );
      return;
    }
    try {
      setLoadingProvider('instagram');
      const result = await instagramAuth.promptAsync();
      if (result?.type !== 'success') return;
      const code = result.params?.code;
      if (!code) {
        Alert.alert('Error', 'No authorization code received from Instagram.');
        return;
      }
      await socialLogin('instagram', { code, redirect_uri: instagramAuth.redirectUri });
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Instagram Sign-In Failed', e?.message || 'Something went wrong.');
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleTiktok = async () => {
    if (!tiktokAuth.configured) {
      Alert.alert(
        'TikTok Sign-In Not Configured',
        'Add EXPO_PUBLIC_TIKTOK_CLIENT_KEY to your .env file to enable TikTok sign-in.',
      );
      return;
    }
    try {
      setLoadingProvider('tiktok');
      const result = await tiktokAuth.promptAsync();
      if (result?.type !== 'success') return;
      const code = result.params?.code;
      if (!code) {
        Alert.alert('Error', 'No authorization code received from TikTok.');
        return;
      }
      await socialLogin('tiktok', { code, redirect_uri: tiktokAuth.redirectUri });
      router.replace('/');
    } catch (e: any) {
      Alert.alert('TikTok Sign-In Failed', e?.message || 'Something went wrong.');
    } finally {
      setLoadingProvider(null);
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
        {/* Google */}
        <Pressable
          style={[styles.socialBtn, loadingProvider === 'google' && styles.socialBtnDisabled]}
          onPress={handleGoogle}
          disabled={loadingProvider !== null}
        >
          {loadingProvider === 'google' ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <MaterialCommunityIcons name="google" size={22} color={colors.text} />
          )}
        </Pressable>

        {/* Facebook */}
        <Pressable
          style={[styles.socialBtn, loadingProvider === 'facebook' && styles.socialBtnDisabled]}
          onPress={handleFacebook}
          disabled={loadingProvider !== null}
        >
          {loadingProvider === 'facebook' ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <MaterialCommunityIcons name="facebook" size={22} color="#1877F2" />
          )}
        </Pressable>

        {/* Instagram */}
        <Pressable
          style={[styles.socialBtn, loadingProvider === 'instagram' && styles.socialBtnDisabled]}
          onPress={handleInstagram}
          disabled={loadingProvider !== null}
        >
          {loadingProvider === 'instagram' ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <MaterialCommunityIcons name="instagram" size={22} color="#E4405F" />
          )}
        </Pressable>

        {/* TikTok */}
        <Pressable
          style={[styles.socialBtn, loadingProvider === 'tiktok' && styles.socialBtnDisabled]}
          onPress={handleTiktok}
          disabled={loadingProvider !== null}
        >
          {loadingProvider === 'tiktok' ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <MaterialCommunityIcons name="music-note" size={22} color={colors.text} />
          )}
        </Pressable>

        {/* Apple — placeholder for future development build */}
        <Pressable
          style={[styles.socialBtn, loadingProvider === 'apple' && styles.socialBtnDisabled]}
          onPress={() => Alert.alert(
            'Apple Sign-In',
            'Apple Sign-In requires a development build and will be available soon.',
          )}
          disabled={loadingProvider !== null}
        >
          <MaterialCommunityIcons name="apple" size={22} color={colors.text} />
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
