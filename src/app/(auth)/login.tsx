import { useState } from 'react';
import {
  StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import { TextInput, Button } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

const ORANGE = '#ff6a00';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      router.replace('/');
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.response?.data?.error || 'Login failed. Check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <ThemedView style={styles.header}>
              <ThemedText type="title" style={styles.brand}>Diilzo</ThemedText>
              <ThemedText type="small" style={styles.subtitle}>Sign in to your account</ThemedText>
            </ThemedView>

            {error && (
              <ThemedView style={styles.errorBox}>
                <ThemedText type="small" style={styles.errorText}>{error}</ThemedText>
              </ThemedView>
            )}

            <ThemedView style={styles.form}>
              <ThemedText type="small" style={styles.label}>Email</ThemedText>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <ThemedText type="small" style={styles.label}>Password</ThemedText>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#999"
                secureTextEntry
                autoCapitalize="none"
              />

              <Pressable
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                <ThemedText type="default" style={styles.btnText}>
                  {loading ? 'Signing in…' : 'Sign In'}
                </ThemedText>
              </Pressable>
            </ThemedView>

            <ThemedView style={styles.footer}>
              <ThemedText type="small">Don't have an account? </ThemedText>
              <Link href="/(auth)/register" asChild>
                <Pressable>
                  <ThemedText type="small" style={styles.link}>Sign up</ThemedText>
                </Pressable>
              </Link>
            </ThemedView>

            <Pressable style={styles.guestBtn} onPress={() => router.replace('/')}>
              <ThemedText type="small" style={styles.guestText}>Continue as guest</ThemedText>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  kav: { flex: 1 },
  scroll: { padding: Spacing.four, flexGrow: 1, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: Spacing.four },
  brand: { fontSize: 32, fontWeight: '800', color: ORANGE },
  subtitle: { marginTop: 4, opacity: 0.6 },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 8, padding: Spacing.two, marginBottom: Spacing.three, borderLeftWidth: 3, borderLeftColor: '#e2231a' },
  errorText: { color: '#e2231a' },
  form: { gap: Spacing.two },
  label: { fontWeight: '600', marginBottom: 4, opacity: 0.7 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: Spacing.two,
    backgroundColor: '#fff',
    color: '#333',
  },
  btn: {
    backgroundColor: ORANGE,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.four },
  link: { color: ORANGE, fontWeight: '600' },
  guestBtn: { alignItems: 'center', marginTop: Spacing.three, padding: Spacing.two },
  guestText: { opacity: 0.5 },
});
