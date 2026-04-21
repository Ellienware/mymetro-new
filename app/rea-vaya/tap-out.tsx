import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { databases, Query } from '../../lib/appwrite';
import { DATABASE_ID, COLLECTIONS } from '../../lib/appwrite';
import { ALL_STOPS } from '../../constants/allStops';
import { COLORS } from '../../constants/theme';
import { calculateDistance } from '../../constants/fareData';

export default function ReaVayaTapOutScreen() {
  const { user } = useUser();
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [selectedStop, setSelectedStop] = useState<any>(null);
  const [fare, setFare] = useState<number | null>(null);
  const brtStops = ALL_STOPS.filter(stop => stop.mode === 'brt');

  useEffect(() => {
    loadActiveTrip();
  }, []);

  const loadActiveTrip = async () => {
    const trips = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.REA_VAYA_TRIPS,
      [
        Query.equal('userId', user!.id),
        Query.equal('status', 'active')
      ]
    );
    if (trips.documents.length === 0) {
      Alert.alert('No active trip', 'You have not tapped in yet.');
      router.back();
      return;
    }
    setActiveTrip(trips.documents[0]);
  };

  const handleSelectStop = (stop: any) => {
  setSelectedStop(stop);
  const entryStop = ALL_STOPS.find(s => s.id === activeTrip.entryStopId);
  if (!entryStop) return;
  const distance = calculateDistance(
    entryStop.coordinates.latitude,
    entryStop.coordinates.longitude,
    stop.coordinates.latitude,
    stop.coordinates.longitude
  );
  // Official Rea Vaya 2025/26 peak fares
  let fareAmount = 0;
  if (distance <= 5) fareAmount = 11;
  else if (distance <= 10) fareAmount = 14;
  else if (distance <= 15) fareAmount = 16.5;
  else if (distance <= 25) fareAmount = 19;
  else if (distance <= 35) fareAmount = 21;
  else if (distance <= 45) fareAmount = 22;
  else fareAmount = 28;
  setFare(fareAmount);
};

  const handleTapOut = async () => {
    if (!selectedStop || !fare) return;
    try {
      // Deduct points from user profile
      const profile = await databases.getDocument(DATABASE_ID, COLLECTIONS.USERS, user!.id);
      const currentPoints = profile.reaVayaPoints || 0;
      if (currentPoints < fare) {
        Alert.alert('Insufficient points', 'Please top up your points.');
        return;
      }
      await databases.updateDocument(DATABASE_ID, COLLECTIONS.USERS, user!.id, {
        reaVayaPoints: currentPoints - fare,
      });
      // Update trip as completed
      await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.REA_VAYA_TRIPS,
        activeTrip.$id,
        {
          exitStopId: selectedStop.id,
          exitStopName: selectedStop.name,
          exitTimestamp: new Date().toISOString(),
          fare,
          status: 'completed',
        }
      );
      Alert.alert('Tapped Out', `Fare deducted: ${fare} points`);
      router.back();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tap Out</Text>
        <View style={{ width: 50 }} />
      </View>
      {activeTrip && (
        <Text style={styles.info}>Boarded at: {activeTrip.entryStopName}</Text>
      )}
      <Text style={styles.subtitle}>Select your alighting stop</Text>
      <FlatList
        data={brtStops}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.stopItem, selectedStop?.id === item.id && styles.selectedStop]}
            onPress={() => handleSelectStop(item)}
          >
            <Text style={styles.stopName}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
      {fare !== null && (
        <Text style={styles.fareText}>Fare: {fare} points</Text>
      )}
      <TouchableOpacity
        style={[styles.confirmButton, !selectedStop && styles.disabled]}
        onPress={handleTapOut}
        disabled={!selectedStop}
      >
        <Text style={styles.confirmText}>Confirm Tap Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: { padding: 5 },
  backText: { fontSize: 16, color: COLORS.primary },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  info: { fontSize: 16, color: '#666', paddingHorizontal: 20, paddingTop: 10 },
  subtitle: { fontSize: 16, color: '#666', padding: 20 },
  stopItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: 'white',
  },
  selectedStop: { backgroundColor: '#e0e0ff' },
  stopName: { fontSize: 16 },
  fareText: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary, textAlign: 'center', margin: 20 },
  confirmButton: {
    backgroundColor: COLORS.primary,
    margin: 20,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmText: { color: 'white', fontSize: 18, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});