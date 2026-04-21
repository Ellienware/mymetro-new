// app/trains/metrorail/train-tab.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
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
import { Card } from '@/components/ui';
import { getMetrorailFare, FARE_CATEGORIES } from '@/constants/metrorailFares';
import { useTicketPurchase } from '@/hooks/useTicketPurchase';
import { TransportStop } from '@/services/transport/types';

const metrorailData = require('@/assets/metrorail_data.json');
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
  categoryId: string;
}

interface PlaceInfo {
  description: string;
  details: GooglePlaceDetail;
}

interface Amenities {
  accessible: boolean | null;
  parking: boolean | null;
  restrooms: boolean | null;
  wifi: boolean | null;
  shops: string[];
  phone?: string;
  website?: string;
  openingHours?: string;
  rating?: number;
  userRatingCount?: number;
  summary?: string;
}

interface NextDeparture {
  time: string;
  isNextDay: boolean;
}

// ─── Pure helpers ──────────────────────────────────────────────────────────────

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
  for (const s of metrorailData.stations as Station[]) {
    const d = haversine(lat, lng, s.lat, s.lon);
    if (d < minDist) { minDist = d; nearest = s; }
  }
  return nearest;
}

function getTravelTime(from: string, to: string): number {
  if (from === to) return 0;
  return (
    metrorailData.travelTimeMatrix?.[`${from},${to}`] ??
    metrorailData.travelTimeMatrix?.[`${to},${from}`] ??
    0
  );
}

function getNextDeparture(stationName: string): NextDeparture | null {
  const deps = metrorailData.departures?.[stationName] as string[] | undefined;
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

async function fetchWalkingRoute(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
): Promise<WalkingRoute | null> {
  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: dest.lat, longitude: dest.lng } } },
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
      durationSec: parseInt(r.duration.replace('s', ''), 10),
      distanceMeters: r.distanceMeters,
      coordinates: polyline
        .decode(r.polyline.encodedPolyline)
        .map(([lat, lng]: [number, number]) => ({ latitude: lat, longitude: lng })),
    };
  } catch (e) {
    console.error('Walking route error:', e);
    return null;
  }
}

async function findPlaceId(stationName: string): Promise<string | null> {
  const queries = [
    `${stationName} Metrorail station South Africa`,
    `${stationName} train station South Africa`,
    stationName,
  ];
  for (const q of queries) {
    try {
      const url =
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
        `?input=${encodeURIComponent(q)}` +
        `&inputtype=textquery` +
        `&fields=place_id` +
        `&key=${GOOGLE_API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.status === 'OK' && data.candidates?.[0]?.place_id) {
        return data.candidates[0].place_id as string;
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchStationAmenities(placeId: string): Promise<Amenities | null> {
  try {
    const fieldMask = [
      'accessibilityOptions',
      'parkingOptions',
      'types',
      'formattedPhoneNumber',
      'nationalPhoneNumber',
      'websiteUri',
      'regularOpeningHours',
      'editorialSummary',
      'rating',
      'userRatingCount',
    ].join(',');

    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': fieldMask,
      },
    });

    if (!res.ok) {
      console.error('Places API error:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const types: string[] = data.types ?? [];

    return {
      accessible: data.accessibilityOptions?.wheelchairAccessibleEntrance ?? null,
      parking:
        data.parkingOptions?.hasParkingLot === true ||
        data.parkingOptions?.hasFreeStreetParking === true ||
        types.some(t => t.includes('parking'))
          ? true
          : data.parkingOptions
          ? false
          : null,
      restrooms: types.includes('restroom') ? true : null,
      wifi: types.includes('wifi') ? true : null,
      shops: types.filter(t => t.includes('store') || t.includes('shop') || t.includes('mall')),
      phone: data.nationalPhoneNumber ?? data.formattedPhoneNumber,
      website: data.websiteUri,
      openingHours: data.regularOpeningHours?.weekdayDescriptions?.join('\n')
        ?? data.regularOpeningHours?.weekdayText?.join('\n'),
      rating: data.rating,
      userRatingCount: data.userRatingCount,
      summary: data.editorialSummary?.text ?? data.editorialSummary?.overview,
    };
  } catch (e) {
    console.error('Amenities fetch error:', e);
    return null;
  }
}

async function addToCalendar(
  originStation: Station,
  destStation: Station,
  departureTimeStr: string,
  travelTimeMinutes: number,
  fare: number,
  categoryName: string,
  walkToStationMin: number,
  walkFromStationMin: number,
): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Please allow calendar access to add reminders.');
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
    title: `🚆 Metrorail: ${originStation.name} → ${destStation.name}`,
    startDate,
    endDate,
    location: `${originStation.name} Metrorail Station`,
    notes:
      `Fare: R${fare.toFixed(2)} (${categoryName})\n` +
      `Walk to station: ~${walkToStationMin} min\n` +
      `Walk from station: ~${walkFromStationMin} min`,
    alarms: [{ relativeOffset: -15 }],
  });
  return true;
}

function fmtWalk(route: WalkingRoute): string {
  return `${(route.distanceMeters / 1000).toFixed(1)} km · ${Math.round(route.durationSec / 60)} min`;
}

function fmtDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

function AmenityRow({
  icon, label, value,
}: { icon: string; label: string; value: string | null }) {
  if (value === null) return null;
  return (
    <View style={styles.amenityRow}>
      <Text style={styles.amenityIcon}>{icon}</Text>
      <Text style={styles.amenityLabel}>{label}</Text>
      <Text style={styles.amenityValue}>{value}</Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MetrorailTab() {
  const { user } = useUser();
  const { buyTicket, purchasing } = useTicketPurchase();

  const [originInfo,   setOriginInfo]   = useState<PlaceInfo | null>(null);
  const [destInfo,     setDestInfo]     = useState<PlaceInfo | null>(null);
  const [originStation, setOriginStation] = useState<Station | null>(null);
  const [destStation,   setDestStation]   = useState<Station | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('metro');
  const [loading,  setLoading]  = useState(false);
  const [walkLegs, setWalkLegs] = useState<WalkLegs>({ originToStation: null, stationToDest: null });
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);

  const [amenitiesVisible,  setAmenitiesVisible]  = useState(false);
  const [selectedStation,   setSelectedStation]   = useState<Station | null>(null);
  const [stationAmenities,  setStationAmenities]  = useState<Amenities | null>(null);
  const [loadingAmenities,  setLoadingAmenities]  = useState(false);
  const [amenitiesError,    setAmenitiesError]    = useState<string | null>(null);

  const mapRef = useRef<MapView>(null);

  // Derived values
  const distanceKm = useMemo(() =>
    originStation && destStation
      ? haversine(originStation.lat, originStation.lon, destStation.lat, destStation.lon)
      : 0,
    [originStation, destStation],
  );

  const fare = useMemo(() =>
    originStation && destStation ? getMetrorailFare(distanceKm, selectedCategory) : 0,
    [distanceKm, selectedCategory, originStation, destStation],
  );

  const trainTime = useMemo(() =>
    originStation && destStation
      ? getTravelTime(originStation.name, destStation.name)
      : 0,
    [originStation, destStation],
  );

  const nextDepResult = useMemo(() =>
    originStation ? getNextDeparture(originStation.name) : null,
    [originStation],
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
  const categoryName = useMemo(() =>
    FARE_CATEGORIES.find(c => c.id === selectedCategory)?.name ?? selectedCategory,
    [selectedCategory],
  );

  // Persistence
  useEffect(() => { loadSavedTrips(); }, []);

  const loadSavedTrips = async () => {
    try {
      const raw = await AsyncStorage.getItem('metrorail_saved_trips');
      if (raw) setSavedTrips(JSON.parse(raw));
    } catch (e) { console.error('loadSavedTrips:', e); }
  };

  const persistTrips = async (trips: SavedTrip[]) => {
    setSavedTrips(trips);
    await AsyncStorage.setItem('metrorail_saved_trips', JSON.stringify(trips));
  };

  // Callbacks
  const saveCurrentTrip = useCallback(async () => {
    if (!originStation || !destStation) return;
    const trip: SavedTrip = {
      origin: originStation.name,
      dest: destStation.name,
      categoryId: selectedCategory,
    };
    await persistTrips([...savedTrips, trip]);
    Alert.alert('Saved ⭐', 'Trip added to favourites.');
  }, [originStation, destStation, selectedCategory, savedTrips]);

  const deleteSavedTrip = useCallback(async (index: number) => {
    await persistTrips(savedTrips.filter((_, i) => i !== index));
  }, [savedTrips]);

  const loadSavedTrip = useCallback((trip: SavedTrip) => {
    const origin = (metrorailData.stations as Station[]).find(s => s.name === trip.origin);
    const dest   = (metrorailData.stations as Station[]).find(s => s.name === trip.dest);
    if (origin && dest) {
      setOriginStation(origin);
      setDestStation(dest);
      setSelectedCategory(trip.categoryId);
      setWalkLegs({ originToStation: null, stationToDest: null });
      setOriginInfo(null);
      setDestInfo(null);
    }
  }, []);

  const updateStations = useCallback(async (
    data: { description: string },
    details: GooglePlaceDetail | null,
    type: 'origin' | 'destination',
  ) => {
    if (!details) return;
    const lat = details.geometry.location.lat;
    const lng = details.geometry.location.lng;
    const station = findNearestStation(lat, lng);
    if (!station) {
      Alert.alert('Out of range', 'No Metrorail station found near that location.');
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

  const swapStations = useCallback(() => {
    const prevOriginInfo    = originInfo;
    const prevDestInfo      = destInfo;
    const prevOriginStation = originStation;
    const prevDestStation   = destStation;
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
    setAmenitiesError(null);
    try {
      const placeId = await findPlaceId(station.name);
      if (!placeId) {
        setAmenitiesError('Could not find this station in Google Maps.');
        return;
      }
      const amenities = await fetchStationAmenities(placeId);
      if (!amenities) {
        setAmenitiesError('Failed to load station information.');
        return;
      }
      setStationAmenities(amenities);
    } catch (e) {
      console.error('showAmenities:', e);
      setAmenitiesError('An error occurred while loading station data.');
    } finally {
      setLoadingAmenities(false);
    }
  }, []);

  const handleAddToCalendar = useCallback(async () => {
    if (!originStation || !destStation || !nextDepResult) {
      Alert.alert('Not ready', 'Please set both origin and destination first.');
      return;
    }
    const walkTo   = Math.round((walkLegs.originToStation?.durationSec ?? 0) / 60);
    const walkFrom = Math.round((walkLegs.stationToDest?.durationSec ?? 0) / 60);
    const success  = await addToCalendar(
      originStation, destStation,
      nextDepResult.time, trainTime,
      fare, categoryName,
      walkTo, walkFrom,
    );
    if (success) Alert.alert('Added 📅', 'Trip added to your calendar with a 15-min reminder.');
  }, [originStation, destStation, nextDepResult, trainTime, fare, categoryName, walkLegs]);

  // ─── NEW: Buy ticket using unified transport system ────────────────────────
  const handleBuyTicket = useCallback(async () => {
    if (!originStation || !destStation) {
      Alert.alert('Cannot buy ticket', 'Please select both origin and destination stations.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Not logged in', 'Please log in to purchase a ticket.');
      return;
    }
    const originStop: TransportStop = {
      id: originStation.id,
      name: originStation.name,
      lat: originStation.lat,
      lon: originStation.lon,
    };
    const destStop: TransportStop = {
      id: destStation.id,
      name: destStation.name,
      lat: destStation.lat,
      lon: destStation.lon,
    };
    const ticket = await buyTicket({
      userId: user.id,
      providerId: 'metrorail',
      origin: originStop,
      destination: destStop,
      categoryId: selectedCategory,
    });
    if (ticket) {
      Alert.alert(
        'Ticket Purchased 🎫',
        `Fare: R${(ticket.fare / 100).toFixed(2)}\nValid until ${new Date(ticket.validUntil).toLocaleString()}`,
        [{ text: 'OK', onPress: () => router.push('/tickets') }]
      );
    } else {
      Alert.alert('Error', 'Could not purchase ticket. Please check your balance.');
    }
  }, [originStation, destStation, selectedCategory, user?.id, buyTicket]);

  // ── Render header ─────────────────────────────────────────────────────────

  const renderHeader = useCallback(() => (
    <>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroIconWrap}>
          <Text style={styles.heroIcon}>🚆</Text>
        </View>
        <Text style={styles.heroTitle}>Metrorail Planner</Text>
        <Text style={styles.heroSub}>
          Door-to-door urban rail journey with walking directions included.
        </Text>
      </View>

      {/* Input card */}
      <Card style={styles.inputCard}>
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
                  <Text style={styles.chipName}>{originStation.name}</Text>
                  {walkLegs.originToStation && (
                    <Text style={styles.chipSub}>🚶 {fmtWalk(walkLegs.originToStation)}</Text>
                  )}
                </View>
                <Text style={styles.chipInfo}>ℹ️</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.swapBtn} onPress={swapStations} activeOpacity={0.8}>
          <Text style={styles.swapIcon}>⇅</Text>
          <Text style={styles.swapLabel}>Swap</Text>
        </TouchableOpacity>

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
                  <Text style={styles.chipName}>{destStation.name}</Text>
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

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.loadingText}>Calculating walking routes…</Text>
        </View>
      )}

      {hasResult && (
        <>
          <Card style={styles.fareCard}>
            <View style={styles.fareRow}>
              <View>
                <Text style={styles.fareLabel}>Fare</Text>
                <Text style={styles.fareAmount}>R{fare.toFixed(2)}</Text>
                <Text style={styles.fareDistance}>{distanceKm.toFixed(1)} km rail distance</Text>
              </View>
              <View style={styles.categoryPicker}>
                {FARE_CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catBtn, selectedCategory === cat.id && styles.catBtnActive]}
                    onPress={() => setSelectedCategory(cat.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.catLabel, selectedCategory === cat.id && styles.catLabelActive]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
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
              <Text style={styles.nextDepValue}>{nextDepDisplay ?? 'No schedule'}</Text>
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
              {/* NEW Buy Ticket button */}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: COLORS.accent }]}
                onPress={handleBuyTicket}
                disabled={purchasing || !originStation || !destStation}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnText}>
                  {purchasing ? '⏳ Buying...' : '🎫 Buy Ticket'}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>

          {/* Journey timeline */}
          <Card style={styles.timelineCard}>
            <Text style={styles.sectionTitle}>Journey Breakdown</Text>
            {[
              {
                icon: '🚶', color: COLORS.accentLight, textColor: COLORS.accentDark,
                label: originInfo?.description ?? 'Your location',
                sub: `Walk to ${originStation!.name}`,
                time: `${Math.round((walkLegs.originToStation?.durationSec ?? 0) / 60)} min`,
              },
              {
                icon: '🚉', color: COLORS.primaryLight, textColor: COLORS.primaryDark,
                label: originStation!.name,
                sub: 'Board Metrorail',
                time: nextDepDisplay ?? '—',
              },
              {
                icon: '🚆', color: COLORS.primaryLight, textColor: COLORS.primaryDark,
                label: `${originStation!.name} → ${destStation!.name}`,
                sub: `${distanceKm.toFixed(1)} km · ${categoryName}`,
                time: `${trainTime} min`,
              },
              {
                icon: '🚶', color: COLORS.accentLight, textColor: COLORS.accentDark,
                label: destStation!.name,
                sub: `Walk to ${destInfo?.description ?? 'destination'}`,
                time: `${Math.round((walkLegs.stationToDest?.durationSec ?? 0) / 60)} min`,
              },
            ].map((step, idx, arr) => (
              <View key={idx} style={styles.timelineStep}>
                <View style={styles.timelineTrack}>
                  <View style={[styles.timelineDot, { backgroundColor: step.color }]}>
                    <Text style={styles.timelineDotIcon}>{step.icon}</Text>
                  </View>
                  {idx < arr.length - 1 && <View style={styles.timelineConnector} />}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel} numberOfLines={1}>{step.label}</Text>
                  <Text style={styles.timelineSub}>{step.sub}</Text>
                </View>
                <Text style={[styles.timelineTime, { color: step.textColor }]}>{step.time}</Text>
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
                    title={originStation.name}
                  >
                    <View style={styles.mapMarker}>
                      <Text style={styles.mapMarkerIcon}>🚉</Text>
                    </View>
                  </Marker>
                )}
                {destStation && (
                  <Marker
                    coordinate={{ latitude: destStation.lat, longitude: destStation.lon }}
                    title={destStation.name}
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
    originStation, destStation, originInfo, destInfo, selectedCategory,
    loading, walkLegs, hasResult,
    fare, trainTime, nextDepDisplay, walkSec, totalSec, allCoords,
    distanceKm, categoryName,
    updateStations, swapStations, showAmenities,
    saveCurrentTrip, handleAddToCalendar,
    handleBuyTicket, purchasing,
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
                  {' · '}{FARE_CATEGORIES.find(c => c.id === trip.categoryId)?.name ?? trip.categoryId}
                </Text>
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => deleteSavedTrip(idx)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.deleteBtn}>🗑️</Text>
            </TouchableOpacity>
          </View>
        ))}
      </Card>
    );
  }, [savedTrips, loadSavedTrip, deleteSavedTrip]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={[]}
        keyExtractor={() => 'noop'}
        renderItem={() => null}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      />

      {/* Amenities bottom-sheet modal (unchanged) */}
      <Modal
        visible={amenitiesVisible}
        animationType="slide"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={() => setAmenitiesVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{selectedStation?.name}</Text>
            <Text style={styles.modalSubtitle}>Metrorail Station</Text>

            {loadingAmenities && (
              <View style={styles.amenitiesLoading}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={styles.amenitiesLoadingText}>Loading station info…</Text>
              </View>
            )}

            {!loadingAmenities && amenitiesError && (
              <View style={styles.amenitiesEmpty}>
                <Text style={styles.amenitiesEmptyIcon}>📍</Text>
                <Text style={styles.amenitiesEmptyText}>{amenitiesError}</Text>
              </View>
            )}

            {!loadingAmenities && stationAmenities && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {stationAmenities.rating != null && (
                  <View style={styles.ratingRow}>
                    <Text style={styles.ratingStars}>{'⭐'.repeat(Math.round(stationAmenities.rating))}</Text>
                    <Text style={styles.ratingText}>
                      {stationAmenities.rating.toFixed(1)}
                      {stationAmenities.userRatingCount != null &&
                        ` (${stationAmenities.userRatingCount.toLocaleString()} reviews)`}
                    </Text>
                  </View>
                )}
                {stationAmenities.summary && <Text style={styles.amenitiesSummary}>{stationAmenities.summary}</Text>}
                <AmenityRow icon="♿" label="Accessible" value={stationAmenities.accessible === null ? null : (stationAmenities.accessible ? '✅ Yes' : '❌ No')} />
                <AmenityRow icon="🅿️" label="Parking" value={stationAmenities.parking === null ? null : (stationAmenities.parking ? 'Available' : 'Not confirmed')} />
                <AmenityRow icon="🚻" label="Restrooms" value={stationAmenities.restrooms === null ? null : (stationAmenities.restrooms ? '✅ Yes' : null)} />
                <AmenityRow icon="📶" label="WiFi" value={stationAmenities.wifi === null ? null : (stationAmenities.wifi ? 'Available' : null)} />
                {stationAmenities.shops.length > 0 && <AmenityRow icon="🛍️" label="Shops" value={stationAmenities.shops.join(', ')} />}
                <AmenityRow icon="📞" label="Phone" value={stationAmenities.phone ?? null} />
                <AmenityRow icon="🌐" label="Website" value={stationAmenities.website ?? null} />
                {stationAmenities.openingHours && (
                  <View style={[styles.amenityRow, { alignItems: 'flex-start' }]}>
                    <Text style={styles.amenityIcon}>🕒</Text>
                    <Text style={styles.amenityLabel}>Hours</Text>
                    <Text style={[styles.amenityValue, { flex: 1 }]}>{stationAmenities.openingHours}</Text>
                  </View>
                )}
                {stationAmenities.accessible === null &&
                 stationAmenities.parking === null &&
                 !stationAmenities.phone &&
                 !stationAmenities.website &&
                 !stationAmenities.openingHours &&
                 !stationAmenities.summary &&
                 stationAmenities.rating == null && (
                  <View style={styles.amenitiesEmpty}>
                    <Text style={styles.amenitiesEmptyIcon}>🔍</Text>
                    <Text style={styles.amenitiesEmptyText}>No detailed amenity data is available for this station yet.</Text>
                  </View>
                )}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={() => setAmenitiesVisible(false)} activeOpacity={0.8}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles (unchanged) ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: { padding: SPACING.md, paddingBottom: 56 },

  hero: { alignItems: 'center', paddingVertical: SPACING.xl, marginBottom: SPACING.md },
  heroIconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md, ...SHADOWS.sm },
  heroIcon: { fontSize: 36 },
  heroTitle: { ...(TYPOGRAPHY.h1 as object), textAlign: 'center', marginBottom: SPACING.xs },
  heroSub: { ...(TYPOGRAPHY.body as object), textAlign: 'center', color: COLORS.textMuted, lineHeight: 22 },

  inputCard: { marginBottom: SPACING.md, zIndex: 10 },
  inputRow: { flexDirection: 'row', gap: SPACING.sm },
  routeIndicator: { width: 24, alignItems: 'center', paddingTop: 30, gap: 2 },
  originDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.primary, borderWidth: 2, borderColor: COLORS.primaryLight },
  routeLine: { flex: 1, width: 2, backgroundColor: COLORS.border, marginVertical: 4, minHeight: 20 },
  destDot: { width: 14, height: 14, borderRadius: 4, backgroundColor: COLORS.accent, borderWidth: 2, borderColor: COLORS.accentLight },
  inputField: { flex: 1 },
  inputLabel: { ...(TYPOGRAPHY.label as object), fontSize: 10, letterSpacing: 1, color: COLORS.textMuted, marginBottom: 4 },

  stationChip: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xs, padding: SPACING.sm, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, gap: SPACING.xs },
  chipEmoji: { fontSize: 16 },
  chipBody: { flex: 1 },
  chipName: { ...(TYPOGRAPHY.bodyBold as object), fontSize: 13, color: COLORS.primaryDark },
  chipSub: { ...(TYPOGRAPHY.caption as object), color: COLORS.primaryDark, marginTop: 1 },
  chipInfo: { fontSize: 14 },

  swapBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, alignSelf: 'center', marginVertical: SPACING.xs, backgroundColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full },
  swapIcon: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  swapLabel: { ...(TYPOGRAPHY.captionBold as object), color: COLORS.primary },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, justifyContent: 'center', marginVertical: SPACING.md },
  loadingText: { ...(TYPOGRAPHY.body as object), color: COLORS.textMuted },

  fareCard: { marginBottom: SPACING.md },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md, flexWrap: 'wrap', gap: SPACING.sm },
  fareLabel: { ...(TYPOGRAPHY.label as object), color: COLORS.textMuted, marginBottom: 2 },
  fareAmount: { fontSize: 38, fontWeight: '800', color: COLORS.primary, letterSpacing: -1 },
  fareDistance: { ...(TYPOGRAPHY.caption as object), color: COLORS.textMuted, marginTop: 2 },
  categoryPicker: { gap: 4 },
  catBtn: { paddingHorizontal: SPACING.sm, paddingVertical: 5, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background },
  catBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catLabel: { ...(TYPOGRAPHY.caption as object), color: COLORS.textMuted, textAlign: 'center' },
  catLabelActive: { color: '#fff', fontWeight: '700' },

  statsRow: { flexDirection: 'row', backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm },
  statItem: { flex: 1, alignItems: 'center' },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statValue: { ...(TYPOGRAPHY.h3 as object), color: COLORS.primary, fontSize: 15 },
  statLabel: { ...(TYPOGRAPHY.caption as object), color: COLORS.textMuted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: COLORS.border },

  nextDepRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  nextDepLabel: { ...(TYPOGRAPHY.caption as object), color: COLORS.textMuted },
  nextDepValue: { ...(TYPOGRAPHY.bodyBold as object), color: COLORS.primary },

  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  actionBtn: { flex: 1, backgroundColor: COLORS.primary, paddingVertical: 11, borderRadius: RADIUS.md, alignItems: 'center' },
  actionBtnSecondary: { backgroundColor: COLORS.accentLight },
  actionBtnText: { ...(TYPOGRAPHY.bodyBold as object), color: '#fff', fontSize: 13 },
  actionBtnTextSecondary: { color: COLORS.accentDark },

  timelineCard: { marginBottom: SPACING.md },
  sectionTitle: { ...(TYPOGRAPHY.bodyBold as object), marginBottom: SPACING.md, color: COLORS.textPrimary ?? '#1E293B' },
  timelineStep: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: 2 },
  timelineTrack: { alignItems: 'center', width: 40 },
  timelineDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  timelineDotIcon: { fontSize: 16 },
  timelineConnector: { width: 2, height: 24, backgroundColor: COLORS.border, marginTop: 2 },
  timelineContent: { flex: 1, paddingTop: 6 },
  timelineLabel: { ...(TYPOGRAPHY.bodyBold as object), fontSize: 13, color: COLORS.textPrimary ?? '#1E293B' },
  timelineSub: { ...(TYPOGRAPHY.caption as object), color: COLORS.textMuted, marginTop: 1 },
  timelineTime: { ...(TYPOGRAPHY.captionBold as object), paddingTop: 8, minWidth: 56, textAlign: 'right' },

  mapCard: { borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: COLORS.surface, marginBottom: SPACING.md, ...SHADOWS.md },
  map: { height: 240 },
  mapMarker: { backgroundColor: COLORS.primaryLight, borderRadius: 20, padding: 6, ...SHADOWS.sm },
  mapMarkerIcon: { fontSize: 18 },

  savedCard: { marginBottom: SPACING.md },
  savedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.xs },
  savedText: { ...(TYPOGRAPHY.body as object), color: COLORS.textPrimary ?? '#1E293B' },
  savedBadge: { ...(TYPOGRAPHY.caption as object), color: COLORS.textMuted },
  deleteBtn: { fontSize: 18, paddingHorizontal: SPACING.xs },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, maxHeight: '85%', flex: 0, minHeight: 200 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: SPACING.md },
  modalTitle: { ...(TYPOGRAPHY.h3 as object), textAlign: 'center', color: COLORS.textPrimary ?? '#1E293B' },
  modalSubtitle: { ...(TYPOGRAPHY.caption as object), textAlign: 'center', color: COLORS.textMuted, marginBottom: SPACING.lg },

  amenitiesLoading: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, justifyContent: 'center', paddingVertical: SPACING.xl },
  amenitiesLoadingText: { ...(TYPOGRAPHY.body as object), color: COLORS.textMuted },
  amenitiesEmpty: { alignItems: 'center', paddingVertical: SPACING.xl },
  amenitiesEmptyIcon: { fontSize: 36, marginBottom: SPACING.sm },
  amenitiesEmptyText: { ...(TYPOGRAPHY.body as object), color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  ratingStars: { fontSize: 14 },
  ratingText: { ...(TYPOGRAPHY.bodyBold as object), color: COLORS.textPrimary ?? '#1E293B' },
  amenitiesSummary: { ...(TYPOGRAPHY.body as object), color: COLORS.textMuted, lineHeight: 22, marginBottom: SPACING.md, fontStyle: 'italic' },

  amenityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm },
  amenityIcon: { fontSize: 18, width: 28 },
  amenityLabel: { ...(TYPOGRAPHY.bodyBold as object), width: 90, color: COLORS.textMuted, fontSize: 13 },
  amenityValue: { ...(TYPOGRAPHY.body as object), color: COLORS.textPrimary ?? '#1E293B', fontSize: 13, flexShrink: 1 },

  closeBtn: { marginTop: SPACING.lg, backgroundColor: COLORS.primary, paddingVertical: 13, borderRadius: RADIUS.md, alignItems: 'center' },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

const gpStyles = {
  textInput: {
    height: 44, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm, backgroundColor: COLORS.background,
    fontSize: 14, color: COLORS.textPrimary ?? '#1E293B',
  },
  listView: { marginTop: 2, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, zIndex: 999, ...SHADOWS.sm },
  row: { paddingVertical: 10, paddingHorizontal: SPACING.sm },
  description: { fontSize: 14, color: COLORS.textPrimary ?? '#1E293B' },
  separator: { height: 1, backgroundColor: COLORS.border },
};