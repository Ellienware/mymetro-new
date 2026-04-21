// app/driver/minibus-taxi/active-ride.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, TextInput, ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline } from 'react-native-maps';
import polyline from '@mapbox/polyline';
import { client, databases, DATABASE_ID, COLLECTIONS, ID, Query } from '@/lib/appwrite';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader, PrimaryButton, LoadingScreen, Card, LiveBadge } from '@/components/ui';
import { getRoute, getVehicle, updateTrip } from '@/services/saasBridge';
import { AppwriteService } from '@/services/appwriteService';

interface RouteStop {
  id?: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
  fareFromOrigin: number;
  distanceFromOrigin?: number;
}

export default function MinibusTripScreen() {
  const { routeId, initialPassengerCount } = useLocalSearchParams<{ routeId: string; initialPassengerCount?: string }>();
  const { user } = useUser();
  const [route, setRoute] = useState<{
    name: string;
    origin: string;
    destination: string;
    distance: number;
    baseFare: number;
    polyline?: string;
    stops?: RouteStop[];
  } | null>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tripStarted, setTripStarted] = useState(false);
  const [ending, setEnding] = useState(false);
  const [location, setLocation] = useState<any>(null);
  const [routeCoords, setRouteCoords] = useState<any[]>([]);
  const [passengerCount, setPassengerCount] = useState(0);
  const [cashCollected, setCashCollected] = useState('');
  const [digitalCollected, setDigitalCollected] = useState('');
  const [dailyRental, setDailyRental] = useState('');
  const [pendingFlags, setPendingFlags] = useState<any[]>([]);
  const locationInterval = useRef<any>(null);
  const tripIdRef = useRef<string | null>(null);
  const flagSub = useRef<any>(null);
  const [lastArrivedStopId, setLastArrivedStopId] = useState<string | null>(null);

  useEffect(() => {
    init();
    return () => { stopTracking(); if (flagSub.current) flagSub.current(); };
  }, []);

  useEffect(() => {
    if (!tripId) return;
    const unsub = client.subscribe(`databases.${DATABASE_ID}.collections.FLAG_REQUESTS.documents`, (res) => {
      const p = res.payload as any;
      if (p?.tripId === tripId && p.status === 'pending') {
        setPendingFlags(prev => [...prev, p]);
        Alert.alert('New Flag 🙋', 'A passenger wants to board. Tap their map marker.');
      }
    });
    flagSub.current = unsub;
    return () => unsub();
  }, [tripId]);

  // Auto‑detect arrival at a stop
  useEffect(() => {
    if (!location || !route?.stops || !tripStarted) return;
    const THRESHOLD_METERS = 50;
    for (const stop of route.stops) {
      if (!stop.lat || !stop.lng) continue;
      const distanceKm = getDistanceFromLatLonInKm(
        location.latitude, location.longitude,
        stop.lat, stop.lng
      );
      const distanceMeters = distanceKm * 1000;
      if (distanceMeters < THRESHOLD_METERS && lastArrivedStopId !== stop.id) {
        setLastArrivedStopId(stop.id || null);
        console.log(`Arrived at stop: ${stop.name || stop.address}`);
        Alert.alert('Stop reached', `You have arrived at ${stop.name || 'a stop'}`, [{ text: 'OK' }]);
        if (tripIdRef.current) {
          databases.updateDocument(DATABASE_ID, COLLECTIONS.TAXI_TRIPS, tripIdRef.current, {
            lastStopArrival: JSON.stringify({ stopId: stop.id, arrivedAt: new Date().toISOString() })
          }).catch(console.error);
        }
      }
    }
  }, [location, route?.stops, tripStarted, lastArrivedStopId]);

  const init = async () => {
    try {
      const drivers = await databases.listDocuments(DATABASE_ID, COLLECTIONS.TAXI_DRIVERS, [Query.equal('userId', user!.id)]);
      if (!drivers.documents.length) throw new Error('Driver not registered');
      const driver = drivers.documents[0];
      const [vehicleDoc, routeData] = await Promise.all([getVehicle(driver.vehicleId), getRoute(routeId)]);
      setVehicle(vehicleDoc);
      
      // Parse stops if it's a string
      if (routeData.stops && typeof routeData.stops === 'string') {
        try {
          routeData.stops = JSON.parse(routeData.stops);
        } catch (e) {
          routeData.stops = [];
        }
      } else if (!routeData.stops) {
        routeData.stops = [];
      }
      
      // Ensure stops have required fields and baseFare is a number
      if (Array.isArray(routeData.stops)) {
        routeData.stops = routeData.stops.map((stop: any, idx: number): RouteStop => ({
          ...stop,
          id: stop.id || `stop_${idx}`,
          name: stop.name || stop.address || `Stop ${idx + 1}`,
          lat: stop.lat || 0,
          lng: stop.lng || 0,
          order: stop.order !== undefined ? stop.order : idx,
          fareFromOrigin: stop.fareFromOrigin || 0,
        }));
      }
      routeData.baseFare = Number(routeData.baseFare) || 0;
      
      setRoute(routeData);
      if (routeData.polyline) {
        setRouteCoords(polyline.decode(routeData.polyline).map(([lat, lng]: [number, number]) => ({ latitude: lat, longitude: lng })));
      }
      const newTrip = await databases.createDocument(DATABASE_ID, COLLECTIONS.TAXI_TRIPS, ID.unique(), {
        driverId: driver.$id, vehicleId: driver.vehicleId, routeId, startedAt: new Date().toISOString(),
        status: 'active', passengerCount: 0, cashCollected: 0, digitalCollected: 0, dailyRental: 0, driverEarnings: 0, currentLocation: null,
      });
      setTripId(newTrip.$id); tripIdRef.current = newTrip.$id;
      const ic = initialPassengerCount ? parseInt(initialPassengerCount, 10) : 0;
      if (ic > 0) { setPassengerCount(ic); await databases.updateDocument(DATABASE_ID, COLLECTIONS.TAXI_TRIPS, newTrip.$id, { passengerCount: ic }); }
    } catch (e: any) { Alert.alert('Error', e.message || 'Could not start trip'); router.back(); }
    finally { setLoading(false); }
  };

  function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Location access required.'); return; }
    const loc = await Location.getCurrentPositionAsync({});
    const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    setLocation(c);
    locationInterval.current = setInterval(async () => {
      const nl = await Location.getCurrentPositionAsync({});
      const nc = { latitude: nl.coords.latitude, longitude: nl.coords.longitude };
      setLocation(nc);
      if (tripIdRef.current) databases.updateDocument(DATABASE_ID, COLLECTIONS.TAXI_TRIPS, tripIdRef.current, { currentLocation: JSON.stringify(nc) }).catch(console.error);
    }, 5000);
  };

  const stopTracking = () => { if (locationInterval.current) clearInterval(locationInterval.current); };

  const updatePassengerCount = (delta: number) => {
    const next = passengerCount + delta;
    if (next < 0) return;
    if (vehicle && next > vehicle.capacity) { Alert.alert('Full', `Max ${vehicle.capacity} passengers`); return; }
    setPassengerCount(next);
    if (tripId) databases.updateDocument(DATABASE_ID, COLLECTIONS.TAXI_TRIPS, tripId, { passengerCount: next }).catch(console.error);
  };

  const acceptFlag = async (flag: any) => {
    if (passengerCount >= vehicle.capacity) { Alert.alert('No seats', 'Vehicle is full.'); return; }
    const nc = passengerCount + 1;
    setPassengerCount(nc);
    await Promise.all([
      databases.updateDocument(DATABASE_ID, COLLECTIONS.TAXI_TRIPS, tripId!, { passengerCount: nc }),
      databases.updateDocument(DATABASE_ID, 'FLAG_REQUESTS', flag.$id, { status: 'accepted' }),
      databases.createDocument(DATABASE_ID, COLLECTIONS.NOTIFICATIONS, ID.unique(), { userId: flag.passengerId, title: 'Flag Accepted 🚌', message: 'Driver is picking you up.', read: false, createdAt: new Date().toISOString() }),
    ]).catch(console.error);
    setPendingFlags(prev => prev.filter(f => f.$id !== flag.$id));
  };

  const endTrip = async () => {
    if (!route || typeof route.baseFare !== 'number') {
      Alert.alert('Error', 'Route data is missing or invalid. Please restart the trip.');
      return;
    }

    const cash = parseFloat(cashCollected) || 0;
    const digital = parseFloat(digitalCollected) || 0;
    const rental = parseFloat(dailyRental) || 0;
    const totalFare = passengerCount * route.baseFare;
    const earnings = totalFare - rental;

    Alert.alert('End Trip', `Passengers: ${passengerCount}\nTotal fare: R${totalFare.toFixed(2)}\nRental: R${rental.toFixed(2)}\nEarnings: R${earnings.toFixed(2)}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm & End', onPress: async () => {
        setEnding(true);
        stopTracking();
        try {
          const flags = await databases.listDocuments(DATABASE_ID, 'FLAG_REQUESTS', [
            Query.equal('tripId', tripId!),
            Query.equal('status', 'pending'),
          ]);
          console.log(`Found ${flags.documents.length} pending flags`);

          for (const flag of flags.documents) {
            if (flag.holdId) {
              try {
                await AppwriteService.captureHold(flag.holdId, tripId!);
                console.log(`Captured hold ${flag.holdId}`);
              } catch (err: any) {
                console.error(`Failed to capture hold ${flag.holdId}:`, err.message);
              }
            }
          }

          await updateTrip(tripId!, {
          endedAt: new Date().toISOString(),
          status: 'completed',
          passengerCount,
          cashCollected: cash,
          digitalCollected: digital,
          dailyRental: rental,
          driverEarnings: earnings,
        });
          Alert.alert('Trip ended successfully', `Earnings: R${earnings.toFixed(2)}`);
          router.replace('/driver/minibus-taxi/dashboard');
        } catch (err: any) {
          console.error('End trip error:', err);
          Alert.alert('Error', `Failed to end trip: ${err.message || 'Unknown error'}`);
        } finally {
          setEnding(false);
        }
      }}
    ]);
  };

  if (loading) return <LoadingScreen />;
  if (!route || !vehicle) return null;

  const pct = Math.round((passengerCount / vehicle.capacity) * 100);
  const rentalVal = parseFloat(dailyRental) || 0;
  const est = (passengerCount * (route?.baseFare || 0)) - rentalVal;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title={route.name} onBack={() => router.back()} right={tripStarted ? <LiveBadge /> : undefined} />
      {!tripStarted ? (
        <ScrollView contentContainerStyle={styles.preContent}>
          <View style={styles.preHero}>
            <Text style={styles.emoji}>🚌</Text>
            <Text style={styles.preTitle}>{route.name}</Text>
            <Text style={styles.preSub}>{route.origin} → {route.destination}</Text>
          </View>
          <Card style={{ padding: 0, overflow: 'hidden', marginBottom: SPACING.md }}>
            {[{ icon: '📏', label: 'Distance', value: `${route.distance} km` }, { icon: '💰', label: 'Fare', value: `R${route.baseFare}/pax` }, { icon: '🚐', label: 'Vehicle', value: vehicle.registrationNumber ?? vehicle.plateNumber }, { icon: '💺', label: 'Capacity', value: `${vehicle.capacity} seats` }].map((row, idx, arr) => (
              <View key={row.label}>
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}><Text style={{ fontSize: 16 }}>{row.icon}</Text></View>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue}>{row.value}</Text>
                </View>
                {idx < arr.length - 1 && <View style={styles.infoDivider} />}
              </View>
            ))}
          </Card>
          <PrimaryButton label="Start Trip" onPress={() => { setTripStarted(true); startTracking(); }} />
        </ScrollView>
      ) : (
        <>
          {location && (
            <MapView style={styles.map} region={{ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }}>
              <Marker coordinate={location} title="You"><View style={styles.markerWrap}><Text style={{ fontSize: 18 }}>🚌</Text></View></Marker>
              {routeCoords.length > 0 && <Polyline coordinates={routeCoords} strokeWidth={4} strokeColor={COLORS.primary} />}
              {route.stops && route.stops.map((stop: RouteStop, idx: number) => {
                if (!stop.lat || !stop.lng) return null;
                return (
                  <Marker
                    key={stop.id || idx}
                    coordinate={{ latitude: stop.lat, longitude: stop.lng }}
                    title={stop.name || `Stop ${idx + 1}`}
                    description={`Fare from origin: R${stop.fareFromOrigin}`}
                  >
                    <View style={styles.stopMarker}>
                      <Text style={{ fontSize: 16 }}>📍</Text>
                    </View>
                  </Marker>
                );
              })}
              {pendingFlags.map(flag => {
                let coords = { latitude: -26.2, longitude: 28.05 };
                try { const loc = JSON.parse(flag.passengerLocation); coords = { latitude: loc.latitude, longitude: loc.longitude }; } catch {}
                return (
                  <Marker key={flag.$id} coordinate={coords} pinColor="orange"
                    onPress={() => Alert.alert('Accept Passenger?', 'Pick up this passenger?', [{ text: 'Decline', style: 'cancel' }, { text: 'Accept', onPress: () => acceptFlag(flag) }])}
                  />
                );
              })}
            </MapView>
          )}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.controlsContent}>
            {pendingFlags.length > 0 && (
              <View style={styles.flagBanner}>
                <Text style={styles.flagBannerText}>🙋 {pendingFlags.length} passenger{pendingFlags.length > 1 ? 's' : ''} flagging — tap their marker</Text>
              </View>
            )}
            <Text style={styles.secLabel}>PASSENGERS</Text>
            <Card style={{ marginBottom: SPACING.md }}>
              <View style={styles.counterRow}>
                <TouchableOpacity style={styles.cBtn} onPress={() => updatePassengerCount(-1)}><Text style={styles.cBtnText}>−</Text></TouchableOpacity>
                <View style={{ alignItems: 'center' }}><Text style={styles.cNum}>{passengerCount}</Text><Text style={TYPOGRAPHY.caption}>/ {vehicle.capacity}</Text></View>
                <TouchableOpacity style={[styles.cBtn, { backgroundColor: COLORS.primary }]} onPress={() => updatePassengerCount(1)}><Text style={[styles.cBtnText, { color: '#fff' }]}>+</Text></TouchableOpacity>
              </View>
              <View style={styles.pTrack}><View style={[styles.pFill, { width: `${pct}%` as any }, pct > 85 && { backgroundColor: COLORS.error }, pct > 60 && pct <= 85 && { backgroundColor: COLORS.accent }]} /></View>
              <Text style={[TYPOGRAPHY.caption, { textAlign: 'right', fontWeight: '600' }]}>{pct}% full</Text>
            </Card>
            <Text style={styles.secLabel}>COLLECTIONS</Text>
            <Card style={{ marginBottom: SPACING.md }}>
              {[{ label: 'Cash Collected (R)', value: cashCollected, set: setCashCollected }, { label: 'Digital Collected (R)', value: digitalCollected, set: setDigitalCollected }, { label: 'Daily Rental (R)', value: dailyRental, set: setDailyRental }].map((f, i, arr) => (
                <View key={f.label}>
                  <Text style={styles.inputLabel}>{f.label}</Text>
                  <TextInput style={[styles.input, i === arr.length - 1 && { marginBottom: 0 }]} value={f.value} onChangeText={f.set} keyboardType="numeric" placeholder="0.00" placeholderTextColor={COLORS.textMuted} />
                </View>
              ))}
            </Card>
            <Card style={{ marginBottom: SPACING.md }}>
              <Text style={TYPOGRAPHY.bodyBold}>Estimated Earnings</Text>
              {[{ label: `Fare (${passengerCount} × R${route?.baseFare ?? 0})`, value: `R${(passengerCount * (route?.baseFare || 0)).toFixed(2)}`, color: COLORS.textPrimary }, { label: 'Daily rental', value: `− R${rentalVal.toFixed(2)}`, color: COLORS.error }].map(r => (
                <View key={r.label} style={styles.eRow}><Text style={[TYPOGRAPHY.body, { fontSize: 13, flex: 1 }]}>{r.label}</Text><Text style={[TYPOGRAPHY.bodyBold, { fontSize: 13, color: r.color }]}>{r.value}</Text></View>
              ))}
              <View style={styles.eTotalRow}><Text style={TYPOGRAPHY.h4}>Your earnings</Text><Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.primary }}>R{est.toFixed(2)}</Text></View>
            </Card>
            <PrimaryButton label="End Trip" onPress={endTrip} loading={ending} variant="danger" />
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  preContent: { padding: SPACING.md, paddingBottom: 48 },
  preHero: { alignItems: 'center', paddingVertical: SPACING.lg },
  stopMarker: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: '#f59e0b',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  emoji: { fontSize: 52, marginBottom: SPACING.sm },
  preTitle: { ...TYPOGRAPHY.h1, textAlign: 'center' },
  preSub: { ...TYPOGRAPHY.body, color: COLORS.textMuted, textAlign: 'center', marginTop: 4, marginBottom: SPACING.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md },
  infoIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm },
  infoLabel: { ...TYPOGRAPHY.body, flex: 1 },
  infoValue: { ...TYPOGRAPHY.bodyBold },
  infoDivider: { height: 1, backgroundColor: COLORS.border, marginLeft: SPACING.md + 32 + SPACING.sm },
  map: { height: 200 },
  markerWrap: { backgroundColor: '#fff', borderRadius: 20, padding: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  controlsContent: { padding: SPACING.md, paddingBottom: 48 },
  flagBanner: { backgroundColor: COLORS.accentLight, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm },
  flagBannerText: { ...TYPOGRAPHY.bodyBold, color: COLORS.accentDark, fontSize: 13, textAlign: 'center' },
  secLabel: { ...TYPOGRAPHY.label, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.xs },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  cBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  cBtnText: { fontSize: 28, fontWeight: '700', color: COLORS.textPrimary, lineHeight: 32 },
  cNum: { fontSize: 48, fontWeight: '800', color: COLORS.primary, lineHeight: 52 },
  pTrack: { height: 8, backgroundColor: COLORS.border, borderRadius: RADIUS.full, overflow: 'hidden', marginBottom: 4 },
  pFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: RADIUS.full },
  inputLabel: { ...TYPOGRAPHY.label, marginBottom: 6, marginTop: SPACING.sm },
  input: { backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 15, color: COLORS.textPrimary, marginBottom: SPACING.xs },
  eRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  eTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: SPACING.sm },
});