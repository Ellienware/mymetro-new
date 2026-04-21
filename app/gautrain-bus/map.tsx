import React, { useEffect, useState } from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity, Text } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { router } from 'expo-router';
import { routes, getShapeById } from '../../services/gtfs';
import { COLORS } from '../../constants/theme';

interface RoutePolyline {
  id: string;
  points: { latitude: number; longitude: number }[];
  color: string;
}

export default function GautrainBusMapScreen() {
  const [polylines, setPolylines] = useState<RoutePolyline[]>([]);

  useEffect(() => {
    // Filter for bus routes (type 3)
    const busRoutes = routes.filter(r => r.route_type === 3);
    const lines = busRoutes.map(route => ({
      id: route.route_id,
      points: getShapeById(route.route_id),
      color: `#${route.route_color}`,
    }));
    setPolylines(lines);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gautrain Bus Network</Text>
        <View style={{ width: 50 }} />
      </View>

      <MapView
        style={styles.map}
        initialRegion={{
          latitude: -26.1,
          longitude: 28.0,
          latitudeDelta: 1.5,
          longitudeDelta: 1.5,
        }}
      >
        {polylines.map(line => (
          <Polyline
            key={line.id}
            coordinates={line.points}
            strokeColor={line.color}
            strokeWidth={3}
          />
        ))}
      </MapView>
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
});