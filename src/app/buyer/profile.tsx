import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { changePassword, toggleTwoFactor, updateProfileWithAvatar } from '@/services/auth';

export default function ProfileEditScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar_url || null);
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // 2FA
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.two_factor_enabled || false);
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [toggling2FA, setToggling2FA] = useState(false);
  const [show2FAPassword, setShow2FAPassword] = useState(false);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  };

  const handleSaveProfile = async () => {
    if (!firstName.trim()) {
      Alert.alert('Missing field', 'First name is required');
      return;
    }
    try {
      setSaving(true);
      const formData = new FormData();
      formData.append('first_name', firstName.trim());
      formData.append('last_name', lastName.trim());
      formData.append('phone', phone.trim());

      if (avatarUri && !avatarUri.startsWith('http')) {
        formData.append('avatar', {
          uri: avatarUri,
          name: 'avatar.jpg',
          type: 'image/jpeg',
        } as any);
      }

      await updateProfileWithAvatar(formData);
      await refreshUser();
      Alert.alert('Saved', 'Profile updated successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || e?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Missing field', 'Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    try {
      setChangingPassword(true);
      await changePassword(currentPassword, newPassword);
      Alert.alert('Success', 'Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || e?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleToggle2FA = async () => {
    if (!twoFactorPassword) {
      Alert.alert('Missing field', 'Please enter your password to confirm');
      return;
    }
    try {
      setToggling2FA(true);
      const result = await toggleTwoFactor(!twoFactorEnabled, twoFactorPassword);
      setTwoFactorEnabled(result.two_factor_enabled);
      setTwoFactorPassword('');
      setShow2FAPassword(false);
      Alert.alert('Success', result.detail);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || e?.message || 'Failed to update 2FA');
    } finally {
      setToggling2FA(false);
    }
  };

  return (
    <View style={styles.screen}>
      <GradientHeader title="Edit Profile" subtitle="Update your information" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.body}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Avatar ────────────────────────────────────────────── */}
          <View style={styles.avatarSection}>
            <Pressable onPress={pickAvatar} style={styles.avatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} resizeMode="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <MaterialCommunityIcons name="account" size={48} color="#FFFFFF" />
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <MaterialCommunityIcons name="camera" size={16} color="#FFFFFF" />
              </View>
            </Pressable>
            <Text style={styles.avatarHint}>Tap to change profile picture</Text>
          </View>

          {/* ── Profile fields ────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Personal Information</Text>

            <Text style={styles.fieldLabel}>First Name</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.fieldLabel}>Last Name</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.fieldLabel}>Email (read-only)</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={user?.email || ''}
              editable={false}
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. +256 700 000 000"
              placeholderTextColor={colors.textTertiary}
              keyboardType="phone-pad"
            />

            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </Pressable>
          </View>

          {/* ── Change password ────────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.passwordHeader}>
              <Text style={styles.cardTitle}>Change Password</Text>
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Current Password</Text>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>New Password</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter new password"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />

            <Pressable
              style={({ pressed }) => [styles.saveBtn, styles.passwordBtn, pressed && { opacity: 0.85 }]}
              onPress={handleChangePassword}
              disabled={changingPassword}
            >
              {changingPassword ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Update Password</Text>
              )}
            </Pressable>
          </View>

          {/* ── Two-Factor Authentication (2FA) ─────────────────────── */}
          <View style={styles.card}>
            <View style={styles.passwordHeader}>
              <Text style={styles.cardTitle}>Two-Factor Authentication</Text>
              <MaterialCommunityIcons
                name={twoFactorEnabled ? 'shield-check' : 'shield-outline'}
                size={22}
                color={twoFactorEnabled ? Brand.primary : colors.textTertiary}
              />
            </View>

            <View style={styles.twoFactorStatusRow}>
              <View style={styles.twoFactorStatusInfo}>
                <Text style={styles.twoFactorStatusText}>
                  {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                </Text>
                <Text style={styles.twoFactorStatusSub}>
                  {twoFactorEnabled
                    ? 'A 6-digit code is sent to your email on every login.'
                    : 'Add an extra layer of security. When enabled, a 6-digit code is sent to your email on every login.'}
                </Text>
              </View>
              <View style={[styles.twoFactorBadge, twoFactorEnabled ? styles.twoFactorBadgeOn : styles.twoFactorBadgeOff]}>
                <Text style={styles.twoFactorBadgeText}>
                  {twoFactorEnabled ? 'ON' : 'OFF'}
                </Text>
              </View>
            </View>

            <Text style={styles.fieldLabel}>
              Password (required to {twoFactorEnabled ? 'disable' : 'enable'})
            </Text>
            <View style={styles.passwordInputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={twoFactorPassword}
                onChangeText={setTwoFactorPassword}
                placeholder="Enter your password"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry={!show2FAPassword}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShow2FAPassword(!show2FAPassword)} hitSlop={8} style={styles.eyeBtn}>
                <MaterialCommunityIcons
                  name={show2FAPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                twoFactorEnabled ? styles.disableBtn : styles.passwordBtn,
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleToggle2FA}
              disabled={toggling2FA}
            >
              {toggling2FA ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  body: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // ── Avatar ──────────────────────────────────────────────────────
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 110, height: 110, borderRadius: 55 },
  avatarFallback: {
    backgroundColor: Brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Brand.dark,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: c.surface,
  },
  avatarHint: { marginTop: 10, fontSize: 13, color: c.textTertiary, fontWeight: '500' },

  // ── Card ────────────────────────────────────────────────────────
  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: c.text, marginBottom: 16 },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  // ── Form ────────────────────────────────────────────────────────
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: c.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: c.text,
  },
  inputDisabled: {
    backgroundColor: c.surfaceAlt,
    opacity: 0.6,
  },

  // ── Buttons ─────────────────────────────────────────────────────
  saveBtn: {
    backgroundColor: Brand.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  passwordBtn: { backgroundColor: Brand.dark },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // ── 2FA ──────────────────────────────────────────────────────────
  twoFactorStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  twoFactorStatusInfo: { flex: 1 },
  twoFactorStatusText: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
    marginBottom: 4,
  },
  twoFactorStatusSub: {
    fontSize: 13,
    color: c.textSecondary,
    lineHeight: 18,
  },
  twoFactorBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  twoFactorBadgeOn: { backgroundColor: 'rgba(22,163,74,0.12)' },
  twoFactorBadgeOff: { backgroundColor: c.surfaceAlt },
  twoFactorBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Brand.primary,
  },
  passwordInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyeBtn: { padding: 4 },
  disableBtn: { backgroundColor: Brand.danger },
});
