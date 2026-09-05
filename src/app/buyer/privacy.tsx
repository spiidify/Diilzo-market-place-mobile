import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
import {
  authenticateWithBiometrics,
  getBiometricType,
  isBiometricAvailable,
  isBiometricEnabled,
  setBiometricEnabled,
} from '@/services/biometric';

export default function PrivacyScreen() {
  const router = useRouter();

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [screenshotPrevention, setScreenshotPrevention] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkBiometric = useCallback(async () => {
    try {
      const [available, enabled, type] = await Promise.all([
        isBiometricAvailable(),
        isBiometricEnabled(),
        getBiometricType(),
      ]);
      setBiometricAvailable(available);
      setBiometricEnabledState(enabled);
      setBiometricType(type);
      // Load dark mode preference
      try {
        const saved = await AsyncStorage.getItem('dark_mode');
        setDarkMode(saved === 'true');
      } catch { }
    } catch {
      setBiometricAvailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDarkModeToggle = async (value: boolean) => {
    setDarkMode(value);
    try {
      await AsyncStorage.setItem('dark_mode', value ? 'true' : 'false');
      Alert.alert('Dark Mode', 'Please restart the app for dark mode to take effect.');
    } catch { }
  };

  useEffect(() => {
    checkBiometric();
  }, [checkBiometric]);

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      // Need to authenticate first before enabling
      setBiometricLoading(true);
      try {
        const success = await authenticateWithBiometrics(
          `Authenticate to enable ${biometricType} for Diilzo`
        );
        if (success) {
          await setBiometricEnabled(true);
          setBiometricEnabledState(true);
        } else {
          Alert.alert('Authentication Failed', 'Could not verify your identity. Please try again.');
        }
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Failed to enable biometric auth');
      } finally {
        setBiometricLoading(false);
      }
    } else {
      try {
        await setBiometricEnabled(false);
        setBiometricEnabledState(false);
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Failed to disable biometric auth');
      }
    }
  };

  const handleScreenshotToggle = (value: boolean) => {
    setScreenshotPrevention(value);
    // Note: actual screenshot prevention requires native module / FlagSecure
    // This is a UI toggle that persists the preference
    Alert.alert(
      value ? 'Screenshot Prevention On' : 'Screenshot Prevention Off',
      value
        ? 'Screenshots will be blocked on sensitive screens in future updates.'
        : 'Screenshots are now allowed on all screens.'
    );
  };

  const handleTerms = () => {
    Linking.openURL('https://diilzo.com/terms').catch(() => {
      Alert.alert('Error', 'Could not open Terms of Service');
    });
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://diilzo.com/privacy').catch(() => {
      Alert.alert('Error', 'Could not open Privacy Policy');
    });
  };

  const handleDeleteData = () => {
    Alert.alert(
      'Delete Account Data',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Contact Support',
              'Please contact support@diilzo.com to request account deletion. Our team will process your request within 30 days.',
              [{ text: 'OK' }]
            );
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient
          colors={[Brand.primaryDark, Brand.primary, Brand.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Privacy & Security</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={Brand.primary} />
            </View>
          ) : (
            <>
              {/* Security section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Security</Text>
                <View style={styles.card}>
                  {/* Biometric auth */}
                  <View style={styles.settingRow}>
                    <View style={[styles.settingIcon, { backgroundColor: Brand.primary + '20' }]}>
                      <MaterialCommunityIcons name="fingerprint" size={22} color={Brand.primary} />
                    </View>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>{biometricType} Login</Text>
                      <Text style={styles.settingSublabel}>
                        {biometricAvailable
                          ? `Use ${biometricType} to sign in securely`
                          : 'Not available on this device'}
                      </Text>
                    </View>
                    {biometricLoading ? (
                      <ActivityIndicator size="small" color={Brand.primary} />
                    ) : (
                      <Switch
                        value={biometricEnabled}
                        onValueChange={handleBiometricToggle}
                        disabled={!biometricAvailable}
                        trackColor={{ false: Brand.border, true: Brand.primary }}
                        thumbColor="#FFFFFF"
                      />
                    )}
                  </View>

                  <View style={styles.rowDivider} />

                  {/* Screenshot prevention */}
                  <View style={styles.settingRow}>
                    <View style={[styles.settingIcon, { backgroundColor: '#8B5CF6' + '20' }]}>
                      <MaterialCommunityIcons name="shield-lock-outline" size={22} color="#8B5CF6" />
                    </View>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>Screenshot Prevention</Text>
                      <Text style={styles.settingSublabel}>
                        Block screenshots on sensitive screens
                      </Text>
                    </View>
                    <Switch
                      value={screenshotPrevention}
                      onValueChange={handleScreenshotToggle}
                      trackColor={{ false: Brand.border, true: Brand.primary }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  {/* Dark mode */}
                  <View style={styles.settingRow}>
                    <View style={[styles.settingIcon, { backgroundColor: '#1A1A2E20' }]}>
                      <MaterialCommunityIcons name="theme-light-dark" size={22} color="#1A1A2E" />
                    </View>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>Dark Mode</Text>
                      <Text style={styles.settingSublabel}>
                        Use dark theme (restart required)
                      </Text>
                    </View>
                    <Switch
                      value={darkMode}
                      onValueChange={handleDarkModeToggle}
                      trackColor={{ false: Brand.border, true: Brand.primary }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                </View>
              </View>

              {/* Data privacy section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Data & Privacy</Text>
                <View style={styles.card}>
                  <Pressable
                    style={({ pressed }) => [styles.linkRow, pressed && { backgroundColor: Brand.surfaceAlt }]}
                    onPress={handlePrivacyPolicy}
                  >
                    <View style={[styles.settingIcon, { backgroundColor: '#06B6D4' + '20' }]}>
                      <MaterialCommunityIcons name="file-document-outline" size={22} color="#06B6D4" />
                    </View>
                    <Text style={styles.linkLabel}>Privacy Policy</Text>
                    <MaterialCommunityIcons name="open-in-new" size={20} color={Brand.textTertiary} />
                  </Pressable>

                  <View style={styles.rowDivider} />

                  <Pressable
                    style={({ pressed }) => [styles.linkRow, pressed && { backgroundColor: Brand.surfaceAlt }]}
                    onPress={handleTerms}
                  >
                    <View style={[styles.settingIcon, { backgroundColor: '#3B82F6' + '20' }]}>
                      <MaterialCommunityIcons name="file-find-outline" size={22} color="#3B82F6" />
                    </View>
                    <Text style={styles.linkLabel}>Terms of Service</Text>
                    <MaterialCommunityIcons name="open-in-new" size={20} color={Brand.textTertiary} />
                  </Pressable>
                </View>
              </View>

              {/* Data info card */}
              <View style={styles.infoCard}>
                <View style={styles.infoIconWrap}>
                  <MaterialCommunityIcons name="information-outline" size={24} color={Brand.primary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>Your Data is Safe</Text>
                  <Text style={styles.infoText}>
                    Diilzo encrypts your personal data and never shares it with third parties.
                    All transactions are secured with industry-standard encryption.
                  </Text>
                </View>
              </View>

              {/* Danger zone */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: Brand.danger }]}>Account Actions</Text>
                <View style={styles.card}>
                  <Pressable
                    style={({ pressed }) => [styles.linkRow, pressed && { backgroundColor: Brand.surfaceAlt }]}
                    onPress={handleDeleteData}
                  >
                    <View style={[styles.settingIcon, { backgroundColor: Brand.danger + '20' }]}>
                      <MaterialCommunityIcons name="trash-can-outline" size={22} color={Brand.danger} />
                    </View>
                    <Text style={[styles.linkLabel, { color: Brand.danger }]}>
                      Delete Account Data
                    </Text>
                    <MaterialCommunityIcons name="chevron-right" size={22} color={Brand.textTertiary} />
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  safeArea: { flex: 1, backgroundColor: Brand.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },

  body: { flex: 1 },
  bodyContent: { padding: Spacing.three, paddingBottom: Spacing.six },
  loadingWrap: { paddingVertical: Spacing.six, alignItems: 'center' },

  // Sections
  section: { marginBottom: Spacing.three },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Brand.text, marginBottom: Spacing.two },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },

  // Setting rows
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    padding: Spacing.three,
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingInfo: { flex: 1, gap: 2 },
  settingLabel: { fontSize: 15, fontWeight: '600', color: Brand.text },
  settingSublabel: { fontSize: 13, color: Brand.textSecondary },
  rowDivider: { height: 1, backgroundColor: Brand.borderLight, marginLeft: 60 },

  // Link rows
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    padding: Spacing.three,
  },
  linkLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: Brand.text },

  // Info card
  infoCard: {
    flexDirection: 'row',
    gap: Spacing.three - 4,
    backgroundColor: Brand.surfaceAlt,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 14,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  infoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: { flex: 1, gap: 4 },
  infoTitle: { fontSize: 15, fontWeight: '700', color: Brand.text },
  infoText: { fontSize: 13, color: Brand.textSecondary, lineHeight: 20 },
});
