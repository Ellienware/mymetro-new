import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '../constants/theme';

// Types for i‑TRAFFIC data (will be imported from types later)
interface TrafficEvent {
  id: string;
  type: 'alert' | 'event' | 'camera';
  title: string;
  description: string;
  time: string;
  severity?: 'low' | 'medium' | 'high';
  location?: string;
}

// Mock data for demonstration
const mockUpdates: TrafficEvent[] = [
  {
    id: '1',
    type: 'alert',
    title: 'Accident on M1 South',
    description: 'Multi‑vehicle accident near Grayston Drive. Two lanes closed.',
    time: '5 min ago',
    severity: 'high',
    location: 'M1 South, Grayston',
  },
  {
    id: '2',
    type: 'event',
    title: 'Roadworks on N1 Western Bypass',
    description: 'Roadworks between Beyers Naudé and Malibongwe. Expect delays.',
    time: '15 min ago',
    severity: 'medium',
    location: 'N1, Randburg',
  },
  {
    id: '3',
    type: 'camera',
    title: 'Camera at M1/M2 Interchange',
    description: 'Heavy traffic approaching from east.',
    time: '2 min ago',
    location: 'M1/M2 Interchange',
  },
  {
    id: '4',
    type: 'alert',
    title: 'Broken down truck on R24',
    description: 'Truck blocking right lane near OR Tambo.',
    time: '10 min ago',
    severity: 'medium',
    location: 'R24, Kempton Park',
  },
  {
    id: '5',
    type: 'event',
    title: 'Planned power outage',
    description: 'Traffic lights affected in Sandton CBD.',
    time: '1 hour ago',
    severity: 'low',
    location: 'Sandton CBD',
  },
];

const filterTypes = [
  { id: 'all', label: 'All' },
  { id: 'alert', label: 'Alerts' },
  { id: 'event', label: 'Events' },
  { id: 'camera', label: 'Cameras' },
];

export default function UpdatesScreen() {
  const [updates, setUpdates] = useState<TrafficEvent[]>(mockUpdates);
  const [filteredUpdates, setFilteredUpdates] = useState<TrafficEvent[]>(mockUpdates);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    applyFilter();
  }, [selectedFilter, updates]);

  const applyFilter = () => {
    if (selectedFilter === 'all') {
      setFilteredUpdates(updates);
    } else {
      setFilteredUpdates(updates.filter(item => item.type === selectedFilter));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Here we will later call i‑TRAFFIC API
    // For now, simulate a refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#10B981';
      default: return '#6B7280';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'alert': return '⚠️';
      case 'event': return '🚧';
      case 'camera': return '📹';
      default: return '📢';
    }
  };

  const renderUpdateItem = ({ item }: { item: TrafficEvent }) => (
    <View style={styles.updateCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.typeIcon}>{getTypeIcon(item.type)}</Text>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardTime}>{item.time}</Text>
      </View>
      <Text style={styles.cardDescription}>{item.description}</Text>
      {item.location && (
        <Text style={styles.cardLocation}>📍 {item.location}</Text>
      )}
      {item.severity && (
        <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(item.severity) + '20' }]}>
          <View style={[styles.severityDot, { backgroundColor: getSeverityColor(item.severity) }]} />
          <Text style={[styles.severityText, { color: getSeverityColor(item.severity) }]}>
            {item.severity.toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Traffic Updates</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Text style={styles.refreshText}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
        {filterTypes.map(filter => (
          <TouchableOpacity
            key={filter.id}
            style={[styles.filterChip, selectedFilter === filter.id && styles.filterChipActive]}
            onPress={() => setSelectedFilter(filter.id)}
          >
            <Text style={[styles.filterLabel, selectedFilter === filter.id && styles.filterLabelActive]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filteredUpdates}
        renderItem={renderUpdateItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No updates available</Text>
          </View>
        }
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
  refreshButton: { padding: 5 },
  refreshText: { fontSize: 20 },
  filterContainer: {
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterLabel: { fontSize: 14, color: '#374151' },
  filterLabelActive: { color: 'white' },
  list: { padding: 20 },
  updateCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  typeIcon: { fontSize: 20, marginRight: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#000', flex: 1 },
  cardTime: { fontSize: 12, color: '#9CA3AF' },
  cardDescription: { fontSize: 14, color: '#4B5563', marginBottom: 8 },
  cardLocation: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  severityText: { fontSize: 12, fontWeight: '600' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: { fontSize: 16, color: '#9CA3AF' },
});