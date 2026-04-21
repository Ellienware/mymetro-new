// app/driver/taxi/minibus/join-queue.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, Alert,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '@/lib/appwrite';
import { getVehicleRoutes, getRanks, getRankRoutes, createQueueEntry, getVehicle } from '@/services/saasBridge';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader, Card, PrimaryButton, LoadingScreen, EmptyState } from '@/components/ui';
import { isPointInGeofence } from '@/utils/geofence';

type JoinStep = 'rank' | 'route' | 'confirm';

export default function JoinQueueScreen() {
  const { user } = useUser();
  const [driver, setDriver] = useState<any>(null);
  const [ranks, setRanks] = useState<any[]>([]);
  const [selectedRank, setSelectedRank] = useState<any>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [step, setStep] = useState<JoinStep>('rank');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
  try {
    const drivers = await databases.listDocuments(DATABASE_ID, COLLECTIONS.TAXI_DRIVERS, [
      Query.equal('userId', user!.id),
    ]);
    if (!drivers.documents.length) throw new Error('Driver not registered');
    const driverData = drivers.documents[0];

    // ✅ Fetch vehicle to get registration number
    const vehicle = await getVehicle(driverData.vehicleId);
    const registrationNumber = vehicle.registrationNumber || vehicle.plateNumber || vehicle.regNumber;

    setDriver({
      ...driverData,
      vehicleReg: registrationNumber, // store it for later use
    });

    const vehicleRoutes = await getVehicleRoutes(driverData.vehicleId);
    if (!vehicleRoutes.length) {
      setRanks([]);
      return;
    }

    if (!driverData.associationId) {
      console.warn('Driver record missing associationId');
      setRanks([]);
      return;
    }
    const ranksData = await getRanks(driverData.associationId);
    setRanks(ranksData);
  } catch (e) {
    console.error(e);
    Alert.alert('Error', 'Could not load ranks');
  } finally {
    setLoading(false);
  }
};

  const selectRank = async (rank: any) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Location access required to join queue.'); return; }
    const loc = await Location.getCurrentPositionAsync({});
    const driverPoint = { lat: loc.coords.latitude, lng: loc.coords.longitude };

    if (rank.geofenceRadius) {
      const rankLocation = JSON.parse(rank.location);
      if (!isPointInGeofence(driverPoint, { coordinates: [rankLocation], radius: rank.geofenceRadius })) {
        Alert.alert('Outside Rank Area', `You must be within ${rank.geofenceRadius}m of ${rank.name} to join.`);
        return;
      }
    }

    setSelectedRank(rank);
    // Get routes for this rank (via bridge)
    const routesData = await getRankRoutes(rank.$id);
    setRoutes(routesData);
    setStep('route');
  };

  const joinQueue = async () => {
  if (!selectedRank || !selectedRoute) return;
  setJoining(true);
  try {
    console.log('Joining queue with:', {
      tenantId: selectedRank.tenantId,
      rankId: selectedRank.$id,
      routeId: selectedRoute.$id,
      driverId: driver.$id,
      vehicleId: driver.vehicleId,
      vehicleReg: driver.vehicleReg
    });
    await createQueueEntry(
      selectedRank.tenantId,
      selectedRank.$id,
      selectedRoute.$id,
      driver.$id,
      driver.vehicleId,
      driver.vehicleReg
    );
    router.push({
      pathname: '/driver/minibus-taxi/queue-status',
      params: { rankId: selectedRank.$id, routeId: selectedRoute.$id },
    });
  } catch (err: any) {
    console.error('Queue join error:', err);
    Alert.alert('Error', err?.message || 'Failed to join queue. Please try again.');
  } finally {
    setJoining(false);
  }
};

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Join Queue"
        onBack={() => {
          if (step === 'route') { setStep('rank'); setSelectedRank(null); }
          else if (step === 'confirm') { setStep('route'); setSelectedRoute(null); }
          else router.back();
        }}
      />

      {/* Step indicator */}
      <View style={styles.stepBar}>
        {(['rank', 'route', 'confirm'] as JoinStep[]).map((s, idx) => (
          <View key={s} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.stepDot, step === s && styles.stepDotActive, (step === 'route' && idx < 1) || (step === 'confirm' && idx < 2) ? styles.stepDotDone : null]}>
              <Text style={[styles.stepDotText, (step === s || (step === 'route' && idx < 1) || (step === 'confirm' && idx < 2)) && styles.stepDotTextActive]}>
                {idx + 1}
              </Text>
            </View>
            {idx < 2 && <View style={styles.stepLine} />}
          </View>
        ))}
      </View>

      {/* Rank selection */}
      {step === 'rank' && (
        <FlatList
          data={ranks}
          keyExtractor={item => item.$id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={() => <Text style={styles.stepTitle}>Select your rank</Text>}
          ListEmptyComponent={<EmptyState icon="🚏" title="No ranks available" subtitle="No active ranks found for your assigned routes." />}
          renderItem={({ item }) => (
            <Card style={styles.rankCard} onPress={() => selectRank(item)}>
              <View style={styles.rankTop}>
                <View style={styles.rankIcon}><Text style={{ fontSize: 24 }}>🚏</Text></View>
                <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                  <Text style={styles.rankName}>{item.name}</Text>
                  {item.geofenceRadius && <Text style={styles.rankDetail}>📏 Must be within {item.geofenceRadius}m</Text>}
                </View>
                <Text style={styles.rankArrow}>›</Text>
              </View>
            </Card>
          )}
        />
      )}

      {/* Route selection */}
      {step === 'route' && (
        <FlatList
          data={routes}
          keyExtractor={item => item.$id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={() => (
            <View>
              <Text style={styles.stepTitle}>Select route at {selectedRank?.name}</Text>
            </View>
          )}
          ListEmptyComponent={<EmptyState icon="🛣️" title="No routes at this rank" subtitle="No active routes found for this rank." />}
          renderItem={({ item }) => (
            <Card style={styles.routeCard} onPress={() => { setSelectedRoute(item); setStep('confirm'); }}>
              <Text style={TYPOGRAPHY.h4}>{item.name}</Text>
              <View style={styles.routePath}>
                <View style={styles.dot} /><Text style={[TYPOGRAPHY.body, { fontSize: 13 }]}>{item.origin}</Text>
                <View style={styles.routeLine} />
                <View style={[styles.dot, { backgroundColor: COLORS.accent }]} /><Text style={[TYPOGRAPHY.body, { fontSize: 13 }]}>{item.destination}</Text>
              </View>
              <Text style={[TYPOGRAPHY.caption, { marginTop: SPACING.xs }]}>💰 R{item.baseFare} · 📏 {item.distance} km</Text>
            </Card>
          )}
        />
      )}

      {/* Confirmation */}
      {step === 'confirm' && selectedRank && selectedRoute && (
        <View style={styles.confirmContent}>
          <View style={styles.confirmHero}>
            <Text style={styles.confirmEmoji}>🚏</Text>
            <Text style={styles.confirmTitle}>Ready to join?</Text>
            <Text style={styles.confirmSub}>Confirm your queue entry details below.</Text>
          </View>
          <Card style={styles.confirmCard}>
            {[
              { label: 'Rank', value: selectedRank.name },
              { label: 'Route', value: selectedRoute.name },
              { label: 'From', value: selectedRoute.origin },
              { label: 'To', value: selectedRoute.destination },
              { label: 'Fare', value: `R${selectedRoute.baseFare}` },
            ].map((row, idx, arr) => (
              <View key={row.label}>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>{row.label}</Text>
                  <Text style={styles.confirmValue}>{row.value}</Text>
                </View>
                {idx < arr.length - 1 && <View style={styles.confirmDivider} />}
              </View>
            ))}
          </Card>
          <PrimaryButton label="Join Queue" onPress={joinQueue} loading={joining} style={styles.joinBtn} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  stepBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: COLORS.primary },
  stepDotDone: { backgroundColor: COLORS.success },
  stepDotText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  stepDotTextActive: { color: '#fff' },
  stepLine: { width: 32, height: 2, backgroundColor: COLORS.border, marginHorizontal: 4 },
  list: { padding: SPACING.md, paddingBottom: 48 },
  stepTitle: { ...TYPOGRAPHY.h3, marginBottom: SPACING.md },
  rankCard: { marginBottom: SPACING.sm },
  rankTop: { flexDirection: 'row', alignItems: 'center' },
  rankIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  rankName: { ...TYPOGRAPHY.h4 },
  rankDetail: { ...TYPOGRAPHY.caption, marginTop: 2 },
  rankArrow: { fontSize: 22, color: COLORS.textMuted },
  routeCard: { marginBottom: SPACING.sm },
  routePath: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACING.xs },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  routeLine: { flex: 1, height: 1.5, backgroundColor: COLORS.border, marginHorizontal: 4, minWidth: 16 },
  confirmContent: { flex: 1, padding: SPACING.md },
  confirmHero: { alignItems: 'center', paddingVertical: SPACING.lg },
  confirmEmoji: { fontSize: 52, marginBottom: SPACING.sm },
  confirmTitle: { ...TYPOGRAPHY.h2, marginBottom: SPACING.xs },
  confirmSub: { ...TYPOGRAPHY.body, color: COLORS.textMuted, textAlign: 'center' },
  confirmCard: { marginBottom: SPACING.md, padding: 0, overflow: 'hidden' },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', padding: SPACING.md },
  confirmLabel: { ...TYPOGRAPHY.caption },
  confirmValue: { ...TYPOGRAPHY.bodyBold },
  confirmDivider: { height: 1, backgroundColor: COLORS.border },
  joinBtn: {},
});