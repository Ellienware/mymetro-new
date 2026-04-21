import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { useUserTickets, useUserProfile } from '../../hooks/useAppwrite';
import { COLORS } from '../../constants/theme';

export default function AnalyticsScreen() {
  const { user } = useUser();
  const { tickets } = useUserTickets();
  const { profile } = useUserProfile();

  // For demo, we'll just show all tickets (not filtered by mode)
  const totalTrips = tickets.length;
  const totalSpent = tickets.reduce((sum, t) => sum + t.price, 0);
  const pointsEarned = profile?.reaVayaPoints || 0;
  const avgFare = totalTrips > 0 ? (totalSpent / totalTrips).toFixed(2) : '0.00';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Total Trips</Text>
          <Text style={styles.cardValue}>{totalTrips}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Total Spent</Text>
          <Text style={styles.cardValue}>R{totalSpent.toFixed(2)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Points Earned</Text>
          <Text style={styles.cardValue}>{pointsEarned}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Average Fare</Text>
          <Text style={styles.cardValue}>R{avgFare}</Text>
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
  content: { padding: 20, gap: 16 },
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, color: '#666', marginBottom: 8 },
  cardValue: { fontSize: 28, fontWeight: 'bold', color: COLORS.primary },
});