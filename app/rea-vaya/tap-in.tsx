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

export default function ReaVayaTapInScreen() {
  const { user } = useUser();
  const [selectedStop, setSelectedStop] = useState<any>(null);
  const brtStops = ALL_STOPS.filter(stop => stop.mode === 'brt');

  const handleTapIn = async () => {
    if (!selectedStop) return;
    try {
      // Check for existing active trip
      const activeTrips = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.REA_VAYA_TRIPS,
        [
          Query.equal('userId', user!.id),
          Query.equal('status', 'active')
        ]
      );
      if (activeTrips.documents.length > 0) {
        Alert.alert('Active trip', 'You have already tapped in. Please tap out first.');
        return;
      }
      // Create new trip
      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.REA_VAYA_TRIPS,
        'unique()',
        {
          userId: user!.id,
          entryStopId: selectedStop.id,
          entryStopName: selectedStop.name,
          entryTimestamp: new Date().toISOString(),
          status: 'active',
        }
      );
      Alert.alert('Tapped In', `Boarded at ${selectedStop.name}`);
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
        <Text style={styles.headerTitle}>Tap In</Text>
        <View style={{ width: 50 }} />
      </View>
      <Text style={styles.subtitle}>Select your boarding stop</Text>
      <FlatList
        data={brtStops}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.stopItem, selectedStop?.id === item.id && styles.selectedStop]}
            onPress={() => setSelectedStop(item)}
          >
            <Text style={styles.stopName}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity
        style={[styles.confirmButton, !selectedStop && styles.disabled]}
        onPress={handleTapIn}
        disabled={!selectedStop}
      >
        <Text style={styles.confirmText}>Confirm Tap In</Text>
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
  subtitle: { fontSize: 16, color: '#666', padding: 20 },
  stopItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: 'white',
  },
  selectedStop: { backgroundColor: '#e0e0ff' },
  stopName: { fontSize: 16 },
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