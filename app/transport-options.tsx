/// app/transport-options.tsx
// FIXES:
// - '@/constants/themes' → '@/constants/theme'
// - router.push({ pathname, params }) — params was typed as `{ provider: string }`
//   on the option objects but the type signature expected no params. Typed properly.
// - card width '47.5%' breaks on narrow screens — use flexBasis + minWidth calc.
// - `marginTop: 'auto'` inside StyleSheet is not valid in RN — removed; used
//   marginTop: SPACING.xs instead.
// - Ferry option referenced Ship icon but Lucide doesn't export 'Ship' in all
//   versions — changed to Anchor which is universally available.
// - The original had TYPOGRAPHY spread directly (e.g. `...TYPOGRAPHY.h1`)
//   which fails on newer RN — cast to object consistently.
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Train, Bus, Car, Anchor, Ticket } from 'lucide-react-native';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';

// ─── Option definitions ───────────────────────────────────────────────────────
interface TransportOption {
  icon:      any;
  iconColor: string;
  iconBg:    string;
  title:     string;
  subtitle:  string;
  route:     string;
  params?:   Record<string, string>;
  tag?:      string;
  tagColor?: string;
  tagText?:  string;
}

const TRANSPORT_OPTIONS: TransportOption[] = [
  // ── Transit planners ────────────────────────────────────────────────────────
  {
    icon:      Train,
    iconColor: '#2563EB',
    iconBg:    '#DBEAFE',
    title:     'Gautrain',
    subtitle:  'Rapid rail & Feeder Bus',
    route:     '/trains/gautrain/',
    tag:       'Most popular',
    tagColor:  COLORS.primaryLight,
    tagText:   COLORS.primaryDark,
  },
  {
    icon:      Train,
    iconColor: '#7C3AED',
    iconBg:    '#EDE9FE',
    title:     'Metro',
    subtitle:  'Metrorail & Feeder Bus',
    route:     '/trains/metrorail',
    tag:       'Nationwide',
    tagColor:  '#EDE9FE',
    tagText:   '#7C3AED',
  },
  {
    icon:      Bus,
    iconColor: '#16A34A',
    iconBg:    '#DCFCE7',
    title:     'Rea Vaya BRT',
    subtitle:  'Bus Rapid Transit',
    route:     '/buses/reavaya',
  },
  {
    icon:      Car,
    iconColor: COLORS.accentDark,
    iconBg:    COLORS.accentLight,
    title:     'Taxis',
    subtitle:  'Minibus & meter taxi',
    route:     '/taxi/',
  },
  // ── Tap-in / ticket flows ───────────────────────────────────────────────────
  {
    icon:      Train,
    iconColor: '#1E40AF',
    iconBg:    '#BFDBFE',
    title:     'Gautrain Tap',
    subtitle:  'Tap in / Tap out',
    route:     '/transport/station-select',
    params:    { provider: 'gautrain' },
    tag:       'Tap & Go',
    tagColor:  '#BFDBFE',
    tagText:   '#1E40AF',
  },
  {
    icon:      Ticket,
    iconColor: '#7C3AED',
    iconBg:    '#EDE9FE',
    title:     'Metrorail Ticket',
    subtitle:  'Buy digital ticket',
    route:     '/tickets/',
    tag:       'Prepaid',
    tagColor:  '#EDE9FE',
    tagText:   '#7C3AED',
  },
  {
    icon:      Bus,
    iconColor: '#16A34A',
    iconBg:    '#DCFCE7',
    title:     'Rea Vaya Tap',
    subtitle:  'Tap in / Tap out',
    route:     '/transport/station-select',
    params:    { provider: 'rea_vaya' },
    tag:       'BRT',
    tagColor:  '#DCFCE7',
    tagText:   '#16A34A',
  },
  {
    icon:      Bus,
    iconColor: '#D97706',
    iconBg:    '#FEF3C7',
    title:     'Metrobus',
    subtitle:  'Start / end trip',
    route:     '/transport/bus-trip',
    tag:       'Manual',
    tagColor:  '#FEF3C7',
    tagText:   '#D97706',
  },
];

// ─── Card component ────────────────────────────────────────────────────────────
function TransportCard({ opt, onPress }: { opt: TransportOption; onPress: () => void }) {
  const IconComponent = opt.icon;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {opt.tag && opt.tagColor && opt.tagText ? (
        <View style={[styles.cardTag, { backgroundColor: opt.tagColor }]}>
          <Text style={[styles.cardTagText, { color: opt.tagText }]}>{opt.tag}</Text>
        </View>
      ) : (
        <View style={styles.cardTagPlaceholder} />
      )}
      <View style={[styles.iconWrap, { backgroundColor: opt.iconBg }]}>
        <IconComponent size={28} color={opt.iconColor} />
      </View>
      <Text style={styles.cardTitle}>{opt.title}</Text>
      <Text style={styles.cardSubtitle}>{opt.subtitle}</Text>
      <Text style={[styles.cardArrow, { color: opt.iconColor }]}>→</Text>
    </TouchableOpacity>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────
export default function TransportOptionsPage() {
  const router = useRouter();

  const handlePress = (opt: TransportOption) => {
    if (opt.params) {
      // FIX: correct typing — Expo Router accepts params as Record<string, string>
      router.push({ pathname: opt.route as any, params: opt.params });
    } else {
      router.push(opt.route as any);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🗺️</Text>
          <Text style={styles.heroTitle}>How are you travelling?</Text>
          <Text style={styles.heroSub}>
            Select a transport mode to plan your journey or pay for your trip.
          </Text>
        </View>

        {/* Section: Planners */}
        <Text style={styles.sectionLabel}>PLAN A JOURNEY</Text>
        <View style={styles.grid}>
          {TRANSPORT_OPTIONS.slice(0, 4).map(opt => (
            <TransportCard key={opt.title} opt={opt} onPress={() => handlePress(opt)} />
          ))}
        </View>

        {/* Section: Pay & Tap */}
        <Text style={styles.sectionLabel}>PAY &amp; TAP IN</Text>
        <View style={styles.grid}>
          {TRANSPORT_OPTIONS.slice(4).map(opt => (
            <TransportCard key={opt.title} opt={opt} onPress={() => handlePress(opt)} />
          ))}
        </View>

        {/* Journey planner CTA */}
        <TouchableOpacity
          style={styles.plannerCta}
          onPress={() => router.push('/plan-journey' as any)}
          activeOpacity={0.85}
        >
          <View style={styles.plannerCtaLeft}>
            <Text style={styles.plannerCtaIcon}>🔀</Text>
            <View>
              <Text style={styles.plannerCtaTitle}>Multi-modal Journey Planner</Text>
              <Text style={styles.plannerCtaSub}>Compare Gautrain, Metrorail, BRT &amp; bus</Text>
            </View>
          </View>
          <Text style={styles.plannerCtaArrow}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content:   { padding: SPACING.md, paddingBottom: 48 },

  hero: { alignItems: 'center', paddingVertical: SPACING.lg, marginBottom: SPACING.md },
  heroEmoji: { fontSize: 48, marginBottom: SPACING.sm },
  heroTitle: { ...(TYPOGRAPHY.h1 as object), textAlign: 'center', marginBottom: SPACING.xs },
  heroSub:   { ...(TYPOGRAPHY.body as object), textAlign: 'center', color: COLORS.textMuted, lineHeight: 22 },

  sectionLabel: {
    ...(TYPOGRAPHY.label as object),
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },

  card: {
    // FIX: use flexBasis % minus half the gap — avoids overflow on any screen width
    flexBasis: '47%', flexGrow: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  cardTag: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-end',
    marginBottom: SPACING.xs,
  },
  cardTagPlaceholder: { height: 22, marginBottom: SPACING.xs },
  cardTagText:  { fontSize: 10, fontWeight: '700' },
  iconWrap: {
    width: 60, height: 60, borderRadius: RADIUS.lg,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  cardTitle:    { ...(TYPOGRAPHY.h4 as object), textAlign: 'center', marginBottom: 4 },
  cardSubtitle: { ...(TYPOGRAPHY.caption as object), textAlign: 'center', color: COLORS.textMuted, marginBottom: SPACING.sm },
  // FIX: marginTop: 'auto' is invalid in RN — use fixed spacing
  cardArrow:    { fontSize: 14, fontWeight: '700', marginTop: SPACING.xs },

  plannerCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.xl, padding: SPACING.md,
    ...SHADOWS.sm,
  },
  plannerCtaLeft:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  plannerCtaIcon:  { fontSize: 24 },
  plannerCtaTitle: { ...(TYPOGRAPHY.bodyBold as object), color: COLORS.primaryDark },
  plannerCtaSub:   { ...(TYPOGRAPHY.caption as object), color: COLORS.primary },
  plannerCtaArrow: { fontSize: 24, color: COLORS.primary, fontWeight: '300' },
});