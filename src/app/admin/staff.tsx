import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import {
  getPlatformStaff,
  getStaffRoles,
  inviteStaff,
  type PlatformStaffMember,
  type PlatformStaffRole,
} from '@/services/adminApi';

const DEPARTMENTS: { code: string; label: string }[] = [
  { code: 'support', label: 'Customer Support' },
  { code: 'finance', label: 'Finance' },
  { code: 'operations', label: 'Operations' },
  { code: 'engineering', label: 'Engineering' },
  { code: 'legal', label: 'Legal & Compliance' },
  { code: 'executive', label: 'Executive' },
];

export default function AdminStaffScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [staff, setStaff] = useState<PlatformStaffMember[]>([]);
  const [roles, setRoles] = useState<PlatformStaffRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDept, setInviteDept] = useState('support');
  const [inviteRoleId, setInviteRoleId] = useState<number | null>(null);
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const [staffData, rolesData] = await Promise.all([getPlatformStaff(), getStaffRoles()]);
      setStaff(staffData);
      setRoles(rolesData);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load staff');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Error', 'Email is required');
      return;
    }
    try {
      setInviting(true);
      const res = await inviteStaff({
        email: inviteEmail.trim().toLowerCase(),
        department: inviteDept,
        role_id: inviteRoleId || undefined,
      });
      Alert.alert(
        'Invitation Sent',
        `Share this link with the staff member:\n\n${res.accept_url}\n\nThey can set their password and activate their account.`,
      );
      setShowInvite(false);
      setInviteEmail('');
      setInviteDept('support');
      setInviteRoleId(null);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const getDeptLabel = (code: string) =>
    DEPARTMENTS.find((d) => d.code === code)?.label || code;

  const renderItem = ({ item }: { item: PlatformStaffMember }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      onPress={() => router.push(`/admin/staff/${item.id}` as any)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatarWrap}>
          {item.avatar_url ? (
            <View style={styles.avatarFallback}>
              <MaterialCommunityIcons name="account" size={22} color="#FFFFFF" />
            </View>
          ) : (
            <View style={styles.avatarFallback}>
              <MaterialCommunityIcons name="account" size={22} color="#FFFFFF" />
            </View>
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
          <Text style={styles.name} numberOfLines={1}>{item.full_name || '—'}</Text>
          <View style={styles.badgeRow}>
            {item.is_superuser && (
              <View style={[styles.badge, { backgroundColor: '#8B5CF620' }]}>
                <Text style={[styles.badgeText, { color: '#8B5CF6' }]}>Superuser</Text>
              </View>
            )}
            {item.role_name && (
              <View style={[styles.badge, { backgroundColor: Brand.accent + '20' }]}>
                <Text style={[styles.badgeText, { color: Brand.accent }]}>{item.role_name}</Text>
              </View>
            )}
            <View style={[styles.badge, { backgroundColor: '#3B82F620' }]}>
              <Text style={[styles.badgeText, { color: '#3B82F6' }]}>{getDeptLabel(item.department)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.statusCol}>
          {item.is_active_staff ? (
            <View style={[styles.statusBadge, { backgroundColor: Brand.success + '20' }]}>
              <Text style={[styles.statusText, { color: Brand.success }]}>Active</Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: Brand.danger + '20' }]}>
              <Text style={[styles.statusText, { color: Brand.danger }]}>Inactive</Text>
            </View>
          )}
          <Text style={styles.onlineText}>
            {item.is_online ? '● Online' : '○ Offline'}
          </Text>
        </View>
      </View>
      <View style={styles.locationRow}>
        <MaterialCommunityIcons name="map-marker" size={14} color={colors.textTertiary} />
        <Text style={styles.locationText}>
          {item.country || '—'}{item.city ? `, ${item.city}` : ''}
        </Text>
        {item.employee_id ? (
          <>
            <MaterialCommunityIcons name="badge-account" size={14} color={colors.textTertiary} style={{ marginLeft: 12 }} />
            <Text style={styles.locationText}>{item.employee_id}</Text>
          </>
        ) : null}
      </View>
    </Pressable>
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Platform Staff" />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ModernHeader
        title="Platform Staff"
        rightIcon="account-plus"
        onRightPress={() => setShowInvite(true)}
      />
      <FlatList
        data={staff}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="account-group" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No staff members yet.</Text>
            <Text style={styles.emptySub}>Tap the + icon to invite your first staff member.</Text>
          </View>
        }
      />

      {/* Invite Modal */}
      <Modal visible={showInvite} animationType="slide" transparent onRequestClose={() => setShowInvite(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Invite Staff Member</Text>
            <Text style={styles.modalSub}>They'll receive an email with a link to set their password and activate their account.</Text>

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="staff@diilzo.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Department</Text>
            <View style={styles.pickerRow}>
              {DEPARTMENTS.map((d) => (
                <Pressable
                  key={d.code}
                  style={[styles.pickerChip, inviteDept === d.code && styles.pickerChipActive]}
                  onPress={() => setInviteDept(d.code)}
                >
                  <Text style={[styles.pickerText, inviteDept === d.code && styles.pickerTextActive]}>
                    {d.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.inputLabel}>Role (optional)</Text>
            <View style={styles.pickerRow}>
              <Pressable
                style={[styles.pickerChip, inviteRoleId === null && styles.pickerChipActive]}
                onPress={() => setInviteRoleId(null)}
              >
                <Text style={[styles.pickerText, inviteRoleId === null && styles.pickerTextActive]}>No role</Text>
              </Pressable>
              {roles.map((r) => (
                <Pressable
                  key={r.id}
                  style={[styles.pickerChip, inviteRoleId === r.id && styles.pickerChipActive]}
                  onPress={() => setInviteRoleId(r.id)}
                >
                  <Text style={[styles.pickerText, inviteRoleId === r.id && styles.pickerTextActive]}>
                    {r.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, styles.modalBtnOutline]} onPress={() => setShowInvite(false)}>
                <Text style={styles.modalBtnTextOutline}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleInvite} disabled={inviting}>
                <Text style={styles.modalBtnTextPrimary}>{inviting ? 'Sending...' : 'Send Invitation'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  cardHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatarWrap: { position: 'relative' },
  avatarFallback: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Brand.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  cardInfo: { flex: 1, gap: 4 },
  email: { fontSize: 14, fontWeight: '700', color: c.text },
  name: { fontSize: 12, color: c.textSecondary },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  statusCol: { alignItems: 'flex-end', gap: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '700' },
  onlineText: { fontSize: 10, color: c.textTertiary },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.border },
  locationText: { fontSize: 11, color: c.textTertiary },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
  emptySub: { fontSize: 12, color: c.textTertiary, textAlign: 'center' },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 16 },
  modalCard: { backgroundColor: c.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400, gap: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: c.text },
  modalSub: { fontSize: 12, color: c.textTertiary, marginBottom: 8 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: c.textSecondary, marginTop: 8 },
  input: {
    borderWidth: 1, borderColor: c.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: c.text,
  },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  pickerChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: c.border },
  pickerChipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  pickerText: { fontSize: 11, color: c.textSecondary },
  pickerTextActive: { color: '#FFFFFF', fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalBtnOutline: { borderWidth: 1, borderColor: c.border },
  modalBtnPrimary: { backgroundColor: Brand.primary },
  modalBtnTextOutline: { fontSize: 14, fontWeight: '600', color: c.text },
  modalBtnTextPrimary: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
});
