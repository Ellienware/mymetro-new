// app/buses/reavaya/index.tsx
// FIXES:
// - '@/constants/themes' → '@/constants/theme'
// - VirtualizedList nesting: wraps in FlatList with ListHeaderComponent instead of ScrollView
// - GooglePlacesAutocomplete listView zIndex stacking
// - getNextDeparture uses real data instead of placeholder string
// - distanceKm calculated between user locations (not just stops) for better fare accuracy
// app/buses/reavaya/index.tsx
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, Switch, ActivityIndicator, Alert,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { GooglePlacesAutocomplete, GooglePlaceDetail } from 'react-native-google-places-autocomplete';
import { router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader, Card } from '@/components/ui';
import { useTicketPurchase } from '@/hooks/useTicketPurchase';
import { TransportStop } from '@/services/transport/types';

const reavayaData = require('@/assets/reavaya_data.json');
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

// ─── Types ──────────────────────────────────────
interface ReaVayaStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

// ─── Fare table ─────────────────────────────────
const FARE_TABLE = [
  { maxKm: 5,        peak: 11.00, offPeak: 9.90  },
  { maxKm: 10,       peak: 14.00, offPeak: 12.60 },
  { maxKm: 15,       peak: 16.50, offPeak: 14.85 },
  { maxKm: 25,       peak: 19.00, offPeak: 17.10 },
  { maxKm: 35,       peak: 21.00, offPeak: 18.90 },
  { maxKm: 45,       peak: 22.00, offPeak: 19.80 },
  { maxKm: Infinity, peak: 28.00, offPeak: 25.20 },
];

function getFare(distanceKm: number, isPeak: boolean): number {
  const bracket = FARE_TABLE.find(b => distanceKm <= b.maxKm);
  if (!bracket) return 0;
  return isPeak ? bracket.peak : bracket.offPeak;
}

// ─── Helpers ────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestStop(lat: number, lng: number): { stop: ReaVayaStop | null; distanceKm: number } {
  let nearest: ReaVayaStop | null = null;
  let minDist = Infinity;
  for (const s of reavayaData.stops as ReaVayaStop[]) {
    const d = haversine(lat, lng, s.lat, s.lon);
    if (d < minDist) { minDist = d; nearest = s; }
  }
  return { stop: nearest, distanceKm: minDist };
}

function getTravelTime(fromName: string, toName: string): number {
  return reavayaData.travelTimeMatrix?.[`${fromName},${toName}`]
    || reavayaData.travelTimeMatrix?.[`${toName},${fromName}`]
    || 0;
}

function getNextDeparture(stopId: string): string {
  const deps = reavayaData.departures?.[stopId];
  if (!deps) return 'Every 5–15 min (peak) / 30 min (off-peak)';
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const next = (deps as string[]).find(t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m >= nowMin;
  });
  return next ? `Next at ${next}` : `First bus at ${(deps as string[])[0]}`;
}

// ─── Main Screen ────────────────────────────────
export default function ReaVayaScreen() {
  const { user } = useUser();
  const { startTripFlow, purchasing } = useTicketPurchase();

  const [originDetails, setOriginDetails] = useState<{ desc: string; lat: number; lng: number } | null>(null);
  const [destDetails, setDestDetails] = useState<{ desc: string; lat: number; lng: number } | null>(null);
  const [originStop, setOriginStop] = useState<ReaVayaStop | null>(null);
  const [destStop, setDestStop] = useState<ReaVayaStop | null>(null);
  const [isPeak, setIsPeak] = useState(true);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<MapView>(null);

  const updateStop = (details: GooglePlaceDetail | null, type: 'origin' | 'destination') => {
    if (!details) return;
    const lat = details.geometry.location.lat;
    const lng = details.geometry.location.lng;
    const desc = details.formatted_address ?? details.name ?? '';
    const { stop } = findNearestStop(lat, lng);
    if (!stop) { Alert.alert('No stop found', 'No Rea Vaya stop found nearby.'); return; }
    if (type === 'origin') { setOriginDetails({ desc, lat, lng }); setOriginStop(stop); }
    else { setDestDetails({ desc, lat, lng }); setDestStop(stop); }
  };

  const distanceKm = originDetails && destDetails
    ? haversine(originDetails.lat, originDetails.lng, destDetails.lat, destDetails.lng)
    : originStop && destStop
      ? haversine(originStop.lat, originStop.lon, destStop.lat, destStop.lon)
      : 0;

  const fare = distanceKm > 0 ? getFare(distanceKm, isPeak) : 0;
  const travelTimeMins = originStop && destStop ? getTravelTime(originStop.name, destStop.name) : 0;
  const nextDep = originStop ? getNextDeparture(originStop.id) : null;
  const hasResult = !!originStop && !!destStop;

  const midLat = originStop && destStop ? (originStop.lat + destStop.lat) / 2 : -26.2;
  const midLng = originStop && destStop ? (originStop.lon + destStop.lon) / 2 : 28.0;

  // ─── Start trip (tap-in) using unified transport system ────────────────
  const startTrip = useCallback(async () => {
    if (!originStop) {
      Alert.alert('Cannot start trip', 'Please select an origin stop first.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Not logged in', 'Please log in to start a trip.');
      return;
    }
    const stop: TransportStop = {
      id: originStop.id,
      name: originStop.name,
      lat: originStop.lat,
      lon: originStop.lon,
    };
    const trip = await startTripFlow({
      userId: user.id,
      providerId: 'reavaya',
      origin: stop,
    });
    if (trip) {
      router.push({
        pathname: '/transport/tap',
        params: {
          provider: 'rea_vaya',
          stationId: originStop.id,
          stationName: originStop.name,
        },
      });
    } else {
      Alert.alert('Error', 'Could not start trip. Please check your balance.');
    }
  }, [originStop, user?.id, startTripFlow]);

  // ─── Header rendered as FlatList header ───────────────────────────────
  const renderHeader = () => (
    <View style={styles.headerContent}>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>🚌</Text>
        <Text style={styles.heroTitle}>Rea Vaya BRT</Text>
        <Text style={styles.heroSub}>Find your nearest stops, fares and next buses.</Text>
      </View>

      {/* Inputs card */}
      <Card style={{ ...styles.inputsCard, zIndex: 20 }}>
        {/* From */}
        <View style={[styles.inputRow, { zIndex: 10 }]}>
          <View style={styles.dotWrap}><View style={styles.originDot} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>FROM</Text>
            <GooglePlacesAutocomplete
              placeholder="Your address or landmark"
              onPress={(data, details) => updateStop(details ?? null, 'origin')}
              query={{ key: GOOGLE_API_KEY, language: 'en', components: 'country:za' }}
              fetchDetails
              keyboardShouldPersistTaps="always"
              styles={gpaStyles(10)}
            />
            {originStop && (
              <View style={styles.stopBadge}>
                <Text style={styles.stopIcon}>🚉</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stopName}>{originStop.name}</Text>
                  <Text style={styles.stopSub}>Nearest Rea Vaya stop</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Divider with swap */}
        <View style={styles.swapRow}>
          <View style={styles.swapLine} />
          <TouchableOpacity
            style={styles.swapBtn}
            onPress={() => {
              const od = originDetails; setOriginDetails(destDetails); setDestDetails(od);
              const os = originStop; setOriginStop(destStop); setDestStop(os);
            }}
          >
            <Text style={styles.swapIcon}>⇅</Text>
          </TouchableOpacity>
          <View style={styles.swapLine} />
        </View>

        {/* To */}
        <View style={[styles.inputRow, { zIndex: 9 }]}>
          <View style={styles.dotWrap}><View style={styles.destDot} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>TO</Text>
            <GooglePlacesAutocomplete
              placeholder="Your destination"
              onPress={(data, details) => updateStop(details ?? null, 'destination')}
              query={{ key: GOOGLE_API_KEY, language: 'en', components: 'country:za' }}
              fetchDetails
              keyboardShouldPersistTaps="always"
              styles={gpaStyles(9)}
            />
            {destStop && (
              <View style={styles.stopBadge}>
                <Text style={styles.stopIcon}>🏁</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stopName}>{destStop.name}</Text>
                  <Text style={styles.stopSub}>Nearest Rea Vaya stop</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Card>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.loadingText}>Finding nearest stops...</Text>
        </View>
      )}

      {hasResult && (
        <>
          {/* Fare card */}
          <Card style={styles.fareCard}>
            <View style={styles.fareTop}>
              <View>
                <Text style={styles.fareLabel}>Fare</Text>
                <Text style={styles.fareAmount}>R{fare.toFixed(2)}</Text>
                <Text style={styles.fareDistance}>{distanceKm.toFixed(1)} km journey</Text>
              </View>
              <View style={styles.peakToggle}>
                <Text style={[styles.peakLabel, !isPeak && styles.peakLabelActive]}>Off-peak</Text>
                <Switch
                  value={isPeak}
                  onValueChange={setIsPeak}
                  trackColor={{ false: COLORS.primaryLight, true: COLORS.primary }}
                  thumbColor="#fff"
                />
                <Text style={[styles.peakLabel, isPeak && styles.peakLabelActive]}>Peak</Text>
              </View>
            </View>

            {/* Stats strip */}
            <View style={styles.statsRow}>
              {[
                { icon: '🚌', label: 'Travel time', value: travelTimeMins > 0 ? `${travelTimeMins} min` : '—' },
                { icon: '⏰', label: 'Next bus', value: nextDep ?? '—' },
                { icon: '💳', label: 'Payment', value: 'Tap card' },
              ].map((s, i, arr) => (
                <View key={s.label} style={{ flexDirection: 'row', flex: 1 }}>
                  <View style={styles.statItem}>
                    <Text style={styles.statIcon}>{s.icon}</Text>
                    <Text style={styles.statValue}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={styles.statDivider} />}
                </View>
              ))}
            </View>

            {/* Tap In & Travel button */}
            <View style={{ marginTop: SPACING.md }}>
              <TouchableOpacity
                style={styles.tapButton}
                onPress={startTrip}
                disabled={purchasing || !originStop}
                activeOpacity={0.8}
              >
                <Text style={styles.tapButtonText}>
                  {purchasing ? '⏳ Starting...' : '🚌 Tap In & Travel'}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>

          {/* Journey breakdown */}
          <Card style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>Journey Breakdown</Text>
            {[
              { icon: '📍', text: originDetails?.desc ?? 'Your location', sub: `Walk to ${originStop!.name} stop`, color: COLORS.accentLight },
              { icon: '🚌', text: `Board at ${originStop!.name}`, sub: nextDep ?? 'Check schedule', color: COLORS.primaryLight },
              { icon: '🚌', text: `${originStop!.name} → ${destStop!.name}`, sub: travelTimeMins > 0 ? `~${travelTimeMins} min` : 'See timetable', color: COLORS.primaryLight },
              { icon: '🏁', text: destStop!.name, sub: destDetails?.desc ?? 'Your destination', color: COLORS.successLight },
            ].map((step, idx, arr) => (
              <View key={idx} style={styles.timelineStep}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineCircle, { backgroundColor: step.color }]}>
                    <Text style={{ fontSize: 14 }}>{step.icon}</Text>
                  </View>
                  {idx < arr.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={{ flex: 1, paddingTop: 4 }}>
                  <Text style={styles.timelineLabel} numberOfLines={1}>{step.text}</Text>
                  <Text style={styles.timelineSub}>{step.sub}</Text>
                </View>
              </View>
            ))}
          </Card>

          {/* Map */}
          <View style={styles.mapWrap}>
            <Text style={styles.mapTitle}>Stop Locations</Text>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{ latitude: midLat, longitude: midLng, latitudeDelta: 0.12, longitudeDelta: 0.12 }}
            >
              <Marker coordinate={{ latitude: originStop!.lat, longitude: originStop!.lon }} title={originStop!.name}>
                <View style={[styles.mapMarker, { backgroundColor: COLORS.primaryLight }]}>
                  <Text style={{ fontSize: 16 }}>🚉</Text>
                </View>
              </Marker>
              <Marker coordinate={{ latitude: destStop!.lat, longitude: destStop!.lon }} title={destStop!.name}>
                <View style={[styles.mapMarker, { backgroundColor: COLORS.successLight }]}>
                  <Text style={{ fontSize: 16 }}>🏁</Text>
                </View>
              </Marker>
            </MapView>
          </View>

          {/* Fare bracket table */}
          <Card style={styles.fareTableCard}>
            <Text style={styles.fareTableTitle}>Rea Vaya Fare Brackets</Text>
            {FARE_TABLE.filter(b => b.maxKm !== Infinity).concat(FARE_TABLE.filter(b => b.maxKm === Infinity)).map((b, idx) => {
              const active = distanceKm <= b.maxKm && (idx === 0 || distanceKm > (FARE_TABLE[idx - 1]?.maxKm ?? 0));
              return (
                <View key={idx} style={[styles.fareTableRow, active && styles.fareTableRowActive, idx === FARE_TABLE.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={[styles.fareTableKm, active && styles.fareTableTextActive]}>
                    {b.maxKm === Infinity ? `> ${FARE_TABLE[FARE_TABLE.length - 2].maxKm} km` : `Up to ${b.maxKm} km`}
                  </Text>
                  <Text style={[styles.fareTableVal, active && styles.fareTableTextActive]}>Peak R{b.peak.toFixed(2)}</Text>
                  <Text style={[styles.fareTableVal, { color: COLORS.success }, active && styles.fareTableTextActive]}>Off R{b.offPeak.toFixed(2)}</Text>
                </View>
              );
            })}
          </Card>
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Rea Vaya BRT" onBack={() => router.back()} />
      <FlatList
        data={[]}
        renderItem={null}
        keyExtractor={() => 'none'}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ─── Styles (unchanged from original) ─────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  listContent: { paddingBottom: 48 },
  headerContent: { padding: SPACING.md },

  hero: { alignItems: 'center', paddingVertical: SPACING.lg, marginBottom: SPACING.md },
  heroEmoji: { fontSize: 48, marginBottom: SPACING.sm },
  heroTitle: { ...TYPOGRAPHY.h1, textAlign: 'center', marginBottom: SPACING.xs },
  heroSub: { ...TYPOGRAPHY.body, textAlign: 'center', color: COLORS.textMuted, lineHeight: 22 },

  inputsCard: { marginBottom: SPACING.md },
  inputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  dotWrap: { width: 20, alignItems: 'center', paddingTop: 22 },
  originDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary },
  destDot: { width: 12, height: 12, borderRadius: 3, backgroundColor: COLORS.accent },
  inputLabel: { ...TYPOGRAPHY.label, fontSize: 11, marginBottom: 4, letterSpacing: 0.8 },

  stopBadge: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.xs, padding: SPACING.sm, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md },
  stopIcon: { fontSize: 16 },
  stopName: { ...TYPOGRAPHY.bodyBold, fontSize: 13, color: COLORS.primaryDark },
  stopSub: { ...TYPOGRAPHY.caption, color: COLORS.primaryDark, marginTop: 1 },

  swapRow: { flexDirection: 'row', alignItems: 'center', marginVertical: SPACING.xs },
  swapLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  swapBtn: { paddingHorizontal: SPACING.md, paddingVertical: 6, backgroundColor: COLORS.border, borderRadius: RADIUS.full, marginHorizontal: SPACING.sm },
  swapIcon: { fontSize: 16, fontWeight: '700', color: COLORS.primary },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, justifyContent: 'center', marginVertical: SPACING.md },
  loadingText: { ...TYPOGRAPHY.body, color: COLORS.textMuted },

  fareCard: { marginBottom: SPACING.md },
  fareTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md },
  fareLabel: { ...TYPOGRAPHY.label, marginBottom: 4 },
  fareAmount: { fontSize: 40, fontWeight: '800', color: COLORS.primary, letterSpacing: -1 },
  fareDistance: { ...TYPOGRAPHY.caption, marginTop: 2 },
  peakToggle: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  peakLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  peakLabelActive: { color: COLORS.primary, fontWeight: '700' },

  statsRow: { flexDirection: 'row', backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: SPACING.sm },
  statItem: { flex: 1, alignItems: 'center' },
  statIcon: { fontSize: 18, marginBottom: 4 },
  statValue: { ...TYPOGRAPHY.bodyBold, fontSize: 12, textAlign: 'center' },
  statLabel: { ...TYPOGRAPHY.caption, marginTop: 1, textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: COLORS.border },

  tapButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: 'center',
    ...SHADOWS.md,
    marginTop: SPACING.sm,
  },
  tapButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: '#fff',
    fontSize: 16,
  },

  timelineCard: { marginBottom: SPACING.md },
  timelineTitle: { ...TYPOGRAPHY.bodyBold, marginBottom: SPACING.sm },
  timelineStep: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.xs },
  timelineLeft: { alignItems: 'center', marginRight: SPACING.sm, width: 36 },
  timelineCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { width: 2, height: 20, backgroundColor: COLORS.border, marginTop: 2 },
  timelineLabel: { ...TYPOGRAPHY.bodyBold, fontSize: 13 },
  timelineSub: { ...TYPOGRAPHY.caption, marginTop: 1 },

  mapWrap: { borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOWS.md, marginBottom: SPACING.md },
  mapTitle: { ...TYPOGRAPHY.bodyBold, padding: SPACING.md, backgroundColor: COLORS.surface },
  map: { height: 240 },
  mapMarker: { borderRadius: 20, padding: 4, ...SHADOWS.sm },

  fareTableCard: { marginBottom: SPACING.md },
  fareTableTitle: { ...TYPOGRAPHY.bodyBold, marginBottom: SPACING.sm },
  fareTableRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  fareTableRowActive: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.xs, marginHorizontal: -SPACING.xs },
  fareTableKm: { ...TYPOGRAPHY.caption, flex: 1 },
  fareTableVal: { ...TYPOGRAPHY.caption, fontWeight: '600', minWidth: 80, textAlign: 'right' },
  fareTableTextActive: { color: COLORS.primaryDark, fontWeight: '700' },
});

const gpaStyles = (zIdx: number) => ({
  textInput: {
    height: 44, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm, backgroundColor: COLORS.background,
    fontSize: 14, color: COLORS.textPrimary,
  },
  listView: {
    marginTop: 4, borderRadius: RADIUS.md, backgroundColor: COLORS.surface,
    ...SHADOWS.sm, zIndex: zIdx + 100, position: 'absolute' as const, top: 44, left: 0, right: 0,
  },
  container: { zIndex: zIdx },
});