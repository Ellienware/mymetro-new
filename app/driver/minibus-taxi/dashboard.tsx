// app/driver/minibus-taxi/dashboard.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router, useFocusEffect } from 'expo-router';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/themes';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '@/lib/appwrite';
import { ScreenHeader, Card, PrimaryButton, LoadingScreen, EmptyState, SectionHeader } from '@/components/ui';
import { getDriverPrimaryVehicle, getVehicleRoutes, getVehicle } from '@/services/saasBridge';

const RADIUS_MD = 12;

export default function MinibusDriverDashboard() {
  const { user } = useUser();
  const [driverRecord, setDriverRecord] = useState<any>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
  try {
    const drivers = await databases.listDocuments(DATABASE_ID, COLLECTIONS.TAXI_DRIVERS, [Query.equal('userId', user!.id)]);
    if (drivers.documents.length === 0) {
      Alert.alert('Not Registered', 'Please complete driver registration first.');
      router.push('/driver/taxi/minibus/register');
      return;
    }
    const driver = drivers.documents[0];
    setDriverRecord(driver);

    let vehicleData;
    try {
      vehicleData = await getVehicle(driver.vehicleId);
    } catch (err: any) {
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.TAXI_DRIVERS, driver.$id);
      Alert.alert(
        'Invalid Vehicle',
        'Your driver profile is corrupted. Please re‑register.',
        [{ text: 'OK', onPress: () => router.replace('/driver/taxi/minibus/register') }]
      );
      return;
    }
    setVehicle(vehicleData);

    const routesData = await getVehicleRoutes(vehicleData.$id);
    // Parse stops for each route
    const parsedRoutes = routesData.map(route => {
      let stopsArray = route.stops;
      if (stopsArray && typeof stopsArray === 'string') {
        try {
          stopsArray = JSON.parse(stopsArray);
        } catch {
          stopsArray = [];
        }
      }
      if (!stopsArray) stopsArray = [];
      
      // Convert to array of strings for display in RouteCard
      if (Array.isArray(stopsArray) && stopsArray.length > 0) {
        // If stops are objects, extract name/address; otherwise keep as string
        const stringStops = stopsArray.map(s => typeof s === 'string' ? s : (s.name || s.address || 'Stop'));
        route.stops = stringStops;
      } else {
        route.stops = [];
      }
      return route;
    });
    setRoutes(parsedRoutes);
  } catch (error: any) {
    console.error(error);
    Alert.alert('Error', error.message || 'Could not load dashboard data');
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

  useFocusEffect(useCallback(() => { loadData(); }, []));

  if (loading) return <LoadingScreen />;
  if (!vehicle) return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Dashboard" onBack={() => router.back()} />
      <EmptyState icon="🚌" title="Vehicle not found" subtitle="Please contact your association to assign a vehicle to your profile." />
    </SafeAreaView>
  );

  const occupancyPct = Math.min(Math.round((vehicle.currentOccupancy ?? 0) / vehicle.capacity * 100), 100);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Minibus Dashboard"
        right={
          <TouchableOpacity onPress={() => { setRefreshing(true); loadData(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ fontSize: 18 }}>🔄</Text>
          </TouchableOpacity>
        }
      />
      <FlatList
        data={routes}
        keyExtractor={item => item.$id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={COLORS.primary} />}
        ListHeaderComponent={() => (
          <>
            <View style={styles.greeting}>
              <Text style={styles.greetingText}>Ready to drive, {user?.firstName ?? 'Driver'} 🚌</Text>
              <Text style={styles.greetingDate}>{new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
            </View>

            <Card style={styles.vehicleCard}>
              <View style={styles.vehicleTop}>
                <View style={[styles.vehicleIconWrap, { borderRadius: RADIUS_MD }]}><Text style={{ fontSize: 28 }}>🚌</Text></View>
                <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                  <Text style={styles.vehiclePlate}>{vehicle.registrationNumber}</Text>
                  <Text style={styles.vehicleMeta}>{vehicle.make} {vehicle.model} · {vehicle.capacity} seats</Text>
                </View>
                <View style={styles.vehicleStatus}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Active</Text>
                </View>
              </View>
              <View style={styles.occupancyLabelRow}>
                <Text style={styles.occupancyLabel}>Current Occupancy</Text>
                <Text style={styles.occupancyValue}>{vehicle.currentOccupancy ?? 0} / {vehicle.capacity}</Text>
              </View>
              <View style={styles.occupancyTrack}>
                <View style={[styles.occupancyFill, { width: `${occupancyPct}%` as any }, occupancyPct > 85 && { backgroundColor: COLORS.error }]} />
              </View>
            </Card>

            <View style={styles.statsRow}>
              {[
                { icon: '🛣️', label: 'Routes', value: routes.length.toString() },
                { icon: '👥', label: 'Capacity', value: vehicle.capacity.toString() },
                { icon: '📍', label: 'Association', value: driverRecord?.associationId ? 'Linked' : '—' },
              ].map(s => (
                <Card key={s.label} style={styles.statCard}>
                  <Text style={styles.statIcon}>{s.icon}</Text>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </Card>
              ))}
            </View>
            <TouchableOpacity style={styles.queueButton} onPress={() => router.push('/driver/minibus-taxi/wallet')}>
              <Text style={styles.queueButtonText}>💰 Wallet</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.queueButton} onPress={() => router.push('/driver/minibus-taxi/join-queue')}>
              <Text style={styles.queueButtonText}>🚏 Join Queue</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.historyLink} onPress={() => router.push('/driver/minibus-taxi/history')}>
              <Text style={styles.historyLinkText}>📋 View Trip History</Text>
              <Text style={styles.historyChevron}>›</Text>
            </TouchableOpacity>
           
            

            <SectionHeader title="Available Routes" action={routes.length > 0 ? `${routes.length} routes` : undefined} />
          </>
        )}
        ListEmptyComponent={<EmptyState icon="🛣️" title="No routes available" subtitle="Your vehicle is not assigned to any active route. Contact your association." />}
        renderItem={({ item }) => (
          <RouteCard route={item} onStart={() => router.push({ pathname: '/driver/minibus-taxi/active-ride', params: { routeId: item.$id } })} />
        )}
      />
    </SafeAreaView>
  );
}

// ✅ RouteCard with full stops list
function RouteCard({ route, onStart }: { route: any; onStart: () => void }) {
  return (
    <Card style={styles.routeCard}>
      <View style={styles.routeTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.routeName}>{route.name}</Text>
          <View style={styles.routePath}>
            <View style={styles.routeStop}>
              <View style={styles.routeStopDot} />
              <Text style={styles.routeStopText}>{route.origin}</Text>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routeStop}>
              <View style={[styles.routeStopDot, { backgroundColor: COLORS.accent }]} />
              <Text style={styles.routeStopText}>{route.destination}</Text>
            </View>
          </View>
        </View>
        <View style={styles.fareBadge}>
          <Text style={styles.fareBadgeText}>R{route.baseFare}</Text>
        </View>
      </View>

      {/* Horizontal metadata */}
      <View style={styles.routeMeta}>
        <View style={styles.routeMetaItem}>
          <Text style={styles.routeMetaIcon}>📏</Text>
          <Text style={styles.routeMetaText}>{route.distance} km</Text>
        </View>
        {route.estimatedMinutes && (
          <View style={styles.routeMetaItem}>
            <Text style={styles.routeMetaIcon}>⏱</Text>
            <Text style={styles.routeMetaText}>~{route.estimatedMinutes} min</Text>
          </View>
        )}
      </View>

      {/* Full stops list (vertical) */}
      {Array.isArray(route.stops) && route.stops.length > 0 && (
        <View style={styles.stopsContainer}>
          <Text style={styles.stopsTitle}>🚏 Stops ({route.stops.length}):</Text>
          {route.stops.map((stop: string, idx: number) => (
            <Text key={idx} style={styles.stopItem}>• {stop}</Text>
          ))}
        </View>
      )}

      <PrimaryButton label="Start Trip" onPress={onStart} />
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  listContent: { paddingHorizontal: SPACING.md, paddingBottom: 48 },
  greeting: { paddingVertical: SPACING.md },
  greetingText: { ...TYPOGRAPHY.h2 },
  greetingDate: { ...TYPOGRAPHY.caption, marginTop: 4 },
  vehicleCard: { marginBottom: SPACING.md },
  vehicleTop: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  vehicleIconWrap: { width: 56, height: 56, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  vehiclePlate: { ...TYPOGRAPHY.h3 },
  vehicleMeta: { ...TYPOGRAPHY.caption, marginTop: 3 },
  vehicleStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.successLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.success },
  statusText: { fontSize: 12, fontWeight: '700', color: COLORS.success },
  occupancyLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  occupancyLabel: { ...TYPOGRAPHY.caption },
  occupancyValue: { ...TYPOGRAPHY.captionBold },
  occupancyTrack: { height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden' },
  occupancyFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4 },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  statCard: { flex: 1, alignItems: 'center', padding: SPACING.sm },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statValue: { ...TYPOGRAPHY.h3, color: COLORS.primary },
  statLabel: { ...TYPOGRAPHY.caption, marginTop: 2, textAlign: 'center' },
  queueButton: { backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: SPACING.md },
  queueButtonText: { color: COLORS.white, fontWeight: 'bold', fontSize: 16 },
  historyLink: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.md, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  historyLinkText: { flex: 1, ...TYPOGRAPHY.bodyBold, color: COLORS.primary, fontSize: 14 },
  historyChevron: { fontSize: 22, color: COLORS.textMuted },
  routeCard: { marginBottom: SPACING.sm },
  routeTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.sm },
  routeName: { ...TYPOGRAPHY.h4, marginBottom: SPACING.xs },
  routePath: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeStop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeStopDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  routeStopText: { ...TYPOGRAPHY.body, fontSize: 13 },
  routeLine: { flex: 1, height: 1.5, backgroundColor: COLORS.border, marginHorizontal: 4, minWidth: 20 },
  fareBadge: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  fareBadgeText: { ...TYPOGRAPHY.bodyBold, color: COLORS.primaryDark, fontSize: 16 },
  routeMeta: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.sm },
  routeMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeMetaIcon: { fontSize: 13 },
  routeMetaText: { ...TYPOGRAPHY.caption },

  // ✅ New styles for stops list
  stopsContainer: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  stopsTitle: {
    ...TYPOGRAPHY.captionBold,
    marginBottom: 4,
  },
  stopItem: {
    ...TYPOGRAPHY.caption,
    marginLeft: SPACING.sm,
    marginBottom: 2,
  },
});