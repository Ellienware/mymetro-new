import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '../../constants/theme';

// Fare table based on official Rea Vaya 2025/26 data (peak fares)
const FARE_TABLE = [
  { distance: '0 – 5 km', peak: 11.00, offPeak: 9.90 },
  { distance: '5.1 – 10 km', peak: 14.00, offPeak: 12.60 },
  { distance: '10.1 – 15 km', peak: 16.50, offPeak: 14.85 },
  { distance: '15.1 – 25 km', peak: 19.00, offPeak: 17.10 },
  { distance: '25.1 – 35 km', peak: 21.00, offPeak: 18.90 },
  { distance: '35.1 – 45 km', peak: 22.00, offPeak: 19.80 },
  { distance: '> 45 km', peak: 28.00, offPeak: 25.20 },
];

export default function ReaVayaFaresScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rea Vaya Fares</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.periodTitle}>2025/26 Fares (effective 1 July 2025)</Text>
        <Text style={styles.note}>
          Off‑peak travel receives 10% discount. Peak times are typically weekdays 06:00–08:30 & 16:00–18:30.
        </Text>

        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.cell, styles.headerCell]}>Distance</Text>
            <Text style={[styles.cell, styles.headerCell]}>Peak</Text>
            <Text style={[styles.cell, styles.headerCell]}>Off‑Peak</Text>
          </View>
          {FARE_TABLE.map((row, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={styles.cell}>{row.distance}</Text>
              <Text style={styles.cell}>R{row.peak.toFixed(2)}</Text>
              <Text style={styles.cell}>R{row.offPeak.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 Bonus Points</Text>
          <Text style={styles.infoText}>
            Load R51 or more to earn bonus points (5%–12.5% extra). The more you load, the more bonus points you receive!
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🚍 Transfer Rules</Text>
          <Text style={styles.infoText}>
            Don’t tap out at intermediate stations – only tap out at your final destination. This ensures you pay for the whole journey as one trip, which is cheaper.
          </Text>
        </View>

        <Text style={styles.footer}>
          Minimum balance to travel: R28.00. Smartcard price: R40.
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
  periodTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  note: { fontSize: 14, color: '#666', marginBottom: 16 },
  table: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, overflow: 'hidden', marginBottom: 20 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  cell: { flex: 1, padding: 10, textAlign: 'center', fontSize: 14 },
  headerCell: { backgroundColor: '#F3F4F6', fontWeight: 'bold', color: '#000' },
  infoCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  infoText: { fontSize: 14, color: '#666', lineHeight: 20 },
  footer: { fontSize: 12, color: '#888', textAlign: 'center', marginTop: 10 },
});