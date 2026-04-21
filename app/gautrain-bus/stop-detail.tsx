import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getStopById, getNextDepartures } from '../../services/gtfs';
import type { GTFSStop, GTFSTrip, GTFSRoute } from '../../types';
import { COLORS } from '../../constants/theme';

// Define the departure type
interface Departure {
  trip: GTFSTrip;
  departureTime: string;
  route: GTFSRoute;
}

export default function GautrainBusStopDetailScreen() {
  const { stopId } = useLocalSearchParams<{ stopId: string }>();
  const [stop, setStop] = useState<GTFSStop | null>(null);
  const [departures, setDepartures] = useState<Departure[]>([]);

  useEffect(() => {
    const s = getStopById(stopId);
    if (s) setStop(s);
    const today = new Date().getDay() || 7; // 0 (Sunday) -> 7
    const now = new Date().toTimeString().split(' ')[0];
    const deps = getNextDepartures(stopId, today, now);
    setDepartures(deps);
  }, []);

  if (!stop) return <View><Text>Loading...</Text></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{stop.stop_name}</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Next departures</Text>
        {departures.length === 0 ? (
          <Text style={styles.noData}>No upcoming departures</Text>
        ) : (
          <FlatList
            data={departures}
            keyExtractor={(item, idx) => idx.toString()}
            renderItem={({ item }) => (
              <View style={styles.departureRow}>
                <Text style={styles.routeShort}>{item.route.route_short_name}</Text>
                <Text style={styles.time}>{item.departureTime}</Text>
              </View>
            )}
          />
        )}
      </View>
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
  content: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  noData: { fontSize: 16, color: '#666', fontStyle: 'italic' },
  departureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  routeShort: { fontSize: 16, fontWeight: '500', color: COLORS.primary },
  time: { fontSize: 16, color: '#000' },
});