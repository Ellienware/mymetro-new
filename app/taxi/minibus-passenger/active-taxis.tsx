// app/taxi/shared/active-taxis.tsx
// app/taxi/active-taxis.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  Alert, ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import { databases, DATABASE_ID, COLLECTIONS, Query, ID } from '@/lib/appwrite';
import { getVehicle } from '@/services/saasBridge';
import { useUser } from '@clerk/clerk-expo';
import * as Location from 'expo-location';
import { AppwriteService } from '@/services/appwriteService';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader, Card, PrimaryButton, LoadingScreen, EmptyState, LiveBadge } from '@/components/ui';
import { useTicketPurchase } from '@/hooks/useTicketPurchase';

interface RouteStop {
  id?: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  fareFromOrigin: number;
}

export default function ActiveTaxisScreen() {
  const params = useLocalSearchParams();
  const routeId = params.routeId as string;
  const routeName = params.routeName as string;
  const boardingStopJson = params.boardingStop as string;
  const expectedFare = params.expectedFare as string;

  console.log('ActiveTaxisScreen params:', { routeId, routeName, boardingStopJson, expectedFare });

  const { user } = useUser();
  const [taxis, setTaxis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaxi, setSelectedTaxi] = useState<any>(null);
  const [flagging, setFlagging] = useState(false);
  const [passengerLocation, setPassengerLocation] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [boardingStop, setBoardingStop] = useState<RouteStop | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingFlag, setPendingFlag] = useState<{ taxi: any; fare: number } | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const { purchaseWithLoanSupport } = useTicketPurchase(); 

  // Ensure routeId exists
  if (!routeId) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Error" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: COLORS.error }}>Invalid route information. Please go back and try again.</Text>
        </View>
      </SafeAreaView>
    );
  }

  useEffect(() => {
    if (boardingStopJson) {
      try {
        const parsed = JSON.parse(boardingStopJson);
        setBoardingStop(parsed);
      } catch (e) {
        console.error('Failed to parse boardingStopJson', e);
      }
    }
    loadActiveTaxis();
    getPassengerLocation();
  }, []);

  const getPassengerLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({});
      setPassengerLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    }
  };

  const loadActiveTaxis = async () => {
    try {
      const trips = await databases.listDocuments(DATABASE_ID, COLLECTIONS.TAXI_TRIPS, [
        Query.equal('routeId', routeId),
        Query.equal('status', 'active'),
      ]);
      const enriched = await Promise.all(
        trips.documents.map(async trip => {
          const vehicle = await getVehicle(trip.vehicleId).catch(() => null);
          return { ...trip, vehicle };
        })
      );
      setTaxis(enriched);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not load active taxis');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const flagDriver = async () => {
    if (!selectedTaxi || !passengerLocation) {
      Alert.alert('Location needed', 'Could not determine your location. Please try again.');
      return;
    }
    setFlagging(true);
    try {
      const fare = parseFloat(expectedFare || '0');
      const fareCents = Math.round(fare * 100);

      const wallet = await AppwriteService.getUserWallet(user!.id);
      const currentBalance = wallet?.balance || 0;

      let finalFare = fareCents;
      let loanTaken = false;

      if (currentBalance < fareCents) {
        const shortfall = fareCents - currentBalance;
        const eligibility = await AppwriteService.checkLoanEligibility(user!.id);
        if (!eligibility.eligible) {
          Alert.alert('Insufficient Funds', `You need R${(fareCents / 100).toFixed(2)} but only have R${(currentBalance / 100).toFixed(2)}. You are not eligible for a loan.`);
          setFlagging(false);
          return;
        }

        const userConfirmed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Insufficient Balance',
            `You need R${(fareCents / 100).toFixed(2)} but only have R${(currentBalance / 100).toFixed(2)}. Would you like to take a loan of R${shortfall / 100} to cover the trip? (Loan terms: 0% interest, repay within 7 days)`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Take Loan', onPress: () => resolve(true) },
            ]
          );
        });

        if (!userConfirmed) {
          setFlagging(false);
          return;
        }

        await AppwriteService.issueLoanAndCreditWallet(user!.id, shortfall, `Taxi fare top-up for route ${routeName}`);
        finalFare = fareCents;
        loanTaken = true;
      }

      const hold = await AppwriteService.placeHold(user!.id, selectedTaxi.driverId, finalFare);

      const address = await Location.reverseGeocodeAsync(passengerLocation);
      const locationText = address[0]?.formattedAddress
        ?? `${passengerLocation.latitude.toFixed(5)}, ${passengerLocation.longitude.toFixed(5)}`;
      const flagData = {
        passengerId: user!.id,
        driverId: selectedTaxi.driverId,
        tripId: selectedTaxi.$id,
        holdId: hold.$id,
        passengerLocation: JSON.stringify({ ...passengerLocation, address: locationText }),
        status: 'pending',
        requestedBoardingStop: JSON.stringify(boardingStop),
        expectedFare: fare,
        loanUsed: loanTaken,
        createdAt: new Date().toISOString(),
      };
      await databases.createDocument(DATABASE_ID, 'FLAG_REQUESTS', ID.unique(), flagData);
      setSelectedTaxi(null);
      Alert.alert('Request sent! 🙌', loanTaken 
        ? 'Driver notified. A loan has been added to your wallet to cover the fare. Repay within 7 days.' 
        : 'Driver notified. Your wallet has a temporary hold for the fare.');
    } catch (error: any) {
      if (error.message?.includes('Insufficient')) {
        Alert.alert('Insufficient Balance', 'Please top up your wallet or contact support.');
      } else {
        console.error(error);
        Alert.alert('Error', 'Could not send flag request. Please try again.');
      }
    } finally {
      setFlagging(false);
    }
  };

  const getTaxiCoords = (taxi: any) => {
    try { 
      const loc = JSON.parse(taxi.currentLocation);
      if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
        return loc;
      }
      return { latitude: -26.2041, longitude: 28.0473 };
    } catch { 
      return { latitude: -26.2041, longitude: 28.0473 }; 
    }
  };

  const availableSeats = (taxi: any) => (taxi.vehicle?.capacity ?? 0) - (taxi.passengerCount ?? 0);

  if (loading) return <LoadingScreen />;

  // Map region center (use passenger location or default)
  const mapRegion = passengerLocation ? {
    latitude: passengerLocation.latitude,
    longitude: passengerLocation.longitude,
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  } : undefined;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title={`Taxis on ${routeName || 'Route'}`} onBack={() => router.back()} right={
        <View style={styles.headerRight}>
          <View style={[styles.countBadge, { backgroundColor: taxis.length > 0 ? COLORS.successLight : COLORS.border }]}>
            <Text style={[styles.countText, { color: taxis.length > 0 ? COLORS.success : COLORS.textMuted }]}>{taxis.length} active</Text>
          </View>
        </View>
      } />

      {boardingStop && expectedFare && (
        <View style={styles.fareBanner}>
          <Text style={styles.fareBannerText}>🚏 Board at {boardingStop.name || boardingStop.address} · Fare: R{parseFloat(expectedFare).toFixed(2)} (hold placed)</Text>
        </View>
      )}

      <MapView 
        style={styles.map} 
        region={mapRegion}
        showsUserLocation={true}
      >
        {taxis.map(taxi => {
          const coords = getTaxiCoords(taxi);
          const seats = availableSeats(taxi);
          return (
            <Marker key={taxi.$id} coordinate={coords} onPress={() => setSelectedTaxi(taxi)}>
              <View style={[styles.taxiMarker, seats === 0 && styles.taxiMarkerFull]}>
                <Text style={{ fontSize: 18 }}>🚌</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {taxis.length === 0 && (
        <View style={styles.emptyOverlay}>
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>No active taxis</Text>
            <Text style={styles.emptySub}>No taxis are currently running on this route. Check back soon.</Text>
            <PrimaryButton label="Refresh" onPress={() => { setRefreshing(true); loadActiveTaxis(); }} loading={refreshing} variant="secondary" style={{ marginTop: SPACING.sm }} />
          </Card>
        </View>
      )}

      {selectedTaxi && (
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTop}>
            <View style={styles.taxiIconWrap}><Text style={{ fontSize: 28 }}>🚌</Text></View>
            <View style={{ flex: 1, marginLeft: SPACING.sm }}>
              <Text style={styles.sheetTitle}>Taxi on {routeName}</Text>
              <Text style={styles.sheetReg}>{selectedTaxi.vehicle?.registrationNumber ?? 'Unknown reg'}</Text>
            </View>
            <LiveBadge />
          </View>
          <View style={styles.sheetStats}>
            <View style={styles.sheetStat}>
              <Text style={styles.sheetStatValue}>R{boardingStop ? parseFloat(expectedFare).toFixed(2) : (selectedTaxi.vehicle?.baseFare ?? '—')}</Text>
              <Text style={styles.sheetStatLabel}>Your fare</Text>
            </View>
            <View style={styles.sheetStatDivider} />
            <View style={styles.sheetStat}>
              <Text style={[styles.sheetStatValue, availableSeats(selectedTaxi) === 0 && { color: COLORS.error }]}>{availableSeats(selectedTaxi)}</Text>
              <Text style={styles.sheetStatLabel}>Seats left</Text>
            </View>
            <View style={styles.sheetStatDivider} />
            <View style={styles.sheetStat}>
              <Text style={styles.sheetStatValue}>{selectedTaxi.passengerCount ?? 0}</Text>
              <Text style={styles.sheetStatLabel}>On board</Text>
            </View>
          </View>
          {availableSeats(selectedTaxi) === 0 && <View style={styles.fullBanner}><Text style={styles.fullBannerText}>⚠️ This taxi is full</Text></View>}
          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.dismissBtn} onPress={() => setSelectedTaxi(null)}><Text style={styles.dismissText}>Dismiss</Text></TouchableOpacity>
            <PrimaryButton label={flagging ? 'Placing hold...' : '🙋 Flag Driver'} onPress={flagDriver} loading={flagging} disabled={availableSeats(selectedTaxi) === 0} style={{ flex: 2 }} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  map: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  countText: { fontSize: 12, fontWeight: '700' },
  fareBanner: { backgroundColor: COLORS.primaryLight, padding: SPACING.sm, alignItems: 'center' },
  fareBannerText: { fontSize: 13, fontWeight: '600', color: COLORS.primaryDark },
  taxiMarker: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 4, borderWidth: 2, borderColor: COLORS.primary, ...SHADOWS.sm },
  taxiMarkerFull: { borderColor: COLORS.error, opacity: 0.6 },
  emptyOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: SPACING.md },
  emptyCard: { alignItems: 'center', padding: SPACING.lg },
  emptyIcon: { fontSize: 40, marginBottom: SPACING.sm },
  emptyTitle: { ...TYPOGRAPHY.h3, marginBottom: 4 },
  emptySub: { ...TYPOGRAPHY.body, textAlign: 'center', color: COLORS.textMuted },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: 36, ...SHADOWS.lg },
  sheetHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  sheetTop: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  taxiIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { ...TYPOGRAPHY.h4 },
  sheetReg: { ...TYPOGRAPHY.caption, marginTop: 2 },
  sheetStats: { flexDirection: 'row', backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm },
  sheetStat: { flex: 1, alignItems: 'center' },
  sheetStatValue: { ...TYPOGRAPHY.h2, color: COLORS.primary, fontSize: 22 },
  sheetStatLabel: { ...TYPOGRAPHY.caption, marginTop: 2 },
  sheetStatDivider: { width: 1, backgroundColor: COLORS.border },
  fullBanner: { backgroundColor: COLORS.errorLight, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm, alignItems: 'center' },
  fullBannerText: { ...TYPOGRAPHY.bodyBold, color: COLORS.error, fontSize: 13 },
  sheetActions: { flexDirection: 'row', gap: SPACING.sm },
  dismissBtn: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg, alignItems: 'center', backgroundColor: COLORS.border },
  dismissText: { ...TYPOGRAPHY.bodyBold, color: COLORS.textSecondary },
});