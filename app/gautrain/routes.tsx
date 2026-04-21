import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, SectionList } from 'react-native';
import { router } from 'expo-router';

import { COLORS } from '../../constants/theme';
import { getRoutesByType } from '@/services/gtfs';

const sections = [
  { title: '🚆 Trains', data: getRoutesByType(2) },
  { title: '🚌 Buses', data: getRoutesByType(3) },
];

export default function GautrainRoutesScreen() {
  const renderItem = ({ item }: any) => (
    <TouchableOpacity
      style={styles.routeItem}
      onPress={() => router.push({ pathname: '/gautrain/route-detail', params: { routeId: item.route_id } })}
    >
      <View style={[styles.colorBadge, { backgroundColor: `#${item.route_color}` }]} />
      <View style={styles.routeInfo}>
        <Text style={styles.routeName}>{item.route_long_name}</Text>
        <Text style={styles.routeShort}>{item.route_short_name}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gautrain Routes</Text>
        <View style={{ width: 50 }} />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={item => item.route_id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        contentContainerStyle={styles.list}
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
  list: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
    color: '#000',
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  colorBadge: {
    width: 8,
    height: '100%',
    borderRadius: 4,
    marginRight: 16,
  },
  routeInfo: { flex: 1 },
  routeName: { fontSize: 16, fontWeight: '600', color: '#000' },
  routeShort: { fontSize: 14, color: '#666', marginTop: 2 },
});