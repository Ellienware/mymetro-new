import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { GAUTRAIN_STATIONS, getGautrainFare } from '../../constants/gautrainFares';

export default function GautrainFaresScreen() {
  // Show a sample table for the first 5 stations (to keep layout tidy)
  const sampleStations = GAUTRAIN_STATIONS.slice(0, 5);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gautrain Fares</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.info}>Peak fares (R) – valid weekdays 06:00–08:30 & 16:00–18:30.</Text>
        <View style={styles.table}>
          {/* Header row */}
          <View style={styles.tableRow}>
            <Text style={[styles.cell, styles.headerCell]}>From ↓ / To →</Text>
            {sampleStations.map(station => (
              <Text key={station} style={[styles.cell, styles.headerCell, styles.stationCell]}>
                {station}
              </Text>
            ))}
          </View>
          {/* Data rows */}
          {sampleStations.map(from => (
            <View key={from} style={styles.tableRow}>
              <Text style={[styles.cell, styles.stationCell]}>{from}</Text>
              {sampleStations.map(to => (
                <Text key={to} style={[styles.cell, styles.fareCell]}>
                  {getGautrainFare(from, to, true)}
                </Text>
              ))}
            </View>
          ))}
        </View>
        <Text style={styles.note}>
          * Fares for OR Tambo and stations beyond Rosebank are also available.
          Actual fare is calculated when you buy a ticket.
        </Text>
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
  info: { fontSize: 14, color: '#666', marginBottom: 16, textAlign: 'center' },
  table: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  cell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
  },
  headerCell: { backgroundColor: '#F3F4F6', fontWeight: 'bold', color: '#000' },
  stationCell: { fontWeight: '600', color: '#374151' },
  fareCell: { color: COLORS.primary },
  note: { marginTop: 20, fontSize: 12, color: '#888', textAlign: 'center' },
});