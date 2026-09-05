import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  Linking as RNLinking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';

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
          <Text style={styles.headerTitle}>Help & Support</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero banner */}
          <View style={styles.heroCard}>
            <View style={styles.heroIconWrap}>
              <MaterialCommunityIcons name="lifebuoy" size={32} color="#FFFFFF" />
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroTitle}>How can we help?</Text>
              <Text style={styles.heroSubtext}>
                We're here to assist you with any questions or issues
              </Text>
            </View>
          </View>

          {/* Contact options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Options</Text>
            {contactOptions.map((option, index) => (
              <Pressable
                key={`contact-${index}`}
                style={({ pressed }) => [styles.contactCard, pressed && { opacity: 0.85 }]}
                onPress={option.action}
              >
                <View style={[styles.contactIcon, { backgroundColor: option.color + '20' }]}>
                  <MaterialCommunityIcons name={option.icon} size={24} color={option.color} />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel}>{option.label}</Text>
                  <Text style={styles.contactSublabel}>{option.sublabel}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={Brand.textTertiary} />
              </Pressable>
            ))}
          </View>

          {/* FAQ */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
            {FAQS.map((faq, index) => {
              const expanded = expandedFaq === index;
              return (
                <View key={`faq-${index}`} style={styles.faqCard}>
                  <Pressable
                    style={styles.faqHeader}
                    onPress={() => toggleFaq(index)}
                  >
                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                    <MaterialCommunityIcons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={22}
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
            <MaterialCommunityIcons name="shopping" size={28} color={Brand.primary} />
            <Text style={styles.appInfoName}>Diilzo</Text>
            <Text style={styles.appInfoVersion}>Version 1.0.0</Text>
            <Text style={styles.appInfoText}>
              Uganda's vibrant green marketplace — shop local, sell global.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.surfaceAlt },
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

  // Hero
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: Brand.primary,
    borderRadius: 16,
    padding: Spacing.three + 2,
    marginBottom: Spacing.three,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroInfo: { flex: 1, gap: 4 },
  heroTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  heroSubtext: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },

  // Sections
  section: { marginBottom: Spacing.three },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Brand.text, marginBottom: Spacing.two },

  // Contact
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    backgroundColor: '#FFFFFF',
    padding: Spacing.three,
    borderRadius: 14,
    marginBottom: Spacing.two,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactInfo: { flex: 1, gap: 2 },
  contactLabel: { fontSize: 15, fontWeight: '700', color: Brand.text },
  contactSublabel: { fontSize: 13, color: Brand.textSecondary },

  // FAQ
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: Spacing.two,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  faqQuestion: { flex: 1, fontSize: 15, fontWeight: '600', color: Brand.text },
  faqBody: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    paddingTop: 0,
  },
  faqAnswer: { fontSize: 14, color: Brand.textSecondary, lineHeight: 22 },

  // App info
  appInfoSection: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.one + 2,
  },
  appInfoName: { fontSize: 18, fontWeight: '800', color: Brand.text },
  appInfoVersion: { fontSize: 13, color: Brand.textTertiary },
  appInfoText: {
    fontSize: 13,
    color: Brand.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.one + 2,
  },
});
