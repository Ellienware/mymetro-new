import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { CustomMapView, type MapViewRef } from '../../components/MapView';
import { ALL_STOPS } from '../../constants/allStops';
import { StationService } from '../../services/stationService';
import { COLORS } from '../../constants/theme';

export default function MetrobusMapScreen() {
  const mapRef = useRef<MapViewRef>(null);
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);
  
  const busStops = ALL_STOPS.filter(stop => stop.mode === 'bus');
  const stationsForMap = busStops.map(stop => ({
    id: stop.id,
    name: stop.name,
    line: stop.lines?.[0] || 'Metrobus',
    zone: '1',
    coordinates: stop.coordinates,
  }));

  const allRoutes = StationService.getAllRoutes();

  const handleFindMe = () => {
    // could add location zoom
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Metrobus Map</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.mapContainer}>
        <CustomMapView
          ref={mapRef}
          stations={stationsForMap}
          routes={allRoutes}
          selectedRoutes={selectedRoutes}
          initialRegion={{
            latitude: -26.2041,
            longitude: 28.0473,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
          userLocation={null}
        />

        <View style={styles.mapControls}>
          <TouchableOpacity style={styles.controlButton} onPress={handleFindMe}>
            <Text style={styles.controlButtonText}>📍</Text>
          </TouchableOpacity>
        </View>
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
  mapContainer: { flex: 1 },
  mapControls: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  controlButtonText: { fontSize: 20 },
});