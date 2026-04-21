import { useState } from "react"
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Linking, Alert } from "react-native"
import { useRouter } from "expo-router"
import { COLORS } from "@/constants/theme"


interface FAQItem {
  id: string
  question: string
  answer: string
  expanded: boolean
}

export default function HelpSupportScreen() {
  const router = useRouter()
  const [faqs, setFaqs] = useState<FAQItem[]>([
    {
      id: "1",
      question: "How do I add money to my myMetro Wallet?",
      answer:
        "You can add money to your wallet by going to the Wallet section and selecting 'Top Up'. You can use your credit/debit card, bank transfer, or other available payment methods.",
      expanded: false,
    },
    {
      id: "2",
      question: "What should I do if my ticket doesn't work?",
      answer:
        "If your digital ticket isn't working, try refreshing the app or checking your internet connection. If the problem persists, contact our support team immediately for assistance.",
      expanded: false,
    },
    {
      id: "3",
      question: "Can I get a refund for unused tickets?",
      answer:
        "Yes, unused tickets can be refunded within 24 hours of purchase. Go to your Travel History, select the ticket, and choose 'Request Refund'. Refunds are processed within 3-5 business days.",
      expanded: false,
    },
    {
      id: "4",
      question: "How do I report a lost or stolen phone?",
      answer:
        "If your phone is lost or stolen, immediately contact our support team to secure your account. You can also log into your account from another device to temporarily disable mobile tickets.",
      expanded: false,
    },
    {
      id: "5",
      question: "What are the operating hours for metro services?",
      answer:
        "Metro services typically operate from 5:00 AM to 11:30 PM on weekdays, and 6:00 AM to 11:00 PM on weekends. However, hours may vary by line and station.",
      expanded: false,
    },
    {
      id: "6",
      question: "How do I change my payment method?",
      answer:
        "Go to Profile > Payment Methods to add, remove, or set a default payment method. You can add multiple cards and bank accounts for convenience.",
      expanded: false,
    },
  ])

  const toggleFAQ = (id: string) => {
    setFaqs((prev) => prev.map((faq) => (faq.id === id ? { ...faq, expanded: !faq.expanded } : faq)))
  }

  const handleContactSupport = (method: string) => {
    switch (method) {
      case "phone":
        Linking.openURL("tel:+27123456789")
        break
      case "email":
        Linking.openURL("mailto:support@mymetro.co.za?subject=myMetro Support Request")
        break
      case "whatsapp":
        Linking.openURL("https://wa.me/27123456789?text=Hi, I need help with myMetro")
        break
      case "chat":
        Alert.alert("Live Chat", "Live chat feature coming soon! Please use phone or email for immediate assistance.")
        break
    }
  }

  const renderFAQItem = (faq: FAQItem) => (
    <TouchableOpacity key={faq.id} style={styles.faqItem} onPress={() => toggleFAQ(faq.id)}>
      <View style={styles.faqHeader}>
        <Text style={styles.faqQuestion}>{faq.question}</Text>
        <Text style={styles.faqToggle}>{faq.expanded ? "−" : "+"}</Text>
      </View>
      {faq.expanded && <Text style={styles.faqAnswer}>{faq.answer}</Text>}
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <Text style={styles.sectionDescription}>
            Need immediate assistance? Choose your preferred contact method:
          </Text>

          <View style={styles.contactGrid}>
            <TouchableOpacity style={styles.contactOption} onPress={() => handleContactSupport("phone")}>
              <Text style={styles.contactIcon}>📞</Text>
              <Text style={styles.contactTitle}>Phone</Text>
              <Text style={styles.contactSubtitle}>+27 11 345 6789</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactOption} onPress={() => handleContactSupport("email")}>
              <Text style={styles.contactIcon}>✉️</Text>
              <Text style={styles.contactTitle}>Email</Text>
              <Text style={styles.contactSubtitle}>support@mymetro.co.za</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactOption} onPress={() => handleContactSupport("whatsapp")}>
              <Text style={styles.contactIcon}>💬</Text>
              <Text style={styles.contactTitle}>WhatsApp</Text>
              <Text style={styles.contactSubtitle}>Quick messaging</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactOption} onPress={() => handleContactSupport("chat")}>
              <Text style={styles.contactIcon}>💭</Text>
              <Text style={styles.contactTitle}>Live Chat</Text>
              <Text style={styles.contactSubtitle}>Coming soon</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <Text style={styles.sectionDescription}>Find quick answers to common questions:</Text>

          {faqs.map(renderFAQItem)}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Information</Text>
          <View style={styles.emergencyCard}>
            <Text style={styles.emergencyIcon}>🚨</Text>
            <View style={styles.emergencyContent}>
              <Text style={styles.emergencyTitle}>Emergency Hotline</Text>
              <Text style={styles.emergencyNumber}>10177</Text>
              <Text style={styles.emergencyDescription}>
                For emergencies on metro premises, call the emergency hotline immediately.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operating Hours</Text>
          <View style={styles.hoursCard}>
            <View style={styles.hoursRow}>
              <Text style={styles.hoursDay}>Monday - Friday</Text>
              <Text style={styles.hoursTime}>5:00 AM - 11:30 PM</Text>
            </View>
            <View style={styles.hoursRow}>
              <Text style={styles.hoursDay}>Saturday - Sunday</Text>
              <Text style={styles.hoursTime}>6:00 AM - 11:00 PM</Text>
            </View>
            <View style={styles.hoursRow}>
              <Text style={styles.hoursDay}>Public Holidays</Text>
              <Text style={styles.hoursTime}>7:00 AM - 10:00 PM</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    fontSize: 16,
    color: COLORS.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 20,
  },
  contactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  contactOption: {
    backgroundColor: "white",
    width: "48%",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  contactIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  contactSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  faqItem: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    flex: 1,
    marginRight: 12,
  },
  faqToggle: {
    fontSize: 20,
    color: COLORS.primary,
    fontWeight: "bold",
  },
  faqAnswer: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 12,
    lineHeight: 20,
  },
  emergencyCard: {
    backgroundColor: "#FEF2F2",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
  },
  emergencyIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  emergencyContent: {
    flex: 1,
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#DC2626",
    marginBottom: 4,
  },
  emergencyNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#DC2626",
    marginBottom: 4,
  },
  emergencyDescription: {
    fontSize: 14,
    color: "#7F1D1D",
  },
  hoursCard: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  hoursDay: {
    fontSize: 16,
    color: "#000",
    fontWeight: "500",
  },
  hoursTime: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: "600",
  },
})

