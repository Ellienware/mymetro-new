import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useUserTickets } from '../../hooks/useAppwrite';
import { COLORS } from '../../constants/theme';

// Filter tickets that belong to Metrorail (train service categories)
const trainCategories = ['metro', 'metro_plus', 'metro_plus_express'];

export default function MetrorailHistoryScreen() {
  const { tickets, loading, refetch } = useUserTickets();
  const [trainTickets, setTrainTickets] = useState<any[]>([]);

  useEffect(() => {
    const filtered = tickets.filter(t => trainCategories.includes(t.serviceCategory));
    setTrainTickets(filtered);
  }, [tickets]);

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.ticketItem}>
      <View style={styles.ticketHeader}>
        <Text style={styles.route}>
          {item.fromStation} → {item.toStation}
        </Text>
        <Text style={[styles.status, { color: item.status === 'active' ? '#10B981' : '#6B7280' }]}>
          {item.status}
        </Text>
      </View>
      <Text style={styles.date}>
        {new Date(item.validFrom).toLocaleDateString()} – {new Date(item.validUntil).toLocaleDateString()}
      </Text>
      <View style={styles.ticketFooter}>
        <Text style={styles.price}>R{item.price.toFixed(2)}</Text>
        <Text style={styles.category}>{item.serviceCategory.replace(/_/g, ' ')}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trip History</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip History</Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.refreshButton}>
          <Text style={styles.refreshText}>🔄</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={trainTickets}
        keyExtractor={item => item.$id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>🎫</Text>
            <Text style={styles.emptyTitle}>No trips yet</Text>
            <Text style={styles.emptySubtitle}>Your train journeys will appear here</Text>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 20 },
  ticketItem: {
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
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  route: { fontSize: 16, fontWeight: '600', color: '#000' },
  status: { fontSize: 14, fontWeight: '500', textTransform: 'capitalize' },
  date: { fontSize: 14, color: '#666', marginBottom: 8 },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
  category: { fontSize: 14, color: '#666', textTransform: 'capitalize' },
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#000', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#666', textAlign: 'center' },
});