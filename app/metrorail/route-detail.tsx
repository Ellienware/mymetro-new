import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ALL_ROUTES } from '../../constants/allRoutes';
import { ALL_STOPS } from '../../constants/allStops';
import { COLORS } from '../../constants/theme';

export default function MetrorailRouteDetailScreen() {
  const { routeId } = useLocalSearchParams<{ routeId: string }>();
  const [route, setRoute] = useState<any>(null);
  const [stops, setStops] = useState<any[]>([]);

  useEffect(() => {
    const found = ALL_ROUTES.find(r => r.id === routeId);
    setRoute(found);
    if (found) {
      // Only process node IDs (way/ entries are not in ALL_STOPS)
      const nodeStopIds = found.stops.filter((id: string) => id.startsWith('node/'));
      const stopList = nodeStopIds
        .map((stopId: string) => ALL_STOPS.find(s => s.id === stopId))
        .filter(Boolean);
      setStops(stopList);
    }
  }, [routeId]);

  if (!route) return <View><Text>Loading...</Text></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{route.name}</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>
          Stops ({stops.length} {stops.length === 1 ? 'station' : 'stations'})
        </Text>
        {stops.length === 0 ? (
          <Text style={styles.noStops}>No station stops available for this route</Text>
        ) : (
          <FlatList
            data={stops}
            keyExtractor={(item, idx) => idx.toString()}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={styles.stopItem}
                onPress={() => router.push({ pathname: '/metrorail/station-detail', params: { stopId: item.id } })}
              >
                <Text style={styles.stopNumber}>{index + 1}.</Text>
                <Text style={styles.stopName}>{item.name}</Text>
              </TouchableOpacity>
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
  noStops: { fontSize: 16, color: '#666', fontStyle: 'italic', textAlign: 'center' },
  stopItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  stopNumber: { fontSize: 16, fontWeight: '500', color: COLORS.primary, width: 30 },
  stopName: { fontSize: 16, color: '#000', flex: 1 },
});