// app/taxi/shared.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  FlatList, ActivityIndicator, Modal, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { searchRoutes } from '@/services/saasBridge';
import { ScreenHeader, Card, PrimaryButton, EmptyState } from '@/components/ui';

interface RouteStop {
  id?: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
  fareFromOrigin: number;
}

interface Route {
  $id: string;
  name: string;
  origin: string;
  destination: string;
  distance: number;
  baseFare: number;
  stops?: RouteStop[];
}

// Helper: extract the first part of a Google Places description (before the first comma)
function extractPlaceName(description: string): string {
  const parts = description.split(',');
  return parts[0].trim();
}

export default function TaxiPassengerScreen() {
  const params = useLocalSearchParams<{ from?: string; to?: string }>();
  const [pickup, setPickup] = useState<any>(null);
  const [destination, setDestination] = useState<any>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [boardingStop, setBoardingStop] = useState<RouteStop | null>(null);
  const [alightingStop, setAlightingStop] = useState<RouteStop | null>(null);
  const [showStopModal, setShowStopModal] = useState(false);

  // Auto‑fill from journey planner
  useEffect(() => {
    if (params.from && params.to) {
      setPickup({ description: params.from });
      setDestination({ description: params.to });
    }
  }, [params.from, params.to]);

  // Auto‑search when both pickup and destination are set
  useEffect(() => {
    if (pickup && destination) {
      handleSearch();
    }
  }, [pickup, destination]);

  const handleSearch = async () => {
    if (!pickup || !destination) return;
    setLoading(true);
    setHasSearched(true);
    try {
      // Extract the main place name (e.g., "Jabulani" from "Jabulani, Soweto, South Africa")
      const pickupName = extractPlaceName(pickup.description);
      const destName = extractPlaceName(destination.description);
      console.log('Searching routes for:', pickupName, destName);
      let data = await searchRoutes(pickupName, destName);
      console.log('Routes found (bridge):', data?.length);
      setRoutes(data || []);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Could not find taxi routes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

const handleRouteSelect = (route: Route) => {
  setSelectedRoute(route);
  
  const rawStops = route.stops || [];
  let normalizedStops: RouteStop[] = [];
  
  // If stops array is huge (> 20), it's likely erroneous – ignore it
  if (Array.isArray(rawStops) && rawStops.length > 0 && rawStops.length <= 20) {
    normalizedStops = rawStops.map((stop, idx) => {
      if (typeof stop === 'string') {
        return {
          id: `stop_${idx}`,
          name: stop,
          address: stop,
          lat: 0,
          lng: 0,
          order: idx + 1,
          fareFromOrigin: 0, // we'll compute fare from origin later if needed
        };
      }
      return stop;
    });
  } else if (rawStops.length > 20) {
    console.warn(`Ignoring invalid stops array (${rawStops.length} items) for route ${route.name}`);
  }
  
  const allStops: RouteStop[] = [
    { id: 'origin', name: 'Origin', address: route.origin, lat: 0, lng: 0, order: -1, fareFromOrigin: 0 },
    ...normalizedStops,
    { id: 'destination', name: 'Destination', address: route.destination, lat: 0, lng: 0, order: 999, fareFromOrigin: route.baseFare },
  ];
  
  setBoardingStop(allStops[0]);
  setAlightingStop(allStops[allStops.length - 1]);
  setShowStopModal(true);
};

  const calculateFare = () => {
    if (!boardingStop || !alightingStop) return 0;
    return Math.max(0, alightingStop.fareFromOrigin - boardingStop.fareFromOrigin);
  };

  const confirmStopsAndProceed = () => {
    if (!selectedRoute || !boardingStop || !alightingStop) return;
    const fare = calculateFare();
    router.push({
      pathname: '/taxi/minibus-passenger/active-taxis',
      params: {
        routeId: selectedRoute.$id,
        routeName: selectedRoute.name,
        boardingStop: JSON.stringify(boardingStop),
        expectedFare: fare.toString(),
      },
    });
    setShowStopModal(false);
    setSelectedRoute(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Find a Taxi" onBack={() => router.back()} />
      <FlatList
        data={routes}
        keyExtractor={item => item.$id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={() => (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroEmoji}>🚖</Text>
              <Text style={styles.heroTitle}>Find a Taxi</Text>
              <Text style={styles.heroSub}>Enter your locations to see available routes.</Text>
            </View>

            <Card style={styles.searchCard}>
              <View style={styles.locationRow}>
                <View style={styles.dotWrap}><View style={styles.pickupDot} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.locationLabel}>PICKUP</Text>
                  <GooglePlacesAutocomplete
                    placeholder="Where are you?"
                    onPress={(data) => setPickup(data)}
                    query={{ key: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY, components: 'country:za' }}
                    fetchDetails={false}
                    styles={{ textInput: [styles.googleInput, pickup && styles.googleInputFilled], container: { flex: 0 }, listView: { zIndex: 9999 } }}
                  />
                </View>
              </View>
              <View style={styles.connectorRow}>
                <View style={{ width: 20, alignItems: 'center' }}><View style={styles.connectorLine} /></View>
              </View>
              <View style={styles.locationRow}>
                <View style={styles.dotWrap}><View style={styles.dropoffDot} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.locationLabel}>DESTINATION</Text>
                  <GooglePlacesAutocomplete
                    placeholder="Where to?"
                    onPress={(data) => setDestination(data)}
                    query={{ key: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY, components: 'country:za' }}
                    fetchDetails={false}
                    styles={{ textInput: [styles.googleInput, destination && styles.googleInputFilled], container: { flex: 0 }, listView: { zIndex: 9998 } }}
                  />
                </View>
              </View>
              <PrimaryButton label="Find Taxis" onPress={handleSearch} loading={loading} disabled={!pickup || !destination} style={{ marginTop: SPACING.sm }} />
            </Card>

            {hasSearched && !loading && (
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsTitle}>{routes.length > 0 ? `${routes.length} route${routes.length !== 1 ? 's' : ''} found` : 'No routes found'}</Text>
              </View>
            )}
            {loading && <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: SPACING.xl }} />}
          </>
        )}
        ListEmptyComponent={hasSearched && !loading ? (
          <EmptyState icon="🔍" title="No routes found" subtitle="Try different pickup and destination locations." />
        ) : null}
        renderItem={({ item }) => (
          <Card style={styles.routeCard} onPress={() => handleRouteSelect(item)}>
            <View style={styles.routeTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.routeName}>{item.name}</Text>
                <View style={styles.routePath}>
                  <View style={styles.pathStop}><View style={styles.pathDot} /><Text style={styles.pathText}>{item.origin}</Text></View>
                  <View style={styles.pathLine} />
                  <View style={styles.pathStop}><View style={[styles.pathDot, { backgroundColor: COLORS.accent }]} /><Text style={styles.pathText}>{item.destination}</Text></View>
                </View>
                {item.stops && item.stops.length > 0 && <Text style={styles.stopCount}>{item.stops.length} intermediate stop(s)</Text>}
              </View>
              <View style={styles.fareBadge}><Text style={styles.fareAmount}>R{item.baseFare}</Text><Text style={styles.fareLabel}>full trip</Text></View>
            </View>
            <View style={styles.routeMeta}><View style={styles.metaItem}><Text style={styles.metaIcon}>📏</Text><Text style={styles.metaText}>{item.distance} km</Text></View></View>
            <Text style={styles.routeCta}>Select pickup/dropoff →</Text>
          </Card>
        )}
      />

      {/* Stop selection modal (unchanged) */}
      <Modal visible={showStopModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select boarding and alighting stops</Text>
            <Text style={styles.modalSub}>Route: {selectedRoute?.name}</Text>
            <Text style={styles.stopSectionTitle}>🚏 Boarding stop</Text>
            <FlatList
              data={[{ id: 'origin', name: 'Origin', address: selectedRoute?.origin, fareFromOrigin: 0 }, ...(selectedRoute?.stops || [])]}
              keyExtractor={(item, idx) => item.id || idx.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.stopOption, boardingStop?.id === item.id && styles.stopOptionSelected]} onPress={() => setBoardingStop(item as RouteStop)}>
                  <Text style={styles.stopName}>{item.name || item.address}</Text>
                  <Text style={styles.stopFare}>R{item.fareFromOrigin} from origin</Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 150 }}
            />
            <Text style={styles.stopSectionTitle}>📍 Alighting stop</Text>
            <FlatList
              data={[...(selectedRoute?.stops || []), { id: 'destination', name: 'Destination', address: selectedRoute?.destination, fareFromOrigin: selectedRoute?.baseFare || 0 }]}
              keyExtractor={(item, idx) => item.id || idx.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.stopOption, alightingStop?.id === item.id && styles.stopOptionSelected]} onPress={() => setAlightingStop(item as RouteStop)}>
                  <Text style={styles.stopName}>{item.name || item.address}</Text>
                  <Text style={styles.stopFare}>R{item.fareFromOrigin} from origin</Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 150 }}
            />
            {boardingStop && alightingStop && (
              <View style={styles.farePreview}>
                <Text style={styles.farePreviewLabel}>Your fare</Text>
                <Text style={styles.farePreviewAmount}>R{calculateFare()}</Text>
              </View>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowStopModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <PrimaryButton label="Continue" onPress={confirmStopsAndProceed} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  listContent: { padding: SPACING.md, paddingBottom: 48 },
  hero: { alignItems: 'center', paddingVertical: SPACING.lg, marginBottom: SPACING.md },
  heroEmoji: { fontSize: 52, marginBottom: SPACING.sm },
  heroTitle: { ...TYPOGRAPHY.h1, textAlign: 'center', marginBottom: SPACING.xs },
  heroSub: { ...TYPOGRAPHY.body, textAlign: 'center', color: COLORS.textMuted },
  searchCard: { marginBottom: SPACING.md, zIndex: 10 },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  dotWrap: { width: 20, alignItems: 'center', paddingTop: 22 },
  pickupDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary },
  dropoffDot: { width: 12, height: 12, borderRadius: 3, backgroundColor: COLORS.accent },
  connectorRow: { paddingLeft: 9, paddingVertical: 2 },
  connectorLine: { width: 2, height: 14, backgroundColor: COLORS.border },
  locationLabel: { ...TYPOGRAPHY.label, fontSize: 11, marginBottom: 4, letterSpacing: 0.8 },
  googleInput: { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, fontSize: 14, color: COLORS.textPrimary, backgroundColor: COLORS.background, height: 44 },
  googleInputFilled: { borderColor: COLORS.success },
  resultsHeader: { marginBottom: SPACING.xs },
  resultsTitle: { ...TYPOGRAPHY.h4, color: COLORS.textMuted },
  routeCard: { marginBottom: SPACING.sm },
  routeTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.sm },
  routeName: { ...TYPOGRAPHY.h4, marginBottom: SPACING.xs },
  routePath: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  pathStop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pathDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  pathText: { ...TYPOGRAPHY.body, fontSize: 13 },
  pathLine: { width: 20, height: 1.5, backgroundColor: COLORS.border, marginHorizontal: 4 },
  stopCount: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  fareBadge: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, alignItems: 'center' },
  fareAmount: { ...TYPOGRAPHY.bodyBold, color: COLORS.primaryDark, fontSize: 16 },
  fareLabel: { fontSize: 10, color: COLORS.primaryDark },
  routeMeta: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.xs },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaIcon: { fontSize: 13 },
  metaText: { ...TYPOGRAPHY.caption },
  routeCta: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, maxHeight: '80%' },
  modalTitle: { ...TYPOGRAPHY.h3, marginBottom: 4 },
  modalSub: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginBottom: SPACING.md },
  stopSectionTitle: { ...TYPOGRAPHY.bodyBold, marginTop: SPACING.md, marginBottom: SPACING.xs },
  stopOption: { padding: SPACING.sm, backgroundColor: COLORS.background, borderRadius: RADIUS.md, marginBottom: SPACING.xs, borderWidth: 1, borderColor: COLORS.border },
  stopOptionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  stopName: { ...TYPOGRAPHY.bodyBold, fontSize: 14 },
  stopFare: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  farePreview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.primaryLight, padding: SPACING.md, borderRadius: RADIUS.md, marginVertical: SPACING.md },
  farePreviewLabel: { ...TYPOGRAPHY.body },
  farePreviewAmount: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  modalButtons: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg, alignItems: 'center', backgroundColor: COLORS.border },
  cancelText: { ...TYPOGRAPHY.bodyBold, color: COLORS.textSecondary },
});