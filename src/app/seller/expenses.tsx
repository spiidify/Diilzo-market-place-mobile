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
    Text,
    TextInput,
    View,
} from 'react-native';

import { ModernHeader } from '@/components/ModernHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import {
    createExpense,
    createMoneyEntry,
    deleteExpense,
    deleteMoneyEntry,
    getExpenses,
    getMoneyEntries,
    getStaff,
    updateExpense,
    updateMoneyEntry,
    type ExpensesResponse,
    type MoneyEntriesResponse,
    type MoneyEntry,
    type POSExpense,
    type SellerStaffMember,
} from '@/services/seller';

type Tab = 'expenses' | 'money';

function fmt(n: string | number): string {
    const v = Number(n) || 0;
    return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}

export default function SellerExpensesScreen() {
    const router = useRouter();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [tab, setTab] = useState<Tab>('expenses');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [expData, setExpData] = useState<ExpensesResponse | null>(null);
    const [moneyData, setMoneyData] = useState<MoneyEntriesResponse | null>(null);
    const [staff, setStaff] = useState<SellerStaffMember[]>([]);

    // filters
    const [catFilter, setCatFilter] = useState('');
    const [kindFilter, setKindFilter] = useState('');

    // expense form
    const [showExpForm, setShowExpForm] = useState(false);
    const [editExp, setEditExp] = useState<POSExpense | null>(null);
    const [fDesc, setFDesc] = useState('');
    const [fAmount, setFAmount] = useState('');
    const [fCategory, setFCategory] = useState('other');
    const [fMethod, setFMethod] = useState('cash');
    const [fPaidTo, setFPaidTo] = useState('');
    const [fStaff, setFStaff] = useState<number | null>(null);
    const [fDate, setFDate] = useState(todayISO());

    // money form
    const [showMoneyForm, setShowMoneyForm] = useState(false);
    const [editMoney, setEditMoney] = useState<MoneyEntry | null>(null);
    const [mKind, setMKind] = useState<'stock' | 'draw'>('stock');
    const [mSource, setMSource] = useState('owner_capital');
    const [mAmount, setMAmount] = useState('');
    const [mNote, setMNote] = useState('');
    const [mDate, setMDate] = useState(todayISO());

    const load = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setLoading(true);
        setError(null);
        try {
            const [exp, mon] = await Promise.all([
                getExpenses(catFilter ? { category: catFilter } : {}),
                getMoneyEntries(kindFilter ? { kind: kindFilter as 'stock' | 'draw' } : {}),
            ]);
            setExpData(exp);
            setMoneyData(mon);
            getStaff().then(setStaff).catch(() => setStaff([]));
        } catch (e: any) {
            setError(e?.message || 'Failed to load.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [catFilter, kindFilter]);

    useEffect(() => { load(); }, [load]);

    const resetExpForm = () => {
        setEditExp(null); setFDesc(''); setFAmount(''); setFCategory('other');
        setFMethod('cash'); setFPaidTo(''); setFStaff(null); setFDate(todayISO());
    };

    const saveExpense = async () => {
        const amount = Number(fAmount);
        if (!fDesc.trim() || !amount || amount <= 0) {
            Alert.alert('Missing details', 'Enter a description and a valid amount.');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                category: fCategory,
                description: fDesc.trim(),
                amount,
                expense_date: fDate || undefined,
                payment_method: fMethod,
                paid_to: fPaidTo.trim(),
                staff_member: fStaff,
            };
            if (editExp) await updateExpense(editExp.id, payload);
            else await createExpense(payload);
            resetExpForm();
            setShowExpForm(false);
            load(true);
        } catch (e: any) {
            Alert.alert('Could not save', e?.message || 'Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const startEditExpense = (e: POSExpense) => {
        setEditExp(e); setFDesc(e.description); setFAmount(String(e.amount));
        setFCategory(e.category); setFMethod(e.payment_method);
        setFPaidTo(e.paid_to); setFStaff(e.staff_member); setFDate(e.expense_date);
        setShowExpForm(true);
    };

    const confirmDeleteExpense = (e: POSExpense) => {
        Alert.alert('Delete expense?', `${e.category_label} — ${e.description}`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try { await deleteExpense(e.id); load(true); }
                    catch (err: any) { Alert.alert('Delete failed', err?.message || ''); }
                },
            },
        ]);
    };

    const resetMoneyForm = () => {
        setEditMoney(null); setMKind('stock'); setMSource('owner_capital');
        setMAmount(''); setMNote(''); setMDate(todayISO());
    };

    const saveMoney = async () => {
        const amount = Number(mAmount);
        if (!amount || amount <= 0) {
            Alert.alert('Missing amount', 'Enter a valid amount.');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                kind: mKind, source: mSource, amount,
                note: mNote.trim(), entry_date: mDate || undefined,
            };
            if (editMoney) await updateMoneyEntry(editMoney.id, payload);
            else await createMoneyEntry(payload);
            resetMoneyForm();
            setShowMoneyForm(false);
            load(true);
        } catch (e: any) {
            Alert.alert('Could not save', e?.message || 'Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const startEditMoney = (m: MoneyEntry) => {
        setEditMoney(m); setMKind(m.kind); setMSource(m.source);
        setMAmount(String(m.amount)); setMNote(m.note); setMDate(m.entry_date);
        setShowMoneyForm(true);
    };

    const confirmDeleteMoney = (m: MoneyEntry) => {
        Alert.alert('Delete entry?', `${m.source_label} — ${m.currency} ${fmt(m.amount)}`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try { await deleteMoneyEntry(m.id); load(true); }
                    catch (err: any) { Alert.alert('Delete failed', err?.message || ''); }
                },
            },
        ]);
    };

    const renderChip = (label: string, active: boolean, onPress: () => void) => (
        <Pressable key={label} style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
        </Pressable>
    );

    if (loading && !expData) {
        return (
            <View style={styles.screen}>
                <ModernHeader title="Expenses & Cash" showBack />
                <View style={styles.center}><ActivityIndicator color={Brand.primary} size="large" /></View>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <ModernHeader title="Expenses & Cash" showBack />

            <View style={styles.tabBar}>
                {(['expenses', 'money'] as Tab[]).map((t) => (
                    <Pressable key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
                        <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                            {t === 'expenses' ? 'Expenses' : 'Money Stocking'}
                        </Text>
                    </Pressable>
                ))}
            </View>

            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Brand.primary} />}
            >
                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                {tab === 'expenses' ? (
                    <>
                        {/* Summary */}
                        <View style={styles.kpiRow}>
                            <View style={[styles.kpiCard, { borderLeftColor: '#F59E0B' }]}>
                                <Text style={styles.kpiValue}>UGX {fmt(expData?.summary.month || 0)}</Text>
                                <Text style={styles.kpiLabel}>This month</Text>
                            </View>
                            <View style={[styles.kpiCard, { borderLeftColor: '#EF4444' }]}>
                                <Text style={styles.kpiValue}>UGX {fmt(expData?.summary.today || 0)}</Text>
                                <Text style={styles.kpiLabel}>Today</Text>
                            </View>
                            <View style={[styles.kpiCard, { borderLeftColor: '#6366F1' }]}>
                                <Text style={styles.kpiValue}>UGX {fmt(expData?.summary.all_time || 0)}</Text>
                                <Text style={styles.kpiLabel}>All time</Text>
                            </View>
                        </View>

                        {/* Category filter chips */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                            {renderChip('All', !catFilter, () => setCatFilter(''))}
                            {(expData?.categories || []).map((c) =>
                                renderChip(c.label, catFilter === c.value, () => setCatFilter(catFilter === c.value ? '' : c.value)))}
                        </ScrollView>

                        {/* Add / edit form */}
                        <Pressable style={styles.addBtn} onPress={() => { resetExpForm(); setShowExpForm(!showExpForm); }}>
                            <MaterialCommunityIcons name={showExpForm ? 'minus' : 'plus'} size={18} color="#fff" />
                            <Text style={styles.addBtnText}>{showExpForm ? 'Hide form' : 'Record Expense'}</Text>
                        </Pressable>

                        {showExpForm && (
                            <View style={styles.formCard}>
                                <Text style={styles.formTitle}>{editExp ? `Edit Expense #${editExp.id}` : 'New Expense'}</Text>
                                <TextInput style={styles.input} placeholder="Description *" placeholderTextColor={colors.textSecondary}
                                    value={fDesc} onChangeText={setFDesc} />
                                <View style={styles.formRow}>
                                    <TextInput style={[styles.input, styles.half]} placeholder="Amount *" placeholderTextColor={colors.textSecondary}
                                        value={fAmount} onChangeText={setFAmount} keyboardType="numeric" />
                                    <TextInput style={[styles.input, styles.half]} placeholder="Date (YYYY-MM-DD)" placeholderTextColor={colors.textSecondary}
                                        value={fDate} onChangeText={setFDate} />
                                </View>
                                <Text style={styles.fieldLabel}>Category</Text>
                                <View style={styles.chipWrap}>
                                    {(expData?.categories || []).map((c) => (
                                        <Pressable key={c.value} style={[styles.chip, fCategory === c.value && styles.chipActive]}
                                            onPress={() => setFCategory(c.value)}>
                                            <Text style={[styles.chipText, fCategory === c.value && styles.chipTextActive]}>{c.label}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                                <Text style={styles.fieldLabel}>Paid via</Text>
                                <View style={styles.chipWrap}>
                                    {(expData?.payment_methods || []).map((m) => (
                                        <Pressable key={m.value} style={[styles.chip, fMethod === m.value && styles.chipActive]}
                                            onPress={() => setFMethod(m.value)}>
                                            <Text style={[styles.chipText, fMethod === m.value && styles.chipTextActive]}>{m.label}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                                <TextInput style={styles.input} placeholder="Paid to (staff, supplier, landlord…)" placeholderTextColor={colors.textSecondary}
                                    value={fPaidTo} onChangeText={setFPaidTo} />
                                {staff.length > 0 && (
                                    <>
                                        <Text style={styles.fieldLabel}>Link to staff member (salary / advance)</Text>
                                        <View style={styles.chipWrap}>
                                            {staff.map((s) => (
                                                <Pressable key={s.id} style={[styles.chip, fStaff === s.id && styles.chipActive]}
                                                    onPress={() => setFStaff(fStaff === s.id ? null : s.id)}>
                                                    <Text style={[styles.chipText, fStaff === s.id && styles.chipTextActive]}>
                                                        {s.user_name || s.user_email}
                                                    </Text>
                                                </Pressable>
                                            ))}
                                        </View>
                                    </>
                                )}
                                <View style={styles.formRow}>
                                    <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={saveExpense} disabled={saving}>
                                        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : editExp ? 'Update' : 'Save Expense'}</Text>
                                    </Pressable>
                                    {editExp && (
                                        <Pressable style={styles.cancelBtn} onPress={() => { resetExpForm(); setShowExpForm(false); }}>
                                            <Text style={styles.cancelBtnText}>Cancel</Text>
                                        </Pressable>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* List */}
                        {(expData?.results || []).map((e) => (
                            <View key={e.id} style={styles.row}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.rowTitle} numberOfLines={1}>{e.description}</Text>
                                    <Text style={styles.rowSub}>
                                        {e.category_label} · {e.expense_date}
                                        {e.staff_name ? ` · 👤 ${e.staff_name}` : e.paid_to ? ` · ${e.paid_to}` : ''}
                                    </Text>
                                    <Text style={styles.rowMeta}>{e.payment_method.replace('_', ' ')}{e.recorded_by ? ` · by ${e.recorded_by}` : ''}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.rowAmount}>{e.currency} {fmt(e.amount)}</Text>
                                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                                        <Pressable onPress={() => startEditExpense(e)} hitSlop={8}>
                                            <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.textSecondary} />
                                        </Pressable>
                                        <Pressable onPress={() => confirmDeleteExpense(e)} hitSlop={8}>
                                            <MaterialCommunityIcons name="trash-can-outline" size={18} color={Brand.danger} />
                                        </Pressable>
                                    </View>
                                </View>
                            </View>
                        ))}
                        {expData && expData.results.length === 0 && (
                            <Text style={styles.emptyText}>No expenses recorded yet. Tap "Record Expense" to log spending — including staff salaries and advances.</Text>
                        )}
                    </>
                ) : (
                    <>
                        {/* Money stocking summary */}
                        <View style={styles.kpiRow}>
                            <View style={[styles.kpiCard, { borderLeftColor: '#10B981' }]}>
                                <Text style={styles.kpiValue}>UGX {fmt(moneyData?.summary.stocked || 0)}</Text>
                                <Text style={styles.kpiLabel}>Stocked in</Text>
                            </View>
                            <View style={[styles.kpiCard, { borderLeftColor: '#EF4444' }]}>
                                <Text style={styles.kpiValue}>UGX {fmt(moneyData?.summary.drawn || 0)}</Text>
                                <Text style={styles.kpiLabel}>Taken out</Text>
                            </View>
                            <View style={[styles.kpiCard, { borderLeftColor: Number(moneyData?.summary.net || 0) >= 0 ? '#6366F1' : '#EF4444' }]}>
                                <Text style={styles.kpiValue}>UGX {fmt(moneyData?.summary.net || 0)}</Text>
                                <Text style={styles.kpiLabel}>Net position</Text>
                            </View>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                            {renderChip('All', !kindFilter, () => setKindFilter(''))}
                            {renderChip('Stocked In', kindFilter === 'stock', () => setKindFilter(kindFilter === 'stock' ? '' : 'stock'))}
                            {renderChip('Taken Out', kindFilter === 'draw', () => setKindFilter(kindFilter === 'draw' ? '' : 'draw'))}
                        </ScrollView>

                        <Pressable style={styles.addBtn} onPress={() => { resetMoneyForm(); setShowMoneyForm(!showMoneyForm); }}>
                            <MaterialCommunityIcons name={showMoneyForm ? 'minus' : 'plus'} size={18} color="#fff" />
                            <Text style={styles.addBtnText}>{showMoneyForm ? 'Hide form' : 'Record Money In / Out'}</Text>
                        </Pressable>

                        {showMoneyForm && (
                            <View style={styles.formCard}>
                                <Text style={styles.formTitle}>{editMoney ? `Edit Entry #${editMoney.id}` : 'New Money Entry'}</Text>
                                <Text style={styles.fieldLabel}>Type</Text>
                                <View style={styles.chipWrap}>
                                    {(['stock', 'draw'] as const).map((k) => (
                                        <Pressable key={k} style={[styles.chip, mKind === k && styles.chipActive]}
                                            onPress={() => {
                                                setMKind(k);
                                                const opts = k === 'stock' ? moneyData?.stock_sources : moneyData?.draw_reasons;
                                                if (opts?.length) setMSource(opts[0].value);
                                            }}>
                                            <Text style={[styles.chipText, mKind === k && styles.chipTextActive]}>
                                                {k === 'stock' ? 'Money Stocked In' : 'Money Taken Out'}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                                <Text style={styles.fieldLabel}>Source / Reason</Text>
                                <View style={styles.chipWrap}>
                                    {(mKind === 'stock' ? moneyData?.stock_sources : moneyData?.draw_reasons)?.map((s) => (
                                        <Pressable key={s.value} style={[styles.chip, mSource === s.value && styles.chipActive]}
                                            onPress={() => setMSource(s.value)}>
                                            <Text style={[styles.chipText, mSource === s.value && styles.chipTextActive]}>{s.label}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                                <View style={styles.formRow}>
                                    <TextInput style={[styles.input, styles.half]} placeholder="Amount *" placeholderTextColor={colors.textSecondary}
                                        value={mAmount} onChangeText={setMAmount} keyboardType="numeric" />
                                    <TextInput style={[styles.input, styles.half]} placeholder="Date (YYYY-MM-DD)" placeholderTextColor={colors.textSecondary}
                                        value={mDate} onChangeText={setMDate} />
                                </View>
                                <TextInput style={styles.input} placeholder="Note (e.g. weekly till float)" placeholderTextColor={colors.textSecondary}
                                    value={mNote} onChangeText={setMNote} />
                                <View style={styles.formRow}>
                                    <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={saveMoney} disabled={saving}>
                                        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : editMoney ? 'Update' : 'Save Entry'}</Text>
                                    </Pressable>
                                    {editMoney && (
                                        <Pressable style={styles.cancelBtn} onPress={() => { resetMoneyForm(); setShowMoneyForm(false); }}>
                                            <Text style={styles.cancelBtnText}>Cancel</Text>
                                        </Pressable>
                                    )}
                                </View>
                            </View>
                        )}

                        {(moneyData?.results || []).map((m) => (
                            <View key={m.id} style={styles.row}>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <MaterialCommunityIcons
                                            name={m.kind === 'stock' ? 'arrow-down-circle' : 'arrow-up-circle'}
                                            size={16}
                                            color={m.kind === 'stock' ? '#10B981' : '#EF4444'}
                                        />
                                        <Text style={styles.rowTitle} numberOfLines={1}>{m.source_label}</Text>
                                    </View>
                                    <Text style={styles.rowSub}>{m.entry_date}{m.note ? ` · ${m.note}` : ''}</Text>
                                    {m.recorded_by ? <Text style={styles.rowMeta}>by {m.recorded_by}</Text> : null}
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[styles.rowAmount, { color: m.kind === 'stock' ? '#10B981' : '#EF4444' }]}>
                                        {m.kind === 'stock' ? '+' : '−'}{m.currency} {fmt(m.amount)}
                                    </Text>
                                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                                        <Pressable onPress={() => startEditMoney(m)} hitSlop={8}>
                                            <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.textSecondary} />
                                        </Pressable>
                                        <Pressable onPress={() => confirmDeleteMoney(m)} hitSlop={8}>
                                            <MaterialCommunityIcons name="trash-can-outline" size={18} color={Brand.danger} />
                                        </Pressable>
                                    </View>
                                </View>
                            </View>
                        ))}
                        {moneyData && moneyData.results.length === 0 && (
                            <Text style={styles.emptyText}>No money entries yet. Record cash you stock into the business (float, capital) or take out.</Text>
                        )}
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: 14, paddingBottom: 40 },
    tabBar: {
        flexDirection: 'row', marginHorizontal: 14, marginTop: 10,
        backgroundColor: colors.surface, borderRadius: 10, padding: 4,
        borderWidth: 1, borderColor: colors.border,
    },
    tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
    tabBtnActive: { backgroundColor: Brand.primary },
    tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    tabTextActive: { color: '#fff' },
    kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    kpiCard: {
        flex: 1, backgroundColor: colors.surface, borderRadius: 10, padding: 10,
        borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3,
    },
    kpiValue: { fontSize: 13, fontWeight: '700', color: colors.text },
    kpiLabel: { fontSize: 10, color: colors.textSecondary, marginTop: 2 },
    chipRow: { marginBottom: 10 },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
    chip: {
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: 6,
    },
    chipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
    chipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    chipTextActive: { color: '#fff' },
    addBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: Brand.primary, borderRadius: 10, paddingVertical: 11, marginBottom: 10,
    },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    formCard: {
        backgroundColor: colors.surface, borderRadius: 12, padding: 12,
        borderWidth: 1, borderColor: colors.border, marginBottom: 12,
    },
    formTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
    fieldLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
    input: {
        borderWidth: 1, borderColor: colors.border, borderRadius: 8,
        paddingHorizontal: 10, paddingVertical: 9, fontSize: 13,
        color: colors.text, marginBottom: 8, backgroundColor: colors.background,
    },
    formRow: { flexDirection: 'row', gap: 8 },
    half: { flex: 1 },
    saveBtn: {
        flex: 1, backgroundColor: Brand.primary, borderRadius: 8,
        paddingVertical: 11, alignItems: 'center',
    },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    cancelBtn: {
        paddingHorizontal: 16, borderRadius: 8, paddingVertical: 11,
        alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    cancelBtnText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
    row: {
        flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 10,
        padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border,
    },
    rowTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
    rowSub: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
    rowMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
    rowAmount: { fontSize: 14, fontWeight: '700', color: colors.text },
    emptyText: { textAlign: 'center', color: colors.textSecondary, fontSize: 13, marginTop: 24, paddingHorizontal: 20 },
    errorText: { color: Brand.danger, textAlign: 'center', marginBottom: 10, fontSize: 13 },
});
