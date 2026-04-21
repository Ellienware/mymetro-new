// app/driver/hub.tsx
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader } from '@/components/ui';

const DRIVER_TYPES = [
  {
    icon: '🚌',
    title: 'Minibus Taxi',
    desc: 'Operate on fixed routes, manage passenger counts, and record daily earnings.',
    tag: 'Fixed routes',
    tagColor: COLORS.primaryLight,
    tagText: COLORS.primaryDark,
    route: '/driver/minibus-taxi/register',
    features: ['Fixed route operation', 'Passenger count tracking', 'Daily earnings reports'],
  },
  {
    icon: '🚖',
    title: 'Meter Taxi',
    desc: 'Accept on-demand ride requests, set per-km rates, and get paid digitally.',
    tag: 'On-demand',
    tagColor: COLORS.accentLight,
    tagText: COLORS.accentDark,
    route: '/driver/meter/register',
    features: ['On-demand bookings', 'Per-km fare setting', 'Digital payments'],
  }
];

export default function TaxiDriverHubScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🚀</Text>
          <Text style={styles.heroTitle}>Become a Driver</Text>
          <Text style={styles.heroSub}>Choose the service type that fits your lifestyle and vehicle.</Text>
        </View>

        {/* Cards */}
        {DRIVER_TYPES.map(item => (
          <TouchableOpacity
            key={item.title}
            style={styles.card}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.88}
          >
            {/* Icon + tag row */}
            <View style={styles.cardTop}>
              <View style={styles.cardIconWrap}>
                <Text style={{ fontSize: 32 }}>{item.icon}</Text>
              </View>
              <View style={[styles.cardTag, { backgroundColor: item.tagColor }]}>
                <Text style={[styles.cardTagText, { color: item.tagText }]}>{item.tag}</Text>
              </View>
            </View>

            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDesc}>{item.desc}</Text>

            {/* Feature list */}
            <View style={styles.featureList}>
              {item.features.map(f => (
                <View key={f} style={styles.featureRow}>
                  <View style={[styles.featureDot, { backgroundColor: item.tagText }]} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            <View style={styles.cardFooter}>
              <Text style={[styles.cardCta, { color: item.tagText }]}>Get started →</Text>
            </View>
          </TouchableOpacity>
        ))}

        <Text style={styles.footerNote}>
          All driver applications are reviewed within 1–2 business days.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 48 },

  hero: { alignItems: 'center', paddingVertical: SPACING.lg, marginBottom: SPACING.md },
  heroEmoji: { fontSize: 48, marginBottom: SPACING.sm },
  heroTitle: { ...TYPOGRAPHY.h1, textAlign: 'center', marginBottom: SPACING.xs },
  heroSub: { ...TYPOGRAPHY.body, textAlign: 'center', color: COLORS.textMuted, paddingHorizontal: SPACING.lg },

  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl,
    padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.md,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.sm },
  cardIconWrap: {
    width: 60, height: 60, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center',
  },
  cardTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  cardTagText: { fontSize: 12, fontWeight: '700' },
  cardTitle: { ...TYPOGRAPHY.h2, marginBottom: SPACING.xs },
  cardDesc: { ...TYPOGRAPHY.body, marginBottom: SPACING.md, lineHeight: 22 },

  featureList: { gap: 6, marginBottom: SPACING.md },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  featureDot: { width: 6, height: 6, borderRadius: 3 },
  featureText: { ...TYPOGRAPHY.body, fontSize: 13 },

  cardFooter: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm },
  cardCta: { fontWeight: '700', fontSize: 14 },

  footerNote: { ...TYPOGRAPHY.caption, textAlign: 'center', color: COLORS.textMuted, marginTop: SPACING.xs },
});