import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    Linking as RNLinking,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';

import { GradientHeader } from '@/components/GradientHeader';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';
import { createTicket, fetchMyTickets, type SupportTicket } from '@/services/orders';

interface FAQ {
  question: string;
  answer: string;
}

interface ContactOption {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  sublabel: string;
  color: string;
  action: () => void;
}

const FAQS: FAQ[] = [
  {
    question: 'How do I track my order?',
    answer:
      'Go to My Orders, tap on your order, and select "Track Order" to see the live status and shipment details.',
  },
  {
    question: 'What payment methods are accepted?',
    answer:
      'We accept MTN Mobile Money, Airtel Money, PayPal, and Cash on Delivery (COD) for select areas.',
  },
  {
    question: 'How long does delivery take?',
    answer:
      'Delivery typically takes 1–3 business days within major cities and 3–7 days for rural areas.',
  },
  {
    question: 'Can I return an item?',
    answer:
      'Yes, you can request a return within 7 days of delivery. Go to your order details and tap "Request Return".',
  },
  {
    question: 'How do I become a seller?',
    answer:
      'Go to your account dashboard and tap "Become a Seller" to set up your store and start listing products.',
  },
  {
    question: 'Is my payment information secure?',
    answer:
      'Yes, all payments are processed through secure, encrypted payment gateways. We never store your card details.',
  },
];

const SUPPORT_EMAIL = 'support@diilzo.com';
const SUPPORT_PHONE = '+256700000000';

const TICKET_CATEGORIES = [
  { key: 'order', label: 'Order issue' },
  { key: 'payment', label: 'Payment' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'return', label: 'Return / refund' },
  { key: 'account', label: 'Account' },
  { key: 'seller', label: 'Seller' },
  { key: 'other', label: 'Other' },
];

const TICKET_STATUS: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: '#F59E0B' },
  in_progress: { label: 'In Progress', color: '#3B82F6' },
  resolved: { label: 'Resolved', color: '#10B981' },
  closed: { label: 'Closed', color: '#6B7280' },
};

export default function SupportScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isAuthenticated } = useAuth();
  const params = useLocalSearchParams<{ order_id?: string; order_number?: string }>();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  // Support tickets
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketModal, setTicketModal] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketCategory, setTicketCategory] = useState('order');
  const [ticketSubmitting, setTicketSubmitting] = useState(false);

  const loadTickets = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setTicketsLoading(true);
      setTickets(await fetchMyTickets());
    } catch { /* non-fatal */ } finally {
      setTicketsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  // Open the form pre-filled when arriving from an order's "Contact Support"
  useEffect(() => {
    if (params.order_number) {
      setTicketSubject(`Problem with order ${params.order_number}`);
      setTicketCategory('order');
      setTicketModal(true);
    }
  }, [params.order_number]);

  const submitTicket = async () => {
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      Alert.alert('Missing details', 'Please add a subject and describe your issue.');
      return;
    }
    setTicketSubmitting(true);
    try {
      await createTicket({
        subject: ticketSubject.trim(),
        message: ticketMessage.trim(),
        category: ticketCategory,
        order_id: params.order_id ? Number(params.order_id) : undefined,
      });
      setTicketModal(false);
      setTicketSubject('');
      setTicketMessage('');
      Alert.alert('Ticket Created', 'Our support team will respond shortly. You can track progress under "My Tickets" below.');
      loadTickets();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || e?.message || 'Failed to create ticket');
    } finally {
      setTicketSubmitting(false);
    }
  };

  const handleChat = () => {
    router.push('/chat' as any);
  };

  const handleEmail = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {
      Alert.alert('Error', 'Could not open email app');
    });
  };

  const handlePhone = () => {
    const phone = SUPPORT_PHONE.replace(/\s/g, '');
    RNLinking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Error', 'Could not open phone app');
    });
  };

  const contactOptions: ContactOption[] = [
    {
      icon: 'chat-outline',
      label: 'Chat with Support',
      sublabel: 'Get instant help from our team',
      color: Brand.primary,
      action: handleChat,
    },
    {
      icon: 'email-outline',
      label: 'Email Us',
      sublabel: SUPPORT_EMAIL,
      color: '#3B82F6',
      action: handleEmail,
    },
    {
      icon: 'phone-outline',
      label: 'Call Us',
      sublabel: SUPPORT_PHONE,
      color: '#06B6D4',
      action: handlePhone,
    },
  ];

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  return (
    <View style={styles.screen}>
      <GradientHeader
        title="Help & Support"
        subtitle="How can we help?"
      />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Contact options */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact Us</Text>
          {contactOptions.map((option, index) => (
            <View key={`contact-${index}`}>
              {index > 0 && <View style={styles.rowDivider} />}
              <Pressable
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
                onPress={option.action}
              >
                <View style={[styles.iconWrap, { backgroundColor: option.color + '18' }]}>
                  <MaterialCommunityIcons name={option.icon} size={18} color={option.color} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.rowLabel}>{option.label}</Text>
                  <Text style={styles.rowSublabel}>{option.sublabel}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textTertiary} />
              </Pressable>
            </View>
          ))}
        </View>

        {/* Support tickets */}
        {isAuthenticated && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={styles.cardTitle}>My Tickets</Text>
              <Pressable
                style={({ pressed }) => [styles.newTicketBtn, pressed && { opacity: 0.85 }]}
                onPress={() => {
                  if (!isAuthenticated) { router.push('/(auth)/login' as any); return; }
                  setTicketSubject(params.order_number ? `Problem with order ${params.order_number}` : '');
                  setTicketCategory('order');
                  setTicketModal(true);
                }}
              >
                <MaterialCommunityIcons name="plus" size={14} color="#FFFFFF" />
                <Text style={styles.newTicketText}>New Ticket</Text>
              </Pressable>
            </View>
            {ticketsLoading ? (
              <ActivityIndicator size="small" color={Brand.primary} style={{ paddingVertical: 12 }} />
            ) : tickets.length === 0 ? (
              <Text style={styles.ticketsEmpty}>
                No support tickets — open one and our team will help you.
              </Text>
            ) : (
              tickets.map((t) => {
                const meta = TICKET_STATUS[t.status] || TICKET_STATUS.open;
                return (
                  <View key={t.id} style={styles.ticketRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ticketSubject} numberOfLines={1}>#{t.id} {t.subject}</Text>
                      <Text style={styles.ticketMeta}>
                        {t.order_number ? `Order ${t.order_number} · ` : ''}
                        {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </Text>
                      {!!t.admin_reply && (
                        <Text style={styles.ticketReply} numberOfLines={2}>
                          <MaterialCommunityIcons name="reply" size={11} color={Brand.primary} /> {t.admin_reply}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.ticketPill, { backgroundColor: meta.color + '15' }]}>
                      <Text style={[styles.ticketPillText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* FAQ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>FAQs</Text>
          {FAQS.map((faq, index) => {
            const expanded = expandedFaq === index;
            return (
              <View key={`faq-${index}`}>
                {index > 0 && <View style={styles.rowDivider} />}
                <Pressable
                  style={({ pressed }) => [styles.faqHeader, pressed && { opacity: 0.8 }]}
                  onPress={() => toggleFaq(index)}
                >
                  <Text style={styles.faqQuestion}>{faq.question}</Text>
                  <MaterialCommunityIcons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={Brand.primary}
                  />
                </Pressable>
                {expanded && (
                  <View style={styles.faqBody}>
                    <Text style={styles.faqAnswer}>{faq.answer}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* App info */}
        <View style={styles.appInfoSection}>
          <MaterialCommunityIcons name="shopping" size={22} color={Brand.primary} />
          <Text style={styles.appInfoName}>Diilzo <Text style={styles.appInfoVersion}>v1.0.0</Text></Text>
          <Text style={styles.appInfoText}>
            Uganda's vibrant green marketplace — shop local, sell global.
          </Text>
        </View>
      </ScrollView>

      {/* New ticket modal */}
      <Modal visible={ticketModal} transparent animationType="slide" onRequestClose={() => setTicketModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>New Support Ticket</Text>
                {!!params.order_number && (
                  <Text style={styles.modalSub}>Linked to order {params.order_number}</Text>
                )}
              </View>
              <Pressable onPress={() => setTicketModal(false)} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.chipRow}>
                {TICKET_CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat.key}
                    style={[styles.chip, ticketCategory === cat.key && styles.chipActive]}
                    onPress={() => setTicketCategory(cat.key)}
                  >
                    <Text style={[styles.chipText, ticketCategory === cat.key && styles.chipTextActive]}>
                      {cat.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Subject</Text>
              <TextInput
                style={styles.input}
                placeholder="Brief summary of your issue"
                placeholderTextColor={colors.textTertiary}
                value={ticketSubject}
                onChangeText={setTicketSubject}
                maxLength={150}
              />

              <Text style={styles.fieldLabel}>Message</Text>
              <TextInput
                style={[styles.input, styles.messageInput]}
                multiline
                numberOfLines={4}
                placeholder="Describe the issue in detail…"
                placeholderTextColor={colors.textTertiary}
                value={ticketMessage}
                onChangeText={setTicketMessage}
                textAlignVertical="top"
              />

              <Pressable
                style={[styles.submitBtn, ticketSubmitting && { opacity: 0.7 }]}
                onPress={submitTicket}
                disabled={ticketSubmitting}
              >
                {ticketSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitText}>Submit Ticket</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surfaceAlt },
  body: { flex: 1 },
  bodyContent: { paddingTop: 10, paddingBottom: 32, gap: 10 },

  card: {
    backgroundColor: c.surface, marginHorizontal: 10, borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 12,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  cardTitle: { fontSize: 12, fontWeight: '800', color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, marginTop: 2 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 2, borderRadius: 8,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
  },
  info: { flex: 1, gap: 1 },
  rowLabel: { fontSize: 13, fontWeight: '700', color: c.text },
  rowSublabel: { fontSize: 11, color: c.textTertiary, fontWeight: '500' },
  rowDivider: { height: 1, backgroundColor: c.borderLight, marginLeft: 44 },

  faqHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, paddingVertical: 9, paddingHorizontal: 2,
  },
  faqQuestion: { flex: 1, fontSize: 13, fontWeight: '700', color: c.text },
  faqBody: { paddingHorizontal: 2, paddingBottom: 10, paddingTop: 0 },
  faqAnswer: { fontSize: 12, color: c.textSecondary, lineHeight: 18 },

  // Tickets
  newTicketBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Brand.primary, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5,
  },
  newTicketText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  ticketsEmpty: { fontSize: 12, color: c.textTertiary, paddingVertical: 10 },
  ticketRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, borderTopWidth: 1, borderTopColor: c.borderLight,
  },
  ticketSubject: { fontSize: 13, fontWeight: '700', color: c.text },
  ticketMeta: { fontSize: 11, color: c.textTertiary, marginTop: 1 },
  ticketReply: { fontSize: 11, color: c.textSecondary, marginTop: 4, fontStyle: 'italic' },
  ticketPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  ticketPillText: { fontSize: 10, fontWeight: '800' },

  // Ticket modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 18, maxHeight: '88%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: c.text },
  modalSub: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: c.text, marginTop: 12, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border,
  },
  chipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: c.textSecondary },
  chipTextActive: { color: '#FFFFFF' },
  input: {
    borderWidth: 1, borderColor: c.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: c.text,
    backgroundColor: c.surfaceAlt,
  },
  messageInput: { minHeight: 90 },
  submitBtn: {
    marginTop: 16, marginBottom: 20, backgroundColor: Brand.primary,
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  submitText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  appInfoSection: { alignItems: 'center', paddingVertical: 18, gap: 3 },
  appInfoName: { fontSize: 15, fontWeight: '800', color: c.text },
  appInfoVersion: { fontSize: 11, fontWeight: '500', color: c.textTertiary },
  appInfoText: { fontSize: 12, color: c.textSecondary, textAlign: 'center' },
});
