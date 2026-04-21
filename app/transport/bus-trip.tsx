// app/transport/bus-trip.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  Alert, ActivityIndicator, Modal, FlatList, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader, Card, PrimaryButton } from '@/components/ui';
import { useUserWallet } from '@/hooks/useAppwrite';
import { useTicketPurchase } from '@/hooks/useTicketPurchase';

const metrobusData = require('@/assets/metrobus_data.json');

// ─── Types ────────────────────────────────────────────────────────────────────
interface Route {
  id: string;
  short_name: string;
  long_name: string;
}

interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

interface RouteDetail {
  route: Route;
  stops: Stop[];
  stopTimes: { stop_id: string; stop_sequence: number }[];
  frequency: any;
}

interface ActiveTrip {
  id: string;
  routeId: string;
  startStopId: string;
  startStopName: string;
  startTime: string;
}

// ─── Fare calculation ─────────────────────────────────────────────────────────
// FIX: unified with MetrobusProvider rate (R2/km + R8 base, minimum R8)
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateFare(origin: Stop, destination: Stop): number {
  const dist = haversine(origin.lat, origin.lon, destination.lat, destination.lon);
  const fare = Math.max(8, 8 + dist * 2.0);
  return Math.round(fare * 100) / 100;
}

// ─── Shared stop loading helper ───────────────────────────────────────────────
function loadRouteStops(routeId: string): Stop[] {
  const detail = metrobusData.routes?.[routeId] as RouteDetail | undefined;
  if (!detail) return [];
  const sorted = [...detail.stopTimes].sort((a, b) => a.stop_sequence - b.stop_sequence);
  const seen = new Set<string>();
  return sorted
    .map(st => detail.stops.find(s => s.id === st.stop_id))
    .filter((s): s is Stop => !!s && !seen.has(s.id) && (seen.add(s.id), true));
}

// ─── Stop picker modal ────────────────────────────────────────────────────────
function StopPickerModal({
  visible,
  title,
  stops,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  stops: Stop[];
  onSelect: (stop: Stop) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={stops}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.stopOption} onPress={() => onSelect(item)}>
                <Text style={styles.stopName}>{item.name}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No stops available</Text>}
          />
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Step 1: Route selection ──────────────────────────────────────────────────
function RouteSelectionScreen({ onSelectRoute }: { onSelectRoute: (route: Route) => void }) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const routeList: Route[] = [];
    const routesObj = metrobusData.routes;
    for (const routeId in routesObj) {
      const detail = routesObj[routeId] as RouteDetail;
      if (detail?.route) routeList.push(detail.route);
    }
    setRoutes(routeList);
  }, []);

  const filtered = routes.filter(r =>
    r.short_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.long_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.id.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Select Route" onBack={() => router.back()} />
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search routes..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.routeOption} onPress={() => onSelectRoute(item)}>
            <Text style={styles.routeText}>{item.short_name} – {item.long_name}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.routeList}
        ListEmptyComponent={<Text style={styles.emptyText}>No routes found</Text>}
      />
    </SafeAreaView>
  );
}

// ─── Step 2: Stop selection ───────────────────────────────────────────────────
function StopSelectionScreen({
  route,
  onBack,
  onStartTrip,
}: {
  route: Route;
  onBack: () => void;
  onStartTrip: (boarding: Stop, alighting: Stop) => void;
}) {
  const [routeStops, setRouteStops] = useState<Stop[]>([]);
  const [boardingStop, setBoardingStop] = useState<Stop | null>(null);
  const [alightingStop, setAlightingStop] = useState<Stop | null>(null);
  const [showPicker, setShowPicker] = useState<'boarding' | 'alighting' | null>(null);

  useEffect(() => {
    setRouteStops(loadRouteStops(route.id));
  }, [route.id]);

  const alightingOptions = boardingStop
    ? routeStops.filter((_, i) => i > routeStops.findIndex(s => s.id === boardingStop.id))
    : routeStops;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title={`Route ${route.short_name}`} onBack={onBack} />
      <View style={styles.content}>
        <Card style={styles.routeInfoCard}>
          <Text style={styles.routeInfoName}>{route.long_name}</Text>
        </Card>

        <Text style={styles.sectionLabel}>Boarding Stop</Text>
        <TouchableOpacity style={styles.stopSelector} onPress={() => setShowPicker('boarding')}>
          <Text style={boardingStop ? styles.stopSelected : styles.stopPlaceholder}>
            {boardingStop ? boardingStop.name : 'Tap to select boarding stop'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Alighting Stop</Text>
        <TouchableOpacity
          style={[styles.stopSelector, !boardingStop && styles.stopSelectorDisabled]}
          onPress={() => boardingStop && setShowPicker('alighting')}
        >
          <Text style={alightingStop ? styles.stopSelected : styles.stopPlaceholder}>
            {alightingStop ? alightingStop.name : boardingStop ? 'Tap to select alighting stop' : 'Select boarding stop first'}
          </Text>
        </TouchableOpacity>

        {boardingStop && alightingStop && (
          <View style={styles.farePreview}>
            <Text style={styles.farePreviewLabel}>Estimated fare</Text>
            <Text style={styles.farePreviewAmount}>R{calculateFare(boardingStop, alightingStop).toFixed(2)}</Text>
          </View>
        )}

        <PrimaryButton
          label="Start Trip"
          onPress={() => {
            if (boardingStop && alightingStop) onStartTrip(boardingStop, alightingStop);
            else Alert.alert('Missing info', 'Please select both boarding and alighting stops.');
          }}
          disabled={!boardingStop || !alightingStop}
          style={styles.startBtn}
        />
      </View>

      <StopPickerModal
        visible={showPicker === 'boarding'}
        title="Select boarding stop"
        stops={routeStops}
        onSelect={s => { setBoardingStop(s); setAlightingStop(null); setShowPicker(null); }}
        onClose={() => setShowPicker(null)}
      />
      <StopPickerModal
        visible={showPicker === 'alighting'}
        title="Select alighting stop"
        stops={alightingOptions}
        onSelect={s => { setAlightingStop(s); setShowPicker(null); }}
        onClose={() => setShowPicker(null)}
      />
    </SafeAreaView>
  );
}

// ─── Step 3: Active trip ──────────────────────────────────────────────────────
function ActiveTripScreen({
  trip,
  route,
  boardingStop,
  onEndTrip,
}: {
  trip: ActiveTrip;
  route: Route;
  boardingStop: Stop;
  onEndTrip: (alighting: Stop) => void;
}) {
  const [alightingStop, setAlightingStop] = useState<Stop | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [routeStops, setRouteStops] = useState<Stop[]>([]);

  useEffect(() => {
    setRouteStops(loadRouteStops(route.id));
  }, [route.id]);

  const alightingOptions = routeStops.filter(
    (_, i) => i > routeStops.findIndex(s => s.id === boardingStop.id),
  );

  const farePreview = alightingStop ? calculateFare(boardingStop, alightingStop) : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Active Trip" onBack={() => {
        Alert.alert('Trip in progress', 'Please end your trip before going back.');
      }} />
      <View style={styles.content}>
        <Card style={styles.activeCard}>
          <Text style={styles.activeLabel}>ACTIVE TRIP</Text>
          <Text style={styles.activeRoute}>Route {route.short_name}</Text>
          <Text style={styles.activeStop}>Boarded at: {boardingStop.name}</Text>
          <Text style={styles.activeTime}>
            Started: {new Date(trip.startTime).toLocaleTimeString()}
          </Text>
        </Card>

        <Text style={styles.sectionLabel}>Alighting Stop</Text>
        <TouchableOpacity style={styles.stopSelector} onPress={() => setShowPicker(true)}>
          <Text style={alightingStop ? styles.stopSelected : styles.stopPlaceholder}>
            {alightingStop ? alightingStop.name : 'Tap to select where you get off'}
          </Text>
        </TouchableOpacity>

        {farePreview !== null && (
          <View style={styles.farePreview}>
            <Text style={styles.farePreviewLabel}>Fare to pay</Text>
            <Text style={styles.farePreviewAmount}>R{farePreview.toFixed(2)}</Text>
          </View>
        )}

        <PrimaryButton
          label="End Trip & Pay"
          onPress={() => alightingStop
            ? onEndTrip(alightingStop)
            : Alert.alert('Select a stop', 'Please select where you are alighting.')
          }
          disabled={!alightingStop}
          style={styles.endBtn}
        />
      </View>

      <StopPickerModal
        visible={showPicker}
        title="Select alighting stop"
        stops={alightingOptions}
        onSelect={s => { setAlightingStop(s); setShowPicker(false); }}
        onClose={() => setShowPicker(false)}
      />
    </SafeAreaView>
  );
}

// ─── Main orchestrator ────────────────────────────────────────────────────────
export default function BusTripScreen() {
  const { user } = useUser();
  const { wallet, refetch } = useUserWallet();
  // FIX: use purchaseWithLoanSupport for the end-trip payment flow
  const { purchaseWithLoanSupport, purchasing } = useTicketPurchase();

  const [step, setStep] = useState<'select-route' | 'select-stops' | 'active-trip'>('select-route');
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [boardingStop, setBoardingStop] = useState<Stop | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRouteSelected = useCallback((route: Route) => {
    setSelectedRoute(route);
    setStep('select-stops');
  }, []);

  const handleStartTrip = useCallback(async (boarding: Stop, alighting: Stop) => {
    if (!user?.id || !selectedRoute) return;
    setLoading(true);
    try {
      // Create a local trip record (no backend required for MVP)
      const trip: ActiveTrip = {
        id:            `local_${Date.now()}`,
        routeId:       selectedRoute.id,
        startStopId:   boarding.id,
        startStopName: boarding.name,
        startTime:     new Date().toISOString(),
      };
      setActiveTrip(trip);
      setBoardingStop(boarding);
      setStep('active-trip');
      Alert.alert('Trip Started 🚌', `Boarded at ${boarding.name}.\nEnd trip when you alight.`);
    } catch (error: any) {
      Alert.alert('Error', error.message ?? 'Could not start trip.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedRoute]);

  const handleEndTrip = useCallback(async (alighting: Stop) => {
    if (!boardingStop || !activeTrip || !user?.id) return;
    const fare = calculateFare(boardingStop, alighting);

    // FIX: use purchaseWithLoanSupport — handles balance check + loan offer properly
    await purchaseWithLoanSupport({
      service:     'metrobus',
      amount:      fare,
      description: `Metrobus: ${boardingStop.name} → ${alighting.name}`,
      from:        boardingStop.name,
      to:          alighting.name,
      onSuccess: () => {
        Alert.alert(
          'Trip Ended ✅',
          `Fare paid: R${fare.toFixed(2)}\nNew balance: R${((wallet?.balance ?? 0) - fare).toFixed(2)}`,
          [{ text: 'OK', onPress: () => {
            refetch();
            setStep('select-route');
            setSelectedRoute(null);
            setActiveTrip(null);
            setBoardingStop(null);
          }}],
        );
      },
      onInsufficient: () => {
        Alert.alert('Insufficient Balance', 'Please top up your wallet and try again.');
      },
    });
  }, [boardingStop, activeTrip, user?.id, wallet?.balance, purchaseWithLoanSupport, refetch]);

  if (step === 'select-route') {
    return <RouteSelectionScreen onSelectRoute={handleRouteSelected} />;
  }

  if (step === 'select-stops' && selectedRoute) {
    return (
      <StopSelectionScreen
        route={selectedRoute}
        onBack={() => setStep('select-route')}
        onStartTrip={handleStartTrip}
      />
    );
  }

  if (step === 'active-trip' && activeTrip && selectedRoute && boardingStop) {
    return (
      <ActiveTripScreen
        trip={activeTrip}
        route={selectedRoute}
        boardingStop={boardingStop}
        onEndTrip={handleEndTrip}
      />
    );
  }

  return null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  content:      { padding: SPACING.md, paddingBottom: 48 },
  routeList:    { padding: SPACING.md },
  routeOption: {
    backgroundColor: COLORS.surface,
    padding:         SPACING.md,
    borderRadius:    RADIUS.md,
    marginBottom:    SPACING.sm,
    borderWidth:     1,
    borderColor:     COLORS.border,
  },
  routeText:    { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary ?? '#1E293B' },
  routeInfoCard:{ alignItems: 'center', marginBottom: SPACING.md },
  routeInfoName:{ fontSize: 16, fontWeight: '700', textAlign: 'center', color: COLORS.textPrimary ?? '#1E293B' },

  sectionLabel: { ...(TYPOGRAPHY.label as object), marginBottom: SPACING.sm, marginTop: SPACING.md },
  stopSelector: {
    backgroundColor: COLORS.surface,
    padding:    SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  stopSelectorDisabled: { opacity: 0.5 },
  stopPlaceholder: { color: COLORS.textMuted },
  stopSelected:    { color: COLORS.textPrimary ?? '#1E293B', fontWeight: '500' },

  farePreview: {
    alignItems:       'center',
    marginVertical:   SPACING.md,
    padding:          SPACING.md,
    backgroundColor:  COLORS.primaryLight,
    borderRadius:     RADIUS.lg,
  },
  farePreviewLabel:  { fontSize: 12, color: COLORS.primaryDark },
  farePreviewAmount: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  startBtn: { marginTop: SPACING.md },

  activeCard: { marginBottom: SPACING.lg },
  activeLabel: { fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  activeRoute: { fontSize: 18, fontWeight: '700', marginBottom: 4, color: COLORS.textPrimary ?? '#1E293B' },
  activeStop:  { fontSize: 14, color: COLORS.textMuted, marginBottom: 4 },
  activeTime:  { fontSize: 14, color: COLORS.textMuted },
  endBtn:      { backgroundColor: COLORS.accent ?? COLORS.primary, marginTop: SPACING.md },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor:     COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding:    SPACING.lg,
    maxHeight:  '80%',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  modalTitle:  { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: SPACING.md, color: COLORS.textPrimary ?? '#1E293B' },
  stopOption:  { padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stopName:    { fontSize: 16, color: COLORS.textPrimary ?? '#1E293B' },
  emptyText:   { textAlign: 'center', padding: SPACING.lg, color: COLORS.textMuted },
  closeBtn:    { marginTop: SPACING.md, backgroundColor: COLORS.border, paddingVertical: 12, borderRadius: RADIUS.md, alignItems: 'center' },
  // FIX: COLORS.textSecondary → COLORS.textMuted (textSecondary doesn't exist in theme)
  closeBtnText:{ fontWeight: '600', color: COLORS.textMuted },

  searchContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    backgroundColor:   COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchInput: {
    backgroundColor: COLORS.background,
    borderRadius:    RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    fontSize:        14,
    color:           COLORS.textPrimary ?? '#1E293B',
    borderWidth:     1,
    borderColor:     COLORS.border,
  },
});