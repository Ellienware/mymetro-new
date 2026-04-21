import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ALL_STOPS } from '../../constants/allStops';
import { COLORS } from '../../constants/theme';

export default function MetrorailStationDetailScreen() {
  const { stopId } = useLocalSearchParams<{ stopId: string }>();
  const [station, setStation] = useState<any>(null);
  const [departures, setDepartures] = useState<any[]>([]);

  useEffect(() => {
    const found = ALL_STOPS.find(s => s.id === stopId);
    setStation(found);
    // Static sample departures – replace with real schedule if available
    setDepartures([
      { time: '08:15', destination: 'Johannesburg Park', platform: '2' },
      { time: '08:45', destination: 'Pretoria', platform: '1' },
      { time: '09:10', destination: 'Soweto', platform: '3' },
    ]);
  }, []);

  if (!station) return <View><Text>Loading...</Text></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{station.name}</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Next departures</Text>
        {departures.map((dep, idx) => (
          <View key={idx} style={styles.departureRow}>
            <Text style={styles.time}>{dep.time}</Text>
            <Text style={styles.destination}>{dep.destination}</Text>
            <Text style={styles.platform}>Plat {dep.platform}</Text>
          </View>
        ))}
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
  content: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  departureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  time: { fontSize: 16, fontWeight: '600', color: COLORS.primary },
  destination: { fontSize: 16, color: '#000', flex: 1, marginLeft: 10 },
  platform: { fontSize: 14, color: '#666' },
});