import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import {
  getStaffDetail,
  getStaffRoles,
  removeStaff,
  updateStaff,
  type PlatformStaffRole,
  type StaffDetail,
} from '@/services/adminApi';

const DEPARTMENTS: { code: string; label: string }[] = [
  { code: 'support', label: 'Customer Support' },
  { code: 'finance', label: 'Finance' },
  { code: 'operations', label: 'Operations' },
  { code: 'engineering', label: 'Engineering' },
  { code: 'legal', label: 'Legal & Compliance' },
  { code: 'executive', label: 'Executive' },
];

const PERMISSION_LABELS: { key: string; label: string }[] = [
  { key: 'can_review_kyc', label: 'Review KYC' },
  { key: 'can_manage_payouts', label: 'Manage Payouts' },
  { key: 'can_moderate_products', label: 'Moderate Products' },
  { key: 'can_resolve_disputes', label: 'Resolve Disputes' },
  { key: 'can_manage_stores', label: 'Manage Stores' },
  { key: 'can_view_finances', label: 'View Finances' },
  { key: 'can_manage_users', label: 'Manage Users' },
  { key: 'can_manage_announcements', label: 'Announcements' },
  { key: 'can_handle_support_chats', label: 'Support Chats' },
  { key: 'can_manage_slides', label: 'Manage Slides' },
  { key: 'can_manage_currencies', label: 'Currencies' },
  { key: 'can_manage_staff', label: 'Manage Staff' },
];

export default function AdminStaffDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [staff, setStaff] = useState<StaffDetail | null>(null);
  const [roles, setRoles] = useState<PlatformStaffRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedDept, setSelectedDept] = useState('support');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const [detail, rolesData] = await Promise.all([
        getStaffDetail(Number(id)),
        getStaffRoles(),
      ]);
      setStaff(detail);
      setRoles(rolesData);
      setSelectedRoleId(detail.role_id);
      setSelectedDept(detail.department);
      setIsActive(detail.is_active_staff);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load staff detail');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateStaff(Number(id), {
        role_id: selectedRoleId || undefined,
        department: selectedDept,
        is_active_staff: isActive,
      });
      Alert.alert('Saved', 'Staff member updated successfully.');
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update staff member');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = () => {
    Alert.alert(
      'Remove Staff Member',
      `Are you sure you want to remove ${staff?.email}? This will revoke their staff access.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeStaff(Number(id));
              Alert.alert('Removed', 'Staff member has been removed.');
              router.back();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to remove staff member');
            }
          },
        },
      ],
    );
  };

  const getDeptLabel = (code: string) =>
    DEPARTMENTS.find((d) => d.code === code)?.label || code;

  if (loading) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Staff Detail" />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      </View>
    );
  }

  if (!staff) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Staff Detail" />
        <View style={styles.centerBody}>
          <Text style={styles.errorText}>Staff member not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ModernHeader title="Staff Detail" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} />}
      >
        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <MaterialCommunityIcons name="account" size={32} color="#FFFFFF" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{staff.full_name || staff.email}</Text>
              <Text style={styles.profileEmail}>{staff.email}</Text>
              {staff.phone ? <Text style={styles.profilePhone}>{staff.phone}</Text> : null}
            </View>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Department</Text>
              <Text style={styles.infoValue}>{getDeptLabel(staff.department)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Employee ID</Text>
              <Text style={styles.infoValue}>{staff.employee_id || '—'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Country</Text>
              <Text style={styles.infoValue}>{staff.country || '—'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>City</Text>
              <Text style={styles.infoValue}>{staff.city || '—'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Hired</Text>
              <Text style={styles.infoValue}>{staff.hired_at ? new Date(staff.hired_at).toLocaleDateString() : '—'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={[styles.infoValue, { color: staff.is_active_staff ? Brand.success : Brand.danger }]}>
                {staff.is_active_staff ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        </View>

        {/* Permissions Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Permissions</Text>
          {staff.permissions && Object.keys(staff.permissions).length > 0 ? (
            <View style={styles.permGrid}>
              {PERMISSION_LABELS.map(({ key, label }) => (
                <View key={key} style={[styles.permChip, staff.permissions[key] ? styles.permChipOn : styles.permChipOff]}>
                  <MaterialCommunityIcons
                    name={staff.permissions[key] ? 'check-circle' : 'circle-outline'}
                    size={14}
                    color={staff.permissions[key] ? Brand.success : Brand.textTertiary}
                  />
                  <Text style={[styles.permText, { color: staff.permissions[key] ? Brand.success : Brand.textTertiary }]}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No role assigned — no permissions.</Text>
          )}
        </View>

        {/* Edit Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Edit Role & Department</Text>

          <Text style={styles.inputLabel}>Role</Text>
          <View style={styles.pickerRow}>
            <Pressable
              style={[styles.pickerChip, selectedRoleId === null && styles.pickerChipActive]}
              onPress={() => setSelectedRoleId(null)}
            >
              <Text style={[styles.pickerText, selectedRoleId === null && styles.pickerTextActive]}>No role</Text>
            </Pressable>
            {roles.map((r) => (
              <Pressable
                key={r.id}
                style={[styles.pickerChip, selectedRoleId === r.id && styles.pickerChipActive]}
                onPress={() => setSelectedRoleId(r.id)}
              >
                <Text style={[styles.pickerText, selectedRoleId === r.id && styles.pickerTextActive]}>
                  {r.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.inputLabel}>Department</Text>
          <View style={styles.pickerRow}>
            {DEPARTMENTS.map((d) => (
              <Pressable
                key={d.code}
                style={[styles.pickerChip, selectedDept === d.code && styles.pickerChipActive]}
                onPress={() => setSelectedDept(d.code)}
              >
                <Text style={[styles.pickerText, selectedDept === d.code && styles.pickerTextActive]}>
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.toggleRow, isActive && styles.toggleRowActive]}
            onPress={() => setIsActive(!isActive)}
          >
            <MaterialCommunityIcons name={isActive ? 'toggle-switch' : 'toggle-switch-off'} size={28} color={isActive ? Brand.success : Brand.textTertiary} />
            <Text style={styles.toggleText}>{isActive ? 'Active staff member' : 'Inactive staff member'}</Text>
          </Pressable>

          <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </Pressable>

          {!staff.is_superuser && (
            <Pressable style={styles.removeBtn} onPress={handleRemove}>
              <MaterialCommunityIcons name="account-remove" size={16} color={Brand.danger} />
              <Text style={styles.removeBtnText}>Remove from Staff</Text>
            </Pressable>
          )}
        </View>

        {/* Activity Log Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Activity Log</Text>
          {staff.activity.length > 0 ? (
            staff.activity.map((a) => (
              <View key={a.id} style={styles.activityRow}>
                <View style={styles.activityIcon}>
                  <MaterialCommunityIcons name="history" size={14} color={Brand.textTertiary} />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityAction}>{a.description || a.action}</Text>
                  <Text style={styles.activityTime}>
                    {new Date(a.created_at).toLocaleString()} · {a.target_type} #{a.target_id}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No activity recorded yet.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 14, color: Brand.textTertiary },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { backgroundColor: Brand.surface, borderRadius: 12, padding: 16, gap: 12, borderWidth: 1, borderColor: Brand.border },
  cardTitle: { fontSize: 13, fontWeight: '800', color: Brand.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  // Profile
  profileHeader: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 8 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Brand.primary, justifyContent: 'center', alignItems: 'center' },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { fontSize: 16, fontWeight: '700', color: Brand.text },
  profileEmail: { fontSize: 13, color: Brand.textSecondary },
  profilePhone: { fontSize: 12, color: Brand.textTertiary },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  infoItem: { width: '48%' },
  infoLabel: { fontSize: 10, fontWeight: '600', color: Brand.textTertiary, textTransform: 'uppercase' },
  infoValue: { fontSize: 13, color: Brand.text, marginTop: 2 },
  // Permissions
  permGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  permChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  permChipOn: { backgroundColor: Brand.success + '15' },
  permChipOff: { backgroundColor: Brand.surfaceAlt },
  permText: { fontSize: 11, fontWeight: '500' },
  // Edit
  inputLabel: { fontSize: 12, fontWeight: '600', color: Brand.textSecondary, marginTop: 4 },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  pickerChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Brand.border },
  pickerChipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  pickerText: { fontSize: 11, color: Brand.textSecondary },
  pickerTextActive: { color: '#FFFFFF', fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  toggleRowActive: {},
  toggleText: { fontSize: 13, color: Brand.text },
  saveBtn: { backgroundColor: Brand.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, justifyContent: 'center', marginTop: 4 },
  removeBtnText: { fontSize: 13, fontWeight: '600', color: Brand.danger },
  // Activity
  activityRow: { flexDirection: 'row', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Brand.border },
  activityIcon: { width: 24, alignItems: 'center' },
  activityInfo: { flex: 1, gap: 2 },
  activityAction: { fontSize: 12, color: Brand.text },
  activityTime: { fontSize: 10, color: Brand.textTertiary },
  emptyText: { fontSize: 12, color: Brand.textTertiary, textAlign: 'center', paddingVertical: 16 },
});
