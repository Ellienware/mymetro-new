import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '../../constants/theme';

const gridItems = [
  { id: 'tracker', title: 'Live Buses', icon: '🚌', route: '/gautrain-bus/tracker' },
  { id: 'routes', title: 'Routes', icon: '🗺️', route: '/gautrain-bus/routes' },
  { id: 'stops', title: 'Stops', icon: '📍', route: '/gautrain-bus/stops' },
  { id: 'map', title: 'Network Map', icon: '🗺️', route: '/gautrain-bus/map' },
  { id: 'fares', title: 'Fares', icon: '💰', route: '/gautrain-bus/fares' },
  { id: 'alerts', title: 'Alerts', icon: '⚠️', route: '/updates' },
];

export default function GautrainBusHubScreen() {
  const handleTrackerNow = () => {
    router.push('/gautrain-bus/tracker');
  };

  const renderGridItem = ({ item }: { item: typeof gridItems[0] }) => (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => router.push(item.route)}
    >
      <Text style={styles.gridIcon}>{item.icon}</Text>
      <Text style={styles.gridTitle}>{item.title}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gautrain Bus</Text>
          <View style={{ width: 50 }} />
        </View>

        <TouchableOpacity style={styles.trackerCard} onPress={handleTrackerNow}>
          <View style={styles.trackerRow}>
            <Text style={styles.trackerText}>🚌 See live buses now</Text>
            <Text style={styles.arrow}>→</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Services</Text>
        <FlatList
          data={gridItems}
          renderItem={renderGridItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          scrollEnabled={false}
        />
      </ScrollView>
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
  trackerCard: {
    backgroundColor: COLORS.primary,
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trackerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackerText: { fontSize: 16, color: 'white', fontWeight: '600' },
  arrow: { fontSize: 18, color: 'white' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  gridRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  gridItem: {
    width: '48%',
    backgroundColor: 'white',
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  gridIcon: { fontSize: 32, marginBottom: 8 },
  gridTitle: { fontSize: 14, fontWeight: '500', color: '#000' },
});