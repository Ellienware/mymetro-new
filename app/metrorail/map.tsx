import React from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity, Text } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { router } from 'expo-router';
import { ALL_STOPS } from '../../constants/allStops';
import { COLORS } from '../../constants/theme';

// Filter for Metrorail stations (same logic as stations list)
const metrorailStops = ALL_STOPS.filter(stop => 
  stop.mode === 'train' && (stop.lines.includes('Metrorail') || stop.lines.includes('Johannesburg–'))
);

export default function MetrorailMapScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Metrorail Map</Text>
        <View style={{ width: 50 }} />
      </View>

      <MapView
        style={styles.map}
        initialRegion={{
          latitude: -26.2,
          longitude: 28.0,
          latitudeDelta: 1.0,
          longitudeDelta: 1.0,
        }}
      >
        {metrorailStops.map(stop => (
          <Marker
            key={stop.id}
            coordinate={{
              latitude: stop.coordinates.latitude,
              longitude: stop.coordinates.longitude,
            }}
            title={stop.name}
            pinColor="blue"
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