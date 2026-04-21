// app/trains/metrorail/bus-tab.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  ListRenderItem,
  ScrollView,
} from 'react-native';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { Card } from '@/components/ui';

const metrobusData = require('@/assets/metrobus_data.json');

// ─── Types ────────────────────────────────────────────────────────────────────

interface BusRoute {
  id: string;
  short_name: string;
  long_name: string;
}

interface BusStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

interface StopTime {
  stop_id:        string;
  arrival_time:   string;   // may be "25:30:00" for post-midnight GTFS
  departure_time: string;
  stop_sequence:  number;
}

interface Frequency {
  start_time:      string;
  end_time:        string;
  headway_minutes: number;
}

interface RouteDetail {
  route:     BusRoute;
  stops:     BusStop[];
  stopTimes: StopTime[];
  frequency: Frequency | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse a time string "HH:MM:SS" or "HH:MM" to total minutes since midnight.
 * Handles GTFS post-midnight times like "25:30:00" (= 1530 minutes).
 */
function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  // Ignore seconds for departure display purposes
  return h * 60 + m;
}

/**
 * Format a (possibly post-midnight) GTFS time string to HH:MM display.
 * "25:30:00" → "01:30"
 */
function fmtGtfsTime(timeStr: string): string {
  const parts = timeStr.split(':').map(Number);
  const h = (parts[0] ?? 0) % 24;
  const m = parts[1] ?? 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getNextDeparture(
  stopId: string,
  stopTimes: StopTime[],
  frequency: Frequency | null,
): string {
  const now    = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (frequency) {
    const startMin = timeToMinutes(frequency.start_time);
    const endMin   = timeToMinutes(frequency.end_time);
    const headway  = frequency.headway_minutes;

    if (nowMin < startMin) return fmtGtfsTime(frequency.start_time);
    if (nowMin >= endMin)  return 'No more service today';

    const elapsed  = nowMin - startMin;
    const nextMin  = startMin + (Math.floor(elapsed / headway) + 1) * headway;
    if (nextMin >= endMin) return 'Last bus soon';

    const displayH = Math.floor(nextMin / 60) % 24;
    const displayM = nextMin % 60;
    return `${String(displayH).padStart(2, '0')}:${String(displayM).padStart(2, '0')}`;
  }

  // FIX: filter by stop_id and find next departure using corrected timeToMinutes
  const times = stopTimes.filter(st => st.stop_id === stopId);
  if (!times.length) return 'No schedule';

  const next = times.find(st => timeToMinutes(st.arrival_time) >= nowMin);
  const chosen = next ?? times[0];
  return fmtGtfsTime(chosen.arrival_time);
}

// ─── Route card (memoised) ────────────────────────────────────────────────────

const RouteCard = React.memo(({ route, onPress }: { route: BusRoute; onPress: () => void }) => (
  <TouchableOpacity style={styles.routeCard} onPress={onPress} activeOpacity={0.75}>
    <View style={styles.routeBadge}>
      <Text style={styles.routeBadgeText} numberOfLines={1}>{route.short_name}</Text>
    </View>
    <View style={styles.routeCardBody}>
      <Text style={styles.routeName} numberOfLines={1}>{route.long_name}</Text>
    </View>
    <Text style={styles.routeChevron}>›</Text>
  </TouchableOpacity>
));

// ─── Main component ───────────────────────────────────────────────────────────

export default function MetrobusTab() {
  const [routes,        setRoutes]        = useState<BusRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<BusRoute | null>(null);
  const [routeDetail,   setRouteDetail]   = useState<RouteDetail | null>(null);
  const [loading,       setLoading]       = useState(false);

  // FIX: Handle both flat route objects AND nested { route: BusRoute } shape
  useEffect(() => {
    try {
      const raw = metrobusData.routes;
      if (!raw) { setRoutes([]); return; }

      let routeList: BusRoute[];
      if (Array.isArray(raw)) {
        // Flat array of BusRoute
        routeList = raw as BusRoute[];
      } else {
        // Object keyed by route_id — values may be RouteDetail or bare BusRoute
        routeList = Object.values(raw).map((v: any) => {
          // If the value has a .route sub-key (RouteDetail shape), unwrap it
          return (v as any).route ?? (v as BusRoute);
        });
      }
      setRoutes(routeList.filter(r => r?.id && r?.long_name));
    } catch (e) {
      console.error('Failed to parse metrobus routes:', e);
      setRoutes([]);
    }
  }, []);

  const selectRoute = useCallback(async (routeId: string) => {
    setLoading(true);
    setRouteDetail(null);
    try {
      // Support both array and object shapes in the JSON
      let detail: RouteDetail | null = null;

      if (Array.isArray(metrobusData.routes)) {
        // If routes is an array, look for detail in a separate key
        detail = (metrobusData.routeDetails?.[routeId] ?? null) as RouteDetail | null;
      } else {
        detail = (metrobusData.routes[routeId] as RouteDetail) ?? null;
      }

      if (!detail) throw new Error(`Route ${routeId} not found`);

      // Validate shape
      if (!Array.isArray(detail.stops)) {
        throw new Error('Route detail missing stops array');
      }

      // Sort stop times by sequence to ensure correct order
      const sortedStopTimes = [...(detail.stopTimes ?? [])].sort(
        (a, b) => Number(a.stop_sequence) - Number(b.stop_sequence),
      );

      setRouteDetail({ ...detail, stopTimes: sortedStopTimes });
      setSelectedRoute(detail.route);
    } catch (err) {
      console.error('selectRoute:', err);
      Alert.alert('Error', 'Could not load route details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRoute(null);
    setRouteDetail(null);
  }, []);

  const frequencyText = useMemo(() => {
    const f = routeDetail?.frequency;
    if (!f) return 'Fixed schedule';
    return `Every ${f.headway_minutes} min  ·  ${fmtGtfsTime(f.start_time)} – ${fmtGtfsTime(f.end_time)}`;
  }, [routeDetail?.frequency]);

  const keyExtractor = useCallback((item: BusRoute) => item.id, []);

  const renderRoute: ListRenderItem<BusRoute> = useCallback(({ item }) => (
    <RouteCard route={item} onPress={() => selectRoute(item.id)} />
  ), [selectRoute]);

  const ListEmpty = useMemo(() => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🚌</Text>
      <Text style={styles.emptyTitle}>No routes available</Text>
      <Text style={styles.emptySub}>Metrobus route data could not be loaded.</Text>
    </View>
  ), []);

  // ── Route list screen ──────────────────────────────────────────────────────

  if (!selectedRoute) {
    return (
      <FlatList
        data={routes}
        keyExtractor={keyExtractor}
        renderItem={renderRoute}
        ListHeaderComponent={
          <Text style={styles.pageTitle}>🚌  Metrobus Routes</Text>
        }
        ListEmptyComponent={
          routes.length === 0 ? ListEmpty : undefined
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  // ── Loading screen ─────────────────────────────────────────────────────────

  if (loading || !routeDetail) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading route…</Text>
      </View>
    );
  }

  // ── Route detail screen ────────────────────────────────────────────────────

  const { stops, stopTimes, frequency } = routeDetail;

  return (
    <FlatList
      data={stops}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.detailContent}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={clearSelection} activeOpacity={0.7}>
            <Text style={styles.backIcon}>←</Text>
            <Text style={styles.backText}>All routes</Text>
          </TouchableOpacity>

          {/* Route header */}
          <View style={styles.routeHeader}>
            <View style={styles.routeBadgeLarge}>
              <Text style={styles.routeBadgeLargeText}>{selectedRoute.short_name}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeDetailName}>{selectedRoute.long_name}</Text>
              <View style={styles.freqChip}>
                <Text style={styles.freqChipIcon}>⏱️</Text>
                <Text style={styles.freqChipText}>{frequencyText}</Text>
              </View>
            </View>
          </View>

          {stops.length > 0 && (
            <Text style={styles.stopsHeading}>
              {stops.length} Stop{stops.length !== 1 ? 's' : ''}
            </Text>
          )}

          {stops.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>No stop data</Text>
              <Text style={styles.emptySub}>Schedule data is unavailable for this route.</Text>
            </View>
          )}
        </>
      }
      renderItem={({ item: stop, index }) => (
        <View style={styles.stopRow}>
          {/* Track indicator */}
          <View style={styles.stopTrack}>
            <View style={[
              styles.stopDot,
              index === 0 && styles.stopDotFirst,
              index === stops.length - 1 && styles.stopDotLast,
            ]}>
              <Text style={styles.stopNum}>{index + 1}</Text>
            </View>
            {index < stops.length - 1 && <View style={styles.stopConnector} />}
          </View>
          {/* Stop info */}
          <View style={styles.stopBody}>
            <Text style={styles.stopName}>{stop.name}</Text>
            <Text style={styles.stopTime}>
              Next: {getNextDeparture(stop.id, stopTimes, frequency)}
            </Text>
          </View>
        </View>
      )}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // List
  listContent: { padding: SPACING.md, paddingBottom: 56 },
  pageTitle:   { ...(TYPOGRAPHY.h2 as object), marginBottom: SPACING.lg, color: COLORS.textPrimary ?? '#1E293B' },

  routeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  routeBadge: {
    minWidth: 44, height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
  },
  routeBadgeText: { ...(TYPOGRAPHY.label as object), color: COLORS.primaryDark, fontWeight: '800', fontSize: 11 },
  routeCardBody:  { flex: 1 },
  routeName:      { ...(TYPOGRAPHY.bodyBold as object), color: COLORS.textPrimary ?? '#1E293B' },
  routeChevron:   { fontSize: 22, color: COLORS.textMuted, fontWeight: '300' },

  emptyState: { alignItems: 'center', paddingVertical: SPACING.xl * 2 },
  emptyIcon:  { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { ...(TYPOGRAPHY.h3 as object), color: COLORS.textPrimary ?? '#1E293B', marginBottom: SPACING.xs },
  emptySub:   { ...(TYPOGRAPHY.body as object), color: COLORS.textMuted, textAlign: 'center' },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.sm },
  loadingText:      { ...(TYPOGRAPHY.body as object), color: COLORS.textMuted },

  // Detail
  detailContent: { padding: SPACING.md, paddingBottom: 56 },

  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginBottom: SPACING.md,
    paddingVertical: 6, paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.border,
  },
  backIcon: { fontSize: 16, color: COLORS.primary, fontWeight: '700' },
  backText: { ...(TYPOGRAPHY.bodyBold as object), color: COLORS.primary, fontSize: 14 },

  routeHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: SPACING.md, marginBottom: SPACING.lg,
  },
  routeBadgeLarge: {
    minWidth: 56, height: 56,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
  },
  routeBadgeLargeText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  routeDetailName:     { ...(TYPOGRAPHY.h3 as object), color: COLORS.textPrimary ?? '#1E293B', marginBottom: SPACING.xs },
  freqChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingVertical: 4, paddingHorizontal: SPACING.sm,
    alignSelf: 'flex-start',
  },
  freqChipIcon: { fontSize: 12 },
  freqChipText: { ...(TYPOGRAPHY.caption as object), color: COLORS.primaryDark, fontWeight: '600' },

  stopsHeading: {
    ...(TYPOGRAPHY.bodyBold as object),
    color: COLORS.textPrimary ?? '#1E293B',
    marginBottom: SPACING.sm,
  },

  // Stop rows with timeline track
  stopRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    marginBottom: 2,
    paddingRight: SPACING.md,
    ...SHADOWS.sm,
  },
  stopTrack:     { width: 48, alignItems: 'center', paddingTop: SPACING.sm },
  stopDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  stopDotFirst:  { backgroundColor: COLORS.primary },
  stopDotLast:   { backgroundColor: COLORS.accent },
  stopNum:       { color: COLORS.primaryDark, fontWeight: '700', fontSize: 11 },
  stopConnector: { flex: 1, width: 2, backgroundColor: COLORS.border, marginVertical: 2, minHeight: 20 },
  stopBody:      { flex: 1, paddingVertical: SPACING.sm },
  stopName:      { ...(TYPOGRAPHY.bodyBold as object), fontSize: 13, color: COLORS.textPrimary ?? '#1E293B', marginBottom: 2 },
  stopTime:      { ...(TYPOGRAPHY.caption as object), color: COLORS.textMuted },
});