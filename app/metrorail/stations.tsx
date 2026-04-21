import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { ALL_STOPS } from '../../constants/allStops';
import { COLORS } from '../../constants/theme';

// Filter for Metrorail stations: mode 'train' and NOT related to Gautrain
const metrorailStops = ALL_STOPS.filter(stop => 
  stop.mode === 'train' && 
  !stop.name.toLowerCase().includes('gautrain') &&
  !stop.lines.some(line => line.toLowerCase().includes('gautrain'))
);

export default function MetrorailStationsScreen() {
  console.log('Metrorail stops count:', metrorailStops.length); // debug

  const renderItem = ({ item }: { item: typeof metrorailStops[0] }) => (
    <TouchableOpacity
      style={styles.stationItem}
      onPress={() => router.push({ pathname: '/metrorail/station-detail', params: { stopId: item.id } })}
    >
      <View style={styles.stationInfo}>
        <Text style={styles.stationName}>{item.name}</Text>
      </View>
      {item.lines.length > 0 && (
        <Text style={styles.lines}>{item.lines.slice(0, 2).join(' • ')}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Metrorail Stations</Text>
        <View style={{ width: 50 }} />
      </View>
      <FlatList
        data={metrorailStops}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No Metrorail stations found</Text>}
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
  stationItem: {
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
  stationInfo: {
    marginBottom: 4,
  },
  stationName: { fontSize: 16, fontWeight: '600', color: '#000' },
  lines: { fontSize: 14, color: '#666' },
  empty: { textAlign: 'center', marginTop: 40, color: '#666' },
});