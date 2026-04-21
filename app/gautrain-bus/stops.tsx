import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { stops, trips, stopTimes, routes } from '../../services/gtfs';
import type { GTFSStop } from '../../types';
import { COLORS } from '../../constants/theme';

export default function GautrainBusStopsScreen() {
  const [busStops, setBusStops] = useState<GTFSStop[]>([]);

  useEffect(() => {
    // Get all bus route IDs (route_type = 3)
    const busRouteIds = new Set(routes.filter(r => r.route_type === 3).map(r => r.route_id));
    const busTripIds = new Set(trips.filter(t => busRouteIds.has(t.route_id)).map(t => t.trip_id));
    const busStopIdsSet = new Set(stopTimes.filter(st => busTripIds.has(st.trip_id)).map(st => st.stop_id));
    const filtered = stops.filter(s => busStopIdsSet.has(s.stop_id));
    setBusStops(filtered);
  }, []);

  const renderItem = ({ item }: { item: GTFSStop }) => (
    <TouchableOpacity
      style={styles.stopItem}
      onPress={() => router.push({ pathname: '/gautrain-bus/stop-detail', params: { stopId: item.stop_id } })}
    >
      <Text style={styles.stopName}>{item.stop_name}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gautrain Bus Stops</Text>
        <View style={{ width: 50 }} />
      </View>
      <FlatList
        data={busStops}
        keyExtractor={item => item.stop_id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No bus stops found</Text>}
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
  list: { padding: 20 },
  stopItem: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  stopName: { fontSize: 16, fontWeight: '500' },
  empty: { textAlign: 'center', marginTop: 40, color: '#666' },
});