import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, SectionList } from 'react-native';
import { router } from 'expo-router';
import { ALL_ROUTES } from '../../constants/allRoutes';
import { COLORS } from '../../constants/theme';

// Filter for Metrorail routes:
// - mode = 'train'
// - exclude Gautrain (name or operator)
// - exclude Shosholoza Meyl (long‑distance)
const metrorailRoutes = ALL_ROUTES.filter(route => {
  if (route.mode !== 'train') return false;
  
  // Exclude Gautrain
  if (route.name.toLowerCase().includes('gautrain')) return false;
  if (route.operator?.toLowerCase().includes('gautrain')) return false;
  
  // Exclude Shosholoza Meyl (long‑distance)
  if (route.operator?.toLowerCase().includes('shosholoza')) return false;
  
  // Also exclude routes that are explicitly not Metrorail
  if (route.name.includes('Airport Line')) return false; // Gautrain
  
  // Include everything else – this will show all remaining train routes
  return true;
});

// Group by operator (or 'Metrorail' if none)
const groupedRoutes = metrorailRoutes.reduce((acc: any, route) => {
  const operator = route.operator || 'Metrorail';
  if (!acc[operator]) acc[operator] = [];
  acc[operator].push(route);
  return acc;
}, {});

const sections = Object.keys(groupedRoutes).map(operator => ({
  title: operator,
  data: groupedRoutes[operator],
}));

export default function MetrorailRoutesScreen() {
  console.log('Metrorail routes count:', metrorailRoutes.length); // debug

  const renderItem = ({ item }: { item: typeof metrorailRoutes[0] }) => (
    <TouchableOpacity
      style={styles.routeItem}
      onPress={() => router.push({ pathname: '/metrorail/route-detail', params: { routeId: item.id } })}
    >
      <View style={[styles.colorBadge, { backgroundColor: item.colour || '#3388ff' }]} />
      <View style={styles.routeInfo}>
        <Text style={styles.routeName}>{item.name}</Text>
        <Text style={styles.routeMeta}>
          {item.stops.length} stops
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Metrorail Routes</Text>
        <View style={{ width: 50 }} />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No Metrorail routes found</Text>}
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
  list: { paddingHorizontal: 20, paddingBottom: 20 },
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
    height: 40,
    borderRadius: 4,
    marginRight: 16,
  },
  routeInfo: { flex: 1 },
  routeName: { fontSize: 16, fontWeight: '600', color: '#000' },
  routeMeta: { fontSize: 14, color: '#666', marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40, color: '#666' },
});