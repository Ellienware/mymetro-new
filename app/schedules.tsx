import React, { useState } from 'react';
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
import { COLORS, TYPOGRAPHY, SPACING } from '../constants/theme';

// Define a union type for schedule items
type ScheduleItem = {
  id: string;
  route: string;
  time: string;
  status: string;
  platform?: string;   // trains
  bus?: string;        // buses/BRT
  // Add other optional fields as needed
};

// Mock schedule data (ensure each item matches ScheduleItem)
const mockSchedules = {
  train: [
    { id: '1', route: 'Soweto → Johannesburg', time: '06:30', platform: '2', status: 'On Time' },
    { id: '2', route: 'Pretoria → Johannesburg', time: '07:15', platform: '1', status: 'Delayed' },
    { id: '3', route: 'Johannesburg → Soweto', time: '07:45', platform: '3', status: 'On Time' },
  ],
  reaVaya: [
    { id: '4', route: 'T1: Soweto → Sandton', time: '06:45', bus: 'A12', status: 'Scheduled' },
    { id: '5', route: 'T2: Soweto → CBD', time: '07:20', bus: 'B7', status: 'Scheduled' },
  ],
  metrobus: [
    { id: '6', route: 'M1: Parktown → Randburg', time: '07:00', bus: 'M101', status: 'On Time' },
    { id: '7', route: 'M2: Soweto → Midrand', time: '07:35', bus: 'M205', status: 'Delayed' },
  ],
  taxi: [
    { id: '8', route: 'Bree Taxi Rank → Sandton', time: '06:50', status: 'Active' },
    { id: '9', route: 'Soweto → Johannesburg CBD', time: '07:10', status: 'Active' },
  ],
};

const modes = [
  { id: 'train', label: 'Trains', icon: '🚆' },
  { id: 'reaVaya', label: 'Rea Vaya', icon: '🚍' },
  { id: 'metrobus', label: 'Metro Bus', icon: '🚌' },
  { id: 'taxi', label: 'Taxis', icon: '🚖' },
];

export default function SchedulesScreen() {
  const [selectedMode, setSelectedMode] = useState('train');
  const [schedules, setSchedules] = useState<ScheduleItem[]>(mockSchedules.train);

  const handleModeChange = (modeId: string) => {
    setSelectedMode(modeId);
    setSchedules(mockSchedules[modeId as keyof typeof mockSchedules] || []);
  };

  const renderScheduleItem = ({ item }: { item: ScheduleItem }) => (
    <View style={styles.scheduleItem}>
      <View style={styles.routeInfo}>
        <Text style={styles.routeName}>{item.route}</Text>
        <Text style={styles.routeTime}>{item.time}</Text>
      </View>
      <View style={styles.detailRow}>
        {item.platform && <Text style={styles.detail}>Platform {item.platform}</Text>}
        {item.bus && <Text style={styles.detail}>Bus {item.bus}</Text>}
        <Text style={[styles.status, getStatusStyle(item.status)]}>{item.status}</Text>
      </View>
    </View>
  );

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'On Time': return { color: '#10B981' };
      case 'Delayed': return { color: '#F59E0B' };
      case 'Cancelled':
      case 'Scheduled': return { color: '#6B7280' };
      default: return { color: COLORS.primary };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schedules</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Mode filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modeFilter}>
        {modes.map((mode) => (
          <TouchableOpacity
            key={mode.id}
            style={[styles.modeChip, selectedMode === mode.id && styles.modeChipActive]}
            onPress={() => handleModeChange(mode.id)}
          >
            <Text style={styles.modeIcon}>{mode.icon}</Text>
            <Text style={[styles.modeLabel, selectedMode === mode.id && styles.modeLabelActive]}>
              {mode.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={schedules}
        renderItem={renderScheduleItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No schedules found</Text>}
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
  modeFilter: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  modeChipActive: {
    backgroundColor: COLORS.primary,
  },
  modeIcon: { fontSize: 16, marginRight: 6 },
  modeLabel: { fontSize: 14, color: '#374151' },
  modeLabelActive: { color: 'white' },
  list: { padding: 20 },
  scheduleItem: {
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
  routeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeName: { fontSize: 16, fontWeight: '600', color: '#000', flex: 1 },
  routeTime: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detail: { fontSize: 14, color: '#666' },
  status: { fontSize: 14, fontWeight: '500' },
  empty: { textAlign: 'center', marginTop: 40, color: '#666' },
});