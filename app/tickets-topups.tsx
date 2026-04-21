import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, TYPOGRAPHY, SPACING } from '@/constants/theme';

const sections = [
  {
    title: 'Trains',
    items: [
      { id: 'metrorail-tickets', name: 'Metrorail Tickets', icon: '🎫', route: '/metrorail/tickets' },
      { id: 'gautrain-cards', name: 'Gautrain Tickets', icon: '🎫', route: '/gautrain/buy-ticket' },
    ],
  },
  {
    title: 'Buses',
    items: [
      { id: 'rea-vaya-points', name: 'Rea Vaya Points', icon: '🚍', route: '/rea-vaya/buy-points' },
      { id: 'metrobus-topup', name: 'Metrobus Top‑Up', icon: '🚌', route: '/metrobus/top-up' },
    ],
  },
  {
    title: 'Other',
    items: [
      { id: 'pay-bills', name: 'Pay Bills', icon: '📃', route: '/pay-bills' },
    ],
  },
];

export default function TicketsTopupsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tickets & Top‑Ups</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.cardGrid}>
              {section.items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.cardWrapper}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#FFFFFF', '#F9FAFB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.card}
                  >
                    <Text style={styles.cardIcon}>{item.icon}</Text>
                    <Text style={styles.cardName}>{item.name}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: { padding: SPACING.xs },
  backText: { fontSize: TYPOGRAPHY.fontSizes.base, color: COLORS.primary },
  headerTitle: { fontSize: TYPOGRAPHY.fontSizes.xl, fontWeight: 'bold', color: COLORS.gray900 },
  content: { padding: SPACING.xl },
  section: { marginBottom: SPACING.xl },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizes.lg,
    fontWeight: '600',
    color: COLORS.gray900,
    marginBottom: SPACING.md,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  cardWrapper: {
    width: '48%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  card: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  cardIcon: { fontSize: 32, marginBottom: SPACING.sm },
  cardName: { fontSize: TYPOGRAPHY.fontSizes.sm, fontWeight: '500', color: COLORS.gray900, textAlign: 'center' },
});