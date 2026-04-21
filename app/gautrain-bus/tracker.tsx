import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { router } from 'expo-router';
import { routes, getShapeById } from '../../services/gtfs';
import { COLORS } from '../../constants/theme';

interface BusRoute {
  id: string;
  name: string;
  color: string;
  points: { latitude: number; longitude: number }[];
  stops: { latitude: number; longitude: number; name: string }[];
}

export default function GautrainBusTrackerScreen() {
  const [busRoutes, setBusRoutes] = useState<BusRoute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBusRoutes();
  }, []);

  const loadBusRoutes = async () => {
    try {
      // Filter bus routes (route_type = 3)
      const busRoutesData = routes.filter(r => r.route_type === 3);
      const enriched = await Promise.all(
        busRoutesData.map(async (route) => {
          const shapePoints = getShapeById(route.route_id);
          // In a real implementation, you would also fetch stops for the route.
          // For now, we use dummy stops or leave empty.
          const stops = shapePoints
            .filter((_, idx) => idx % 10 === 0) // pick every 10th point as a dummy stop
            .map(point => ({ ...point, name: 'Stop' }));
          return {
            id: route.route_id,
            name: route.route_long_name,
            color: `#${route.route_color}`,
            points: shapePoints,
            stops,
          };
        })
      );
      setBusRoutes(enriched);
    } catch (error) {
      console.error('Failed to load bus routes', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gautrain Bus Tracker</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Calculate a region that fits all routes
  const allPoints = busRoutes.flatMap(r => r.points);
  const minLat = Math.min(...allPoints.map(p => p.latitude));
  const maxLat = Math.max(...allPoints.map(p => p.latitude));
  const minLng = Math.min(...allPoints.map(p => p.longitude));
  const maxLng = Math.max(...allPoints.map(p => p.longitude));
  const region = {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: (maxLat - minLat) * 1.2,
    longitudeDelta: (maxLng - minLng) * 1.2,
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gautrain Bus Tracker</Text>
        <View style={{ width: 50 }} />
      </View>
      <MapView style={styles.map} initialRegion={region}>
        {busRoutes.map(route => (
          <Polyline
            key={route.id}
            coordinates={route.points}
            strokeColor={route.color}
            strokeWidth={4}
          />
        ))}
        {busRoutes.flatMap(route =>
          route.stops.map((stop, idx) => (
            <Marker
              key={`${route.id}-${idx}`}
              coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
              title={`${route.name} stop`}
              pinColor={route.color}
            />
          ))
        )}
      </MapView>
      <View style={styles.legend}>
        <Text style={styles.legendText}>Bus routes are shown in their route colours. Tap a marker to see stop details.</Text>
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
  map: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  legend: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendText: { fontSize: 12, color: '#666', textAlign: 'center' },
});