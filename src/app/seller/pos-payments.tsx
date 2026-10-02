import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import {
    deletePOSPaymentGateway,
    getPOSPaymentGateways,
    savePOSPaymentGateway,
    type POSGateway,
} from '@/services/seller';

const GATEWAY_COLORS: Record<string, string> = {
    mtn_momo: '#CA8A04',
    airtel_money: '#DC2626',
    stripe: '#7C3AED',
    paypal: '#2563EB',
};

const GATEWAY_ICONS: Record<string, string> = {
    mtn_momo: 'cellphone',
    airtel_money: 'cellphone-wireless',
    stripe: 'credit-card-outline',
    paypal: 'wallet-outline',
};

const GATEWAY_HINTS: Record<string, string> = {
    mtn_momo: 'Buyer gets an approval prompt on their MTN phone.',
    airtel_money: 'Buyer gets an approval prompt on their Airtel phone.',
    stripe: 'A card payment link is generated for the buyer.',
    paypal: 'A PayPal checkout link is generated for the buyer.',
};

export default function POSPaymentMethodsScreen() {
    const router = useRouter();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [gateways, setGateways] = useState<POSGateway[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [locked, setLocked] = useState(false);
    // draft credential inputs keyed `${gateway}:${field}`
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [savingId, setSavingId] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setError(null);
            setRefreshing(true);
            const res = await getPOSPaymentGateways();
            setGateways(res.results);
        } catch (e: any) {
            if (e?.response?.status === 403 && e?.response?.data?.upgrade_required) {
                setLocked(true);
            } else {
                setError(e?.message || 'Failed to load payment methods');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async (g: POSGateway, enabled: boolean) => {
        setSavingId(g.gateway);
        try {
            const credentials: Record<string, string> = {};
            g.fields.forEach((f) => {
                const v = drafts[`${g.gateway}:${f.key}`];
                if (v?.trim()) credentials[f.key] = v.trim();
            });
            await savePOSPaymentGateway({
                gateway: g.gateway,
                is_enabled: enabled,
                environment: (drafts[`${g.gateway}:__env__`] as string) || g.environment,
                credentials,
            });
            setDrafts((prev) => {
                const next = { ...prev };
                g.fields.forEach((f) => delete next[`${g.gateway}:${f.key}`]);
                return next;
            });
            await load();
        } catch (e: any) {
            Alert.alert('Save Failed', e?.response?.data?.error || e?.message || 'Could not save.');
        } finally {
            setSavingId(null);
        }
    };

    const remove = (g: POSGateway) => {
        if (!g.id) return;
        Alert.alert('Remove Method', `Remove ${g.label} configuration?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive',
                onPress: async () => {
                    try {
                        await deletePOSPaymentGateway(g.id!);
                        await load();
                    } catch {
                        Alert.alert('Error', 'Could not remove.');
                    }
                },
            },
        ]);
    };

    const renderGateway = (g: POSGateway) => {
        const accent = GATEWAY_COLORS[g.gateway] || Brand.primary;
        const isOpen = expanded === g.gateway;
        return (
            <View key={g.gateway} style={styles.card}>
                <Pressable
                    style={styles.cardHead}
                    onPress={() => setExpanded(isOpen ? null : g.gateway)}
                >
                    <View style={[styles.gwIcon, { backgroundColor: accent + '18' }]}>
                        <MaterialCommunityIcons name={GATEWAY_ICONS[g.gateway] as any} size={20} color={accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.gwName}>{g.label}</Text>
                        <Text style={styles.gwHint}>{GATEWAY_HINTS[g.gateway]}</Text>
                    </View>
                    <View style={styles.gwState}>
                        {g.is_enabled ? (
                            <View style={[styles.statePill, { backgroundColor: '#DCF5EC' }]}>
                                <Text style={[styles.statePillText, { color: '#16A34A' }]}>LIVE</Text>
                            </View>
                        ) : g.has_credentials ? (
                            <View style={[styles.statePill, { backgroundColor: '#FEF3C7' }]}>
                                <Text style={[styles.statePillText, { color: '#B45309' }]}>SAVED</Text>
                            </View>
                        ) : (
                            <View style={[styles.statePill, { backgroundColor: colors.surfaceAlt }]}>
                                <Text style={[styles.statePillText, { color: colors.textTertiary }]}>OFF</Text>
                            </View>
                        )}
                        <MaterialCommunityIcons
                            name={isOpen ? 'chevron-up' : 'chevron-down'}
                            size={20} color={colors.textTertiary}
                        />
                    </View>
                </Pressable>

                {isOpen && (
                    <View style={styles.cardBody}>
                        <Text style={styles.fieldLabel}>Environment</Text>
                        <View style={styles.envRow}>
                            {(['sandbox', 'production'] as const).map((env) => {
                                const cur = (drafts[`${g.gateway}:__env__`] as string) || g.environment;
                                const active = cur === env;
                                return (
                                    <Pressable
                                        key={env}
                                        style={[styles.envChip, active && { backgroundColor: accent, borderColor: accent }]}
                                        onPress={() => setDrafts((p) => ({ ...p, [`${g.gateway}:__env__`]: env }))}
                                    >
                                        <Text style={[styles.envChipText, active && { color: '#FFFFFF' }]}>
                                            {env === 'sandbox' ? 'Sandbox / Test' : 'Production / Live'}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {g.fields.map((f) => (
                            <View key={f.key} style={{ marginTop: 10 }}>
                                <Text style={styles.fieldLabel}>{f.label}{f.secret ? ' (secret)' : ''}</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder={g.credentials[f.key] || `Paste your ${f.label}`}
                                    placeholderTextColor={colors.textTertiary}
                                    secureTextEntry={f.secret}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    value={drafts[`${g.gateway}:${f.key}`] ?? ''}
                                    onChangeText={(t) =>
                                        setDrafts((p) => ({ ...p, [`${g.gateway}:${f.key}`]: t }))}
                                />
                            </View>
                        ))}

                        <View style={styles.cardActions}>
                            <Switch
                                value={g.is_enabled}
                                onValueChange={(v) => save(g, v)}
                                trackColor={{ false: colors.border, true: accent + '70' }}
                                thumbColor={g.is_enabled ? accent : '#f4f3f4'}
                            />
                            <Text style={styles.switchLabel}>Enabled</Text>
                            <View style={{ flex: 1 }} />
                            {g.id ? (
                                <Pressable onPress={() => remove(g)} style={styles.removeBtn}>
                                    <MaterialCommunityIcons name="trash-can-outline" size={15} color={Brand.danger} />
                                    <Text style={styles.removeText}>Remove</Text>
                                </Pressable>
                            ) : null}
                            <Pressable
                                style={[styles.saveBtn, { backgroundColor: accent }]}
                                disabled={savingId === g.gateway}
                                onPress={() => save(g, g.is_enabled)}
                            >
                                {savingId === g.gateway
                                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                                    : <Text style={styles.saveBtnText}>Save</Text>}
                            </Pressable>
                        </View>
                    </View>
                )}
            </View>
        );
    };

    if (locked) {
        return (
            <View style={styles.screen}>
                <ModernHeader title="POS Payment Methods" showBack />
                <View style={styles.center}>
                    <MaterialCommunityIcons name="lock-outline" size={48} color="#7C3AED" />
                    <Text style={styles.emptyTitle}>POS requires a paid plan</Text>
                    <Text style={styles.emptySub}>
                        Payment method setup is included with paid seller plans.
                    </Text>
                    <Pressable style={styles.upgradeBtn} onPress={() => router.push('/seller/subscription' as any)}>
                        <Text style={styles.upgradeBtnText}>View Plans</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <ModernHeader title="POS Payment Methods" showBack />
            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={Brand.primary} /></View>
            ) : error ? (
                <View style={styles.center}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Brand.danger} />
                    <Text style={styles.emptySub}>{error}</Text>
                    <Pressable style={styles.upgradeBtn} onPress={load}>
                        <Text style={styles.upgradeBtnText}>Retry</Text>
                    </Pressable>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[Brand.primary]} tintColor={Brand.primary} />}
                >
                    <View style={styles.infoCard}>
                        <MaterialCommunityIcons name="wallet-outline" size={26} color={Brand.primary} />
                        <Text style={styles.infoText}>
                            Connect your own accounts — POS payments settle straight to you and never
                            pass through Diilzo. Online marketplace orders still go through Diilzo checkout.
                        </Text>
                    </View>
                    {gateways.map(renderGateway)}
                    <View style={styles.helpCard}>
                        <Text style={styles.helpTitle}>Where to get credentials</Text>
                        <Text style={styles.helpText}>
                            {'\u2022'} MTN MoMo — momodeveloper.mtn.com → Collection product → API User, API Key & Subscription Key{'\n'}
                            {'\u2022'} Airtel Money — developers.airtel.africa → Client ID & Client Secret{'\n'}
                            {'\u2022'} Stripe — dashboard.stripe.com/apikeys → Publishable & Secret keys{'\n'}
                            {'\u2022'} PayPal — developer.paypal.com → Client ID & Secret{'\n\n'}
                            Use Sandbox while testing, then switch to Production with live keys.
                        </Text>
                    </View>
                </ScrollView>
            )}
        </View>
    );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.surfaceAlt },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
    emptyTitle: { fontSize: 17, fontWeight: '800', color: c.text, marginTop: 14 },
    emptySub: { fontSize: 13, color: c.textTertiary, textAlign: 'center', marginTop: 8, lineHeight: 19 },
    upgradeBtn: { backgroundColor: Brand.primary, borderRadius: 10, paddingHorizontal: 22, paddingVertical: 10, marginTop: 16 },
    upgradeBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
    list: { padding: 14, paddingBottom: 30 },

    infoCard: {
        flexDirection: 'row', gap: 12, alignItems: 'flex-start',
        backgroundColor: Brand.primary + '10', borderWidth: 1, borderColor: Brand.primary + '30',
        borderRadius: 14, padding: 14, marginBottom: 14,
    },
    infoText: { flex: 1, fontSize: 12, color: c.textSecondary, lineHeight: 18 },

    card: {
        backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 10,
        elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    gwIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    gwName: { fontSize: 14, fontWeight: '800', color: c.text },
    gwHint: { fontSize: 11, color: c.textTertiary, marginTop: 2 },
    gwState: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statePill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    statePillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

    cardBody: { marginTop: 12, borderTopWidth: 1, borderTopColor: c.borderLight, paddingTop: 12 },
    fieldLabel: { fontSize: 11, fontWeight: '700', color: c.textSecondary, marginBottom: 5 },
    input: {
        borderWidth: 1, borderColor: c.border, borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: c.text,
        backgroundColor: c.surfaceAlt,
    },
    envRow: { flexDirection: 'row', gap: 8 },
    envChip: {
        flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 10,
        paddingVertical: 8, alignItems: 'center',
    },
    envChipText: { fontSize: 12, fontWeight: '700', color: c.textSecondary },

    cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
    switchLabel: { fontSize: 12, fontWeight: '700', color: c.text },
    removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 },
    removeText: { fontSize: 12, fontWeight: '700', color: Brand.danger },
    saveBtn: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 9 },
    saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

    helpCard: {
        backgroundColor: c.surface, borderRadius: 14, padding: 14, marginTop: 4,
    },
    helpTitle: { fontSize: 13, fontWeight: '800', color: c.text, marginBottom: 8 },
    helpText: { fontSize: 12, color: c.textSecondary, lineHeight: 19 },
});
