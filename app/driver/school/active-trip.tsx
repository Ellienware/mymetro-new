import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  SafeAreaView, Alert, ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import MapView, { Marker, Polyline } from 'react-native-maps';
import polyline from '@mapbox/polyline';
import * as Speech from 'expo-speech';

import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from '@/lib/appwrite';
import { COLORS } from '@/constants/theme';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const LOCATION_TASK = 'KIDDORIDE_BG_LOCATION';

// ---------- Background location task ----------
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error('BG location error:', error);
    return;
  }
  if (data?.locations?.length) {
    const { latitude, longitude } = data.locations[0].coords;
    const last = (global as any).__lastLocation;
    if (last) {
      const dx = latitude - last.latitude;
      const dy = longitude - last.longitude;
      if (Math.sqrt(dx * dx + dy * dy) < 0.00015) return;
    }
    (global as any).__lastLocation = { latitude, longitude };
    if ((global as any).__kiddoTripDocId) {
      await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.SCHOOL_TRIPS,
        (global as any).__kiddoTripDocId,
        { currentLocation: JSON.stringify({ latitude, longitude }) }
      ).catch(console.error);
    }
  }
});

// ---------- Helper: distance (meters) ----------
const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ / 2) ** 2 +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ---------- Helper: earnings ----------
const calculateEarnings = (bookingsCount: number, distanceKm: number): number => {
  const baseFare = 20;
  const perKm = 2;
  return (bookingsCount * baseFare) + (distanceKm * perKm);
};

export default function DriverTripScreen() {
  const { offeringId } = useLocalSearchParams<{ offeringId: string }>();

  const [offering, setOffering] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<any>(null);
  const [tripDoc, setTripDoc] = useState<any>(null);
  const [tripStarted, setTripStarted] = useState(false);
  const [ended, setEnded] = useState(false);

  const [routeCoords, setRouteCoords] = useState<any[]>([]);
  const [steps, setSteps] = useState<any[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const lastSpokenRef = useRef<string | null>(null);
  const totalDistanceRef = useRef(0);
  const lastCoordsRef = useRef<any>(null);

  useEffect(() => {
    init();
    return () => {
      stopTracking();
      (global as any).__kiddoTripDocId = null;
    };
  }, []);

  const init = async () => {
    try {
      const offeringDoc = await databases.getDocument(DATABASE_ID, COLLECTIONS.DRIVER_SCHOOL_OFFERINGS, offeringId);
      setOffering(offeringDoc);

      const bookingsRes = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_BOOKINGS, [
        Query.equal('offeringId', offeringId),
        Query.equal('status', 'active'),
      ]);

      const list = bookingsRes.documents.map((b: any) => ({
        bookingId: b.$id,
        parentId: b.parentId,
        childName: JSON.parse(b.childIds || '[]').join(', '),
        homeAddress: b.pickupAddress,
        homeLat: b.homeLat,
        homeLng: b.homeLng,
        pickedUp: false,
        dropped: false,
      }));

      setBookings(list);

      const today = new Date().toISOString().split('T')[0];
      const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_TRIPS, [
        Query.equal('offeringId', offeringId),
        Query.equal('date', today),
      ]);

      let doc;
      if (existing.documents.length > 0) {
        doc = existing.documents[0];
        if (doc.status === 'started') setTripStarted(true);
        if (doc.currentLocation) {
          try { setLocation(JSON.parse(doc.currentLocation)); } catch(e) {}
        }
      } else {
        doc = await databases.createDocument(DATABASE_ID, COLLECTIONS.SCHOOL_TRIPS, ID.unique(), {
          offeringId,
          date: today,
          status: 'not_started',
          childrenStatus: JSON.stringify([]),
          distanceKm: 0,
          durationMinutes: 0,
          totalPassengers: 0,
          earnings: 0,
          startedAt: null,
          endedAt: null,
        });
      }

      setTripDoc(doc);
      (global as any).__kiddoTripDocId = doc.$id;

    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not load trip');
    } finally {
      setLoading(false);
    }
  };

  const getOptimizedRoute = async () => {
    if (!location || !GOOGLE_API_KEY) return;

    const remaining = bookings.filter(b => !b.pickedUp);
    let waypointsParam = '';
    if (remaining.length > 0) {
      waypointsParam = `&waypoints=optimize:true|${remaining.map(b => `${b.homeLat},${b.homeLng}`).join('|')}`;
    }
    const dest = `${offering.schoolLat},${offering.schoolLng}`;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${location.latitude},${location.longitude}&destination=${dest}${waypointsParam}&key=${GOOGLE_API_KEY}`;

    const res = await fetch(url);
    const data = await res.json();
    if (data.routes?.length) {
      const route = data.routes[0];
      const points = polyline.decode(route.overview_polyline.points);
      setRouteCoords(points.map(([lat, lng]) => ({ latitude: lat, longitude: lng })));
      const stepsList = route.legs.flatMap((leg: any) =>
        leg.steps.map((s: any) => ({
          instruction: s.html_instructions.replace(/<[^>]+>/g, ''),
          location: { latitude: s.end_location.lat, longitude: s.end_location.lng }
        }))
      );
      setSteps(stepsList);
      setCurrentStepIndex(0);
    }
  };

  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    lastCoordsRef.current = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 20,
      timeInterval: 5000,
    });
  };

  const stopTracking = async () => {
    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
    if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  };

  const sendNotification = async (parentId: string, title: string, message: string) => {
    try {
      await databases.createDocument(DATABASE_ID, COLLECTIONS.NOTIFICATIONS, ID.unique(), {
        userId: parentId,
        title,
        message,
        read: false,
        createdAt: new Date().toISOString(),
      });
    } catch (error) { console.error(error); }
  };

  const updateBookingStatus = async (bookingId: string, field: 'pickedUp' | 'dropped', timeKey: 'pickupTime' | 'dropoffTime') => {
    const updated = bookings.map(b =>
      b.bookingId === bookingId ? { ...b, [field]: true, [timeKey]: new Date().toISOString() } : b
    );
    setBookings(updated);
    const childrenStatus = updated.map(b => ({
      bookingId: b.bookingId,
      childName: b.childName,
      pickupTime: b.pickupTime,
      dropoffTime: b.dropoffTime,
    }));
    await databases.updateDocument(DATABASE_ID, COLLECTIONS.SCHOOL_TRIPS, tripDoc.$id, {
      childrenStatus: JSON.stringify(childrenStatus),
    });
    const child = updated.find(b => b.bookingId === bookingId);
    if (child) {
      const title = field === 'pickedUp' ? 'Picked Up' : 'Arrived at School';
      const msg = field === 'pickedUp'
        ? `${child.childName} has been picked up`
        : `${child.childName} arrived at school`;
      await sendNotification(child.parentId, title, msg);
    }
    if (field === 'dropped' && updated.every(b => b.dropped)) {
      endTrip();
    }
    // After a pickup, re‑optimise route for remaining stops
    if (field === 'pickedUp') {
      await getOptimizedRoute();
    }
  };

  const markPickup = (bookingId: string) => updateBookingStatus(bookingId, 'pickedUp', 'pickupTime');
  const markDropoff = (bookingId: string) => updateBookingStatus(bookingId, 'dropped', 'dropoffTime');

  const startTrip = async () => {
    if (!tripDoc) return;
    await databases.updateDocument(DATABASE_ID, COLLECTIONS.SCHOOL_TRIPS, tripDoc.$id, {
      status: 'started',
      startedAt: new Date().toISOString(),
    });
    setTripStarted(true);
    await startTracking();
    await getOptimizedRoute();
  };

  const endTrip = async () => {
    if (ended) return;
    setEnded(true);
    Alert.alert('End Trip', 'Finish the trip?', [
      { text: 'Cancel', style: 'cancel', onPress: () => setEnded(false) },
      {
        text: 'End Trip',
        onPress: async () => {
          await stopTracking();
          const endedAt = new Date();
          const startedAt = new Date(tripDoc.startedAt);
          const durationMinutes = Math.floor((endedAt.getTime() - startedAt.getTime()) / 60000);
          const distanceKm = totalDistanceRef.current / 1000;
          const totalPassengers = bookings.length;
          const earnings = calculateEarnings(totalPassengers, distanceKm);
          await databases.updateDocument(DATABASE_ID, COLLECTIONS.SCHOOL_TRIPS, tripDoc.$id, {
            status: 'completed',
            endedAt: endedAt.toISOString(),
            durationMinutes,
            distanceKm,
            totalPassengers,
            earnings,
          });
          Alert.alert('Trip Summary', `Distance: ${distanceKm.toFixed(2)} km\nTime: ${durationMinutes} min\nEarnings: R${earnings.toFixed(2)}`);
          router.back();
        },
      },
    ]);
  };

  // Real‑time distance accumulation
  useEffect(() => {
    if (!location || !tripStarted) return;
    if (lastCoordsRef.current) {
      const d = getDistanceMeters(
        lastCoordsRef.current.latitude,
        lastCoordsRef.current.longitude,
        location.latitude,
        location.longitude
      );
      totalDistanceRef.current += d;
    }
    lastCoordsRef.current = location;
  }, [location]);

  // Turn‑by‑turn voice
  useEffect(() => {
    if (!location || steps.length === 0) return;
    const step = steps[currentStepIndex];
    if (!step) return;
    const dist = getDistanceMeters(location.latitude, location.longitude, step.location.latitude, step.location.longitude);
    if (dist < 30 && lastSpokenRef.current !== step.instruction) {
      lastSpokenRef.current = step.instruction;
      Speech.stop();
      Speech.speak(step.instruction);
      setCurrentStepIndex(prev => prev + 1);
    }
  }, [location, steps, currentStepIndex]);

  // Auto pickup
  useEffect(() => {
    if (!location || !tripStarted) return;
    bookings.forEach(b => {
      if (b.pickedUp) return;
      const dist = getDistanceMeters(location.latitude, location.longitude, b.homeLat, b.homeLng);
      if (dist < 40) {
        Speech.speak(`${b.childName} picked up`);
        markPickup(b.bookingId);
      }
    });
  }, [location, tripStarted, bookings]);

  // Auto dropoff when near school (after all picked up)
  useEffect(() => {
    if (!location || !tripStarted || !offering) return;
    const allPickedUp = bookings.length > 0 && bookings.every(b => b.pickedUp);
    const someNotDropped = bookings.some(b => !b.dropped);
    if (!allPickedUp || !someNotDropped) return;
    const distToSchool = getDistanceMeters(location.latitude, location.longitude, offering.schoolLat, offering.schoolLng);
    if (distToSchool < 50) {
      bookings.forEach(b => {
        if (!b.dropped) markDropoff(b.bookingId);
      });
    }
  }, [location, tripStarted, offering, bookings]);

  if (loading) return <ActivityIndicator size="large" style={{ marginTop: 40 }} />;
  if (!offering) return <Text style={{ textAlign: 'center', marginTop: 40 }}>Offering not found</Text>;

  const nextInstruction = steps[currentStepIndex]?.instruction;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Trip to {offering.schoolName}</Text>
        {tripStarted && <LiveBadge />}
      </View>

      {tripStarted && nextInstruction && (
        <View style={styles.navBanner}>
          <Text style={styles.navText}>{nextInstruction}</Text>
        </View>
      )}

      <MapView style={styles.map} region={location ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      } : undefined}>
        {location && <Marker coordinate={location} title="You" pinColor="#3B82F6" />}
        {bookings.map(b => !b.pickedUp && (
          <Marker key={b.bookingId} coordinate={{ latitude: b.homeLat, longitude: b.homeLng }} title={b.childName} pinColor="#F59E0B" />
        ))}
        {offering && <Marker coordinate={{ latitude: offering.schoolLat, longitude: offering.schoolLng }} title={offering.schoolName} pinColor="#8B5CF6" />}
        {routeCoords.length > 0 && <Polyline coordinates={routeCoords} strokeWidth={4} strokeColor="#3B82F6" />}
      </MapView>

      {!tripStarted ? (
        <TouchableOpacity style={styles.startBtn} onPress={startTrip}>
          <Text style={styles.startText}>Start Trip</Text>
        </TouchableOpacity>
      ) : (
        <>
          <FlatList
            data={bookings}
            keyExtractor={item => item.bookingId}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.childName}>{item.childName}</Text>
                <Text style={styles.address}>{item.homeAddress}</Text>
                <View style={styles.statusRow}>
                  <Text style={item.pickedUp ? styles.done : styles.pending}>
                    {item.pickedUp ? '✔ Picked Up' : '⏳ Waiting'}
                  </Text>
                  <Text style={item.dropped ? styles.done : styles.pending}>
                    {item.dropped ? '✔ Dropped' : '⏳ Not dropped'}
                  </Text>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.btn, styles.pickupBtn]}
                    onPress={() => markPickup(item.bookingId)}
                    disabled={item.pickedUp}
                  >
                    <Text style={styles.btnText}>Pick Up</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.dropBtn]}
                    onPress={() => markDropoff(item.bookingId)}
                    disabled={item.dropped}
                  >
                    <Text style={styles.btnText}>Drop</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
          <TouchableOpacity style={styles.endBtn} onPress={endTrip}>
            <Text style={styles.endBtnText}>End Trip</Text>
          </TouchableOpacity>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backButton: { padding: 5, marginRight: 12 },
  backText: { fontSize: 16, color: COLORS.primary },
  title: { fontSize: 18, fontWeight: 'bold', flex: 1 },
  navBanner: { backgroundColor: '#111', padding: 12, marginHorizontal: 16, marginTop: 8, borderRadius: 8 },
  navText: { color: '#fff', fontWeight: '600' },
  map: { height: 250, margin: 16, borderRadius: 12 },
  startBtn: { backgroundColor: '#10B981', marginHorizontal: 16, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  startText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  endBtn: { backgroundColor: '#EF4444', marginHorizontal: 16, marginVertical: 12, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  endBtnText: { color: 'white', fontWeight: 'bold' },
  card: { backgroundColor: 'white', marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 12, elevation: 2 },
  childName: { fontSize: 16, fontWeight: 'bold' },
  address: { fontSize: 12, color: '#666', marginTop: 2 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  done: { color: '#10B981', fontWeight: '600' },
  pending: { color: '#F59E0B', fontWeight: '500' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 8 },
  btn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  pickupBtn: { backgroundColor: '#3B82F6' },
  dropBtn: { backgroundColor: '#8B5CF6' },
  btnText: { color: 'white', fontWeight: '600' },
});

const LiveBadge = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 }}>
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: 'white', marginRight: 4 }} />
    <Text style={{ fontSize: 10, fontWeight: 'bold', color: 'white' }}>LIVE</Text>
  </View>
);