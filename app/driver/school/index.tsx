// app/driver/school/dashboard.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router, useFocusEffect } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '@/lib/appwrite';
import { AppwriteService } from '@/services/appwriteService';
import { Card, SectionHeader, StatusPill, LoadingScreen, EmptyState } from '@/components/ui';

export default function SchoolDriverDashboard() {
  const { user } = useUser();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayTrips, setTodayTrips] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  
  const totalEarnings = todayTrips.reduce((sum, t) => sum + (t.earnings || 0), 0);
  
  const loadData = async () => {
    if (!user) return;
    try {
      const drivers = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_DRIVERS, [
        Query.equal('userId', user!.id),
      ]);
      if (drivers.documents.length === 0) {
        Alert.alert('Not registered', 'Please apply as a school driver first.');
        router.push('/driver/school/apply');
        return;
      }
      const driver = drivers.documents[0];
      setDriverId(driver.$id);
      
      // Load wallet balance
      const wallet = await AppwriteService.getSchoolDriverWallet(driver.$id);
      if (wallet) {
        setWalletBalance(wallet.balance || 0);
      } else {
        // Create wallet if not exists
        const newWallet = await AppwriteService.createSchoolDriverWallet(driver.$id);
        setWalletBalance(newWallet.balance || 0);
      }

      const [vehiclesRes, offeringsRes] = await Promise.all([
        databases.listDocuments(DATABASE_ID, COLLECTIONS.DRIVER_VEHICLES, [
          Query.equal('assignedDriverId', driver.$id),
          Query.equal('verificationStatus', 'approved'),
        ]),
        databases.listDocuments(DATABASE_ID, COLLECTIONS.DRIVER_SCHOOL_OFFERINGS, [
          Query.equal('driverId', driver.$id),
          Query.equal('status', 'active'),
        ]),
      ]);
      setVehicles(vehiclesRes.documents);
      setOfferings(offeringsRes.documents);

      if (offeringsRes.documents.length > 0) {
        const offeringIds = offeringsRes.documents.map(o => o.$id);
        const bookingsRes = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_BOOKINGS, [
          Query.equal('offeringId', offeringIds.length === 1 ? offeringIds[0] : offeringIds),
          Query.equal('status', 'active'),
        ]);
        setUpcomingBookings(bookingsRes.documents);
      }
      const today = new Date().toISOString().split('T')[0];
      const tripsRes = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.SCHOOL_TRIPS,
        [
          Query.equal('date', today),
          Query.equal('offeringId', offeringsRes.documents.map(o => o.$id)),
        ]
      );
      setTodayTrips(tripsRes.documents);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  if (loading) return <LoadingScreen />;

  const totalChildren = upcomingBookings.reduce((acc, b) => acc + JSON.parse(b.childIds || '[]').length, 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={COLORS.primary} />}
      >
        {/* Header */}
        <View style={styles.hero}>
          <View>
            <Text style={styles.greeting}>Welcome back</Text>
            <Text style={styles.driverName}>
              {user?.fullName?.split(' ')[0] ?? 'Driver'} 🚐
            </Text>
          </View>
          {todayTrips.some(t => t.status === 'started') && (
            <Text style={styles.liveText}>🔴 Trip in progress</Text>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Vehicles', value: vehicles.length, icon: '🚐' },
            { label: 'Trips', value: offerings.length, icon: '🗺️' },
            { label: 'Children', value: totalChildren, icon: '👧' },
            { label: 'Earnings', value: `R${totalEarnings}`, icon: '💰' }
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statIcon}>{s.icon}</Text>
              <Text style={styles.statNum}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick actions */}
        <View style={styles.section}>
          <SectionHeader title="Quick Actions" />
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/driver/school/register')}>
              <Text style={styles.actionIcon}>🚐</Text>
              <Text style={styles.actionLabel}>Add Vehicle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/driver/school/create-offering')}>
              <Text style={styles.actionIcon}>➕</Text>
              <Text style={styles.actionLabel}>New Route</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/driver/school/passengers')}>
              <Text style={styles.actionIcon}>👥</Text>
              <Text style={styles.actionLabel}>Passengers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/driver/school/wallet')}>
              <Text style={styles.actionIcon}>💰</Text>
              <Text style={styles.actionLabel}>Wallet</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Today's Trips */}
        <View style={styles.section}>
          <SectionHeader title="Today's Trips" />
          {offerings.length === 0 ? (
            <EmptyState
              icon="🚐"
              title="No trips today"
              subtitle="Create a route to start trips"
            />
          ) : (
            offerings.map(offering => {
              const trip = todayTrips.find(t => t.offeringId === offering.$id);
              return (
                <Card key={offering.$id} style={styles.tripCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tripSchool}>{offering.schoolName}</Text>
                    <Text style={styles.tripSub}>📍 {offering.baseAddress}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {trip?.status === 'started' && <StatusPill status="active" />}
                    {trip?.status === 'completed' && <StatusPill status="completed" />}
                    {!trip && <StatusPill status="pending" />}
                  </View>
                  <TouchableOpacity
                    style={styles.tripBtn}
                    onPress={() =>
                      router.push({
                        pathname: '/driver/school/active-trip',
                        params: { offeringId: offering.$id },
                      })
                    }
                  >
                    <Text style={styles.tripBtnText}>
                      {trip?.status === 'started'
                        ? 'Continue Trip'
                        : trip?.status === 'completed'
                        ? 'View Trip'
                        : 'Start Trip'}
                    </Text>
                  </TouchableOpacity>
                </Card>
              );
            })
          )}
        </View>

        {/* Active routes */}
        <View style={styles.section}>
          <SectionHeader title="My Trips" />
          {offerings.length === 0 ? (
            <EmptyState
              icon="🗺️"
              title="No active routes"
              subtitle="Create a route for parents to discover you"
              action="Create Route"
              onAction={() => router.push('/driver/school/create-offering')}
            />
          ) : (
            offerings.map(offering => (
              <Card
                key={offering.$id}
                style={styles.offeringCard}
                onPress={() => router.push({ pathname: '/driver/school/active-trip', params: { offeringId: offering.$id } })}
              >
                <View style={styles.offeringTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.offeringSchool}>{offering.schoolName}</Text>
                    <Text style={styles.offeringBase}>📍 {offering.baseAddress}</Text>
                  </View>
                  <View style={styles.offeringSeats}>
                    <Text style={styles.seatsNum}>{offering.availableSeats}</Text>
                    <Text style={styles.seatsLabel}>seats</Text>
                  </View>
                </View>
                <View style={styles.offeringPrices}>
                  {offering.weeklyPrice && (
                    <View style={styles.pricePill}>
                      <Text style={styles.pricePillText}>Weekly R{offering.weeklyPrice}</Text>
                    </View>
                  )}
                  {offering.monthlyPrice && (
                    <View style={[styles.pricePill, { backgroundColor: COLORS.accentLight }]}>
                      <Text style={[styles.pricePillText, { color: COLORS.accentDark }]}>Monthly R{offering.monthlyPrice}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.offeringCta}>Tap to manage today's trip →</Text>
              </Card>
            ))
          )}
        </View>

        {/* Vehicles */}
        <View style={styles.section}>
          <SectionHeader title="My Vehicles" />
          {vehicles.length === 0 ? (
            <EmptyState
              icon="🚐"
              title="No approved vehicles"
              subtitle="Register a vehicle to start offering trips"
              action="Register Vehicle"
              onAction={() => router.push('/driver/school/register')}
            />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {vehicles.map(v => (
                <View key={v.$id} style={styles.vehicleCard}>
                  <Text style={styles.vehicleIcon}>🚐</Text>
                  <Text style={styles.vehiclePlate}>{v.plateNumber}</Text>
                  <Text style={styles.vehicleInfo}>{v.make} {v.model}</Text>
                  <Text style={styles.vehicleSeats}>{v.capacity} seats</Text>
                  <StatusPill status={v.verificationStatus} />
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },

  hero: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.lg, paddingBottom: SPACING.md,
  },
  greeting: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  driverName: { ...TYPOGRAPHY.h1, marginTop: 2 },
  passengersBtn: {
    backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2, borderRadius: RADIUS.full,
  },
  passengersBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  statsRow: {
    flexDirection: 'row', marginHorizontal: SPACING.md, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.sm, marginBottom: SPACING.md,
  },
  statCard: { flex: 1, alignItems: 'center', gap: 2 },
  statIcon: { fontSize: 20 },
  statNum: { ...TYPOGRAPHY.h2, color: COLORS.primary },
  statLabel: { ...TYPOGRAPHY.caption },

  section: { paddingHorizontal: SPACING.md, marginBottom: SPACING.lg },

  actionsRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  actionCard: {
    flex: 1, minWidth: '45%', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.md, alignItems: 'center', ...SHADOWS.sm, gap: SPACING.xs,
  },
  actionIcon: { fontSize: 26 },
  actionLabel: { ...TYPOGRAPHY.captionBold, textAlign: 'center' },

  offeringCard: {},
  offeringTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.xs },
  offeringSchool: { ...TYPOGRAPHY.h4 },
  offeringBase: { ...TYPOGRAPHY.caption, marginTop: 3 },
  offeringSeats: { alignItems: 'center', backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 6 },
  seatsNum: { fontSize: 20, fontWeight: '800', color: COLORS.primaryDark },
  seatsLabel: { fontSize: 10, color: COLORS.primaryDark },
  offeringPrices: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.xs },
  pricePill: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  pricePillText: { fontSize: 12, fontWeight: '600', color: COLORS.primaryDark },
  offeringCta: { ...TYPOGRAPHY.caption, color: COLORS.primary, fontWeight: '600', marginTop: 4 },

  vehicleCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    marginRight: SPACING.sm, width: 140, alignItems: 'center', gap: SPACING.xs, ...SHADOWS.sm,
  },
  vehicleIcon: { fontSize: 32 },
  vehiclePlate: { ...TYPOGRAPHY.bodyBold, textAlign: 'center' },
  vehicleInfo: { ...TYPOGRAPHY.caption, textAlign: 'center' },
  vehicleSeats: { ...TYPOGRAPHY.caption, color: COLORS.primary, fontWeight: '600' },
  tripCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    ...SHADOWS.sm,
  },
  summaryCard: {
    padding: SPACING.md,
  },
  summaryText: {
    fontSize: 14,
    marginBottom: 6,
  },
  tripSchool: {
    ...TYPOGRAPHY.h4,
  },
  tripSub: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  tripBtn: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primary,
    padding: 10,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  tripBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  liveText: {
    marginTop: 4,
    fontSize: 12,
    color: 'red',
    fontWeight: '600',
  },
});