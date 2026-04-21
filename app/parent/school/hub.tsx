import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/constants/theme';
import { databases, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { Query } from 'appwrite';
import type { DriverProfile } from '@/types/appwrite';

interface SchoolRoute {
  $id: string;
  driverId: string;
  pickupArea: string;
  capacity: number;
  pricePeriod: 'weekly' | 'monthly';
  status: string;
  morning: string; // JSON string
  afternoon?: string; // JSON string (optional)
}

interface EnrichedRoute extends SchoolRoute {
  driver: DriverProfile;
  schoolStops: { school: string; dropoffTime: string; price: number; order: number }[];
  pickupStartTime: string;
}

export default function ParentSchoolSearchScreen() {
  const [routes, setRoutes] = useState<EnrichedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    setLoading(true);
    try {
      const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_ROUTES, [
        Query.equal('status', 'active')
      ]);
      const rawRoutes = res.documents as unknown as SchoolRoute[];

      const enriched: EnrichedRoute[] = [];
      for (const route of rawRoutes) {
        try {
          let morningData: any = {};
          try {
            morningData = JSON.parse(route.morning);
          } catch (e) {
            console.warn(`Invalid morning JSON for route ${route.$id}`);
            continue;
          }

          const schoolStops = morningData.schoolStops || [];
          if (schoolStops.length === 0) continue;

          const driverDoc = await databases.getDocument(DATABASE_ID, COLLECTIONS.DRIVER_PROFILES, route.driverId);
          const driver = driverDoc as unknown as DriverProfile;
          if (driver.schoolVerificationStatus !== 'approved') continue;

          enriched.push({
            ...route,
            driver,
            schoolStops,
            pickupStartTime: morningData.pickupStartTime || 'N/A',
          });
        } catch (err) {
          console.warn(`Failed to process route ${route.$id}`, err);
        }
      }
      setRoutes(enriched);
    } catch (error) {
      console.error('Failed to load school routes', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = routes.filter(route =>
    route.schoolStops.some(stop => stop.school.toLowerCase().includes(search.toLowerCase()))
  );

  const renderRoute = ({ item }: { item: EnrichedRoute }) => {
    const firstStops = item.schoolStops.slice(0, 3);
    const moreCount = item.schoolStops.length - 3;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: '/parent/school/booking', params: { routeId: item.$id } })}
      >
        <LinearGradient
          colors={['#FFFFFF', '#F9FAFB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.routeCard}
        >
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Active</Text>
            </View>
            <Text style={styles.pickupArea}>📍 {item.pickupArea}</Text>
          </View>

          {/* Pickup time */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>⏰ Morning pickup:</Text>
            <Text style={styles.infoValue}>{item.pickupStartTime}</Text>
          </View>

          {/* Schools section */}
          <Text style={styles.schoolsLabel}>🏫 Schools served ({item.schoolStops.length})</Text>
          <View style={styles.schoolsList}>
            {firstStops.map((stop, idx) => (
              <View key={idx} style={styles.schoolChip}>
                <Text style={styles.schoolName}>{stop.school}</Text>
                <View style={styles.schoolDetails}>
                  <Text style={styles.dropoffTime}>⬇️ {stop.dropoffTime}</Text>
                  <Text style={styles.price}>R{stop.price}/{item.pricePeriod}</Text>
                </View>
              </View>
            ))}
            {moreCount > 0 && (
              <View style={styles.moreChip}>
                <Text style={styles.moreText}>+{moreCount} more school(s)</Text>
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={styles.cardFooter}>
            <Text style={styles.seats}>💺 Seats available: {item.capacity}</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Find School Transport</Text>
          <View style={{ width: 50 }} />
        </View>
        <ActivityIndicator size="large" style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find School Transport</Text>
        <View style={{ width: 50 }} />
      </View>
      <TextInput
        style={styles.searchInput}
        placeholder="Search by school name"
        value={search}
        onChangeText={setSearch}
        placeholderTextColor="#9CA3AF"
      />
      <FlatList
        data={filtered}
        renderItem={renderRoute}
        keyExtractor={(item) => item.$id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No routes found. Check back later.</Text>}
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
  searchInput: {
    margin: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  list: { paddingBottom: 20 },
  routeCard: {
    borderRadius: 20,
    marginBottom: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  badge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  pickupArea: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    textAlign: 'right',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  schoolsLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    color: '#374151',
  },
  schoolsList: {
    paddingHorizontal: 16,
  },
  schoolChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  schoolName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    flex: 2,
  },
  schoolDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dropoffTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  moreChip: {
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  moreText: {
    fontSize: 12,
    color: '#4B5563',
    fontStyle: 'italic',
  },
  cardFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginTop: 8,
  },
  seats: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  loader: { marginTop: 40 },
  empty: { textAlign: 'center', marginTop: 40, color: '#9CA3AF' },
});