import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useAuth } from '@/context/AuthContext';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { apiRequest } from '@/services/api';
import { toggleTwoFactor } from '@/services/auth';
import {
  authenticateWithBiometrics,
  disableBiometric,
  getBiometricCredentials,
  getBiometricType,
  isBiometricAvailable,
  isBiometricEnabled,
  setBiometricEnabled,
} from '@/services/biometric';
import { isSoundEnabled, playSound, setSoundEnabled, Sounds } from '@/services/sound';

export default function PrivacyScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, refreshUser } = useAuth();

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [loading, setLoading] = useState(true);

  // 2FA
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.two_factor_enabled || false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState<Array<{
    notification_type: string; label: string;
    in_app_enabled: boolean; email_enabled: boolean; push_enabled: boolean;
  }>>([]);
  const [notifLoading, setNotifLoading] = useState(true);

  const loadNotifPrefs = useCallback(async () => {
    try {
      setNotifLoading(true);
      const data = await apiRequest<{ preferences: any[] }>({
        method: 'GET', url: '/notifications/preferences/',
      });
      setNotifPrefs(data.preferences || []);
    } catch (e) {
      // Non-critical — preferences just won't be editable
    } finally {
      setNotifLoading(false);
    }
  }, []);

  const toggleNotif = useCallback(async (ntype: string, channel: string) => {
    setNotifPrefs((prev) => {
      const updated = prev.map((p) => {
        if (p.notification_type !== ntype) return p;
        return { ...p, [channel]: !p[channel as keyof typeof p] };
      });
      // Fire-and-forget save
      const changed = updated.find((p) => p.notification_type === ntype);
      if (changed) {
        apiRequest({
          method: 'PUT', url: '/notifications/preferences/',
          data: { preferences: [changed] },
        }).catch(() => { });
      }
      return updated;
    });
  }, []);

  useEffect(() => {
    loadNotifPrefs();
  }, [loadNotifPrefs]);

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
      // Load sound preference
      setSoundEnabledState(isSoundEnabled());
    } catch {
      setBiometricAvailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSoundToggle = async (value: boolean) => {
    setSoundEnabledState(value);
    await setSoundEnabled(value);
    if (value) playSound(Sounds.SUCCESS);
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
          // Check if credentials are already stored (from login screen)
          const credentials = await getBiometricCredentials();
          if (credentials) {
            // Credentials already stored — just enable the flag
            await setBiometricEnabled(true);
            setBiometricEnabledState(true);
            Alert.alert(
              `${biometricType} Enabled`,
              `You can now sign in with ${biometricType} on the login screen.`,
            );
          } else {
            // No stored credentials — user needs to log in first
            Alert.alert(
              'Sign In Required',
              `Please sign in with your email and password first, then enable ${biometricType} from the login prompt to save your credentials securely.`,
              [{ text: 'OK' }],
            );
          }
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
        await disableBiometric();
        setBiometricEnabledState(false);
        Alert.alert(
          `${biometricType} Disabled`,
          'Your saved credentials have been removed. You will need to sign in with email and password.',
        );
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Failed to disable biometric auth');
      }
    }
  };

  const handleTerms = () => {
    Linking.openURL('https://diilzo.com/terms').catch(() => {
      Alert.alert('Error', 'Could not open Terms of Service');
    });
  };

  const handleTwoFactorToggle = async (value: boolean) => {
    // Prompt for password to confirm the change
    Alert.alert(
      value ? 'Enable Two-Factor Authentication' : 'Disable Two-Factor Authentication',
      value
        ? 'When enabled, a 6-digit code will be sent to your email on every login.'
        : 'Are you sure you want to disable 2FA? Your account will be less secure.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            Alert.prompt(
              'Enter Password',
              `Enter your password to ${value ? 'enable' : 'disable'} 2FA`,
              async (password) => {
                if (!password) return;
                setTwoFactorLoading(true);
                try {
                  const result = await toggleTwoFactor(value, password);
                  setTwoFactorEnabled(result.two_factor_enabled);
                  await refreshUser();
                  Alert.alert('Success', result.detail);
                } catch (e: any) {
                  Alert.alert('Error', e?.response?.data?.detail || e?.message || 'Failed to update 2FA');
                } finally {
                  setTwoFactorLoading(false);
                }
              },
              'secure-text',
            );
          },
        },
      ]
    );
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
                        trackColor={{ false: colors.border, true: Brand.primary }}
                        thumbColor="#FFFFFF"
                      />
                    )}
                  </View>

                  {/* Sound effects */}
                  <View style={styles.settingRow}>
                    <View style={[styles.settingIcon, { backgroundColor: '#F59E0B20' }]}>
                      <MaterialCommunityIcons name="volume-high" size={22} color="#F59E0B" />
                    </View>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>Sound Effects</Text>
                      <Text style={styles.settingSublabel}>
                        Play sounds for taps, notifications, and actions
                      </Text>
                    </View>
                    <Switch
                      value={soundEnabled}
                      onValueChange={handleSoundToggle}
                      trackColor={{ false: colors.border, true: Brand.primary }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  <View style={styles.rowDivider} />

                  {/* Two-Factor Authentication */}
                  <View style={styles.settingRow}>
                    <View style={[styles.settingIcon, { backgroundColor: Brand.primary + '20' }]}>
                      <MaterialCommunityIcons
                        name={twoFactorEnabled ? 'shield-check' : 'shield-outline'}
                        size={22}
                        color={Brand.primary}
                      />
                    </View>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>Two-Factor Authentication</Text>
                      <Text style={styles.settingSublabel}>
                        {twoFactorEnabled
                          ? 'A 6-digit code is sent to your email on every login'
                          : 'Add an extra layer of security with email OTP'}
                      </Text>
                    </View>
                    {twoFactorLoading ? (
                      <ActivityIndicator size="small" color={Brand.primary} />
                    ) : (
                      <Switch
                        value={twoFactorEnabled}
                        onValueChange={handleTwoFactorToggle}
                        trackColor={{ false: colors.border, true: Brand.primary }}
                        thumbColor="#FFFFFF"
                      />
                    )}
                  </View>
                </View>
              </View>

              {/* Notification preferences section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notifications</Text>
                <Text style={styles.sectionSub}>
                  Choose which notifications you receive on each channel.
                </Text>
                {notifLoading ? (
                  <View style={styles.loadingWrap}><ActivityIndicator size="small" color={Brand.primary} /></View>
                ) : (
                  <View style={styles.card}>
                    {notifPrefs.map((pref, idx) => (
                      <View key={pref.notification_type}>
                        {idx > 0 && <View style={styles.rowDivider} />}
                        <View style={styles.notifTypeRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.settingLabel}>{pref.label}</Text>
                            <View style={styles.notifChannels}>
                              <Pressable
                                style={styles.notifChannelChip}
                                onPress={() => toggleNotif(pref.notification_type, 'in_app_enabled')}
                              >
                                <MaterialCommunityIcons
                                  name={pref.in_app_enabled ? 'bell' : 'bell-off'}
                                  size={14}
                                  color={pref.in_app_enabled ? Brand.primary : colors.textTertiary}
                                />
                                <Text style={[styles.notifChannelText, { color: pref.in_app_enabled ? Brand.primary : colors.textTertiary }]}>App</Text>
                              </Pressable>
                              <Pressable
                                style={styles.notifChannelChip}
                                onPress={() => toggleNotif(pref.notification_type, 'email_enabled')}
                              >
                                <MaterialCommunityIcons
                                  name={pref.email_enabled ? 'email' : 'email-off'}
                                  size={14}
                                  color={pref.email_enabled ? Brand.primary : colors.textTertiary}
                                />
                                <Text style={[styles.notifChannelText, { color: pref.email_enabled ? Brand.primary : colors.textTertiary }]}>Email</Text>
                              </Pressable>
                              <Pressable
                                style={styles.notifChannelChip}
                                onPress={() => toggleNotif(pref.notification_type, 'push_enabled')}
                              >
                                <MaterialCommunityIcons
                                  name={pref.push_enabled ? 'cellphone' : 'cellphone-off'}
                                  size={14}
                                  color={pref.push_enabled ? Brand.primary : colors.textTertiary}
                                />
                                <Text style={[styles.notifChannelText, { color: pref.push_enabled ? Brand.primary : colors.textTertiary }]}>Push</Text>
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Data privacy section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Data & Privacy</Text>
                <View style={styles.card}>
                  <Pressable
                    style={({ pressed }) => [styles.linkRow, pressed && { backgroundColor: colors.surfaceAlt }]}
                    onPress={handlePrivacyPolicy}
                  >
                    <View style={[styles.settingIcon, { backgroundColor: '#06B6D4' + '20' }]}>
                      <MaterialCommunityIcons name="file-document-outline" size={22} color="#06B6D4" />
                    </View>
                    <Text style={styles.linkLabel}>Privacy Policy</Text>
                    <MaterialCommunityIcons name="open-in-new" size={20} color={colors.textTertiary} />
                  </Pressable>

                  <View style={styles.rowDivider} />

                  <Pressable
                    style={({ pressed }) => [styles.linkRow, pressed && { backgroundColor: colors.surfaceAlt }]}
                    onPress={handleTerms}
                  >
                    <View style={[styles.settingIcon, { backgroundColor: '#3B82F6' + '20' }]}>
                      <MaterialCommunityIcons name="file-find-outline" size={22} color="#3B82F6" />
                    </View>
                    <Text style={styles.linkLabel}>Terms of Service</Text>
                    <MaterialCommunityIcons name="open-in-new" size={20} color={colors.textTertiary} />
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
                    style={({ pressed }) => [styles.linkRow, pressed && { backgroundColor: colors.surfaceAlt }]}
                    onPress={handleDeleteData}
                  >
                    <View style={[styles.settingIcon, { backgroundColor: Brand.danger + '20' }]}>
                      <MaterialCommunityIcons name="trash-can-outline" size={22} color={Brand.danger} />
                    </View>
                    <Text style={[styles.linkLabel, { color: Brand.danger }]}>
                      Delete Account Data
                    </Text>
                    <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textTertiary} />
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

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
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
  sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: Spacing.two },
  card: {
    backgroundColor: c.surface,
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
  settingLabel: { fontSize: 15, fontWeight: '600', color: c.text },
  settingSublabel: { fontSize: 13, color: c.textSecondary },
  rowDivider: { height: 1, backgroundColor: c.borderLight, marginLeft: 60 },

  // Link rows
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    padding: Spacing.three,
  },
  linkLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: c.text },

  // Info card
  infoCard: {
    flexDirection: 'row',
    gap: Spacing.three - 4,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  infoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: c.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: { flex: 1, gap: 4 },
  infoTitle: { fontSize: 15, fontWeight: '700', color: c.text },
  infoText: { fontSize: 13, color: c.textSecondary, lineHeight: 20 },

  // Notification preferences
  sectionSub: { fontSize: 13, color: c.textSecondary, marginBottom: Spacing.two },
  notifTypeRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three },
  notifChannels: { flexDirection: 'row', gap: 8, marginTop: 6 },
  notifChannelChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: c.surfaceAlt, borderRadius: 12,
  },
  notifChannelText: { fontSize: 12, fontWeight: '600' },
});
