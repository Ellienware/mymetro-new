// app/journey-details.tsx
// FIXES:
// - new Date(undefined) → "Invalid Date" crash — all date formatting guarded
// - totalFare.toFixed(2) crashes when totalFare is undefined — guarded
// - journey param was not decodeURIComponent'd — callers use encodeURIComponent
// - legs array was never validated before .map — will crash on bad data
// - ScrollView had no flex:1 so content was cut off on short screens
// - import path for RoutePreviewMap was relative — updated to alias
// REDESIGN: uses full design system (COLORS, TYPOGRAPHY, SPACING, RADIUS)
import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity, FlatList,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader } from '@/components/ui';
import { RoutePreviewMap } from '@/components/RoutePreviewMap';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MODE_ICON: Record<string, string> = { RAIL: '🚆', BUS: '🚌', WALK: '🚶' };
const MODE_LABEL: Record<string, string> = { RAIL: 'Train', BUS: 'Bus', WALK: 'Walk' };
const MODE_COLOR: Record<string, string> = {
  RAIL: COLORS.primaryLight,
  BUS:  COLORS.accentLight,
  WALK: COLORS.border,
};
const MODE_TEXT: Record<string, string> = {
  RAIL: COLORS.primaryDark,
  BUS:  COLORS.accentDark,
  WALK: COLORS.textMuted,
};

// FIX: guard against undefined / Invalid Date
function fmtTime(v: string | undefined | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(sec: number | undefined): string {
  if (!sec || sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

// ─── Leg card ─────────────────────────────────────────────────────────────────
function LegCard({ leg, index, total }: { leg: any; index: number; total: number }) {
  const isLast  = index === total - 1;
  const color   = MODE_COLOR[leg.mode] ?? COLORS.border;
  const txtCol  = MODE_TEXT[leg.mode]  ?? COLORS.textMuted;
  const icon    = MODE_ICON[leg.mode]  ?? '🚍';
  const label   = MODE_LABEL[leg.mode] ?? leg.mode;
  const steps   = Array.isArray(leg.steps) ? leg.steps : [];

  return (
    <View style={styles.legWrapper}>
      {/* Timeline track */}
      <View style={styles.track}>
        <View style={[styles.trackDot, { backgroundColor: color }]}>
          <Text style={styles.trackIcon}>{icon}</Text>
        </View>
        {!isLast && <View style={styles.trackLine} />}
      </View>

      {/* Card body */}
      <View style={[styles.legCard, { marginBottom: isLast ? 0 : SPACING.sm }]}>
        {/* Mode + route name */}
        <View style={styles.legHeader}>
          <View style={[styles.modePill, { backgroundColor: color }]}>
            <Text style={[styles.modePillText, { color: txtCol }]}>
              {label}{leg.routeShortName ? ` · ${leg.routeShortName}` : ''}
            </Text>
          </View>
          <Text style={styles.legTimes}>
            {fmtTime(leg.startTime)} → {fmtTime(leg.endTime)}
          </Text>
        </View>

        {/* From / To */}
        <View style={styles.legRoute}>
          <View style={styles.legRouteRow}>
            <View style={styles.routeDotOrigin} />
            <Text style={styles.legStop} numberOfLines={1}>{leg.from?.name ?? '—'}</Text>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.legRouteRow}>
            <View style={styles.routeDotDest} />
            <Text style={styles.legStop} numberOfLines={1}>{leg.to?.name ?? '—'}</Text>
          </View>
        </View>

        {/* Walking steps */}
        {leg.mode === 'WALK' && steps.length > 0 && (
          <View style={styles.stepsWrap}>
            {steps.map((step: any, si: number) => (
              <Text key={si} style={styles.stepText}>
                · {step.streetName ?? 'Continue'} ({Math.round(step.distance ?? 0)} m)
              </Text>
            ))}
          </View>
        )}

        {/* Duration chip */}
        {leg.durationSec > 0 && (
          <Text style={styles.legDuration}>{fmtDuration(leg.durationSec)}</Text>
        )}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function JourneyDetailsScreen() {
  const { journey } = useLocalSearchParams<{ journey: string }>();

  // FIX: decodeURIComponent — callers use encodeURIComponent before pushing param
  let parsed: any = null;
  try {
    if (journey) parsed = JSON.parse(decodeURIComponent(journey));
  } catch (e) {
    console.error('Failed to parse journey:', e);
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (!parsed || !Array.isArray(parsed.legs) || parsed.legs.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Journey Details" onBack={() => router.back()} />
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🗺️</Text>
          <Text style={styles.emptyTitle}>No journey data</Text>
          <Text style={styles.emptySub}>Journey information is unavailable.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>← Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // FIX: guard all fields against undefined
  const legs:             any[]  = parsed.legs;
  const totalDurationSec: number = parsed.totalDurationSec ?? parsed.totalDuration ?? 0;
  const totalFare:        number = parsed.totalFare ?? 0;
  const departureTime:    string = parsed.departureTime ?? '';
  const arrivalTime:      string = parsed.arrivalTime   ?? '';
  const systemName:       string = parsed.systemName ?? '';

  // Count unique non-walk modes
  const transitLegs = legs.filter((l: any) => l.mode !== 'WALK');
  const transfers   = Math.max(0, transitLegs.length - 1);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Journey Details" onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Map */}
        <RoutePreviewMap legs={legs} />

        {/* Summary card */}
        <View style={styles.summaryCard}>
          {/* Times */}
          <View style={styles.summaryTimes}>
            <View style={styles.summaryTimeBlock}>
              <Text style={styles.summaryTimeLabel}>Departs</Text>
              <Text style={styles.summaryTime}>{fmtTime(departureTime)}</Text>
            </View>
            <View style={styles.summaryArrowWrap}>
              <View style={styles.summaryArrowLine} />
              <Text style={styles.summaryArrow}>→</Text>
              <View style={styles.summaryArrowLine} />
            </View>
            <View style={[styles.summaryTimeBlock, { alignItems: 'flex-end' }]}>
              <Text style={styles.summaryTimeLabel}>Arrives</Text>
              <Text style={styles.summaryTime}>{fmtTime(arrivalTime)}</Text>
            </View>
          </View>

          {/* Stats strip */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{fmtDuration(totalDurationSec)}</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, totalFare > 0 ? { color: COLORS.primary } : { color: COLORS.success }]}>
                {totalFare > 0 ? `R${totalFare.toFixed(2)}` : 'Free'}
              </Text>
              <Text style={styles.statLabel}>Fare</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{transfers === 0 ? 'Direct' : `${transfers}`}</Text>
              <Text style={styles.statLabel}>{transfers === 0 ? '' : 'Transfer' + (transfers > 1 ? 's' : '')}</Text>
            </View>
            {systemName ? (
              <>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { fontSize: 12 }]} numberOfLines={1}>{systemName}</Text>
                  <Text style={styles.statLabel}>System</Text>
                </View>
              </>
            ) : null}
          </View>

          {/* Mode chips */}
          <View style={styles.modeChips}>
            {[...new Set(legs.map((l: any) => l.mode))].map((mode: any, i, arr) => (
              <View key={mode} style={styles.modeChipRow}>
                <View style={[styles.modeChip, { backgroundColor: MODE_COLOR[mode] ?? COLORS.border }]}>
                  <Text style={{ fontSize: 13 }}>{MODE_ICON[mode] ?? '🚍'}</Text>
                  <Text style={[styles.modeChipText, { color: MODE_TEXT[mode] ?? COLORS.textMuted }]}>
                    {MODE_LABEL[mode] ?? mode}
                  </Text>
                </View>
                {i < arr.length - 1 && <Text style={styles.modeArrow}>›</Text>}
              </View>
            ))}
          </View>
        </View>

        {/* Leg-by-leg breakdown */}
        <Text style={styles.sectionLabel}>JOURNEY BREAKDOWN</Text>
        <View style={styles.legsContainer}>
          {legs.map((leg: any, idx: number) => (
            <LegCard key={idx} leg={leg} index={idx} total={legs.length} />
          ))}
        </View>

        {/* Back button */}
        <TouchableOpacity style={styles.backButtonLarge} onPress={() => router.back()}>
          <Text style={styles.backButtonLargeText}>← Back to Results</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll:    { paddingBottom: 48 },

  // ── Empty ──
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyIcon:  { fontSize: 52, marginBottom: SPACING.md },
  emptyTitle: { ...TYPOGRAPHY.h2, marginBottom: SPACING.xs },
  emptySub:   { ...TYPOGRAPHY.body, color: COLORS.textMuted, textAlign: 'center', marginBottom: SPACING.lg },
  backBtn:    { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xl, paddingVertical: 12, borderRadius: RADIUS.lg },
  backBtnText:{ color: '#fff', fontWeight: '700' },

  // ── Summary card ──
  summaryCard: {
    margin: SPACING.md, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl, overflow: 'hidden', ...SHADOWS.md,
  },
  summaryTimes: {
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.lg, paddingBottom: SPACING.md,
  },
  summaryTimeBlock: { flex: 1 },
  summaryTimeLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginBottom: 2 },
  summaryTime:      { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary ?? '#1E293B' },
  summaryArrowWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm },
  summaryArrowLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  summaryArrow:     { fontSize: 18, color: COLORS.primary, fontWeight: '700', marginHorizontal: 4 },

  statsRow:   {
    flexDirection: 'row', backgroundColor: COLORS.background,
    marginHorizontal: SPACING.md, borderRadius: RADIUS.md,
    padding: SPACING.sm, marginBottom: SPACING.md,
  },
  statItem:   { flex: 1, alignItems: 'center' },
  statValue:  { ...TYPOGRAPHY.h3, fontSize: 15, color: COLORS.textPrimary ?? '#1E293B' },
  statLabel:  { ...TYPOGRAPHY.caption, marginTop: 2, textAlign: 'center' },
  statDivider:{ width: 1, backgroundColor: COLORS.border },

  modeChips:  { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  modeChipRow:{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  modeChip:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full },
  modeChipText:{ fontSize: 12, fontWeight: '700' },
  modeArrow:  { fontSize: 14, color: COLORS.textMuted },

  // ── Legs ──
  sectionLabel: {
    ...TYPOGRAPHY.label, textTransform: 'uppercase', letterSpacing: 0.8,
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
  },
  legsContainer: { paddingHorizontal: SPACING.md },

  legWrapper: { flexDirection: 'row', gap: SPACING.sm },

  track:       { alignItems: 'center', width: 40 },
  trackDot:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  trackIcon:   { fontSize: 16 },
  trackLine:   { flex: 1, width: 2, backgroundColor: COLORS.border, marginVertical: 2, minHeight: 16 },

  legCard: {
    flex: 1, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SPACING.md,
    ...SHADOWS.sm,
  },
  legHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: SPACING.sm,
  },
  modePill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  modePillText: { fontSize: 12, fontWeight: '700' },
  legTimes:     { ...TYPOGRAPHY.caption, fontWeight: '600' },

  legRoute:      { marginBottom: SPACING.xs },
  legRouteRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  routeDotOrigin:{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  routeDotDest:  { width: 8, height: 8, borderRadius: 2, backgroundColor: COLORS.accent },
  routeConnector:{ width: 2, height: 10, backgroundColor: COLORS.border, marginLeft: 3 },
  legStop:       { ...TYPOGRAPHY.body, fontSize: 13, flex: 1 },
  legDuration:   { ...TYPOGRAPHY.caption, color: COLORS.primary, fontWeight: '600', marginTop: SPACING.xs, textAlign: 'right' },

  stepsWrap:  { marginTop: SPACING.xs, paddingTop: SPACING.xs, borderTopWidth: 1, borderTopColor: COLORS.border },
  stepText:   { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginBottom: 2 },

  // ── Back button ──
  backButtonLarge: {
    backgroundColor: COLORS.primary, margin: SPACING.md,
    paddingVertical: 14, borderRadius: RADIUS.xl, alignItems: 'center',
    ...SHADOWS.md,
  },
  backButtonLargeText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});