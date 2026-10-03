import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { GradientHeader } from '@/components/GradientHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { fetchOrderInvoice, type OrderInvoice } from '@/services/orders';

const fmtMoney = (v: string | number, currency = 'UGX') =>
  `${currency} ${Number(v || 0).toLocaleString()}`;

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

export default function OrderInvoiceScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ id: string }>();
  const orderId = Number(params.id);

  const [invoice, setInvoice] = useState<OrderInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setInvoice(await fetchOrderInvoice(orderId));
    } catch (e: any) {
      setError(e?.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const shareInvoice = async () => {
    if (!invoice) return;
    const lines = invoice.suborders.flatMap((s) =>
      s.items.map((i) => `• ${i.name}${i.variant ? ` (${i.variant})` : ''} × ${i.quantity} — ${fmtMoney(i.total, invoice.currency)}`)
    );
    await Share.share({
      message: [
        `DIILZO INVOICE #${invoice.order_number}`,
        `Date: ${fmtDate(invoice.created_at)}`,
        `Billed to: ${invoice.customer.name} (${invoice.customer.email})`,
        ``,
        ...lines,
        ``,
        `Subtotal: ${fmtMoney(invoice.totals.subtotal, invoice.currency)}`,
        `Shipping: ${fmtMoney(invoice.totals.shipping, invoice.currency)}`,
        `TOTAL: ${fmtMoney(invoice.totals.total, invoice.currency)}`,
        `Payment: ${invoice.payment_status.toUpperCase()}`,
      ].join('\n'),
    });
  };

  return (
    <View style={styles.root}>
      <GradientHeader
        title="Invoice"
        subtitle={invoice ? `#${invoice.order_number}` : undefined}
        rightIcon={invoice ? 'share-variant' : undefined}
        onRightPress={shareInvoice}
      />

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Brand.primary} /></View>
      ) : error || !invoice ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="file-document-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.errorText}>{error || 'Invoice not available'}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.invHead}>
              <Text style={styles.logo}>Diilzo</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.invTitle}>INVOICE</Text>
                <Text style={styles.invNo}>#{invoice.order_number}</Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>BILLED TO</Text>
                <Text style={styles.metaName}>{invoice.customer.name || invoice.customer.email}</Text>
                <Text style={styles.metaText}>{invoice.customer.email}</Text>
                {!!invoice.customer.phone && <Text style={styles.metaText}>{invoice.customer.phone}</Text>}
                {!!invoice.ship_to.street && (
                  <Text style={styles.metaText}>
                    {invoice.ship_to.street}{invoice.ship_to.city ? `, ${invoice.ship_to.city}` : ''}
                    {invoice.ship_to.country ? `, ${invoice.ship_to.country}` : ''}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.label}>DETAILS</Text>
                <Text style={styles.metaText}>Date: {fmtDate(invoice.created_at)}</Text>
                <Text style={styles.metaText}>Status: {invoice.status}</Text>
                <Text style={styles.metaText}>Payment: {invoice.payment_status}</Text>
              </View>
            </View>

            {/* Items per seller */}
            {invoice.suborders.map((s, si) => (
              <View key={si}>
                <View style={styles.storeRow}>
                  <MaterialCommunityIcons name="storefront-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.storeName}>
                    {s.store_name}{s.store_country ? ` — ships from ${s.store_country}` : ''}
                  </Text>
                </View>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, { flex: 1 }]}>Item</Text>
                  <Text style={[styles.th, styles.num]}>Qty</Text>
                  <Text style={[styles.th, styles.num]}>Total</Text>
                </View>
                {s.items.map((i, ii) => (
                  <View key={ii} style={styles.tr}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tdName} numberOfLines={2}>{i.name}</Text>
                      {!!i.variant && <Text style={styles.tdVariant}>{i.variant}</Text>}
                    </View>
                    <Text style={[styles.td, styles.num]}>{i.quantity}</Text>
                    <Text style={[styles.td, styles.num]}>{fmtMoney(i.total, invoice.currency)}</Text>
                  </View>
                ))}
              </View>
            ))}

            {/* Totals */}
            <View style={styles.totals}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>{fmtMoney(invoice.totals.subtotal, invoice.currency)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Shipping</Text>
                <Text style={styles.totalValue}>{fmtMoney(invoice.totals.shipping, invoice.currency)}</Text>
              </View>
              {Number(invoice.totals.tax) > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Tax</Text>
                  <Text style={styles.totalValue}>{fmtMoney(invoice.totals.tax, invoice.currency)}</Text>
                </View>
              )}
              {Number(invoice.totals.discount) > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Discount</Text>
                  <Text style={[styles.totalValue, { color: '#10B981' }]}>
                    -{fmtMoney(invoice.totals.discount, invoice.currency)}
                  </Text>
                </View>
              )}
              <View style={[styles.totalRow, styles.grandRow]}>
                <Text style={styles.grandLabel}>TOTAL</Text>
                <Text style={styles.grandValue}>{fmtMoney(invoice.totals.total, invoice.currency)}</Text>
              </View>
            </View>

            <Text style={styles.footer}>
              Thank you for shopping on Diilzo — Africa's marketplace for local &amp; international trade.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
    card: {
      backgroundColor: c.surface, borderRadius: 14, padding: 18,
      elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    },
    invHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 14, borderBottomWidth: 3, borderBottomColor: Brand.primary },
    logo: { fontSize: 24, fontWeight: '800', color: Brand.primary },
    invTitle: { fontSize: 18, fontWeight: '700', color: c.textSecondary },
    invNo: { fontSize: 12, fontWeight: '700', color: c.textTertiary, marginTop: 2 },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, gap: 12 },
    label: { fontSize: 10, fontWeight: '800', color: c.textTertiary, letterSpacing: 0.6, marginBottom: 4 },
    metaName: { fontSize: 14, fontWeight: '700', color: c.text },
    metaText: { fontSize: 12, color: c.textSecondary, marginTop: 1 },
    storeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, marginBottom: 4 },
    storeName: { fontSize: 12, fontWeight: '700', color: c.textSecondary },
    tableHead: { flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: c.border, paddingBottom: 6 },
    th: { fontSize: 10, fontWeight: '800', color: c.textTertiary, letterSpacing: 0.5 },
    tr: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
    tdName: { fontSize: 13, fontWeight: '600', color: c.text },
    tdVariant: { fontSize: 11, color: c.textTertiary },
    td: { fontSize: 13, color: c.text, width: 70 },
    num: { textAlign: 'right', width: 70 },
    totals: { marginTop: 14, alignSelf: 'flex-end', width: '65%', minWidth: 220 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    totalLabel: { fontSize: 13, color: c.textSecondary },
    totalValue: { fontSize: 13, fontWeight: '600', color: c.text },
    grandRow: { borderTopWidth: 2, borderTopColor: c.text, marginTop: 6, paddingTop: 8 },
    grandLabel: { fontSize: 15, fontWeight: '800', color: c.text },
    grandValue: { fontSize: 15, fontWeight: '800', color: Brand.primary },
    footer: { fontSize: 11, color: c.textTertiary, textAlign: 'center', marginTop: 22, lineHeight: 17 },
    errorText: { fontSize: 14, color: c.textSecondary, marginTop: 10 },
    retryBtn: { marginTop: 16, backgroundColor: Brand.primary, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20 },
    retryText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  });
}
