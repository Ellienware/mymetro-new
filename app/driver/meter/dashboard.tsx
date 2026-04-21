// app/driver/meter/dashboard.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  FlatList, Alert, Switch,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '@/lib/appwrite';
import { updateDriverLocation, setDriverOnline, acceptRide } from '@/services/meterApi';
import { AppwriteService } from '@/services/appwriteService';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader, Card, PrimaryButton, LoadingScreen, EmptyState, LiveBadge } from '@/components/ui';

export default function MeterDriverDashboard() {
  const { user } = useUser();
  const [driver, setDriver] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const locationInterval = useRef<any>(null);

  const loadDriver = async () => {
    try {
      const drivers = await databases.listDocuments(DATABASE_ID, COLLECTIONS.METER_DRIVERS, [
        Query.equal('userId', user!.id),
      ]);
      if (drivers.documents.length === 0) {
        Alert.alert('Not registered', 'Please register as a meter taxi driver first.');
        router.push('/driver/meter/register' as any);
        return;
      }
      const driverData = drivers.documents[0];
      setDriver(driverData);
      setIsOnline(driverData.isOnline);
      if (driverData.isOnline) startLocationUpdates(driverData.$id);

      // Load wallet balance
      const wallet = await AppwriteService.getMeterDriverWallet(driverData.$id);
      setWalletBalance(wallet?.balance || 0);

      const requests = await databases.listDocuments(DATABASE_ID, COLLECTIONS.METER_RIDE_REQUESTS, [
        Query.equal('status', 'pending'),
      ]);
      setPendingRequests(requests.documents);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    loadDriver();
    return () => stopLocationUpdates();
  }, []));

  const startLocationUpdates = async (driverId: string) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    locationInterval.current = setInterval(async () => {
      const loc = await Location.getCurrentPositionAsync({});
      await updateDriverLocation(driverId, loc.coords.latitude, loc.coords.longitude);
    }, 5000);
  };

  const stopLocationUpdates = () => {
    if (locationInterval.current) clearInterval(locationInterval.current);
  };

  const toggleOnline = async (value: boolean) => {
    if (!driver) return;
    setIsOnline(value);
    await setDriverOnline(driver.$id, value);
    if (value) startLocationUpdates(driver.$id);
    else stopLocationUpdates();
  };

  const acceptRequest = async (request: any) => {
    setAccepting(request.$id);
    try {
      const result = await acceptRide(request.$id, driver.$id);
      router.push({ pathname: '/driver/meter/active-ride', params: { rideId: result.rideId } });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setAccepting(null);
    }
  };

  if (loading) return <LoadingScreen />;
  if (!driver) return null;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Meter Taxi"
        right={
          <TouchableOpacity onPress={loadDriver} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ fontSize: 18 }}>🔄</Text>
          </TouchableOpacity>
        }
      />

      <FlatList
        data={pendingRequests}
        keyExtractor={item => item.$id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <>
            {/* Greeting */}
            <View style={styles.greeting}>
              <Text style={styles.greetingText}>{greeting()}, {user?.firstName ?? 'Driver'} 🚖</Text>
              <Text style={styles.greetingDate}>{new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
            </View>

            {/* Online toggle card */}
            <Card style={StyleSheet.flatten([styles.onlineCard, isOnline && styles.onlineCardActive])}>
              <View style={styles.onlineLeft}>
                <View style={[styles.onlineDot, isOnline && styles.onlineDotActive]} />
                <View>
                  <Text style={styles.onlineTitle}>{isOnline ? 'You\'re online' : 'You\'re offline'}</Text>
                  <Text style={styles.onlineSub}>
                    {isOnline ? 'Accepting ride requests nearby' : 'Toggle to start accepting rides'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isOnline}
                onValueChange={toggleOnline}
                trackColor={{ false: COLORS.border, true: COLORS.success }}
                thumbColor="#fff"
              />
            </Card>

            {/* Driver stats including wallet */}
            <View style={styles.statsRow}>
              {[
                { icon: '⭐', label: 'Rating', value: driver.rating > 0 ? driver.rating.toFixed(1) : '—' },
                { icon: '🚗', label: 'Total rides', value: (driver.totalRatings ?? 0).toString() },
                { icon: '🚘', label: 'Vehicle', value: driver.vehicleReg ?? '—' },
                { icon: '💰', label: 'Wallet', value: `R${walletBalance.toFixed(0)}` },
              ].map(s => (
                <Card key={s.label} style={styles.statCard}>
                  <Text style={styles.statIcon}>{s.icon}</Text>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </Card>
              ))}
            </View>

            {/* Quick actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/driver/meter/wallet')}>
                <Text style={styles.actionIcon}>💰</Text>
                <Text style={styles.actionLabel}>Wallet</Text>
              </TouchableOpacity>
            </View>

            {/* Requests header */}
            <View style={styles.requestsHeader}>
              <Text style={styles.requestsTitle}>Incoming Requests</Text>
              {isOnline && <LiveBadge />}
            </View>

            {!isOnline && (
              <Card style={styles.offlineTip}>
                <Text style={styles.offlineTipIcon}>💡</Text>
                <Text style={styles.offlineTipText}>Go online to start receiving ride requests from nearby passengers.</Text>
              </Card>
            )}
          </>
        )}
        ListEmptyComponent={
          isOnline ? (
            <EmptyState icon="🔍" title="No requests yet" subtitle="Ride requests from nearby passengers will appear here." />
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.requestCard}>
            {/* Route */}
            <View style={styles.requestRoute}>
              <View style={styles.routeStop}>
                <View style={styles.routeDot} />
                <Text style={styles.routeAddress} numberOfLines={1}>{item.pickupAddress}</Text>
              </View>
              <View style={styles.routeConnector} />
              <View style={styles.routeStop}>
                <View style={[styles.routeDot, { backgroundColor: COLORS.accent }]} />
                <Text style={styles.routeAddress} numberOfLines={1}>{item.dropoffAddress}</Text>
              </View>
            </View>

            {/* Fare + meta */}
            <View style={styles.requestMeta}>
              <View style={styles.fareBadge}>
                <Text style={styles.fareAmount}>R{item.estimatedFare}</Text>
                <Text style={styles.fareLabel}>est. fare</Text>
              </View>
              {item.distanceKm && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaIcon}>📏</Text>
                  <Text style={styles.metaText}>{item.distanceKm} km</Text>
                </View>
              )}
              {item.estimatedMinutes && (
                <View style={styles.metaItem}>
                  <Text style={styles.metaIcon}>⏱</Text>
                  <Text style={styles.metaText}>~{item.estimatedMinutes} min</Text>
                </View>
              )}
            </View>

            <PrimaryButton
              label={accepting === item.$id ? 'Accepting...' : 'Accept Ride'}
              onPress={() => acceptRequest(item)}
              loading={accepting === item.$id}
            />
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  listContent: { paddingHorizontal: SPACING.md, paddingBottom: 48 },

  greeting: { paddingVertical: SPACING.md },
  greetingText: { ...TYPOGRAPHY.h2 },
  greetingDate: { ...TYPOGRAPHY.caption, marginTop: 4 },

  onlineCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  onlineCardActive: { borderWidth: 1.5, borderColor: COLORS.success },
  onlineLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  onlineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.border },
  onlineDotActive: { backgroundColor: COLORS.success },
  onlineTitle: { ...TYPOGRAPHY.bodyBold },
  onlineSub: { ...TYPOGRAPHY.caption, marginTop: 2 },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  statCard: { flex: 1, minWidth: '45%', alignItems: 'center', padding: SPACING.sm },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statValue: { ...TYPOGRAPHY.h3, color: COLORS.primary, fontSize: 16 },
  statLabel: { ...TYPOGRAPHY.caption, marginTop: 2, textAlign: 'center' },

  actionsRow: { marginBottom: SPACING.md },
  actionCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', ...SHADOWS.sm },
  actionIcon: { fontSize: 28, marginBottom: 4 },
  actionLabel: { ...TYPOGRAPHY.captionBold },

  requestsHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  requestsTitle: { ...TYPOGRAPHY.h3, flex: 1 },

  offlineTip: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs, backgroundColor: COLORS.accentLight },
  offlineTipIcon: { fontSize: 16 },
  offlineTipText: { ...TYPOGRAPHY.body, fontSize: 13, flex: 1, lineHeight: 20 },

  requestCard: { marginBottom: SPACING.sm },
  requestRoute: { marginBottom: SPACING.sm },
  routeStop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 4 },
  routeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  routeAddress: { ...TYPOGRAPHY.body, fontSize: 14, flex: 1 },
  routeConnector: { width: 2, height: 16, backgroundColor: COLORS.border, marginLeft: 4, marginVertical: 2 },
  requestMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm },
  fareBadge: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, alignItems: 'center' },
  fareAmount: { ...TYPOGRAPHY.bodyBold, color: COLORS.primaryDark, fontSize: 16 },
  fareLabel: { fontSize: 10, color: COLORS.primaryDark },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaIcon: { fontSize: 13 },
  metaText: { ...TYPOGRAPHY.caption },
});