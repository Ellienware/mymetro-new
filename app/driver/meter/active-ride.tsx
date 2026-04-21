import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from '@/lib/appwrite';
import { startRide, endRide, updateDriverLocation } from '@/services/meterApi';
import { COLORS } from '@/constants/theme';

export default function MeterActiveRideScreen() {
  const { rideId } = useLocalSearchParams();
  const [ride, setRide] = useState<any>(null);
  const [request, setRequest] = useState<any>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [tripStarted, setTripStarted] = useState(false);
  const [location, setLocation] = useState<any>(null);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const locationInterval = useRef<any>(null);
  const startTime = useRef<number | null>(null);
  const lastCoords = useRef<any>(null);

  useEffect(() => {
    init();
    return () => stopTracking();
  }, []);

  const init = async () => {
    try {
      const rideDoc = await databases.getDocument(DATABASE_ID, COLLECTIONS.METER_RIDES, rideId as string);
      setRide(rideDoc);
      const req = await databases.getDocument(DATABASE_ID, COLLECTIONS.METER_RIDE_REQUESTS, rideDoc.requestId);
      setRequest(req);
      // Get driver ID from ride
      setDriverId(rideDoc.driverId);
      if (rideDoc.status === 'active') {
        setTripStarted(true);
        startTracking();
      }
    } catch (error) {
      Alert.alert('Error', 'Could not load ride');
      router.back();
    }
  };

  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    lastCoords.current = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    startTime.current = Date.now();
    locationInterval.current = setInterval(async () => {
      const newLoc = await Location.getCurrentPositionAsync({});
      setLocation({ latitude: newLoc.coords.latitude, longitude: newLoc.coords.longitude });
      if (lastCoords.current) {
        const d = getDistance(lastCoords.current.latitude, lastCoords.current.longitude, newLoc.coords.latitude, newLoc.coords.longitude);
        setDistance(prev => prev + d);
      }
      lastCoords.current = { latitude: newLoc.coords.latitude, longitude: newLoc.coords.longitude };
      if (driverId) await updateDriverLocation(driverId, newLoc.coords.latitude, newLoc.coords.longitude);
      if (startTime.current) setDuration((Date.now() - startTime.current) / 60000);
    }, 3000);
  };

  const stopTracking = () => {
    if (locationInterval.current) clearInterval(locationInterval.current);
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const φ1 = toRad(lat1), φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) / 1000; // km
  };

  const handleStartTrip = async () => {
    if (!driverId) return;
    await startRide(rideId as string, driverId);
    setTripStarted(true);
    startTracking();
  };

  const handleEndTrip = async () => {
    Alert.alert('End Trip', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End',
        onPress: async () => {
          stopTracking();
          const finalDistance = distance;
          const finalDuration = duration;
          const result = await endRide(rideId as string, driverId!, { lat: location.latitude, lng: location.longitude }, finalDistance, finalDuration);
          Alert.alert('Trip Completed', `Fare: R${result.fare}`);
          router.replace('/driver/meter/dashboard');
        },
      },
    ]);
  };

  if (!ride || !request) return <ActivityIndicator size="large" style={{ marginTop: 40 }} />;

  return (
    <SafeAreaView style={styles.container}>
      <MapView style={styles.map} region={location ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      } : undefined}>
        <Marker coordinate={request.pickupLat ? { latitude: request.pickupLat, longitude: request.pickupLng } : { latitude: -26.2, longitude: 28.05 }} title="Pickup" pinColor="green" />
        <Marker coordinate={request.dropoffLat ? { latitude: request.dropoffLat, longitude: request.dropoffLng } : { latitude: -26.2, longitude: 28.05 }} title="Dropoff" pinColor="red" />
        {location && <Marker coordinate={location} title="You" pinColor="#3B82F6" />}
      </MapView>
      <View style={styles.info}>
        <Text>Pickup: {request.pickupAddress}</Text>
        <Text>Dropoff: {request.dropoffAddress}</Text>
        {tripStarted && (
          <>
            <Text>Distance: {distance.toFixed(2)} km</Text>
            <Text>Duration: {duration.toFixed(1)} min</Text>
            <Text>Estimated fare: R{ride.fare}</Text>
          </>
        )}
      </View>
      {!tripStarted ? (
        <TouchableOpacity style={styles.startBtn} onPress={handleStartTrip}>
          <Text style={styles.startText}>Start Trip</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.endBtn} onPress={handleEndTrip}>
          <Text style={styles.endText}>End Trip</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  info: { padding: 16, backgroundColor: 'white' },
  startBtn: { backgroundColor: '#10B981', padding: 14, margin: 16, borderRadius: 8, alignItems: 'center' },
  startText: { color: 'white', fontWeight: 'bold' },
  endBtn: { backgroundColor: '#EF4444', padding: 14, margin: 16, borderRadius: 8, alignItems: 'center' },
  endText: { color: 'white', fontWeight: 'bold' },
});