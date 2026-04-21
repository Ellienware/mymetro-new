// app/parent/school/bookings.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router, useFocusEffect } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { databases, DATABASE_ID, COLLECTIONS, Query, ID } from '@/lib/appwrite';
import { ScreenHeader, Card, StatusPill, LoadingScreen, EmptyState } from '@/components/ui';

export default function ParentSchoolBookingsScreen() {
  const { user } = useUser();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBookings = async () => {
    try {
      const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_BOOKINGS, [
        Query.equal('parentId', user!.id),
        Query.orderDesc('createdAt'),
      ]);
      const enriched = await Promise.all(
        res.documents.map(async booking => {
          try {
            const offering = await databases.getDocument(DATABASE_ID, COLLECTIONS.DRIVER_SCHOOL_OFFERINGS, booking.offeringId);
            return { ...booking, offering };
          } catch {
            return { ...booking, offering: null };
          }
        })
      );
      setBookings(enriched);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadBookings(); }, []));

  const startChat = async (booking: any) => {
    try {
      const driver = await databases.getDocument(DATABASE_ID, COLLECTIONS.SCHOOL_DRIVERS, booking.offering?.driverId);
      const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.CHAT_ROOMS, [Query.equal('bookingId', booking.$id)]);
      let roomId: string;
      if (existing.documents.length > 0) {
        roomId = existing.documents[0].$id;
      } else {
        const room = await databases.createDocument(DATABASE_ID, COLLECTIONS.CHAT_ROOMS, ID.unique(), {
          participants: JSON.stringify([user!.id, driver.userId]),
          bookingId: booking.$id,
          createdAt: new Date().toISOString(),
        });
        roomId = room.$id;
      }
      router.push({ pathname: '/chat', params: { roomId, bookingId: booking.$id, otherUserName: 'Driver' } });
    } catch {
      Alert.alert('Error', 'Could not start chat');
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="My Bookings" onBack={() => router.back()} />
      <FlatList
        data={bookings}
        keyExtractor={item => item.$id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="📋"
            title="No bookings yet"
            subtitle="Once you book transport it will appear here"
            action="Find Transport"
            onAction={() => router.push('/parent/school/search')}
          />
        }
        renderItem={({ item }) => {
          // FIX: Use childNames field for display (IDs stored in childIds)
          const childNames = JSON.parse(item.childNames || item.childIds || '[]').join(', ');
          return (
            <Card style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.schoolName}>{item.offering?.schoolName ?? item.selectedSchool}</Text>
                  <Text style={styles.childName}>👧 {childNames || 'Children not specified'}</Text>
                </View>
                <StatusPill status={item.status} />
              </View>

              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailIcon}>📍</Text>
                  <Text style={styles.detailText} numberOfLines={1}>{item.pickupAddress}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailIcon}>💰</Text>
                  <Text style={styles.detailText}>R{item.price} · {item.period}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailIcon}>📅</Text>
                  <Text style={styles.detailText}>{new Date(item.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                </View>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.trackBtn}
                  onPress={() => router.push({ pathname: '/parent/school/tracking', params: { bookingId: item.$id } })}
                >
                  <Text style={styles.trackBtnText}>📍 Track</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chatBtn} onPress={() => startChat(item)}>
                  <Text style={styles.chatBtnText}>💬 Message Driver</Text>
                </TouchableOpacity>
              </View>
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: SPACING.md, paddingBottom: 40 },
  card: { marginBottom: SPACING.sm },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.sm },
  schoolName: { ...TYPOGRAPHY.h4 },
  childName: { ...TYPOGRAPHY.caption, marginTop: 4, color: COLORS.textSecondary },
  detailsGrid: { gap: 6, marginBottom: SPACING.sm },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailIcon: { fontSize: 13, width: 20 },
  detailText: { ...TYPOGRAPHY.body, fontSize: 13, flex: 1 },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  trackBtn: {
    flex: 1, paddingVertical: 10, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight, alignItems: 'center',
  },
  trackBtnText: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 14 },
  chatBtn: {
    flex: 2, paddingVertical: 10, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary, alignItems: 'center',
  },
  chatBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});