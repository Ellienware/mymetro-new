// app/parent/school/dashboard.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, RefreshControl, ActivityIndicator,
  Alert,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router, useFocusEffect } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { databases, DATABASE_ID, COLLECTIONS, Query, client } from '@/lib/appwrite';
import { Card, SectionHeader, EmptyState, LoadingScreen, LiveBadge, StatusPill } from '@/components/ui';

export default function ParentDashboard() {
  const { user } = useUser();
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [childrenCount, setChildrenCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tripLocations, setTripLocations] = useState<Record<string, any>>({});

  if (!user) return null;

  const loadData = async () => {
    try {
      // Active bookings
      const bookingsRes = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_BOOKINGS, [
        Query.equal('parentId', user.id),
        Query.equal('status', 'active'),
        Query.orderDesc('createdAt'),
      ]);
      const bookings = bookingsRes.documents;

      // Children count
      const childrenRes = await databases.listDocuments(DATABASE_ID, COLLECTIONS.CHILDREN, [
        Query.equal('parentId', user.id),
      ]);
      setChildrenCount(childrenRes.total);

      // Unread messages — parallel queries per room
      const chatRoomsRes = await databases.listDocuments(DATABASE_ID, COLLECTIONS.CHAT_ROOMS, []);
      const myRooms = chatRoomsRes.documents.filter(room =>
        JSON.parse(room.participants || '[]').includes(user.id)
      );
      const unreadCounts = await Promise.all(
        myRooms.map(room =>
          databases.listDocuments(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, [
            Query.equal('roomId', room.$id),
            Query.equal('read', false),
            Query.notEqual('senderId', user.id),
          ]).then(r => r.total).catch(() => 0)
        )
      );
      setUnreadMessages(unreadCounts.reduce((a, b) => a + b, 0));

      // Enrich bookings with offering + today's trip — parallel
      const enriched = await Promise.all(
        bookings.map(async booking => {
          try {
            const offering = await databases.getDocument(
              DATABASE_ID, COLLECTIONS.DRIVER_SCHOOL_OFFERINGS, booking.offeringId
            );
            const today = new Date().toISOString().split('T')[0];
            const tripsRes = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_TRIPS, [
              Query.equal('offeringId', booking.offeringId),
              Query.equal('date', today),
            ]);
            const trip = tripsRes.documents[0] ?? null;
            if (trip?.currentLocation) {
              setTripLocations(prev => ({ ...prev, [booking.$id]: JSON.parse(trip.currentLocation) }));
            }
            return { ...booking, offering, trip };
          } catch {
            return { ...booking, offering: null, trip: null };
          }
        })
      );
      setActiveBookings(enriched);
    } catch (error) {
      console.error('Dashboard load error:', error);
      Alert.alert('Error', 'Could not load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Real-time trip location updates
  React.useEffect(() => {
    if (!activeBookings.length) return;
    const unsubs = activeBookings
      .filter(b => b.trip)
      .map(booking =>
        client.subscribe(
          `databases.${DATABASE_ID}.collections.${COLLECTIONS.SCHOOL_TRIPS}.documents`,
          (response) => {
            const payload = response.payload as any;
            if (payload?.$id === booking.trip.$id && payload.currentLocation) {
              setTripLocations(prev => ({ ...prev, [booking.$id]: JSON.parse(payload.currentLocation) }));
            }
          }
        )
      );
    const msgUnsub = client.subscribe(
      `databases.${DATABASE_ID}.collections.${COLLECTIONS.CHAT_MESSAGES}.documents`,
      async (response) => {
        const msg = response.payload as any;
        if (msg?.senderId !== user.id) {
          try {
            const room = await databases.getDocument(DATABASE_ID, COLLECTIONS.CHAT_ROOMS, msg.roomId);
            if (JSON.parse(room.participants || '[]').includes(user.id)) {
              setUnreadMessages(prev => prev + 1);
            }
          } catch {}
        }
      }
    );
    return () => { unsubs.forEach(u => u()); msgUnsub(); };
  }, [activeBookings]);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  if (loading) return <LoadingScreen />;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero header */}
        <View style={styles.hero}>
          <View>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.userName}>{user.fullName?.split(' ')[0] || 'Parent'} 👋</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/chat/inbox')} style={styles.msgBtn}>
            <Text style={styles.msgIcon}>💬</Text>
            {unreadMessages > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadMessages}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Stats strip */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statCard} onPress={() => router.push('/parent/school/children')}>
            <Text style={styles.statNumber}>{childrenCount}</Text>
            <Text style={styles.statLabel}>Children</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity style={styles.statCard} onPress={() => router.push('/parent/school/bookings')}>
            <Text style={styles.statNumber}>{activeBookings.length}</Text>
            <Text style={styles.statLabel}>Active Trips</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity style={styles.statCard} onPress={() => router.push('/chat/inbox')}>
            <Text style={[styles.statNumber, unreadMessages > 0 && { color: COLORS.accent }]}>{unreadMessages}</Text>
            <Text style={styles.statLabel}>Messages</Text>
          </TouchableOpacity>
        </View>

        {/* Active bookings */}
        <View style={styles.section}>
          <SectionHeader title="Today's Trips" action="See all" onAction={() => router.push('/parent/school/bookings')} />
          {activeBookings.length === 0 ? (
            <EmptyState
              icon="🚌"
              title="No active trips"
              subtitle="Find a driver and book school transport for your child"
              action="Find Transport"
              onAction={() => router.push('/parent/school/search')}
            />
          ) : (
            activeBookings.map(booking => (
              <BookingCard
                key={booking.$id}
                booking={booking}
                hasLiveLocation={!!tripLocations[booking.$id]}
              />
            ))
          )}
        </View>

        {/* Quick actions */}
        <View style={styles.section}>
          <SectionHeader title="Quick Actions" />
          <View style={styles.actionsGrid}>
            {[
              { icon: '🔍', label: 'Find Transport', route: '/parent/school/search' },
              { icon: '👧', label: 'My Children', route: '/parent/school/children' },
              { icon: '📋', label: 'All Bookings', route: '/parent/school/bookings' },
              { icon: '💬', label: 'Messages', route: '/chat/inbox' },
            ].map(item => (
              <TouchableOpacity
                key={item.label}
                style={styles.actionCard}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.82}
              >
                <Text style={styles.actionIcon}>{item.icon}</Text>
                <Text style={styles.actionLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BookingCard({ booking, hasLiveLocation }: { booking: any; hasLiveLocation: boolean }) {
  // FIX: childIds now stores child IDs — resolve names from children array
  // For backward compatibility we handle both names and IDs gracefully
  const childIds: string[] = JSON.parse(booking.childIds || '[]');
  const tripStatus = booking.trip?.status;
  const isLive = tripStatus === 'started' && hasLiveLocation;

  // Derive child pickup status from trip childrenStatus
  let pickedUp = false;
  let droppedOff = false;
  if (booking.trip?.childrenStatus) {
    const statuses = JSON.parse(booking.trip.childrenStatus);
    const entry = statuses.find((s: any) => s.bookingId === booking.$id);
    if (entry) {
      pickedUp = !!entry.pickupTime;
      droppedOff = !!entry.dropoffTime;
    }
  }

  return (
    <Card
      style={styles.bookingCard}
      onPress={() => router.push({ pathname: '/parent/school/tracking', params: { bookingId: booking.$id } })}
    >
      <View style={styles.bookingTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bookingSchool}>{booking.offering?.schoolName ?? booking.selectedSchool}</Text>
          <Text style={styles.bookingChildren}>
            {childIds.length} child{childIds.length !== 1 ? 'ren' : ''}
          </Text>
        </View>
        {isLive ? <LiveBadge /> : <StatusPill status={tripStatus ?? 'not_started'} />}
      </View>

      <View style={styles.bookingMeta}>
        <Text style={styles.metaText}>📍 {booking.pickupAddress}</Text>
        <Text style={styles.metaText}>⏰ {booking.offering?.operatingHoursMorning ?? 'N/A'}</Text>
      </View>

      {/* Child status strip — only shown once trip started */}
      {tripStatus === 'started' && (
        <View style={styles.childStatusStrip}>
          <View style={[styles.statusChip, { backgroundColor: pickedUp ? COLORS.primaryLight : COLORS.warningLight }]}>
            <Text style={[styles.statusChipText, { color: pickedUp ? COLORS.primaryDark : COLORS.accentDark }]}>
              {pickedUp ? '✓ Picked up' : '⏳ Awaiting pickup'}
            </Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: droppedOff ? COLORS.successLight : '#F1F5F9' }]}>
            <Text style={[styles.statusChipText, { color: droppedOff ? COLORS.success : COLORS.textMuted }]}>
              {droppedOff ? '✓ At school' : '🏫 En route'}
            </Text>
          </View>
        </View>
      )}

      {isLive && (
        <Text style={styles.liveHint}>Tap to track live →</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },

  // Hero
  hero: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.lg, paddingBottom: SPACING.md,
  },
  greeting: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },
  userName: { ...TYPOGRAPHY.h1, marginTop: 2 },
  msgBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', ...SHADOWS.sm },
  msgIcon: { fontSize: 22 },
  badge: { position: 'absolute', top: -2, right: -2, backgroundColor: COLORS.error, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  // Stats
  statsRow: { flexDirection: 'row', backgroundColor: COLORS.surface, marginHorizontal: SPACING.md, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.sm, marginBottom: SPACING.md },
  statCard: { flex: 1, alignItems: 'center' },
  statNumber: { ...TYPOGRAPHY.h2, color: COLORS.primary },
  statLabel: { ...TYPOGRAPHY.caption, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  // Section
  section: { paddingHorizontal: SPACING.md, marginBottom: SPACING.lg },

  // Booking card
  bookingCard: { marginBottom: SPACING.sm },
  bookingTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.xs },
  bookingSchool: { ...TYPOGRAPHY.h4 },
  bookingChildren: { ...TYPOGRAPHY.caption, marginTop: 2, color: COLORS.textMuted },
  bookingMeta: { gap: 4, marginBottom: SPACING.xs },
  metaText: { ...TYPOGRAPHY.body, fontSize: 13 },
  childStatusStrip: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.xs },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  statusChipText: { fontSize: 12, fontWeight: '600' },
  liveHint: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: SPACING.xs },

  // Actions
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  actionCard: {
    width: '47%', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.md, alignItems: 'center', ...SHADOWS.sm,
  },
  actionIcon: { fontSize: 28, marginBottom: SPACING.xs },
  actionLabel: { ...TYPOGRAPHY.captionBold, textAlign: 'center' },
});