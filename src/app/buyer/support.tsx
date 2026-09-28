import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    Alert,
    Pressable,
    Linking as RNLinking,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { GradientHeader } from '@/components/GradientHeader';
import { Brand } from '@/constants/theme';
import { useAppTheme, type ThemeColors } from '@/context/ThemeContext';

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

export default function SupportScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

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

  appInfoSection: { alignItems: 'center', paddingVertical: 18, gap: 3 },
  appInfoName: { fontSize: 15, fontWeight: '800', color: c.text },
  appInfoVersion: { fontSize: 11, fontWeight: '500', color: c.textTertiary },
  appInfoText: { fontSize: 12, color: c.textSecondary, textAlign: 'center' },
});
