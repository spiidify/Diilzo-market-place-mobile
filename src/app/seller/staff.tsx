import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
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
import { useScreenshotPrevention } from '@/hooks/useScreenshotPrevention';
import {
  createStaffRole,
  getStaff,
  getStaffRoles,
  inviteStaff,
  removeStaff,
  updateStaff,
  type SellerStaffMember,
  type SellerStaffRole,
} from '@/services/seller';

export default function SellerStaffScreen() {
  useScreenshotPrevention(true);
  const [staff, setStaff] = useState<SellerStaffMember[]>([]);
  const [roles, setRoles] = useState<SellerStaffRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [userId, setUserId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [inviting, setInviting] = useState(false);

  // Create role modal
  const [showRole, setShowRole] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [roleType, setRoleType] = useState('custom');
  const [creatingRole, setCreatingRole] = useState(false);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const [staffData, rolesData] = await Promise.all([getStaff(), getStaffRoles()]);
      setStaff(staffData);
      setRoles(rolesData);
    } catch (e: any) {
      setError(e?.message || 'Failed to load staff');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleInvite = async () => {
    if (!userId || !Number(userId)) {
      Alert.alert('Validation', 'Enter a valid user ID');
      return;
    }
    setInviting(true);
    try {
      await inviteStaff({ user: Number(userId), role: selectedRoleId || undefined });
      setShowInvite(false);
      setUserId('');
      setSelectedRoleId(null);
      Alert.alert('Success', 'Staff invited');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || e?.message || 'Failed to invite staff');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = (member: SellerStaffMember) => {
    Alert.alert('Remove Staff', `Remove ${member.user_name || member.user_email} from your team?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await removeStaff(member.id);
            setStaff((prev) => prev.filter((s) => s.id !== member.id));
            Alert.alert('Success', 'Staff removed');
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error || e?.message || 'Failed to remove staff');
          }
        },
      },
    ]);
  };

  const handleToggleActive = async (member: SellerStaffMember) => {
    const next = !member.is_active;
    try {
      await updateStaff(member.id, { is_active: next });
      setStaff((prev) => prev.map((s) => (s.id === member.id ? { ...s, is_active: next } : s)));
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || e?.message || 'Failed to update staff');
    }
  };

  const handleCreateRole = async () => {
    if (!roleName.trim()) {
      Alert.alert('Validation', 'Role name is required');
      return;
    }
    setCreatingRole(true);
    try {
      await createStaffRole({ name: roleName.trim(), role_type: roleType });
      setShowRole(false);
      setRoleName('');
      setRoleType('custom');
      Alert.alert('Success', 'Role created');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || e?.message || 'Failed to create role');
    } finally {
      setCreatingRole(false);
    }
  };

  const renderStaff = ({ item }: { item: SellerStaffMember }) => (
    <View style={styles.staffCard}>
      <View style={styles.staffHeader}>
        <View style={[styles.avatar, { backgroundColor: item.is_owner ? Brand.primary + '20' : Brand.surfaceAlt }]}>
          <MaterialCommunityIcons
            name={item.is_owner ? 'crown' : 'account'}
            size={22}
            color={item.is_owner ? Brand.primary : Brand.textSecondary}
          />
        </View>
        <View style={styles.staffInfo}>
          <Text style={styles.staffName} numberOfLines={1}>{item.user_name || 'Unknown'}</Text>
          <Text style={styles.staffEmail} numberOfLines={1}>{item.user_email}</Text>
        </View>
        {item.is_owner ? (
          <View style={[styles.statusBadge, { backgroundColor: Brand.primary + '20' }]}>
            <Text style={[styles.statusText, { color: Brand.primary }]}>Owner</Text>
          </View>
        ) : (
          <View style={[styles.statusBadge, { backgroundColor: item.is_active ? Brand.success + '20' : Brand.danger + '20' }]}>
            <Text style={[styles.statusText, { color: item.is_active ? Brand.success : Brand.danger }]}>
              {item.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.staffMetaRow}>
        <View style={styles.metaCol}>
          <Text style={styles.metaLabel}>Role</Text>
          <Text style={styles.metaValue}>{item.role_name || 'No role'}</Text>
        </View>
        <View style={styles.metaCol}>
          <Text style={styles.metaLabel}>Joined</Text>
          <Text style={styles.metaValue}>
            {item.accepted_at ? new Date(item.accepted_at).toLocaleDateString() : 'Pending'}
          </Text>
        </View>
        {item.has_full_access ? (
          <View style={styles.fullAccessBadge}>
            <MaterialCommunityIcons name="shield-check-outline" size={12} color={Brand.primary} />
            <Text style={styles.fullAccessText}>Full Access</Text>
          </View>
        ) : null}
      </View>

      {!item.is_owner && (
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.toggleBtn, pressed && { opacity: 0.7 }]}
            onPress={() => handleToggleActive(item)}
          >
            <MaterialCommunityIcons
              name={item.is_active ? 'pause-circle-outline' : 'play-circle-outline'}
              size={16}
              color={item.is_active ? Brand.rating : Brand.success}
            />
            <Text style={[styles.toggleText, { color: item.is_active ? Brand.rating : Brand.success }]}>
              {item.is_active ? 'Deactivate' : 'Activate'}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
            onPress={() => handleRemove(item)}
          >
            <MaterialCommunityIcons name="account-remove-outline" size={16} color={Brand.danger} />
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  if (loading && staff.length === 0) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Staff" subtitle="Manage your team" />
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={Brand.primary} />
        </View>
      </View>
    );
  }

  if (error && staff.length === 0) {
    return (
      <View style={styles.screen}>
        <ModernHeader title="Staff" subtitle="Manage your team" />
        <View style={styles.centerBody}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ModernHeader title="Staff" subtitle="Manage your team" />
      <FlatList
        data={staff}
        keyExtractor={(item) => `${item.id}`}
        renderItem={renderStaff}
        maxToRenderPerBatch={10}
        windowSize={11}
        initialNumToRender={10}
        removeClippedSubviews={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            {/* Invite staff button */}
            <Pressable style={({ pressed }) => [styles.inviteBtn, pressed && { opacity: 0.85 }]} onPress={() => setShowInvite(true)}>
              <MaterialCommunityIcons name="account-plus" size={20} color="#FFFFFF" />
              <Text style={styles.inviteBtnText}>Invite Staff</Text>
            </Pressable>

            {/* Roles section */}
            <View style={styles.rolesSection}>
              <View style={styles.rolesHeader}>
                <Text style={styles.sectionTitle}>Roles</Text>
                <Pressable style={styles.createRoleBtn} onPress={() => setShowRole(true)}>
                  <MaterialCommunityIcons name="plus" size={16} color={Brand.primary} />
                  <Text style={styles.createRoleText}>Create Role</Text>
                </Pressable>
              </View>
              {roles.length === 0 ? (
                <Text style={styles.rolesEmpty}>No roles defined</Text>
              ) : (
                roles.map((role) => (
                  <View key={`role-${role.id}`} style={styles.roleCard}>
                    <View style={styles.roleIcon}>
                      <MaterialCommunityIcons name="shield-account-outline" size={18} color={Brand.primary} />
                    </View>
                    <View style={styles.roleInfo}>
                      <Text style={styles.roleName}>{role.name}</Text>
                      <Text style={styles.roleType}>{role.role_type}</Text>
                    </View>
                    {role.can_manage_staff ? (
                      <MaterialCommunityIcons name="shield-check-outline" size={18} color={Brand.success} />
                    ) : null}
                  </View>
                ))
              )}
            </View>

            <Text style={styles.sectionTitle}>Team Members</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.centerBody}>
            <MaterialCommunityIcons name="account-group-outline" size={48} color={Brand.textTertiary} />
            <Text style={styles.emptyText}>No staff members</Text>
            <Text style={styles.emptySubtext}>Invite team members to help manage your store</Text>
          </View>
        }
      />

      {/* Invite staff modal */}
      <Modal visible={showInvite} animationType="slide" transparent onRequestClose={() => setShowInvite(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Staff</Text>
              <Pressable onPress={() => setShowInvite(false)} hitSlop={12}>
                <MaterialCommunityIcons name="close" size={24} color={Brand.textTertiary} />
              </Pressable>
            </View>

            <Text style={styles.formLabel}>User ID *</Text>
            <TextInput
              style={styles.formInput}
              value={userId}
              onChangeText={setUserId}
              placeholder="Enter user ID"
              keyboardType="numeric"
              placeholderTextColor={Brand.textTertiary}
            />

            <Text style={styles.formLabel}>Role</Text>
            {roles.length === 0 ? (
              <Text style={styles.noRolesText}>No roles available — staff will get default permissions</Text>
            ) : (
              <View style={styles.roleSelector}>
                {roles.map((role) => (
                  <Pressable
                    key={`sel-${role.id}`}
                    style={[styles.roleOption, selectedRoleId === role.id && styles.roleOptionActive]}
                    onPress={() => setSelectedRoleId(role.id)}
                  >
                    <Text style={[styles.roleOptionText, selectedRoleId === role.id && styles.roleOptionTextActive]}>
                      {role.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Pressable
              style={({ pressed }) => [styles.submitBtn, (inviting || pressed) && { opacity: 0.85 }]}
              onPress={handleInvite}
              disabled={inviting}
            >
              {inviting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Send Invite</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Create role modal */}
      <Modal visible={showRole} animationType="slide" transparent onRequestClose={() => setShowRole(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Role</Text>
              <Pressable onPress={() => setShowRole(false)} hitSlop={12}>
                <MaterialCommunityIcons name="close" size={24} color={Brand.textTertiary} />
              </Pressable>
            </View>

            <Text style={styles.formLabel}>Role Name *</Text>
            <TextInput
              style={styles.formInput}
              value={roleName}
              onChangeText={setRoleName}
              placeholder="e.g. Order Manager"
              placeholderTextColor={Brand.textTertiary}
            />

            <Text style={styles.formLabel}>Role Type</Text>
            <View style={styles.typeRow}>
              {['custom', 'manager', 'staff'].map((t) => (
                <Pressable
                  key={t}
                  style={[styles.typeBtn, roleType === t && styles.typeBtnActive]}
                  onPress={() => setRoleType(t)}
                >
                  <Text style={[styles.typeBtnText, roleType === t && styles.typeBtnTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [styles.submitBtn, (creatingRole || pressed) && { opacity: 0.85 }]}
              onPress={handleCreateRole}
              disabled={creatingRole}
            >
              {creatingRole ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Create Role</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
  centerBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { marginTop: 12, fontSize: 14, color: Brand.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  emptyText: { marginTop: 12, fontSize: 14, color: Brand.textSecondary, fontWeight: '600' },
  emptySubtext: { marginTop: 4, fontSize: 12, color: Brand.textTertiary },

  list: { padding: 12, paddingBottom: 32 },

  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Brand.primary, borderRadius: 12, paddingVertical: 14, marginBottom: 16,
  },
  inviteBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  rolesSection: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 16,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  rolesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Brand.text, marginBottom: 10, marginTop: 4 },
  createRoleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  createRoleText: { fontSize: 13, fontWeight: '700', color: Brand.primary },
  rolesEmpty: { fontSize: 13, color: Brand.textTertiary, fontStyle: 'italic', paddingVertical: 8 },

  roleCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  roleIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Brand.primary + '12', justifyContent: 'center', alignItems: 'center' },
  roleInfo: { flex: 1, gap: 2 },
  roleName: { fontSize: 14, fontWeight: '700', color: Brand.text },
  roleType: { fontSize: 11, color: Brand.textTertiary, textTransform: 'capitalize' },

  staffCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  staffHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  staffInfo: { flex: 1, gap: 2 },
  staffName: { fontSize: 15, fontWeight: '700', color: Brand.text },
  staffEmail: { fontSize: 12, color: Brand.textTertiary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },

  staffMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  metaCol: { flex: 1, gap: 2 },
  metaLabel: { fontSize: 11, color: Brand.textTertiary, fontWeight: '600' },
  metaValue: { fontSize: 13, color: Brand.text, fontWeight: '600' },
  fullAccessBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Brand.primary + '12', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  fullAccessText: { fontSize: 10, fontWeight: '700', color: Brand.primary },

  actionRow: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: Brand.borderLight, paddingTop: 12 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: Brand.surfaceAlt },
  toggleText: { fontSize: 13, fontWeight: '700' },
  removeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(220,38,38,0.08)' },
  removeText: { fontSize: 13, fontWeight: '700', color: Brand.danger },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
  formLabel: { fontSize: 13, fontWeight: '700', color: Brand.text, marginBottom: 6, marginTop: 12 },
  formInput: {
    borderWidth: 1.5, borderColor: Brand.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Brand.text,
  },
  noRolesText: { fontSize: 13, color: Brand.textTertiary, fontStyle: 'italic' },
  roleSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleOption: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Brand.border, backgroundColor: Brand.surfaceAlt },
  roleOptionActive: { borderColor: Brand.primary, backgroundColor: Brand.primary + '12' },
  roleOptionText: { fontSize: 13, fontWeight: '600', color: Brand.textTertiary },
  roleOptionTextActive: { color: Brand.primary, fontWeight: '700' },

  typeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Brand.border, alignItems: 'center' },
  typeBtnActive: { borderColor: Brand.primary, backgroundColor: Brand.primary + '12' },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: Brand.textTertiary, textTransform: 'capitalize' },
  typeBtnTextActive: { color: Brand.primary },

  submitBtn: { backgroundColor: Brand.primary, marginTop: 20, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
