import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '../../constants/theme';

const features = [
  { id: 'routes', title: 'Routes', icon: '🗺️', route: '/gautrain/routes' },
  { id: 'stops', title: 'Stops', icon: '📍', route: '/gautrain/stops' },
  { id: 'map', title: 'Network Map', icon: '🌐', route: '/gautrain/map' },
  { id: 'fares', title: 'Fares', icon: '💰', route: '/gautrain/fares' },
  { id: 'history', title: 'My Trips', icon: '📋', route: '/gautrain/history' },
];

export default function GautrainHubScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gautrain</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Explore the network</Text>
        <View style={styles.grid}>
          {features.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.gridItem}
              onPress={() => router.push(item.route as any)}
            >
              <Text style={styles.gridIcon}>{item.icon}</Text>
              <Text style={styles.gridLabel}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
  content: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 20 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  gridIcon: { fontSize: 32, marginBottom: 10 },
  gridLabel: { fontSize: 16, fontWeight: '500', color: '#000' },
});