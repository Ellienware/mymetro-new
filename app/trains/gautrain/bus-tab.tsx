// app/trains/gautrain/bus-tab.tsx
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
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { Card } from '@/components/ui';

// ─── GTFS data ────────────────────────────────────────────────────────────────
const routesData:    BusRoute[]    = require('@/assets/gtfs/gautrain/routes.json');
const tripsData:     GtfsTrip[]   = require('@/assets/gtfs/gautrain/trips.json');
const stopTimesData: GtfsStopTime[] = require('@/assets/gtfs/gautrain/stop_times.json');
const stopsData:     GtfsStop[]   = require('@/assets/gtfs/gautrain/stops.json');
const shapesData:    ShapePoint[]  = require('@/assets/gtfs/gautrain/shapes.json');

// ─── Types ────────────────────────────────────────────────────────────────────

interface BusRoute {
  route_id:         string;
  route_short_name: string;
  route_long_name:  string;
  route_desc:       string;
  route_type:       number | string;
}

interface GtfsTrip {
  route_id: string;
  trip_id:  string;
  shape_id: string;
}

interface GtfsStopTime {
  trip_id:        string;
  stop_id:        string;
  arrival_time:   string;   // may be "25:30:00" for post-midnight GTFS
  departure_time: string;
  stop_sequence:  number;
}

interface GtfsStop {
  stop_id:   string;
  stop_name: string;
  stop_lat:  number;
  stop_lon:  number;
}

interface ShapePoint {
  shape_id:          string;
  shape_pt_lat:      number;
  shape_pt_lon:      number;
  shape_pt_sequence: number;
}

interface ResolvedStopTime {
  stop_id:       string;
  arrival_time:  string;   // original GTFS string e.g. "25:30:00"
  stop_sequence: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse a GTFS time string that may exceed 23:59 (valid GTFS for post-midnight
 * trips) into total minutes since midnight.  E.g. "25:30:00" → 1530.
 */
function gtfsTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Format a GTFS time string to HH:MM, clamping hours ≥ 24 back to display
 * time (e.g. "25:30:00" → "01:30").
 */
function fmtGtfsTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const displayH = h % 24;
  return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getNextDeparture(stopId: string, stopTimes: ResolvedStopTime[]): string {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const times = stopTimes.filter(st => st.stop_id === stopId);
  if (!times.length) return 'No schedule';
  const next = times.find(st => gtfsTimeToMinutes(st.arrival_time) >= nowMin);
  const chosen = next ?? times[0];
  return fmtGtfsTime(chosen.arrival_time);
}

// ─── Route list item ──────────────────────────────────────────────────────────

const RouteCard = React.memo(({ route, onPress }: { route: BusRoute; onPress: () => void }) => (
  <TouchableOpacity style={styles.routeCard} onPress={onPress} activeOpacity={0.75}>
    <View style={styles.routeShortWrap}>
      <Text style={styles.routeShort}>{route.route_short_name}</Text>
    </View>
    <View style={styles.routeCardBody}>
      <Text style={styles.routeName} numberOfLines={1}>{route.route_long_name}</Text>
      {!!route.route_desc && (
        <Text style={styles.routeDesc} numberOfLines={2}>{route.route_desc}</Text>
      )}
    </View>
    <Text style={styles.routeChevron}>›</Text>
  </TouchableOpacity>
));

// ─── Main component ───────────────────────────────────────────────────────────

export default function BusTab() {
  const [routes,        setRoutes]        = useState<BusRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<BusRoute | null>(null);
  const [stops,         setStops]         = useState<GtfsStop[]>([]);
  const [stopTimes,     setStopTimes]     = useState<ResolvedStopTime[]>([]);
  const [shapePoints,   setShapePoints]   = useState<ShapePoint[]>([]);
  const [loading,       setLoading]       = useState(false);

  // ── Load bus routes on mount ──────────────────────────────────────────────
  useEffect(() => {
    const busRoutes = routesData.filter(r => Number(r.route_type) === 3);
    setRoutes(busRoutes);
  }, []);

  // ── Select a route ────────────────────────────────────────────────────────
  const selectRoute = useCallback(async (route: BusRoute) => {
    setSelectedRoute(route);
    setStops([]);
    setStopTimes([]);
    setShapePoints([]);
    setLoading(true);

    try {
      const trips = tripsData.filter(t => t.route_id === route.route_id);
      if (!trips.length) {
        Alert.alert('No trips', 'No schedule data available for this route.');
        return;
      }

      const tripId = trips[0].trip_id;

      // Resolve stop times for this trip, sorted by sequence
      const rawStopTimes = (stopTimesData as GtfsStopTime[])
        .filter(st => st.trip_id === tripId)
        .sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));

      const resolvedStopTimes: ResolvedStopTime[] = rawStopTimes.map(st => ({
        stop_id:       st.stop_id,
        arrival_time:  st.arrival_time,
        stop_sequence: Number(st.stop_sequence),
      }));

      // Resolve ordered stops
      const stopIdOrder = rawStopTimes.map(st => st.stop_id);
      const stopMap = new Map(stopsData.map(s => [s.stop_id, s]));
      const orderedStops = stopIdOrder
        .map(id => stopMap.get(id))
        .filter((s): s is GtfsStop => !!s);

      // Resolve shape polyline
      const shapeId = trips[0].shape_id;
      const shape = shapeId
        ? (shapesData as ShapePoint[])
            .filter(sp => sp.shape_id === shapeId)
            .sort((a, b) => Number(a.shape_pt_sequence) - Number(b.shape_pt_sequence))
        : [];

      setStopTimes(resolvedStopTimes);
      setStops(orderedStops);
      setShapePoints(shape);
    } catch (err) {
      console.error('selectRoute error:', err);
      Alert.alert('Error', 'Failed to load route details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRoute(null);
    setStops([]);
    setStopTimes([]);
    setShapePoints([]);
  }, []);

  // ── Map region ─────────────────────────────────────────────────────────────
  const mapRegion = useMemo(() => {
    if (!shapePoints.length) return undefined;
    const mid = shapePoints[Math.floor(shapePoints.length / 2)];
    return {
      latitude:       mid.shape_pt_lat,
      longitude:      mid.shape_pt_lon,
      latitudeDelta:  0.07,
      longitudeDelta: 0.07,
    };
  }, [shapePoints]);

  const shapeCoords = useMemo(
    () => shapePoints.map(p => ({ latitude: p.shape_pt_lat, longitude: p.shape_pt_lon })),
    [shapePoints],
  );

  // ── Route list render ─────────────────────────────────────────────────────
  const renderRoute: ListRenderItem<BusRoute> = useCallback(({ item }) => (
    <RouteCard route={item} onPress={() => selectRoute(item)} />
  ), [selectRoute]);

  const keyExtractor = useCallback((item: BusRoute) => item.route_id, []);

  const ListEmptyComponent = useMemo(() => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🚌</Text>
      <Text style={styles.emptyTitle}>No bus routes found</Text>
      <Text style={styles.emptySub}>Feeder bus GTFS data could not be loaded.</Text>
    </View>
  ), []);

  const ListHeaderComponent = useMemo(() => (
    <Text style={styles.pageTitle}>🚌  Feeder Bus Routes</Text>
  ), []);

  // ── Route list screen ─────────────────────────────────────────────────────
  if (!selectedRoute) {
    return (
      <FlatList
        data={routes}
        keyExtractor={keyExtractor}
        renderItem={renderRoute}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  // ── Route detail screen ───────────────────────────────────────────────────
  const StopRow = ({ stop, index }: { stop: GtfsStop; index: number }) => (
    <View style={styles.stopRow}>
      <View style={styles.stopTrack}>
        <View style={[styles.stopDot, index === 0 && styles.stopDotFirst, index === stops.length - 1 && styles.stopDotLast]}>
          <Text style={styles.stopNum}>{index + 1}</Text>
        </View>
        {index < stops.length - 1 && <View style={styles.stopConnector} />}
      </View>
      <View style={styles.stopBody}>
        <Text style={styles.stopName}>{stop.stop_name}</Text>
        <Text style={styles.stopTime}>Next: {getNextDeparture(stop.stop_id, stopTimes)}</Text>
      </View>
    </View>
  );

  return (
    <FlatList
      data={stops}
      keyExtractor={item => item.stop_id}
      contentContainerStyle={styles.detailContent}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={() => (
        <>
          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={clearSelection} activeOpacity={0.7}>
            <Text style={styles.backIcon}>←</Text>
            <Text style={styles.backText}>All routes</Text>
          </TouchableOpacity>

          {/* Route header */}
          <View style={styles.routeHeader}>
            <View style={styles.routeShortLarge}>
              <Text style={styles.routeShortLargeText}>{selectedRoute.route_short_name}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeDetailName}>{selectedRoute.route_long_name}</Text>
              {!!selectedRoute.route_desc && (
                <Text style={styles.routeDetailDesc} numberOfLines={2}>{selectedRoute.route_desc}</Text>
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
          {!loading && shapeCoords.length > 0 && mapRegion && (
            <View style={styles.mapCard}>
              <MapView style={styles.map} initialRegion={mapRegion}>
                <Polyline
                  coordinates={shapeCoords}
                  strokeColor={COLORS.primary}
                  strokeWidth={4}
                />
                {stops.map((stop, i) => (
                  <Marker
                    key={stop.stop_id}
                    coordinate={{ latitude: stop.stop_lat, longitude: stop.stop_lon }}
                    title={stop.stop_name}
                    description={`Stop ${i + 1}`}
                  >
                    <View style={[
                      styles.mapStopMarker,
                      i === 0 && { backgroundColor: COLORS.primary },
                      i === stops.length - 1 && { backgroundColor: COLORS.accent },
                    ]}>
                      <Text style={styles.mapStopNum}>{i + 1}</Text>
                    </View>
                  </Marker>
                ))}
              </MapView>
            </View>
          )}

          {!loading && stops.length > 0 && (
            <Text style={styles.stopsHeading}>Stops &amp; Departures</Text>
          )}

          {!loading && !stops.length && !loading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>No stop data</Text>
              <Text style={styles.emptySub}>Schedule data is unavailable for this route.</Text>
            </View>
          )}
        </>
      )}
      renderItem={({ item, index }) => (
        <StopRow stop={item} index={index} />
      )}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Route list
  listContent:  { padding: SPACING.md, paddingBottom: 56 },
  pageTitle:    { ...(TYPOGRAPHY.h2 as object), marginBottom: SPACING.lg, color: COLORS.textPrimary ?? '#1E293B' },

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
    minWidth: 44, height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
  },
  routeShort:    { ...(TYPOGRAPHY.label as object), color: COLORS.primaryDark, fontWeight: '800', fontSize: 12 },
  routeCardBody: { flex: 1 },
  routeName:     { ...(TYPOGRAPHY.bodyBold as object), color: COLORS.textPrimary ?? '#1E293B', marginBottom: 2 },
  routeDesc:     { ...(TYPOGRAPHY.caption as object), color: COLORS.textMuted },
  routeChevron:  { fontSize: 22, color: COLORS.textMuted, fontWeight: '300' },

  emptyState: { alignItems: 'center', paddingVertical: SPACING.xl * 2 },
  emptyIcon:  { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { ...(TYPOGRAPHY.h3 as object), color: COLORS.textPrimary ?? '#1E293B', marginBottom: SPACING.xs },
  emptySub:   { ...(TYPOGRAPHY.body as object), color: COLORS.textMuted, textAlign: 'center' },

  // Route detail
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
  routeShortLargeText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  routeDetailName:     { ...(TYPOGRAPHY.h3 as object), color: COLORS.textPrimary ?? '#1E293B', marginBottom: 4 },
  routeDetailDesc:     { ...(TYPOGRAPHY.body as object), color: COLORS.textMuted },

  loadingWrap: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.sm },
  loadingText: { ...(TYPOGRAPHY.body as object), color: COLORS.textMuted },

  // Map
  mapCard: {
    height: 240,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  map: { flex: 1 },
  mapStopMarker: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 2, borderColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  mapStopNum: { fontSize: 9, fontWeight: '700', color: COLORS.primaryDark },

  stopsHeading: {
    ...(TYPOGRAPHY.bodyBold as object),
    color: COLORS.textPrimary ?? '#1E293B',
    marginBottom: SPACING.md,
  },

  // Stop rows
  stopRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    marginBottom: 2,
    paddingRight: SPACING.md,
    paddingVertical: 2,
    ...SHADOWS.sm,
  },
  stopTrack: {
    alignItems: 'center',
    width: 40,
    paddingTop: SPACING.sm,
  },
  stopDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  stopDotFirst: { backgroundColor: COLORS.primary },
  stopDotLast:  { backgroundColor: COLORS.accent },
  stopNum:      { color: COLORS.primaryDark, fontWeight: '700', fontSize: 11 },
  stopConnector: {
    flex: 1, width: 2,
    backgroundColor: COLORS.border,
    marginVertical: 2,
    minHeight: 24,
  },
  stopBody: { flex: 1, paddingVertical: SPACING.sm },
  stopName: { ...(TYPOGRAPHY.bodyBold as object), fontSize: 13, color: COLORS.textPrimary ?? '#1E293B', marginBottom: 2 },
  stopTime: { ...(TYPOGRAPHY.caption as object), color: COLORS.textMuted },
});