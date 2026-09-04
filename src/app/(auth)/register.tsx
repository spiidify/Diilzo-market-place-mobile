import { useState } from 'react';
import {
  StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import { TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

const ORANGE = '#ff6a00';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!email || !password || !firstName) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await register(email, password, firstName, lastName, phone);
      router.replace('/');
    } catch (e: any) {
      const data = e?.response?.data;
      const msg = data?.password?.[0] || data?.email?.[0] || data?.detail || 'Registration failed.';
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
              <ThemedText type="small" style={styles.subtitle}>Create your account</ThemedText>
            </ThemedView>

            {error && (
              <ThemedView style={styles.errorBox}>
                <ThemedText type="small" style={styles.errorText}>{error}</ThemedText>
              </ThemedView>
            )}

            <ThemedView style={styles.form}>
              <ThemedText type="small" style={styles.label}>First Name *</ThemedText>
              <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="John" placeholderTextColor="#999" />

              <ThemedText type="small" style={styles.label}>Last Name</ThemedText>
              <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Doe" placeholderTextColor="#999" />

              <ThemedText type="small" style={styles.label}>Email *</ThemedText>
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

              <ThemedText type="small" style={styles.label}>Phone</ThemedText>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+256 700 000 000"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />

              <ThemedText type="small" style={styles.label}>Password * (min 8 chars)</ThemedText>
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
                onPress={handleRegister}
                disabled={loading}
              >
                <ThemedText type="default" style={styles.btnText}>
                  {loading ? 'Creating account…' : 'Sign Up'}
                </ThemedText>
              </Pressable>
            </ThemedView>

            <ThemedView style={styles.footer}>
              <ThemedText type="small">Already have an account? </ThemedText>
              <Link href="/(auth)/login" asChild>
                <Pressable>
                  <ThemedText type="small" style={styles.link}>Sign in</ThemedText>
                </Pressable>
              </Link>
            </ThemedView>
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
  scroll: { padding: Spacing.four, flexGrow: 1 },
  header: { alignItems: 'center', marginBottom: Spacing.three },
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
});
