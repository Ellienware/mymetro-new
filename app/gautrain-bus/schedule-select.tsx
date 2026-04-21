import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { getRoutesByType } from '../../services/gtfs';
import { COLORS } from '../../constants/theme';

export default function BusScheduleSelectScreen() {
  const busRoutes = getRoutesByType(3);

  const renderItem = ({ item }: any) => (
    <TouchableOpacity
      style={styles.routeItem}
      onPress={() => router.push({ pathname: '/gautrain-bus/route-schedule', params: { routeId: item.route_id } })}
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
        <Text style={styles.headerTitle}>Select a Route</Text>
        <View style={{ width: 50 }} />
      </View>
      <FlatList
        data={busRoutes}
        keyExtractor={item => item.route_id}
        renderItem={renderItem}
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
  list: { padding: 20 },
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
    height: 40,
    borderRadius: 4,
    marginRight: 16,
  },
  routeInfo: { flex: 1 },
  routeName: { fontSize: 16, fontWeight: '600', color: '#000' },
  routeShort: { fontSize: 14, color: '#666', marginTop: 2 },
});