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
  { id: 'routes', title: 'Routes', icon: '🗺️', route: '/metrorail/routes' },
  { id: 'stations', title: 'Stations', icon: '🚉', route: '/metrorail/stations' },
  { id: 'map', title: 'Network Map', icon: '🗺️', route: '/metrorail/map' },
  { id: 'fares', title: 'Fares/tickets', icon: '💰', route: '/metrorail/tickets' },
  { id: 'schedules', title: 'Schedules', icon: '⏰', route: '/metrorail/schedule' },
  { id: 'history', title: 'Trip History', icon: '📋', route: '/metrorail/history' }, // placeholder
];

export default function MetrorailHubScreen() {
  const handlePlanJourney = () => {
    router.push({
      pathname: '/(tabs)/home',
      params: { mode: 'train' }
    });
  };

  const renderGridItem = ({ item }: { item: typeof gridItems[0] }) => (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => router.push(item.route as any)}
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
          <Text style={styles.headerTitle}>Metrorail</Text>
          <View style={{ width: 50 }} />
        </View>

        <TouchableOpacity style={styles.planCard} onPress={handlePlanJourney}>
          <View style={styles.planRow}>
            <Text style={styles.planText}>🚆 Plan a train journey</Text>
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
  planCard: {
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
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planText: { fontSize: 16, color: 'white', fontWeight: '600' },
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