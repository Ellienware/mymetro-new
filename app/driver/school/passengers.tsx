
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, Alert,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router, useFocusEffect } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { databases, DATABASE_ID, COLLECTIONS, Query, ID } from '@/lib/appwrite';
import { ScreenHeader, LoadingScreen, EmptyState, Card } from '@/components/ui';

interface Passenger {
  bookingId: string;
  childName: string;
  parentId: string;
  parentName: string;
  parentPhone: string;
  pickupAddress: string;
  offeringId: string;
  schoolName: string;
}

export default function MyPassengersScreen() {
  const { user } = useUser();
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPassengers = async () => {
    try {
      const drivers = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_DRIVERS, [
        Query.equal('userId', user!.id),
      ]);
      if (drivers.documents.length === 0) return;
      const driverId = drivers.documents[0].$id;

      const offerings = await databases.listDocuments(DATABASE_ID, COLLECTIONS.DRIVER_SCHOOL_OFFERINGS, [
        Query.equal('driverId', driverId),
        Query.equal('status', 'active'),
      ]);
      const offeringIds = offerings.documents.map(o => o.$id);
      if (!offeringIds.length) { setPassengers([]); return; }

      const bookings = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_BOOKINGS, [
        Query.equal('offeringId', offeringIds),
        Query.equal('status', 'active'),
      ]);

      // FIX: Fetch all parent profiles in parallel
      const uniqueParentIds = [...new Set(bookings.documents.map(b => b.parentId))];
      const parentDocs = await Promise.all(
        uniqueParentIds.map(pid =>
          databases.getDocument(DATABASE_ID, COLLECTIONS.USERS, pid).catch(() => null)
        )
      );
      const parentMap = new Map(
        parentDocs.filter(Boolean).map(p => [p!.$id, p])
      );

      const enriched: Passenger[] = [];
      for (const booking of bookings.documents) {
        const parent = parentMap.get(booking.parentId);
        const offering = offerings.documents.find(o => o.$id === booking.offeringId);
        // FIX: Use childNames for display names
        const childNames: string[] = JSON.parse(booking.childNames || booking.childIds || '[]');
        for (const childName of childNames) {
          enriched.push({
            bookingId: booking.$id,
            childName,
            parentId: booking.parentId,
            parentName: parent ? `${parent.firstName ?? ''} ${parent.lastName ?? ''}`.trim() || 'Parent' : 'Parent',
            parentPhone: parent?.phone ?? 'No phone',
            pickupAddress: booking.pickupAddress,
            offeringId: booking.offeringId,
            schoolName: offering?.schoolName ?? 'Unknown school',
          });
        }
      }
      setPassengers(enriched);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load passengers');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadPassengers(); }, []));

  const startChat = async (passenger: Passenger) => {
    try {
      const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.CHAT_ROOMS, [
        Query.equal('bookingId', passenger.bookingId),
      ]);
      let roomId: string;
      if (existing.documents.length > 0) {
        roomId = existing.documents[0].$id;
      } else {
        const drivers = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_DRIVERS, [
          Query.equal('userId', user!.id),
        ]);
        const driverId = drivers.documents[0].$id;
        const room = await databases.createDocument(DATABASE_ID, COLLECTIONS.CHAT_ROOMS, ID.unique(), {
          participants: JSON.stringify([passenger.parentId, driverId]),
          bookingId: passenger.bookingId,
          createdAt: new Date().toISOString(),
        });
        roomId = room.$id;
      }
      router.push({ pathname: '/chat', params: { roomId, bookingId: passenger.bookingId, otherUserName: passenger.parentName } });
    } catch {
      Alert.alert('Error', 'Could not start chat');
    }
  };

  if (loading) return <LoadingScreen />;

  // Group passengers by school
  const bySchool = passengers.reduce((acc: Record<string, Passenger[]>, p) => {
    if (!acc[p.schoolName]) acc[p.schoolName] = [];
    acc[p.schoolName].push(p);
    return acc;
  }, {});

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="My Passengers" onBack={() => router.back()} />

      {passengers.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No passengers yet"
          subtitle="Active bookings will appear here once parents book your routes"
        />
      ) : (
        <FlatList
          data={Object.entries(bySchool)}
          keyExtractor={([school]) => school}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: [school, schoolPassengers] }) => (
            <View style={styles.schoolGroup}>
              <View style={styles.schoolGroupHeader}>
                <Text style={styles.schoolGroupIcon}>🏫</Text>
                <Text style={styles.schoolGroupName}>{school}</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{schoolPassengers.length}</Text>
                </View>
              </View>
              {schoolPassengers.map((passenger, idx) => (
                <Card key={`${passenger.bookingId}-${idx}`} style={styles.passengerCard}>
                  <View style={styles.cardTop}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{passenger.childName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                      <Text style={styles.childName}>{passenger.childName}</Text>
                      <Text style={styles.parentName}>👤 {passenger.parentName}</Text>
                    </View>
                  </View>
                  <View style={styles.details}>
                    <Text style={styles.detail}>📍 {passenger.pickupAddress}</Text>
                    <Text style={styles.detail}>📞 {passenger.parentPhone}</Text>
                  </View>
                  <TouchableOpacity style={styles.chatBtn} onPress={() => startChat(passenger)}>
                    <Text style={styles.chatBtnText}>💬 Message Parent</Text>
                  </TouchableOpacity>
                </Card>
              ))}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: SPACING.md, paddingBottom: 40 },

  schoolGroup: { marginBottom: SPACING.lg },
  schoolGroupHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.xs },
  schoolGroupIcon: { fontSize: 18 },
  schoolGroupName: { ...TYPOGRAPHY.h4, flex: 1 },
  countBadge: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.primaryDark },

  passengerCard: {},
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: COLORS.primaryDark },
  childName: { ...TYPOGRAPHY.h4 },
  parentName: { ...TYPOGRAPHY.caption, marginTop: 2 },
  details: { gap: 4, marginBottom: SPACING.sm },
  detail: { ...TYPOGRAPHY.body, fontSize: 13 },
  chatBtn: { backgroundColor: COLORS.primary, paddingVertical: 10, borderRadius: RADIUS.md, alignItems: 'center' },
  chatBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});