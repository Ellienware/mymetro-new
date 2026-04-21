import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { AppwriteService } from '../../services/appwriteService';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '../../lib/appwrite';
import { COLORS } from '../../constants/theme';

export default function MetrobusScreen() {
  const { user } = useUser();
  const [balance, setBalance] = useState(0);
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!user) return;
    const bal = await AppwriteService.getMetrobusBalance(user.id);
    setBalance(bal);
    // Check for active trip
    const activeTrips = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.METROBUS_TRIPS,
      [Query.equal('userId', user.id), Query.equal('status', 'active')]
    );
    if (activeTrips.documents.length > 0) {
      setActiveTrip(activeTrips.documents[0]);
    }
    // Load recent trips
    const recent = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.METROBUS_TRIPS,
      [Query.equal('userId', user.id), Query.orderDesc('entryTimestamp'), Query.limit(10)]
    );
    setTrips(recent.documents);
  };

  const handleTapIn = () => {
    router.push('/metrobus/select-stop?action=in');
  };

  const handleTapOut = () => {
    if (!activeTrip) return;
    router.push(`/metrobus/select-stop?action=out&tripId=${activeTrip.$id}`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Metrobus</Text>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Balance</Text>
        <Text style={styles.balanceAmount}>R{balance.toFixed(2)}</Text>
        <TouchableOpacity style={styles.topUpButton} onPress={() => router.push('/metrobus/top-up')}>
          <Text style={styles.topUpText}>Top Up</Text>
        </TouchableOpacity>
      </View>

      {activeTrip ? (
        <View style={styles.activeTripCard}>
          <Text style={styles.activeTitle}>Active Trip</Text>
          <Text>Boarded at: {activeTrip.entryStopName}</Text>
          <Text>Time: {new Date(activeTrip.entryTimestamp).toLocaleTimeString()}</Text>
          <TouchableOpacity style={styles.tapOutButton} onPress={handleTapOut}>
            <Text style={styles.tapOutText}>Tap Out</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.tapInButton} onPress={handleTapIn}>
          <Text style={styles.tapInText}>Tap In</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.historyTitle}>Recent Trips</Text>
      <FlatList
        data={trips}
        keyExtractor={(item) => item.$id}
        renderItem={({ item }) => (
          <View style={styles.tripItem}>
            <Text>{item.entryStopName} → {item.exitStopName || '?'}</Text>
            <Text>{item.fare ? `R${item.fare}` : item.status}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  balanceCard: {
    backgroundColor: COLORS.primaryLight,
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  balanceLabel: { fontSize: 16, color: '#666' },
  balanceAmount: { fontSize: 32, fontWeight: 'bold', marginVertical: 10 },
  topUpButton: { backgroundColor: COLORS.primary, padding: 10, borderRadius: 8 },
  topUpText: { color: '#fff', fontWeight: '600' },
  activeTripCard: {
    backgroundColor: '#f0f0f0',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  activeTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  tapOutButton: { backgroundColor: '#ff9800', padding: 15, borderRadius: 8, marginTop: 10 },
  tapOutText: { color: '#fff', fontWeight: '600', textAlign: 'center' },
  tapInButton: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 8, marginBottom: 20 },
  tapInText: { color: '#fff', fontWeight: '600', textAlign: 'center' },
  historyTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  tripItem: { padding: 10, borderBottomWidth: 1, borderColor: '#ccc' },
});