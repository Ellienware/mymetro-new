// app/journey-results.tsx (full file with taxi support)
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  FlatList, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { findItineraries, type Itinerary, type Leg } from '@/services/gtfsRouter';
import { usePaymentMethods, useUserWallet } from '@/hooks/useAppwrite';
import { useTicketPurchase } from '@/hooks/useTicketPurchase';
import { PaymentMethodModal } from '@/components/PaymentMethodModal';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader, Card, LoadingScreen, EmptyState } from '@/components/ui';

const safeStr = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? v[0] ?? '' : v ?? '';

const MODE_ICON: Record<string, string> = {
  RAIL: '🚆', BUS: '🚌', TAXI: '🚖', WALK: '🚶',
};

const MODE_COLOR: Record<string, string> = {
  RAIL: COLORS.primaryLight,
  BUS:  COLORS.accentLight,
  TAXI: COLORS.warningLight || '#FEF3C7',
  WALK: COLORS.border,
};

const MODE_TEXT_COLOR: Record<string, string> = {
  RAIL: COLORS.primaryDark,
  BUS:  COLORS.accentDark,
  TAXI: COLORS.accentDark,
  WALK: COLORS.textMuted,
};

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

function mapPaymentMethods(methods: any[]) {
  return (methods ?? []).map(m => ({
    id:          m.$id,
    name:        m.name,
    icon:        m.type === 'card' ? '💳' : '🏦',
    description: m.description,
    available:   true,
    isCustom:    true,
    lastFour:    m.lastFour,
    expiryDate:  m.expiryDate,
    cardType:    m.cardType,
  }));
}

interface ProcessedJourney extends Omit<Itinerary, 'departureTime' | 'arrivalTime'> {
  departureTime: string;
  arrivalTime:   string;
  transferInfo:  string;
}

function getButtonLabel(journey: ProcessedJourney): string {
  if (journey.totalFare === 0) return 'Select';
  const firstTransitLeg = journey.legs.find(l => l.mode !== 'WALK');
  if (!firstTransitLeg) return 'Select';
  const provider = (firstTransitLeg.routeShortName || '').toLowerCase();
  if (provider.includes('gautrain') || provider.includes('rea vaya')) return 'Tap In & Travel';
  if (provider.includes('metrobus')) return 'Start Trip';
  if (journey.systemName === 'Minibus Taxi') return 'Select Stops';
  return `Buy · R${journey.totalFare.toFixed(2)}`;
}

function JourneyCard({
  journey,
  isBest,
  onViewDetails,
  onViewMap,
  onSelectTaxi,
  onStartTrip,
  onPurchaseTicket,
}: {
  journey:       ProcessedJourney;
  isBest:        boolean;
  onViewDetails: () => void;
  onViewMap:     () => void;
  onSelectTaxi:  (journey: ProcessedJourney) => void;
  onStartTrip:   (journey: ProcessedJourney) => void;
  onPurchaseTicket: (journey: ProcessedJourney) => void;
}) {
  const uniqueModes = [...new Set(journey.legs.map((l: Leg) => l.mode))];
  const buttonLabel = getButtonLabel(journey);
  const isTapOrManual = buttonLabel === 'Tap In & Travel' || buttonLabel === 'Start Trip';
  const isTaxi = journey.systemName === 'Minibus Taxi';

  const handlePress = () => {
    if (journey.totalFare === 0) return;
    if (isTaxi) {
      onSelectTaxi(journey);
    } else if (isTapOrManual) {
      onStartTrip(journey);
    } else {
      onPurchaseTicket(journey);
    }
  };

  return (
    <Card style={{ ...styles.journeyCard, ...(isBest ? styles.journeyCardBest : {}) }}>
      {isBest && (
        <View style={styles.bestBadge}>
          <Text style={styles.bestBadgeText}>⚡ Best option</Text>
        </View>
      )}

      <View style={styles.journeyTop}>
        <View>
          <Text style={styles.journeyTimes}>
            {journey.departureTime} → {journey.arrivalTime}
          </Text>
          <Text style={styles.journeyDuration}>{fmtDuration(journey.totalDurationSec)}</Text>
        </View>
        <View style={styles.journeyFareWrap}>
          {journey.totalFare > 0 ? (
            <>
              <Text style={styles.journeyFare}>R{journey.totalFare.toFixed(2)}</Text>
              <Text style={styles.journeyTransfer}>{journey.transferInfo}</Text>
            </>
          ) : (
            <Text style={styles.journeyFareFree}>Free</Text>
          )}
        </View>
      </View>

      <View style={styles.modeRow}>
        {(uniqueModes as string[]).map((mode, i) => (
          <View key={i} style={styles.modeChipRow}>
            <View style={[styles.modeChip, { backgroundColor: MODE_COLOR[mode] ?? COLORS.border }]}>
              <Text style={{ fontSize: 13 }}>{MODE_ICON[mode] ?? '🚍'}</Text>
              <Text style={[styles.modeChipText, { color: MODE_TEXT_COLOR[mode] ?? COLORS.textMuted }]}>
                {mode}
              </Text>
            </View>
            {i < uniqueModes.length - 1 && <Text style={styles.modeArrow}>›</Text>}
          </View>
        ))}
      </View>

      {journey.legs.length > 0 && (
        <View style={styles.legSummary}>
          {journey.legs
            .filter((l: Leg) => l.mode !== 'WALK' || journey.legs.length === 1)
            .map((leg: Leg, i: number) => (
              <Text key={i} style={styles.legText} numberOfLines={1}>
                {MODE_ICON[leg.mode]} {leg.from.name} → {leg.to.name}
              </Text>
            ))}
        </View>
      )}

      <View style={styles.journeyActions}>
        <View style={styles.journeyLinks}>
          <TouchableOpacity onPress={onViewDetails} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.linkText}>Details</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onViewMap} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.linkText, { color: COLORS.accent ?? COLORS.primary }]}>Map</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.selectBtn} onPress={handlePress} activeOpacity={0.85}>
          <Text style={styles.selectBtnText}>{buttonLabel}</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

export default function JourneyResultsScreen() {
  const params = useLocalSearchParams();
  const fromName = safeStr(params.fromName);
  const toName   = safeStr(params.toName);

  const [journeys, setJourneys] = useState<ProcessedJourney[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedJourney, setSelectedJourney] = useState<ProcessedJourney | null>(null);

  const { wallet } = useUserWallet();
  const { paymentMethods } = usePaymentMethods();
  const { purchaseWithLoanSupport } = useTicketPurchase();

  const loadJourneys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fromLat = parseFloat(safeStr(params.fromLat));
      const fromLng = parseFloat(safeStr(params.fromLng));
      const toLat   = parseFloat(safeStr(params.toLat));
      const toLng   = parseFloat(safeStr(params.toLng));

      if ([fromLat, fromLng, toLat, toLng].some(n => !isFinite(n))) {
        throw new Error('Invalid coordinates. Please try searching again.');
      }

      const dateStr  = safeStr(params.date).split('T')[0];
      const timeStr  = safeStr(params.time);
      const [hour, minute] = timeStr.split(':').map(Number);
      const date = new Date(dateStr);
      const time = new Date();
      time.setHours(hour || 0, minute || 0, 0, 0);

      const modes    = (safeStr(params.modes) || 'Rail,Bus,Walk').split(',');
      const tripType = safeStr(params.tripType) === 'cheapest' ? 'cheapest' : 'fastest';

      const itineraries = await findItineraries(
        fromLat, fromLng, toLat, toLng, date, time, modes, tripType,
        fromName, toName   // pass names for taxi search
      );

      const processed: ProcessedJourney[] = itineraries.map((it: Itinerary) => {
        const transitLegs = it.legs.filter((l: Leg) => l.mode !== 'WALK');
        const transfers   = Math.max(0, transitLegs.length - 1);
        return {
          ...it,
          departureTime: it.departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          arrivalTime:   it.arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          transferInfo:  transfers === 0 ? 'Direct' : `${transfers} transfer${transfers > 1 ? 's' : ''}`,
        };
      });

      setJourneys(processed);
    } catch (err: any) {
      console.error('Journey results error:', err);
      setError(err.message || 'Could not find routes. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [
    safeStr(params.fromLat), safeStr(params.fromLng),
    safeStr(params.toLat),   safeStr(params.toLng),
    safeStr(params.date),    safeStr(params.time),
    safeStr(params.modes),   safeStr(params.tripType),
    fromName, toName,
  ]);

  useEffect(() => { loadJourneys(); }, [loadJourneys]);

  const handleSelectTaxi = useCallback((journey: ProcessedJourney) => {
    const firstLeg = journey.legs.find(l => l.mode !== 'WALK');
    if (!firstLeg) return;
    router.push({
      pathname: '/taxi/shared',
      params: {
        from: firstLeg.from.name,
        to: firstLeg.to.name,
      },
    });
  }, []);

  const handleStartTrip = useCallback((journey: ProcessedJourney) => {
    const firstTransitLeg = journey.legs.find(l => l.mode !== 'WALK');
    if (!firstTransitLeg) return;
    const provider = (firstTransitLeg.routeShortName || '').toLowerCase();
    const originStop = firstTransitLeg.from;

    if (provider.includes('gautrain') || provider.includes('rea vaya')) {
      router.push({
        pathname: '/transport/tap',
        params: {
          provider: provider.includes('gautrain') ? 'gautrain' : 'rea_vaya',
          stationId: originStop.id,
          stationName: originStop.name,
        },
      });
    } else if (provider.includes('metrobus')) {
      router.push('/transport/bus-trip');
    } else {
      Alert.alert('Not supported', 'This journey type cannot be started from here.');
    }
  }, []);

  const handlePurchaseTicket = useCallback((journey: ProcessedJourney) => {
    setSelectedJourney(journey);
    setShowPaymentModal(true);
  }, []);

  const handlePaymentConfirm = useCallback(async (useLoan: boolean) => {
  if (!selectedJourney) return;
  await purchaseWithLoanSupport({
    service:     'metrorail',
    amount:      selectedJourney.totalFare,
    description: `${fromName} → ${toName}`,
    from:        fromName,
    to:          toName,
    onSuccess: () => {
      Alert.alert('Ticket purchased! 🎉', `${fromName} → ${toName}`);
      setShowPaymentModal(false);
    },
    onInsufficient: () => Alert.alert('Insufficient Balance', 'Please top up your wallet.'),
  });
}, [selectedJourney, fromName, toName, purchaseWithLoanSupport]);

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Journey Results" onBack={() => router.back()} right={
        <TouchableOpacity onPress={loadJourneys} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ fontSize: 18 }}>🔄</Text>
        </TouchableOpacity>
      } />

      <View style={styles.routeSummary}>
        <Text style={styles.routeFrom} numberOfLines={1}>{fromName}</Text>
        <Text style={styles.routeArrow}>→</Text>
        <Text style={styles.routeTo} numberOfLines={1}>{toName}</Text>
      </View>

      <FlatList
        data={error ? [] : journeys}
        keyExtractor={(item, i) => item.id ?? String(i)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={journeys.length > 0 ? (
          <Text style={styles.resultCount}>{journeys.length} route{journeys.length !== 1 ? 's' : ''} found</Text>
        ) : null}
        ListEmptyComponent={
          error ? (
            <EmptyState icon="⚠️" title="Could not find routes" subtitle={error} action="Try Again" onAction={loadJourneys} />
          ) : (
            <EmptyState icon="🚌" title="No routes found" subtitle="Try different locations or transport modes." action="Go Back" onAction={() => router.back()} />
          )
        }
        renderItem={({ item, index }) => (
          <JourneyCard
            journey={item}
            isBest={index === 0}
            onViewDetails={() => router.push({ pathname: '/journey-details', params: { journey: encodeURIComponent(JSON.stringify(item)) } })}
            onViewMap={() => router.push({ pathname: '/journey-map', params: { journey: encodeURIComponent(JSON.stringify(item)) } })}
            onSelectTaxi={handleSelectTaxi}
            onStartTrip={handleStartTrip}
            onPurchaseTicket={handlePurchaseTicket}
          />
        )}
      />

      <PaymentMethodModal
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onConfirm={handlePaymentConfirm}
        amount={selectedJourney?.totalFare ?? 0}
        walletBalance={wallet?.balance ?? 0}
        loading={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  routeSummary: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    gap: SPACING.xs,
  },
  routeFrom:  { ...(TYPOGRAPHY.caption as object), flex: 1, fontWeight: '600', textAlign: 'right', color: COLORS.textPrimary ?? '#1E293B' },
  routeArrow: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },
  routeTo:    { ...(TYPOGRAPHY.caption as object), flex: 1, fontWeight: '600', color: COLORS.textPrimary ?? '#1E293B' },
  list:        { padding: SPACING.md, paddingBottom: 48 },
  resultCount: { ...(TYPOGRAPHY.caption as object), color: COLORS.textMuted, marginBottom: SPACING.sm },
  journeyCard:     { marginBottom: SPACING.sm },
  journeyCardBest: { borderWidth: 1.5, borderColor: COLORS.primary },
  bestBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start', marginBottom: SPACING.sm,
  },
  bestBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  journeyTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.sm },
  journeyTimes:   { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary ?? '#1E293B' },
  journeyDuration:{ ...(TYPOGRAPHY.caption as object), marginTop: 2, color: COLORS.textMuted },
  journeyFareWrap:{ alignItems: 'flex-end' },
  journeyFare:    { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  journeyFareFree:{ fontSize: 18, fontWeight: '800', color: COLORS.accent ?? COLORS.primary },
  journeyTransfer:{ ...(TYPOGRAPHY.caption as object), marginTop: 2, color: COLORS.textMuted },
  modeRow:     { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.sm },
  modeChipRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  modeChip:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full },
  modeChipText:{ fontSize: 11, fontWeight: '700' },
  modeArrow:   { fontSize: 14, color: COLORS.textMuted },
  legSummary:  { marginBottom: SPACING.sm, gap: 3 },
  legText:     { ...(TYPOGRAPHY.caption as object), color: COLORS.textMuted },
  journeyActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm },
  journeyLinks:   { flexDirection: 'row', gap: SPACING.md },
  linkText:       { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  selectBtn:      { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: 9, borderRadius: RADIUS.lg },
  selectBtnText:  { color: '#fff', fontWeight: '700', fontSize: 13 },
});