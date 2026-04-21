// app/trains/gautrain/train-tab.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import MapView, { Polyline, Marker, LatLng } from 'react-native-maps';
import { GooglePlacesAutocomplete, GooglePlaceDetail } from 'react-native-google-places-autocomplete';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';
import polyline from '@mapbox/polyline';
import { router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { getGautrainFare } from '@/constants/gautrainFares';
import { Card } from '@/components/ui';
import { useTicketPurchase } from '@/hooks/useTicketPurchase';
import { TransportStop } from '@/services/transport/types';

const gautrainData = require('@/assets/gautrain_data.json');
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

interface WalkingRoute {
  durationSec: number;
  distanceMeters: number;
  coordinates: LatLng[];
}

interface WalkLegs {
  originToStation: WalkingRoute | null;
  stationToDest: WalkingRoute | null;
}

interface SavedTrip {
  origin: string;
  dest: string;
  isPeak: boolean;
}

interface PlaceInfo {
  description: string;
  details: GooglePlaceDetail;
}

interface Amenities {
  accessible: boolean;
  parking: boolean;
  restrooms: boolean;
  wifi: boolean;
  shops: string[];
  phone?: string;
  website?: string;
  openingHours?: string;
}

interface NextDeparture {
  time: string;
  isNextDay: boolean;
}

// ─── Pure helpers (defined outside component for stable references) ────────────

const NORTH_LINE = ['Hatfield', 'Pretoria', 'Centurion', 'Midrand', 'Marlboro', 'Sandton', 'Rosebank', 'Park'];
const EAST_LINE  = ['OR Tambo', 'Rhodesfield', 'Marlboro', 'Sandton'];

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestStation(lat: number, lng: number): Station | null {
  let nearest: Station | null = null;
  let minDist = Infinity;
  for (const s of gautrainData.stations as Station[]) {
    const d = haversine(lat, lng, s.lat, s.lon);
    if (d < minDist) { minDist = d; nearest = s; }
  }
  return nearest;
}

function getTravelTime(from: string, to: string): number {
  if (from === to) return 0;
  return (
    gautrainData.travelTimeMatrix[`${from},${to}`] ??
    gautrainData.travelTimeMatrix[`${to},${from}`] ??
    0
  );
}

function getLineDirection(stationName: string, destName: string): string {
  const ni = NORTH_LINE.indexOf(stationName);
  const nj = NORTH_LINE.indexOf(destName);
  if (ni !== -1 && nj !== -1) return nj > ni ? 'South' : 'North';

  const ei = EAST_LINE.indexOf(stationName);
  const ej = EAST_LINE.indexOf(destName);
  if (ei !== -1 && ej !== -1) return ej > ei ? 'East' : 'West';

  return 'South'; // fallback for cross-line (via Marlboro/Sandton)
}

function getNextDeparture(stationName: string, destName: string): NextDeparture | null {
  const direction = getLineDirection(stationName, destName);
  const deps = gautrainData.departures?.[stationName]?.[direction] as string[] | undefined;
  if (!deps?.length) return null;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const todayDep = deps.find(t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m >= nowMin;
  });

  return todayDep
    ? { time: todayDep, isNextDay: false }
    : { time: deps[0], isNextDay: true };
}

function getStopCount(from: string, to: string): number {
  const ni = NORTH_LINE.indexOf(from), nj = NORTH_LINE.indexOf(to);
  if (ni !== -1 && nj !== -1) return Math.abs(nj - ni);

  const ei = EAST_LINE.indexOf(from), ej = EAST_LINE.indexOf(to);
  if (ei !== -1 && ej !== -1) return Math.abs(ej - ei);

  return 0; // cross-line
}

async function fetchWalkingRoute(
  origin: { lat: number; lng: number },
  dest:   { lat: number; lng: number },
): Promise<WalkingRoute | null> {
  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type':       'application/json',
        'X-Goog-Api-Key':     GOOGLE_API_KEY,
        'X-Goog-FieldMask':   'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin:      { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: dest.lat,   longitude: dest.lng   } } },
        travelMode: 'WALK',
        computeAlternativeRoutes: false,
        languageCode: 'en',
        units: 'METRIC',
      }),
    });
    const data = await res.json();
    if (!data.routes?.[0]) return null;
    const r = data.routes[0];
    return {
      durationSec:    parseInt(r.duration.replace('s', ''), 10),
      distanceMeters: r.distanceMeters,
      coordinates:    polyline
        .decode(r.polyline.encodedPolyline)
        .map(([lat, lng]: [number, number]) => ({ latitude: lat, longitude: lng })),
    };
  } catch (e) {
    console.error('Walking route error:', e);
    return null;
  }
}

async function fetchStationAmenities(placeId: string): Promise<Amenities | null> {
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'Content-Type':   'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask':
          'accessibilityOptions,parkingOptions,types,formattedPhoneNumber,website,regularOpeningHours',
      },
    });
    const data = await res.json();
    return {
      accessible: data.accessibilityOptions?.wheelchairAccessibleEntrance === true,
      parking:    data.parkingOptions?.hasParkingLot === true || data.types?.includes('parking'),
      restrooms:  data.types?.includes('restroom')  ?? false,
      wifi:       data.types?.includes('wifi')       ?? false,
      shops:      (data.types as string[] | undefined)?.filter(t => t.includes('store') || t.includes('shop')) ?? [],
      phone:         data.formattedPhoneNumber,
      website:       data.website,
      openingHours:  data.regularOpeningHours?.weekdayText?.join('\n'),
    };
  } catch (e) {
    console.error('Amenities error:', e);
    return null;
  }
}

async function addToCalendar(
  originStation:      Station,
  destStation:        Station,
  departureTimeStr:   string,
  travelTimeMinutes:  number,
  fare:               number,
  isPeak:             boolean,
  walkToStationMin:   number,
): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Please allow calendar access to add trip reminders.');
    return false;
  }
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const cal = calendars.find(c => c.isPrimary) ?? calendars[0];
  if (!cal) { Alert.alert('Error', 'No calendar found on this device.'); return false; }

  const [h, m] = departureTimeStr.split(':').map(Number);
  const startDate = new Date();
  startDate.setHours(h, m, 0, 0);
  if (startDate < new Date()) startDate.setDate(startDate.getDate() + 1);
  const endDate = new Date(startDate.getTime() + travelTimeMinutes * 60_000);

  await Calendar.createEventAsync(cal.id, {
    title:    `🚆 Gautrain: ${originStation.name} → ${destStation.name}`,
    startDate,
    endDate,
    location: `${originStation.name} Gautrain Station`,
    notes:    `Fare: R${fare} (${isPeak ? 'peak' : 'off-peak'})\nWalking to station: ~${walkToStationMin} min`,
    alarms:   [{ relativeOffset: -15 }],
  });
  return true;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtWalk(route: WalkingRoute): string {
  return `${(route.distanceMeters / 1000).toFixed(1)} km · ${Math.round(route.durationSec / 60)} min`;
}

function fmtDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TrainTab() {
  const { user } = useUser();
  const { startTripFlow, purchasing } = useTicketPurchase();

  const [originInfo,   setOriginInfo]   = useState<PlaceInfo | null>(null);
  const [destInfo,     setDestInfo]     = useState<PlaceInfo | null>(null);
  const [originStation, setOriginStation] = useState<Station | null>(null);
  const [destStation,   setDestStation]   = useState<Station | null>(null);
  const [isPeak,   setIsPeak]   = useState(true);
  const [loading,  setLoading]  = useState(false);
  const [walkLegs, setWalkLegs] = useState<WalkLegs>({ originToStation: null, stationToDest: null });

  const [savedTrips,         setSavedTrips]         = useState<SavedTrip[]>([]);
  const [amenitiesVisible,   setAmenitiesVisible]   = useState(false);
  const [selectedStation,    setSelectedStation]    = useState<Station | null>(null);
  const [stationAmenities,   setStationAmenities]   = useState<Amenities | null>(null);
  const [loadingAmenities,   setLoadingAmenities]   = useState(false);

  const mapRef = useRef<MapView>(null);

  // ── Derived values (memoised so renderHeader dependency array is stable) ──

  const fare = useMemo(() =>
    originStation && destStation
      ? getGautrainFare(originStation.name, destStation.name, isPeak)
      : 0,
    [originStation, destStation, isPeak],
  );

  const trainTime = useMemo(() =>
    originStation && destStation
      ? getTravelTime(originStation.name, destStation.name)
      : 0,
    [originStation, destStation],
  );

  const nextDepResult = useMemo(() =>
    originStation && destStation
      ? getNextDeparture(originStation.name, destStation.name)
      : null,
    [originStation, destStation],
  );

  const nextDepDisplay = useMemo(() =>
    nextDepResult
      ? nextDepResult.isNextDay
        ? `${nextDepResult.time} (tomorrow)`
        : nextDepResult.time
      : null,
    [nextDepResult],
  );

  const walkSec = useMemo(() =>
    (walkLegs.originToStation?.durationSec ?? 0) + (walkLegs.stationToDest?.durationSec ?? 0),
    [walkLegs],
  );

  const totalSec = useMemo(() => walkSec + trainTime * 60, [walkSec, trainTime]);

  const allCoords = useMemo(() => [
    ...(walkLegs.originToStation?.coordinates ?? []),
    ...(walkLegs.stationToDest?.coordinates ?? []),
  ], [walkLegs]);

  const hasResult = !!originStation && !!destStation && !loading;

  // ── Persistence ──────────────────────────────────────────────────────────

  useEffect(() => { loadSavedTrips(); }, []);

  const loadSavedTrips = async () => {
    try {
      const raw = await AsyncStorage.getItem('gautrain_saved_trips');
      if (raw) setSavedTrips(JSON.parse(raw));
    } catch (e) { console.error('loadSavedTrips:', e); }
  };

  const persistSavedTrips = async (trips: SavedTrip[]) => {
    setSavedTrips(trips);
    await AsyncStorage.setItem('gautrain_saved_trips', JSON.stringify(trips));
  };

  // ── Stable callbacks ─────────────────────────────────────────────────────

  const saveCurrentTrip = useCallback(async () => {
    if (!originStation || !destStation) return;
    const trip: SavedTrip = { origin: originStation.name, dest: destStation.name, isPeak };
    const updated = [...savedTrips, trip];
    await persistSavedTrips(updated);
    Alert.alert('Saved ⭐', 'Trip added to favourites.');
  }, [originStation, destStation, isPeak, savedTrips]);

  const deleteSavedTrip = useCallback(async (index: number) => {
    const updated = savedTrips.filter((_, i) => i !== index);
    await persistSavedTrips(updated);
  }, [savedTrips]);

  const loadSavedTrip = useCallback((trip: SavedTrip) => {
    const origin = (gautrainData.stations as Station[]).find(s => s.name === trip.origin);
    const dest   = (gautrainData.stations as Station[]).find(s => s.name === trip.dest);
    if (origin && dest) {
      setOriginStation(origin);
      setDestStation(dest);
      setIsPeak(trip.isPeak);
      setWalkLegs({ originToStation: null, stationToDest: null });
      setOriginInfo(null);
      setDestInfo(null);
    }
  }, []);

  const updateStations = useCallback(async (
    data:    { description: string },
    details: GooglePlaceDetail | null,
    type:    'origin' | 'destination',
  ) => {
    if (!details) return;
    const lat = details.geometry.location.lat;
    const lng = details.geometry.location.lng;
    const station = findNearestStation(lat, lng);
    if (!station) {
      Alert.alert('Out of range', 'No Gautrain station found near that location.');
      return;
    }
    setLoading(true);
    try {
      if (type === 'origin') {
        setOriginInfo({ description: data.description, details });
        setOriginStation(station);
        const route = await fetchWalkingRoute({ lat, lng }, { lat: station.lat, lng: station.lon });
        setWalkLegs(prev => ({ ...prev, originToStation: route }));
      } else {
        setDestInfo({ description: data.description, details });
        setDestStation(station);
        const route = await fetchWalkingRoute({ lat: station.lat, lng: station.lon }, { lat, lng });
        setWalkLegs(prev => ({ ...prev, stationToDest: route }));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fixed swapStations – captures values before setting
  const swapStations = useCallback(() => {
    const prevOriginInfo = originInfo;
    const prevDestInfo = destInfo;
    const prevOriginStation = originStation;
    const prevDestStation = destStation;
    setOriginInfo(prevDestInfo);
    setDestInfo(prevOriginInfo);
    setOriginStation(prevDestStation);
    setDestStation(prevOriginStation);
    setWalkLegs(prev => ({
      originToStation: prev.stationToDest,
      stationToDest:   prev.originToStation,
    }));
  }, [originInfo, destInfo, originStation, destStation]);

  const showAmenities = useCallback(async (station: Station) => {
    setSelectedStation(station);
    setAmenitiesVisible(true);
    setLoadingAmenities(true);
    setStationAmenities(null);
    try {
      const searchRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
        `?input=${encodeURIComponent(station.name + ' Gautrain Station')}` +
        `&inputtype=textquery&fields=place_id&key=${GOOGLE_API_KEY}`,
      );
      const searchData = await searchRes.json();
      const placeId = searchData.candidates?.[0]?.place_id as string | undefined;
      if (placeId) {
        setStationAmenities(await fetchStationAmenities(placeId));
      }
    } catch (e) {
      console.error('showAmenities:', e);
    } finally {
      setLoadingAmenities(false);
    }
  }, []);

  const handleAddToCalendar = useCallback(async () => {
    if (!originStation || !destStation || !nextDepResult) {
      Alert.alert('Not ready', 'Please set both origin and destination first.');
      return;
    }
    const walkMin = Math.round((walkLegs.originToStation?.durationSec ?? 0) / 60);
    const success = await addToCalendar(
      originStation, destStation,
      nextDepResult.time,
      trainTime, fare, isPeak, walkMin,
    );
    if (success) Alert.alert('Added 📅', 'Trip added to your calendar with a 15-min reminder.');
  }, [originStation, destStation, nextDepResult, trainTime, fare, isPeak, walkLegs]);

  // ─── NEW: Start tap‑in trip using unified transport system ────────────────
  const startTrip = useCallback(async () => {
    if (!originStation) {
      Alert.alert('Cannot start trip', 'Please select an origin station first.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Not logged in', 'Please log in to start a trip.');
      return;
    }
    const stop: TransportStop = {
      id: originStation.id,
      name: originStation.name,
      lat: originStation.lat,
      lon: originStation.lon,
    };
    const trip = await startTripFlow({
      userId: user.id,
      providerId: 'gautrain',
      origin: stop,
    });
    if (trip) {
      router.push({
        pathname: '/transport/tap',
        params: {
          provider: 'gautrain',
          stationId: originStation.id,
          stationName: originStation.name,
        },
      });
    } else {
      Alert.alert('Error', 'Could not start trip. Please check your balance.');
    }
  }, [originStation, user?.id, startTripFlow]);

  // ── List header (all screen content) ─────────────────────────────────────

  const renderHeader = useCallback(() => (
    <>
      {/* ── Hero ── */}
      <View style={styles.hero}>
        <View style={styles.heroIconWrap}>
          <Text style={styles.heroIcon}>🚆</Text>
        </View>
        <Text style={styles.heroTitle}>Door‑to‑Door Journey</Text>
        <Text style={styles.heroSub}>
          Find your nearest stations with live walking directions.
        </Text>
      </View>

      {/* ── Input card ── */}
      <Card style={styles.inputCard}>
        {/* Origin */}
        <View style={styles.inputRow}>
          <View style={styles.routeIndicator}>
            <View style={styles.originDot} />
            <View style={styles.routeLine} />
          </View>
          <View style={styles.inputField}>
            <Text style={styles.inputLabel}>FROM</Text>
            <GooglePlacesAutocomplete
              placeholder="Address or landmark"
              onPress={(data, details) => updateStations(data, details ?? null, 'origin')}
              query={{ key: GOOGLE_API_KEY, language: 'en', components: 'country:za' }}
              fetchDetails
              listViewDisplayed="auto"
              keepResultsAfterBlur={false}
              enablePoweredByContainer={false}
              styles={gpStyles}
            />
            {originStation && (
              <TouchableOpacity
                style={styles.stationChip}
                onPress={() => showAmenities(originStation)}
                activeOpacity={0.75}
              >
                <Text style={styles.chipEmoji}>🚉</Text>
                <View style={styles.chipBody}>
                  <Text style={styles.chipName}>{originStation.name} Station</Text>
                  {walkLegs.originToStation && (
                    <Text style={styles.chipSub}>🚶 {fmtWalk(walkLegs.originToStation)}</Text>
                  )}
                </View>
                <Text style={styles.chipInfo}>ℹ️</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Swap button */}
        <TouchableOpacity style={styles.swapBtn} onPress={swapStations} activeOpacity={0.8}>
          <Text style={styles.swapIcon}>⇅</Text>
          <Text style={styles.swapLabel}>Swap</Text>
        </TouchableOpacity>

        {/* Destination */}
        <View style={styles.inputRow}>
          <View style={styles.routeIndicator}>
            <View style={styles.destDot} />
          </View>
          <View style={styles.inputField}>
            <Text style={styles.inputLabel}>TO</Text>
            <GooglePlacesAutocomplete
              placeholder="Your destination"
              onPress={(data, details) => updateStations(data, details ?? null, 'destination')}
              query={{ key: GOOGLE_API_KEY, language: 'en', components: 'country:za' }}
              fetchDetails
              listViewDisplayed="auto"
              keepResultsAfterBlur={false}
              enablePoweredByContainer={false}
              styles={gpStyles}
            />
            {destStation && (
              <TouchableOpacity
                style={styles.stationChip}
                onPress={() => showAmenities(destStation)}
                activeOpacity={0.75}
              >
                <Text style={styles.chipEmoji}>🚉</Text>
                <View style={styles.chipBody}>
                  <Text style={styles.chipName}>{destStation.name} Station</Text>
                  {walkLegs.stationToDest && (
                    <Text style={styles.chipSub}>🚶 {fmtWalk(walkLegs.stationToDest)}</Text>
                  )}
                </View>
                <Text style={styles.chipInfo}>ℹ️</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Card>

      {/* ── Loading indicator ── */}
      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.loadingText}>Calculating walking routes…</Text>
        </View>
      )}

      {/* ── Results ── */}
      {hasResult && (
        <>
          {/* Fare card */}
          <Card style={styles.fareCard}>
            <View style={styles.fareRow}>
              <View>
                <Text style={styles.fareLabel}>Fare</Text>
                <Text style={styles.fareAmount}>R{fare}</Text>
              </View>
              <View style={styles.peakRow}>
                <Text style={[styles.peakLabel, !isPeak && styles.peakActive]}>Off‑peak</Text>
                <Switch
                  value={isPeak}
                  onValueChange={setIsPeak}
                  trackColor={{ false: COLORS.primaryLight, true: COLORS.primary }}
                  thumbColor="#fff"
                />
                <Text style={[styles.peakLabel, isPeak && styles.peakActive]}>Peak</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              {[
                { icon: '🚆', label: 'Train',   value: `${trainTime} min` },
                { icon: '🚶', label: 'Walking', value: `${Math.round(walkSec / 60)} min` },
                { icon: '⏱',  label: 'Total',   value: fmtDuration(totalSec) },
              ].map((s, i, arr) => (
                <React.Fragment key={s.label}>
                  <View style={styles.statItem}>
                    <Text style={styles.statIcon}>{s.icon}</Text>
                    <Text style={styles.statValue}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={styles.statDivider} />}
                </React.Fragment>
              ))}
            </View>

            <View style={styles.nextDepRow}>
              <Text style={styles.nextDepLabel}>Next from {originStation!.name}</Text>
              <Text style={styles.nextDepValue}>{nextDepDisplay ?? 'No service'}</Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={saveCurrentTrip} activeOpacity={0.8}>
                <Text style={styles.actionBtnText}>⭐  Save Trip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSecondary]}
                onPress={handleAddToCalendar}
                activeOpacity={0.8}
              >
                <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>
                  📅  Calendar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: COLORS.accent }]}
                onPress={startTrip}
                disabled={purchasing || !originStation}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnText}>
                  {purchasing ? '⏳ Starting...' : '🚆 Tap In & Travel'}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>

          {/* Journey timeline */}
          <Card style={styles.timelineCard}>
            <Text style={styles.sectionTitle}>Journey Breakdown</Text>
            {(
              [
                {
                  icon:      '🚶',
                  label:     originInfo?.description ?? 'Your location',
                  sub:       `Walk to ${originStation!.name}`,
                  time:      `${Math.round((walkLegs.originToStation?.durationSec ?? 0) / 60)} min`,
                  dotColor:  COLORS.accentLight,
                  timeColor: COLORS.accentDark,
                },
                {
                  icon:      '🚉',
                  label:     originStation!.name,
                  sub:       'Board Gautrain',
                  time:      nextDepDisplay ?? '—',
                  dotColor:  COLORS.primaryLight,
                  timeColor: COLORS.primaryDark,
                },
                {
                  icon:      '🚆',
                  label:     `${originStation!.name} → ${destStation!.name}`,
                  sub:       (() => {
                    const n = getStopCount(originStation!.name, destStation!.name);
                    return n > 0 ? `${n} stop${n !== 1 ? 's' : ''}` : 'Direct';
                  })(),
                  time:      `${trainTime} min`,
                  dotColor:  COLORS.primaryLight,
                  timeColor: COLORS.primaryDark,
                },
                {
                  icon:      '🚶',
                  label:     destStation!.name,
                  sub:       `Walk to ${destInfo?.description ?? 'destination'}`,
                  time:      `${Math.round((walkLegs.stationToDest?.durationSec ?? 0) / 60)} min`,
                  dotColor:  COLORS.accentLight,
                  timeColor: COLORS.accentDark,
                },
              ] as const
            ).map((step, idx, arr) => (
              <View key={idx} style={styles.timelineStep}>
                <View style={styles.timelineTrack}>
                  <View style={[styles.timelineDot, { backgroundColor: step.dotColor }]}>
                    <Text style={styles.timelineDotIcon}>{step.icon}</Text>
                  </View>
                  {idx < arr.length - 1 && <View style={styles.timelineConnector} />}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel} numberOfLines={1}>{step.label}</Text>
                  <Text style={styles.timelineSub}>{step.sub}</Text>
                </View>
                <Text style={[styles.timelineTime, { color: step.timeColor }]}>{step.time}</Text>
              </View>
            ))}
          </Card>

          {/* Map */}
          {allCoords.length > 0 && (
            <View style={styles.mapCard}>
              <Text style={styles.sectionTitle}>Walking Route</Text>
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                  latitude:      allCoords[Math.floor(allCoords.length / 2)].latitude,
                  longitude:     allCoords[Math.floor(allCoords.length / 2)].longitude,
                  latitudeDelta: 0.06,
                  longitudeDelta: 0.06,
                }}
              >
                <Polyline
                  coordinates={allCoords}
                  strokeColor={COLORS.primary}
                  strokeWidth={4}
                  lineDashPattern={[8, 4]}
                />
                {originStation && (
                  <Marker
                    coordinate={{ latitude: originStation.lat, longitude: originStation.lon }}
                    title={`${originStation.name} Station`}
                  >
                    <View style={styles.mapMarker}><Text style={styles.mapMarkerIcon}>🚉</Text></View>
                  </Marker>
                )}
                {destStation && (
                  <Marker
                    coordinate={{ latitude: destStation.lat, longitude: destStation.lon }}
                    title={`${destStation.name} Station`}
                  >
                    <View style={[styles.mapMarker, { backgroundColor: COLORS.accentLight }]}>
                      <Text style={styles.mapMarkerIcon}>🏁</Text>
                    </View>
                  </Marker>
                )}
              </MapView>
            </View>
          )}
        </>
      )}
    </>
  ), [
    originStation, destStation, originInfo, destInfo,
    isPeak, loading, walkLegs, hasResult,
    fare, trainTime, nextDepDisplay, walkSec, totalSec, allCoords,
    updateStations, swapStations, showAmenities,
    saveCurrentTrip, handleAddToCalendar,
    startTrip, purchasing,
  ]);

  const renderFooter = useCallback(() => {
    if (!savedTrips.length) return null;
    return (
      <Card style={styles.savedCard}>
        <Text style={styles.sectionTitle}>⭐  Saved Trips</Text>
        {savedTrips.map((trip, idx) => (
          <View key={idx} style={styles.savedRow}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => loadSavedTrip(trip)}>
              <Text style={styles.savedText}>
                {trip.origin} → {trip.dest}
                <Text style={styles.savedBadge}>
                  {' '}{trip.isPeak ? '· Peak' : '· Off‑peak'}
                </Text>
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteSavedTrip(idx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.deleteBtn}>🗑️</Text>
            </TouchableOpacity>
          </View>
        ))}
      </Card>
    );
  }, [savedTrips, loadSavedTrip, deleteSavedTrip]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={[]}
        keyExtractor={() => 'noop'}
        renderItem={() => null}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      />

      {/* ── Amenities modal ── */}
      <Modal visible={amenitiesVisible} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{selectedStation?.name} Station</Text>

            {loadingAmenities && <ActivityIndicator style={{ marginVertical: 24 }} color={COLORS.primary} />}

            {!loadingAmenities && stationAmenities && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {(
                  [
                    { icon: '♿', label: 'Accessible', value: stationAmenities.accessible ? '✅ Yes' : '❌ No' },
                    { icon: '🅿️', label: 'Parking',    value: stationAmenities.parking   ? 'Available' : 'Not available' },
                    { icon: '🚻', label: 'Restrooms',  value: stationAmenities.restrooms  ? '✅ Yes' : '❌ No' },
                    { icon: '📶', label: 'WiFi',       value: stationAmenities.wifi       ? 'Available' : 'Not available' },
                  ] as const
                ).map(row => (
                  <View key={row.label} style={styles.amenityRow}>
                    <Text style={styles.amenityIcon}>{row.icon}</Text>
                    <Text style={styles.amenityLabel}>{row.label}</Text>
                    <Text style={styles.amenityValue}>{row.value}</Text>
                  </View>
                ))}
                {stationAmenities.shops.length > 0 && (
                  <View style={styles.amenityRow}>
                    <Text style={styles.amenityIcon}>🛍️</Text>
                    <Text style={styles.amenityLabel}>Shops</Text>
                    <Text style={[styles.amenityValue, { flex: 1 }]}>{stationAmenities.shops.join(', ')}</Text>
                  </View>
                )}
                {stationAmenities.phone && (
                  <View style={styles.amenityRow}>
                    <Text style={styles.amenityIcon}>📞</Text>
                    <Text style={styles.amenityLabel}>Phone</Text>
                    <Text style={styles.amenityValue}>{stationAmenities.phone}</Text>
                  </View>
                )}
                {stationAmenities.website && (
                  <View style={styles.amenityRow}>
                    <Text style={styles.amenityIcon}>🌐</Text>
                    <Text style={styles.amenityLabel}>Website</Text>
                    <Text style={[styles.amenityValue, { flex: 1 }]} numberOfLines={1}>
                      {stationAmenities.website}
                    </Text>
                  </View>
                )}
                {stationAmenities.openingHours && (
                  <View style={[styles.amenityRow, { alignItems: 'flex-start' }]}>
                    <Text style={styles.amenityIcon}>🕒</Text>
                    <Text style={styles.amenityLabel}>Hours</Text>
                    <Text style={[styles.amenityValue, { flex: 1 }]}>{stationAmenities.openingHours}</Text>
                  </View>
                )}
              </ScrollView>
            )}

            {!loadingAmenities && !stationAmenities && (
              <Text style={styles.amenityEmpty}>No amenity information available for this station.</Text>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={() => setAmenitiesVisible(false)} activeOpacity={0.8}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Styles (unchanged) ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: { padding: SPACING.md, paddingBottom: 56 },

  // Hero
  hero: { alignItems: 'center', paddingVertical: SPACING.xl, marginBottom: SPACING.md },
  heroIconWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  heroIcon:  { fontSize: 36 },
  heroTitle: { ...(TYPOGRAPHY.h1 as object), textAlign: 'center', marginBottom: SPACING.xs },
  heroSub:   { ...(TYPOGRAPHY.body as object), textAlign: 'center', color: COLORS.textMuted, lineHeight: 22 },

  // Input card
  inputCard: { marginBottom: SPACING.md, zIndex: 10 },
  inputRow:  { flexDirection: 'row', gap: SPACING.sm },

  routeIndicator: { width: 24, alignItems: 'center', paddingTop: 30, gap: 2 },
  originDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: COLORS.primary,
    borderWidth: 2, borderColor: COLORS.primaryLight,
  },
  routeLine: {
    flex: 1, width: 2,
    backgroundColor: COLORS.border,
    marginVertical: 4,
    minHeight: 20,
  },
  destDot: {
    width: 14, height: 14, borderRadius: 4,
    backgroundColor: COLORS.accent,
    borderWidth: 2, borderColor: COLORS.accentLight,
  },

  inputField:  { flex: 1 },
  inputLabel:  {
    ...(TYPOGRAPHY.label as object),
    fontSize: 10, letterSpacing: 1,
    color: COLORS.textMuted, marginBottom: 4,
  },

  stationChip: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: SPACING.xs, padding: SPACING.sm,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md, gap: SPACING.xs,
  },
  chipEmoji: { fontSize: 16 },
  chipBody:  { flex: 1 },
  chipName:  { ...(TYPOGRAPHY.bodyBold as object), fontSize: 13, color: COLORS.primaryDark },
  chipSub:   { ...(TYPOGRAPHY.caption as object), color: COLORS.primaryDark, marginTop: 1 },
  chipInfo:  { fontSize: 14 },

  swapBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    alignSelf: 'center', marginVertical: SPACING.xs,
    backgroundColor: COLORS.border,
    paddingHorizontal: SPACING.md, paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  swapIcon:  { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  swapLabel: { ...(TYPOGRAPHY.captionBold as object), color: COLORS.primary },

  // Loading
  loadingRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, justifyContent: 'center', marginVertical: SPACING.md },
  loadingText: { ...(TYPOGRAPHY.body as object), color: COLORS.textMuted },

  // Fare card
  fareCard: { marginBottom: SPACING.md },
  fareRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md },
  fareLabel:  { ...(TYPOGRAPHY.label as object), color: COLORS.textMuted, marginBottom: 2 },
  fareAmount: { fontSize: 42, fontWeight: '800', color: COLORS.primary, letterSpacing: -1 },
  peakRow:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  peakLabel:  { ...(TYPOGRAPHY.caption as object), color: COLORS.textMuted },
  peakActive: { color: COLORS.primary, fontWeight: '700' },

  statsRow:    { flexDirection: 'row', backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm },
  statItem:    { flex: 1, alignItems: 'center' },
  statIcon:    { fontSize: 20, marginBottom: 4 },
  statValue:   { ...(TYPOGRAPHY.h3 as object), color: COLORS.primary, fontSize: 15 },
  statLabel:   { ...(TYPOGRAPHY.caption as object), color: COLORS.textMuted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: COLORS.border },

  nextDepRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  nextDepLabel: { ...(TYPOGRAPHY.caption as object), color: COLORS.textMuted },
  nextDepValue: { ...(TYPOGRAPHY.bodyBold as object), color: COLORS.primary },

  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  actionBtn: {
    flex: 1, backgroundColor: COLORS.primary,
    paddingVertical: 11, borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  actionBtnSecondary: { backgroundColor: COLORS.accentLight },
  actionBtnText:      { ...(TYPOGRAPHY.bodyBold as object), color: '#fff', fontSize: 13 },
  actionBtnTextSecondary: { color: COLORS.accentDark },

  // Timeline
  timelineCard: { marginBottom: SPACING.md },
  sectionTitle: { ...(TYPOGRAPHY.bodyBold as object), marginBottom: SPACING.md, color: COLORS.textPrimary ?? '#1E293B' },
  timelineStep: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: 2 },
  timelineTrack: { alignItems: 'center', width: 40 },
  timelineDot: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  timelineDotIcon: { fontSize: 16 },
  timelineConnector: { width: 2, height: 24, backgroundColor: COLORS.border, marginTop: 2 },
  timelineContent:  { flex: 1, paddingTop: 6 },
  timelineLabel:    { ...(TYPOGRAPHY.bodyBold as object), fontSize: 13, color: COLORS.textPrimary ?? '#1E293B' },
  timelineSub:      { ...(TYPOGRAPHY.caption as object), color: COLORS.textMuted, marginTop: 1 },
  timelineTime:     { ...(TYPOGRAPHY.captionBold as object), paddingTop: 8, minWidth: 56, textAlign: 'right' },

  // Map
  mapCard: {
    borderRadius: RADIUS.lg, overflow: 'hidden',
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  map: { height: 260 },
  mapMarker: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 20, padding: 6,
    ...SHADOWS.sm,
  },
  mapMarkerIcon: { fontSize: 18 },

  // Saved trips
  savedCard: { marginBottom: SPACING.md },
  savedRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    gap: SPACING.xs,
  },
  savedText:   { ...(TYPOGRAPHY.body as object), color: COLORS.textPrimary ?? '#1E293B' },
  savedBadge:  { ...(TYPOGRAPHY.caption as object), color: COLORS.textMuted },
  deleteBtn:   { fontSize: 18, paddingHorizontal: SPACING.xs },

  // Modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg, maxHeight: '80%',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center', marginBottom: SPACING.md,
  },
  modalTitle:   { ...(TYPOGRAPHY.h3 as object), textAlign: 'center', marginBottom: SPACING.lg, color: COLORS.textPrimary ?? '#1E293B' },
  amenityRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm },
  amenityIcon:  { fontSize: 18, width: 28 },
  amenityLabel: { ...(TYPOGRAPHY.bodyBold as object), width: 90, color: COLORS.textMuted, fontSize: 13 },
  amenityValue: { ...(TYPOGRAPHY.body as object), color: COLORS.textPrimary ?? '#1E293B', fontSize: 13 },
  amenityEmpty: { ...(TYPOGRAPHY.body as object), textAlign: 'center', color: COLORS.textMuted, marginVertical: SPACING.lg },
  closeBtn: {
    marginTop: SPACING.lg, backgroundColor: COLORS.primary,
    paddingVertical: 13, borderRadius: RADIUS.md, alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

const gpStyles = {
  textInput: {
    height: 44,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.background,
    fontSize: 14,
    color: COLORS.textPrimary ?? '#1E293B',
  },
  listView: {
    marginTop: 2,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    ...SHADOWS.sm,
    zIndex: 999,
  },
  row: { paddingVertical: 10, paddingHorizontal: SPACING.sm },
  description: { fontSize: 14, color: COLORS.textPrimary ?? '#1E293B' },
  separator: { height: 1, backgroundColor: COLORS.border },
};