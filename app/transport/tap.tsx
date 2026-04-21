// app/transport/tap.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  Alert, ActivityIndicator, FlatList, Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader, Card, PrimaryButton } from '@/components/ui';
import { useUserWallet } from '@/hooks/useAppwrite';
import { useTicketPurchase } from '@/hooks/useTicketPurchase';
import { getProvider } from '@/services/transport/providers';
import { TransportStop } from '@/services/transport/types';

// FIX: provider id type matches providers.ts — 'reavaya' not 'rea_vaya'
type SupportedProvider = 'gautrain' | 'reavaya';

// ─── Station list for tap-out ─────────────────────────────────────────────────
// Loaded from the same JSON files used by the rest of the app
const gautrainData    = require('@/assets/gautrain_data.json');
const reavayaData     = require('@/assets/reavaya_data.json');

function getStationsForProvider(provider: SupportedProvider): TransportStop[] {
  if (provider === 'gautrain') {
    return (gautrainData.stations ?? []).map((s: any) => ({
      id: s.id, name: s.name, lat: s.lat, lon: s.lon,
    }));
  }
  if (provider === 'reavaya') {
    return (reavayaData.stops ?? []).map((s: any) => ({
      id: s.id, name: s.name, lat: s.lat, lon: s.lon,
    }));
  }
  return [];
}

// ─── Active trip shape (Appwrite document) ────────────────────────────────────
interface ActiveTrip {
  // FIX: use $id consistently — this is an Appwrite document
  $id:            string;
  originStopId:   string;
  originStopName: string;
  startTime:      string;
  provider:       string;
  status:         string;
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function TapScreen() {
  const { user } = useUser();
  const { wallet, refetch } = useUserWallet();
  const { startTripFlow, completeTripFlow, purchasing } = useTicketPurchase();

  const params = useLocalSearchParams<{
    provider:        string;
    stationId:       string;
    stationName:     string;
    destinationHint?: string;
  }>();

  // FIX: validate and normalise provider — 'rea_vaya' → 'reavaya'
  const rawProvider = params.provider as string;
  const provider = (rawProvider === 'rea_vaya' ? 'reavaya' : rawProvider) as SupportedProvider;

  const [activeTrip, setActiveTrip]   = useState<ActiveTrip | null>(null);
  const [loading,    setLoading]      = useState(false);
  const [localTrip,  setLocalTrip]    = useState<any>(null); // Trip from startTripFlow

  // Station list for tap-out picker
  const [stations,         setStations]         = useState<TransportStop[]>([]);
  const [showStationPicker, setShowStationPicker] = useState(false);

  useEffect(() => {
    if (provider === 'gautrain' || provider === 'reavaya') {
      setStations(getStationsForProvider(provider));
    }
  }, [provider]);

  const providerLabel = provider === 'gautrain' ? '🚆 Gautrain' : '🚌 Rea Vaya';

  const originStop: TransportStop = {
    id:   params.stationId  ?? '',
    name: params.stationName ?? 'Unknown Station',
    lat:  0,
    lon:  0,
  };

  // ── Tap in ─────────────────────────────────────────────────────────────────
  const handleTapIn = useCallback(async () => {
    if (!user?.id || !params.stationId) {
      Alert.alert('Error', 'Missing station or user information.');
      return;
    }
    try {
      const trip = await startTripFlow({
        userId:     user.id,
        providerId: provider,
        origin:     originStop,
      });
      if (trip) {
        // Store as a local active trip until tap-out
        setLocalTrip(trip);
        setActiveTrip({
          $id:            trip.id,
          originStopId:   originStop.id,
          originStopName: originStop.name,
          startTime:      trip.startTime.toISOString(),
          provider:       trip.provider,
          status:         'active',
        });
        Alert.alert('Tapped In ✅', `Welcome aboard at ${originStop.name}`);
      }
    } catch (e: any) {
      if (e.message === 'INSUFFICIENT_BALANCE') {
        Alert.alert('Insufficient Balance', 'Please top up your wallet before tapping in.');
      } else {
        Alert.alert('Tap In Failed', e.message ?? 'Please try again.');
      }
    }
  }, [user?.id, params.stationId, provider, originStop, startTripFlow]);

  // ── Tap out ────────────────────────────────────────────────────────────────
  // FIX: was hardcoded to 'park_station' — now opens a real station picker
  const handleTapOut = useCallback(async (exitStation: TransportStop) => {
    if (!activeTrip || !localTrip || !user?.id) return;

    setLoading(true);
    try {
      const result = await completeTripFlow({
        userId:      user.id,
        trip:        localTrip,
        destination: exitStation,
      });

      if (result) {
        Alert.alert(
          'Tapped Out ✅',
          `Fare: R${result.fare.amount.toFixed(2)}\n${result.fare.breakdown}`,
          [{ text: 'OK', onPress: () => {
            refetch();
            router.back();
          }}],
        );
        setActiveTrip(null);
        setLocalTrip(null);
      } else {
        Alert.alert('Error', 'Could not complete trip. Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Tap Out Failed', e.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [activeTrip, localTrip, user?.id, completeTripFlow, refetch]);

  if (!provider || (provider !== 'gautrain' && provider !== 'reavaya')) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Tap In/Out" onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={styles.errorText}>Unsupported provider: {rawProvider}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title={`${providerLabel} Tap`} onBack={() => {
        if (activeTrip) {
          Alert.alert('Trip in progress', 'Please tap out before leaving.');
          return;
        }
        router.back();
      }} />

      <View style={styles.content}>
        {/* Wallet balance */}
        <Card style={styles.infoCard}>
          <Text style={styles.providerName}>{providerLabel}</Text>
          <Text style={styles.balance}>Wallet: R{(wallet?.balance ?? 0).toFixed(2)}</Text>
        </Card>

        {!activeTrip ? (
          // ── Tap In ──
          <View style={styles.tapArea}>
            <View style={styles.stationBadge}>
              <Text style={styles.stationBadgeLabel}>Station</Text>
              <Text style={styles.stationName}>{params.stationName ?? 'Select a station'}</Text>
            </View>
            <PrimaryButton
              label={purchasing ? 'Starting…' : 'Tap In'}
              onPress={handleTapIn}
              disabled={purchasing || loading}
              style={styles.tapButton}
            />
            <TouchableOpacity style={styles.changeStation} onPress={() => router.back()}>
              <Text style={styles.changeStationText}>Change station</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // ── Active trip + Tap Out ──
          <View style={styles.tapArea}>
            <View style={styles.activePill}>
              <Text style={styles.activePillDot}>🟢</Text>
              <Text style={styles.activePillText}>Trip in progress</Text>
            </View>
            <Text style={styles.activeTripText}>Boarded at</Text>
            <Text style={styles.activeStation}>{activeTrip.originStopName}</Text>
            <Text style={styles.activeTime}>
              {new Date(activeTrip.startTime).toLocaleTimeString()}
            </Text>

            <PrimaryButton
              label="Select Exit Station"
              onPress={() => setShowStationPicker(true)}
              style={{ ...styles.tapButton, backgroundColor: COLORS.accent ?? COLORS.primary }}
              disabled={loading || purchasing}
            />
          </View>
        )}
      </View>

      {/* Exit station picker */}
      <Modal visible={showStationPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select exit station</Text>
            <FlatList
              data={stations.filter(s => s.id !== params.stationId)}
              keyExtractor={s => s.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.stationOption}
                  onPress={() => {
                    setShowStationPicker(false);
                    handleTapOut(item);
                  }}
                >
                  <Text style={styles.stationOptionText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No stations available</Text>}
            />
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowStationPicker(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Loading overlay */}
      {(loading || purchasing) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content:   { padding: SPACING.md, flex: 1 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: COLORS.textMuted, textAlign: 'center' },

  infoCard:     { marginBottom: SPACING.lg, alignItems: 'center' },
  providerName: { fontSize: 20, fontWeight: '700', marginBottom: SPACING.xs, color: COLORS.textPrimary ?? '#1E293B' },
  balance:      { fontSize: 14, color: COLORS.textMuted },

  tapArea:         { alignItems: 'center', marginTop: SPACING.xl, flex: 1 },
  stationBadge:    { alignItems: 'center', marginBottom: SPACING.xl, backgroundColor: COLORS.primaryLight, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.lg },
  stationBadgeLabel: { ...(TYPOGRAPHY.label as object), color: COLORS.primaryDark, marginBottom: 4 },
  stationName:     { fontSize: 22, fontWeight: '800', textAlign: 'center', color: COLORS.primary },
  tapButton:       { width: '80%', marginTop: SPACING.md },
  changeStation:   { marginTop: SPACING.md, padding: SPACING.sm },
  changeStationText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },

  activePill:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DCFCE7', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, marginBottom: SPACING.lg },
  activePillDot:  { fontSize: 10 },
  activePillText: { fontSize: 13, fontWeight: '700', color: '#16A34A' },
  activeTripText: { fontSize: 14, color: COLORS.textMuted },
  activeStation:  { fontSize: 24, fontWeight: '800', marginVertical: SPACING.xs, color: COLORS.textPrimary ?? '#1E293B', textAlign: 'center' },
  activeTime:     { fontSize: 14, color: COLORS.textMuted, marginBottom: SPACING.xl },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor:      COLORS.surface,
    borderTopLeftRadius:  RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding:    SPACING.lg,
    maxHeight:  '70%',
  },
  modalHandle:      { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  modalTitle:       { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: SPACING.md, color: COLORS.textPrimary ?? '#1E293B' },
  stationOption:    { padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stationOptionText:{ fontSize: 16, color: COLORS.textPrimary ?? '#1E293B' },
  emptyText:        { textAlign: 'center', padding: SPACING.lg, color: COLORS.textMuted },
  cancelBtn:        { marginTop: SPACING.md, backgroundColor: COLORS.border, paddingVertical: 12, borderRadius: RADIUS.md, alignItems: 'center' },
  // FIX: COLORS.textSecondary → COLORS.textMuted
  cancelBtnText:    { fontWeight: '600', color: COLORS.textMuted },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center' },
});