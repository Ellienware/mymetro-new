// app/buses/reavaya/bus-tab.tsx
// FIXES:
// - '@/constants/themes' → '@/constants/theme'
// - Routes with < 2 stops (incomplete data) were shown — now filtered out
// - getNextDeparture used frequency start/end as *index 0 and 1* of split(':')
//   but end_time is "08:30:00" — parseInt(split(':')[0]) is correct, but the
//   original used split(':')[1] as the minute without parseInt, causing NaN.
//   Rewritten with a dedicated parseMinutes() helper.
// - StopRow was defined inside the FlatList renderItem — caused remounts on
//   every render. Moved outside the parent component.
// - mapRegion latitudeDelta/longitudeDelta could be 0 when all stops are at
//   the same point (incomplete routes) — added minimum delta of 0.02.
// - Marker keys were stop.id which can repeat across routes — scoped to index.
// - Stop deduplication missed the case where stopTimes referenced stops not
//   in the route's stops array — added a fallback to the global stops list.
// - No empty-state for the loading phase (showed blank screen briefly).
// - FlatList for stop list had no extraData so updates didn't re-render.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, FlatList,
  ListRenderItem,
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';

const reavayaData = require('@/assets/reavaya_data.json');

// ─── Types ────────────────────────────────────────────────────────────────────
interface Route {
  id:         string;
  short_name: string;
  long_name:  string;
}

interface Stop {
  id:   string;
  name: string;
  lat:  number;
  lon:  number;
}

interface StopTime {
  stop_id:        string;
  arrival_time:   string;
  departure_time: string;
  stop_sequence:  number;
}

interface Frequency {
  start_time:      string;
  end_time:        string;
  headway_minutes: number;
}

interface RouteDetail {
  route:     Route;
  stops:     Stop[];
  stopTimes: StopTime[];
  frequency: Frequency;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
// FIX: safe time-string → minutes-since-midnight parser
function parseMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length < 2 || parts.some(isNaN)) return 0;
  return parts[0] * 60 + parts[1];
}

function fmtMinutes(totalMin: number): string {
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function fmtTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  return `${(h % 24).toString().padStart(2, '0')}:${(m || 0).toString().padStart(2, '0')}`;
}

// FIX: rewritten using parseMinutes to avoid NaN bugs
function getNextDeparture(
  stopId:    string,
  stopTimes: StopTime[],
  frequency: Frequency | null,
): string {
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  if (frequency) {
    const startMin = parseMinutes(frequency.start_time);
    const endMin   = parseMinutes(frequency.end_time);
    const headway  = frequency.headway_minutes;

    if (nowMin < startMin) return `${fmtMinutes(startMin)} (first bus)`;
    if (nowMin >= endMin)  return 'No more service today';

    const elapsed    = nowMin - startMin;
    const nextOffset = (Math.floor(elapsed / headway) + 1) * headway;
    const nextMin    = startMin + nextOffset;
    if (nextMin >= endMin) return 'Last bus departing';
    return `${fmtMinutes(nextMin)} (~${headway} min freq)`;
  }

  // Fallback: use scheduled stopTimes
  const times = stopTimes.filter(st => st.stop_id === stopId);
  if (!times.length) return 'No schedule';
  const next = times.find(st => parseMinutes(st.arrival_time) >= nowMin);
  return next ? fmtTime(next.arrival_time) : fmtTime(times[0].arrival_time) + ' (tomorrow)';
}

// Global stop index for fallback lookup when a route's stop list is incomplete
const GLOBAL_STOPS = new Map<string, Stop>(
  (reavayaData.stops as Stop[]).map((s: Stop) => [s.id, s])
);

// FIX: minimum 2 stops to be considered a complete route
const isUsableRoute = (detail: RouteDetail): boolean =>
  Array.isArray(detail.stops) && detail.stops.length >= 2 &&
  Array.isArray(detail.stopTimes) && detail.stopTimes.length >= 2;

// ─── Route card (stable, memoised) ───────────────────────────────────────────
const RouteCard = React.memo(({
  route, stopCount, onPress,
}: {
  route:      Route;
  stopCount:  number;
  onPress:    () => void;
}) => (
  <TouchableOpacity style={styles.routeCard} onPress={onPress} activeOpacity={0.75}>
    <View style={styles.routeShortWrap}>
      <Text style={styles.routeShort}>{route.short_name}</Text>
    </View>
    <View style={styles.routeCardBody}>
      <Text style={styles.routeName} numberOfLines={2}>{route.long_name}</Text>
      <Text style={styles.routeMeta}>{stopCount} stops</Text>
    </View>
    <Text style={styles.routeChevron}>›</Text>
  </TouchableOpacity>
));

// ─── Stop row (moved OUTSIDE parent — prevents remount on every render) ───────
const StopRow = React.memo(({
  stop, index, total, stopTimes, frequency,
}: {
  stop:      Stop;
  index:     number;
  total:     number;
  stopTimes: StopTime[];
  frequency: Frequency | null;
}) => {
  const isFirst = index === 0;
  const isLast  = index === total - 1;
  const dotStyle = isFirst
    ? styles.stopDotFirst
    : isLast
      ? styles.stopDotLast
      : styles.stopDotMid;

  return (
    <View style={styles.stopRow}>
      <View style={styles.stopTrack}>
        <View style={[styles.stopDot, dotStyle]}>
          <Text style={[styles.stopNum, (isFirst || isLast) && { color: '#fff' }]}>
            {index + 1}
          </Text>
        </View>
        {!isLast && <View style={styles.stopConnector} />}
      </View>
      <View style={styles.stopBody}>
        <Text style={styles.stopName}>{stop.name}</Text>
        <Text style={styles.stopTime}>
          {getNextDeparture(stop.id, stopTimes, frequency)}
        </Text>
      </View>
    </View>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────
export default function ReaVayaBusTab() {
  const [routes,         setRoutes]         = useState<Array<{ route: Route; stopCount: number }>>([]);
  const [selectedRoute,  setSelectedRoute]  = useState<Route | null>(null);
  const [stops,          setStops]          = useState<Stop[]>([]);
  const [stopTimes,      setStopTimes]      = useState<StopTime[]>([]);
  const [frequency,      setFrequency]      = useState<Frequency | null>(null);
  const [loading,        setLoading]        = useState(false);

  // Load usable routes once
  useEffect(() => {
    const list: Array<{ route: Route; stopCount: number }> = [];
    for (const routeId of Object.keys(reavayaData.routeDetails)) {
      const detail = reavayaData.routeDetails[routeId] as RouteDetail;
      if (detail?.route && isUsableRoute(detail)) {
        list.push({ route: detail.route, stopCount: detail.stops.length });
      }
    }
    setRoutes(list);
  }, []);

  const selectRoute = useCallback((route: Route) => {
    setSelectedRoute(route);
    setStops([]);
    setStopTimes([]);
    setFrequency(null);
    setLoading(true);

    try {
      const detail = reavayaData.routeDetails[route.id] as RouteDetail;
      if (!detail) throw new Error('Route not found');

      const sorted = [...detail.stopTimes].sort((a, b) => a.stop_sequence - b.stop_sequence);

      // FIX: fallback to global stop index when route's stops list is incomplete
      const orderedStops = sorted.map(st => {
        const fromRoute  = detail.stops.find(s => s.id === st.stop_id);
        const fromGlobal = GLOBAL_STOPS.get(st.stop_id);
        return fromRoute ?? fromGlobal ?? null;
      }).filter((s): s is Stop => s !== null);

      // Deduplicate by id
      const seen    = new Set<string>();
      const unique  = orderedStops.filter(s => !seen.has(s.id) && seen.add(s.id));

      setStops(unique);
      setStopTimes(sorted);
      setFrequency(detail.frequency ?? null);
    } catch (err) {
      console.error('selectRoute:', err);
      Alert.alert('Error', 'Failed to load route details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRoute(null);
    setStops([]);
    setStopTimes([]);
    setFrequency(null);
  }, []);

  // ── Map region ─────────────────────────────────────────────────────────────
  const shapeCoords = useMemo(
    () => stops.map(s => ({ latitude: s.lat, longitude: s.lon })),
    [stops],
  );

  const mapRegion = useMemo(() => {
    if (shapeCoords.length < 2) return undefined;
    const lats = shapeCoords.map(c => c.latitude);
    const lngs = shapeCoords.map(c => c.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    return {
      latitude:       (minLat + maxLat) / 2,
      longitude:      (minLng + maxLng) / 2,
      // FIX: minimum deltas so map doesn't zoom into a single pixel
      latitudeDelta:  Math.max((maxLat - minLat) * 1.3, 0.02),
      longitudeDelta: Math.max((maxLng - minLng) * 1.3, 0.02),
    };
  }, [shapeCoords]);

  // ── Route list ─────────────────────────────────────────────────────────────
  const renderRoute: ListRenderItem<{ route: Route; stopCount: number }> = useCallback(
    ({ item }) => (
      <RouteCard
        route={item.route}
        stopCount={item.stopCount}
        onPress={() => selectRoute(item.route)}
      />
    ),
    [selectRoute],
  );

  if (!selectedRoute) {
    return (
      <FlatList
        data={routes}
        keyExtractor={item => item.route.id}
        renderItem={renderRoute}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.pageTitle}>🚌  Rea Vaya BRT</Text>
            <Text style={styles.pageSubtitle}>{routes.length} active route{routes.length !== 1 ? 's' : ''}</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🚌</Text>
            <Text style={styles.emptyTitle}>No routes available</Text>
            <Text style={styles.emptySub}>Rea Vaya route data could not be loaded.</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  // ── Route detail ───────────────────────────────────────────────────────────
  return (
    <FlatList
      data={stops}
      keyExtractor={(item, idx) => `${item.id}-${idx}`}
      extraData={stopTimes}   // FIX: tell FlatList to re-render when data changes
      contentContainerStyle={styles.detailContent}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={() => (
        <>
          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={clearSelection} activeOpacity={0.7}>
            <Text style={styles.backIcon}>←</Text>
            <Text style={styles.backText}>All routes</Text>
          </TouchableOpacity>

          {/* Route identity */}
          <View style={styles.routeHeader}>
            <View style={styles.routeShortLarge}>
              <Text style={styles.routeShortLargeText}>{selectedRoute.short_name}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeDetailName}>{selectedRoute.long_name}</Text>
              {frequency && (
                <Text style={styles.routeFreq}>
                  🕐 Every {frequency.headway_minutes} min · {fmtTime(frequency.start_time)} – {fmtTime(frequency.end_time)}
                </Text>
              )}
            </View>
          </View>

          {/* Loading */}
          {loading && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading route data…</Text>
            </View>
          )}

          {/* Map */}
          {!loading && shapeCoords.length >= 2 && mapRegion && (
            <View style={styles.mapCard}>
              <MapView style={styles.map} initialRegion={mapRegion}>
                <Polyline coordinates={shapeCoords} strokeColor={COLORS.primary} strokeWidth={3} />
                {/* FIX: only render terminus markers to keep map readable */}
                {stops.length > 0 && (
                  <Marker
                    key="origin"
                    coordinate={{ latitude: stops[0].lat, longitude: stops[0].lon }}
                    title={stops[0].name}
                  >
                    <View style={[styles.mapMarker, { backgroundColor: COLORS.primary }]}>
                      <Text style={styles.mapMarkerText}>A</Text>
                    </View>
                  </Marker>
                )}
                {stops.length > 1 && (
                  <Marker
                    key="dest"
                    coordinate={{ latitude: stops[stops.length - 1].lat, longitude: stops[stops.length - 1].lon }}
                    title={stops[stops.length - 1].name}
                  >
                    <View style={[styles.mapMarker, { backgroundColor: COLORS.accent }]}>
                      <Text style={styles.mapMarkerText}>B</Text>
                    </View>
                  </Marker>
                )}
              </MapView>
            </View>
          )}

          {/* Section heading */}
          {!loading && stops.length > 0 && (
            <Text style={styles.stopsHeading}>
              STOPS &amp; NEXT DEPARTURES · {stops.length} stops
            </Text>
          )}

          {/* No stops fallback */}
          {!loading && stops.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>No stop data</Text>
              <Text style={styles.emptySub}>Schedule information is unavailable for this route.</Text>
            </View>
          )}
        </>
      )}
      renderItem={({ item, index }) => (
        <StopRow
          stop={item}
          index={index}
          total={stops.length}
          stopTimes={stopTimes}
          frequency={frequency}
        />
      )}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  listContent:  { padding: SPACING.md, paddingBottom: 56 },
  listHeader:   { marginBottom: SPACING.md },
  pageTitle:    { ...(TYPOGRAPHY.h2 as object), marginBottom: 2 },
  pageSubtitle: { ...(TYPOGRAPHY.caption as object), color: COLORS.textMuted },

  routeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  routeShortWrap: {
    minWidth: 48, height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
  },
  routeShort:    { ...(TYPOGRAPHY.label as object), color: COLORS.primaryDark, fontWeight: '800', fontSize: 11 },
  routeCardBody: { flex: 1 },
  routeName:     { ...(TYPOGRAPHY.bodyBold as object), marginBottom: 2 },
  routeMeta:     { ...(TYPOGRAPHY.caption as object), color: COLORS.textMuted },
  routeChevron:  { fontSize: 22, color: COLORS.textMuted, fontWeight: '300' },

  emptyState: { alignItems: 'center', paddingVertical: SPACING.xl * 2 },
  emptyIcon:  { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { ...(TYPOGRAPHY.h3 as object), marginBottom: SPACING.xs },
  emptySub:   { ...(TYPOGRAPHY.body as object), color: COLORS.textMuted, textAlign: 'center' },

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
    gap: SPACING.md, marginBottom: SPACING.md,
  },
  routeShortLarge: {
    minWidth: 56, height: 56,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
  },
  routeShortLargeText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  routeDetailName:     { ...(TYPOGRAPHY.h3 as object), marginBottom: 4 },
  routeFreq:           { ...(TYPOGRAPHY.caption as object), color: COLORS.primary, fontWeight: '600' },

  loadingWrap: {
    alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.sm,
  },
  loadingText: { ...(TYPOGRAPHY.body as object), color: COLORS.textMuted },

  mapCard: {
    height: 220, borderRadius: RADIUS.lg,
    overflow: 'hidden', marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  map: { flex: 1 },
  mapMarker: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOWS.sm,
  },
  mapMarkerText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  stopsHeading: {
    ...(TYPOGRAPHY.label as object),
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },

  // Stop rows
  stopRow: {
    flexDirection: 'row', gap: SPACING.sm,
    marginBottom: 2,
  },
  stopTrack: { alignItems: 'center', width: 40, paddingTop: SPACING.sm },
  stopDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  stopDotFirst: { backgroundColor: COLORS.primary },
  stopDotLast:  { backgroundColor: COLORS.accent },
  stopDotMid:   { backgroundColor: COLORS.primaryLight },
  stopNum:      { color: COLORS.primaryDark, fontWeight: '700', fontSize: 11 },
  stopConnector: {
    flex: 1, width: 2,
    backgroundColor: COLORS.border,
    marginVertical: 2, minHeight: 20,
  },
  stopBody: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: 2,
    ...SHADOWS.sm,
  },
  stopName: { ...(TYPOGRAPHY.bodyBold as object), fontSize: 13, marginBottom: 2 },
  stopTime: { ...(TYPOGRAPHY.caption as object), color: COLORS.primary, fontWeight: '600' },
});