import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { databases, Query } from '../../lib/appwrite';
import { DATABASE_ID, COLLECTIONS } from '../../lib/appwrite';
import { COLORS } from '../../constants/theme';

interface HistoryTrip {
  $id: string;
  entryStopName: string;
  exitStopName?: string;
  entryTimestamp: string;
  fare?: number;
  status: string;
}

export default function ReaVayaHistoryScreen() {
  const { user } = useUser();
  const [trips, setTrips] = useState<HistoryTrip[]>([]);

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = async () => {
    try {
      const res = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.REA_VAYA_TRIPS,
        [
          Query.equal('userId', user!.id),
          Query.orderDesc('entryTimestamp'),
        ]
      );
      // Map to our simple HistoryTrip type
      const mappedTrips: HistoryTrip[] = res.documents.map((doc: any) => ({
        $id: doc.$id,
        entryStopName: doc.entryStopName,
        exitStopName: doc.exitStopName,
        entryTimestamp: doc.entryTimestamp,
        fare: doc.fare,
        status: doc.status,
      }));
      setTrips(mappedTrips);
    } catch (error) {
      console.error('Failed to load Rea Vaya trips', error);
    }
  };

  const renderItem = ({ item }: { item: HistoryTrip }) => (
    <View style={styles.tripItem}>
      <Text style={styles.tripRoute}>
        {item.entryStopName} → {item.exitStopName || '?'}
      </Text>
      <Text style={styles.tripFare}>
        {item.fare ? `${item.fare} pts` : item.status}
      </Text>
      <Text style={styles.tripDate}>
        {new Date(item.entryTimestamp).toLocaleDateString()}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip History</Text>
        <TouchableOpacity onPress={loadTrips} style={styles.refreshButton}>
          <Text style={styles.refreshText}>🔄</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={trips}
        renderItem={renderItem}
        keyExtractor={(item) => item.$id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No trips yet</Text>}
      />
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
  refreshButton: { padding: 5 },
  refreshText: { fontSize: 20 },
  list: { padding: 20 },
  tripItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tripRoute: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 4 },
  tripFare: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary, marginBottom: 4 },
  tripDate: { fontSize: 14, color: '#666' },
  empty: { textAlign: 'center', marginTop: 40, color: '#666' },
});