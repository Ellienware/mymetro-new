import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import MapView, { Polyline } from 'react-native-maps';
import { getRouteById, getTripsByRoute, getShapeById, getStopTimesForTrip, getStopById } from '../../services/gtfs';
import type { GTFSRoute, GTFSStop } from '../../types';
import { COLORS } from '../../constants/theme';

export default function GautrainBusRouteDetailScreen() {
  const { routeId } = useLocalSearchParams<{ routeId: string }>();
  const [route, setRoute] = useState<GTFSRoute | null>(null);
  const [shapePoints, setShapePoints] = useState<{ latitude: number; longitude: number }[]>([]);
  const [stops, setStops] = useState<GTFSStop[]>([]);

  useEffect(() => {
    const r = getRouteById(routeId);
    if (r) setRoute(r);
    const shape = getShapeById(routeId);
    setShapePoints(shape);
    // Use first trip to get stop order
    const trips = getTripsByRoute(routeId);
    if (trips.length > 0) {
      const stopTimes = getStopTimesForTrip(trips[0].trip_id);
      const stopsList = stopTimes
        .map(st => getStopById(st.stop_id))
        .filter((stop): stop is GTFSStop => stop !== undefined);
      setStops(stopsList);
    }
  }, [routeId]);

  if (!route) return <View><Text>Loading...</Text></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{route.route_short_name}</Text>
        <TouchableOpacity
          style={styles.scheduleButton}
          onPress={() => router.push({ pathname: '/gautrain-bus/route-schedule', params: { routeId } })}
        >
          <Text style={styles.scheduleButtonText}>Schedule</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: shapePoints[0]?.latitude || -26.1,
            longitude: shapePoints[0]?.longitude || 28.0,
            latitudeDelta: 0.2,
            longitudeDelta: 0.2,
          }}
        >
          {shapePoints.length > 0 && (
            <Polyline coordinates={shapePoints} strokeColor={`#${route.route_color}`} strokeWidth={4} />
          )}
        </MapView>
      </View>

      <Text style={styles.sectionTitle}>Stops ({stops.length})</Text>
      <FlatList
        data={stops}
        keyExtractor={item => item.stop_id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.stopItem}
            onPress={() => router.push({ pathname: '/gautrain-bus/stop-detail', params: { stopId: item.stop_id } })}
          >
            <Text style={styles.stopName}>{item.stop_name}</Text>
          </TouchableOpacity>
        )}
        style={styles.stopList}
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
  scheduleButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  scheduleButtonText: { color: 'white', fontSize: 14, fontWeight: '600' },
  mapContainer: { height: 200, margin: 20, borderRadius: 12, overflow: 'hidden' },
  map: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginLeft: 20, marginBottom: 10 },
  stopList: { marginHorizontal: 20, maxHeight: 300 },
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
});