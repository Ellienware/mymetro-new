import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getRouteById, getTripsByRoute, getStopTimesForTrip, frequencies } from '../../services/gtfs';
import type { GTFSRoute } from '../../types';
import { COLORS } from '../../constants/theme';

interface TripInfo {
  tripId: string;
  headsign: string;
  departureTime: string;
}

export default function BusRouteScheduleScreen() {
  const { routeId } = useLocalSearchParams<{ routeId: string }>();
  const [route, setRoute] = useState<GTFSRoute | null>(null);
  const [trips, setTrips] = useState<TripInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!routeId) {
      // No route ID provided – go back
      router.back();
      return;
    }

    const r = getRouteById(routeId);
    if (!r) {
      // Route not found – go back
      router.back();
      return;
    }
    setRoute(r);

    const allTrips = getTripsByRoute(routeId);
    const tripInfos: TripInfo[] = allTrips.map(trip => {
      const stopTimes = getStopTimesForTrip(trip.trip_id);
      const firstStop = stopTimes[0];
      return {
        tripId: trip.trip_id,
        headsign: trip.trip_headsign,
        departureTime: firstStop ? firstStop.departure_time : '?',
      };
    }).sort((a, b) => a.departureTime.localeCompare(b.departureTime));
    setTrips(tripInfos);
    setLoading(false);
  }, [routeId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Schedule</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!route) return null; // will not happen because of early return

  const hasFrequency = frequencies.some(f => f.trip_id.startsWith(routeId));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{route.route_short_name} Schedule</Text>
        <View style={{ width: 50 }} />
      </View>

      {hasFrequency && (
        <Text style={styles.frequencyNote}>
          This route runs every 20 minutes between 05:30 and 20:30.
        </Text>
      )}

      <FlatList
        data={trips}
        keyExtractor={item => item.tripId}
        renderItem={({ item }) => (
          <View style={styles.tripItem}>
            <Text style={styles.headsign}>{item.headsign}</Text>
            <Text style={styles.time}>{item.departureTime}</Text>
          </View>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text>No trips found</Text>}
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  frequencyNote: {
    margin: 20,
    padding: 16,
    backgroundColor: '#e0f2e9',
    borderRadius: 8,
    color: COLORS.primary,
    fontWeight: '600',
  },
  list: { padding: 20 },
  tripItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headsign: { fontSize: 16, color: '#000' },
  time: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
});