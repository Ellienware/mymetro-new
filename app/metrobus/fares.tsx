import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '../../constants/theme';

export default function MetrobusFaresScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fares</Text>
        <View style={{ width: 50 }} />
      </View>
      <View style={styles.content}>
        <Text style={styles.fareInfo}>
          Metrobus uses distance-based fares. The minimum fare is R9.00 and increases by approximately R2 per km.
        </Text>
        <View style={styles.fareCard}>
          <Text style={styles.fareLabel}>0–10 km</Text>
          <Text style={styles.fareValue}>R9 – R15</Text>
        </View>
        <View style={styles.fareCard}>
          <Text style={styles.fareLabel}>11–20 km</Text>
          <Text style={styles.fareValue}>R16 – R25</Text>
        </View>
        <View style={styles.fareCard}>
          <Text style={styles.fareLabel}>21–30 km</Text>
          <Text style={styles.fareValue}>R26 – R35</Text>
        </View>
        <View style={styles.fareCard}>
          <Text style={styles.fareLabel}>31–50 km</Text>
          <Text style={styles.fareValue}>R36 – R50</Text>
        </View>
      </View>
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
  fareInfo: { fontSize: 16, color: '#666', marginBottom: 20, lineHeight: 24 },
  fareCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  fareLabel: { fontSize: 16, fontWeight: '600', color: '#000' },
  fareValue: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
});