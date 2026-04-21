// app/tickets/buy.tsx
import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader, Card, PrimaryButton } from '@/components/ui';
import { useUserWallet } from '@/hooks/useAppwrite';
import { useTicketPurchase } from '@/hooks/useTicketPurchase';
import { TransportStop } from '@/services/transport/types';

export default function BuyTicketScreen() {
  const { user }     = useUser();
  const { wallet, refetch } = useUserWallet();
  const { buyTicket, purchasing } = useTicketPurchase();

  const params = useLocalSearchParams<{
    provider:        string;
    fromStationId:   string;
    fromStationName: string;
    toStationId:     string;
    toStationName:   string;
    // FIX: accept lat/lon so fare engine can compute real distance
    fromLat?:        string;
    fromLon?:        string;
    toLat?:          string;
    toLon?:          string;
    distanceKm:      string;
    // FIX: fare is in RANDS (not cents) — consistent with providers.ts + wallet
    fare:            string;
    categoryId?:     string;
  }>();

  useEffect(() => {
    console.log('BuyTicket params:', params);
  }, []);

  // FIX: fare is rands, NOT cents. No /100.
  const fare     = parseFloat(params.fare      || '0');
  const distance = parseFloat(params.distanceKm || '0');

  if (!params.fromStationName || !params.toStationName || !params.fromStationId || !params.toStationId) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Buy Ticket" onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={styles.errorText}>
            Missing station information. Please go back and select your stations again.
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: SPACING.md }}>
            <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handlePurchase = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Please log in to purchase a ticket.');
      return;
    }

    // FIX: pass real lat/lon from params so the fare engine uses actual distance.
    // Callers should always pass lat/lon when navigating to this screen.
    const origin: TransportStop = {
      id:  params.fromStationId,
      name: params.fromStationName,
      lat: parseFloat(params.fromLat ?? '0'),
      lon: parseFloat(params.fromLon ?? '0'),
    };
    const destination: TransportStop = {
      id:  params.toStationId,
      name: params.toStationName,
      lat: parseFloat(params.toLat ?? '0'),
      lon: parseFloat(params.toLon ?? '0'),
    };

    try {
      const ticket = await buyTicket({
        userId:      user.id,
        providerId:  params.provider ?? 'metrorail',
        origin,
        destination,
        categoryId:  params.categoryId ?? 'metro',
      });

      if (ticket) {
        // FIX: ticket.fare is already in rands — no /100
        Alert.alert(
          'Ticket Purchased 🎫',
          `Fare: R${ticket.fare.toFixed(2)}\nValid until: ${new Date(ticket.validUntil).toLocaleString()}`,
          [{ text: 'View Tickets', onPress: () => {
            refetch();
            router.replace('/tickets');
          }}],
        );
      }
    } catch (e: any) {
      if (e.message === 'INSUFFICIENT_BALANCE') {
        Alert.alert(
          'Insufficient Balance',
          `You need R${fare.toFixed(2)} but your balance is R${(wallet?.balance ?? 0).toFixed(2)}.\n\nPlease top up your wallet.`,
          [
            { text: 'Top Up', onPress: () => router.push('/wallet/topup' as any) },
            { text: 'Cancel', style: 'cancel' },
          ],
        );
      } else {
        Alert.alert('Purchase Failed', e.message ?? 'Could not purchase ticket. Please try again.');
      }
    }
  };

  const insufficient = (wallet?.balance ?? 0) < fare;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Buy Ticket" onBack={() => router.back()} />
      <View style={styles.content}>
        <Card style={styles.summaryCard}>
          <Text style={styles.routeTitle}>
            {params.fromStationName} → {params.toStationName}
          </Text>
          {distance > 0 && (
            <Text style={styles.distance}>{distance.toFixed(1)} km</Text>
          )}

          <View style={styles.divider} />

          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Total Fare</Text>
            {/* FIX: fare is in rands already */}
            <Text style={styles.fareAmount}>R{fare.toFixed(2)}</Text>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Wallet Balance</Text>
            <Text style={[
              styles.balanceAmount,
              insufficient && { color: COLORS.accent ?? '#EF4444' },
            ]}>
              R{(wallet?.balance ?? 0).toFixed(2)}
            </Text>
          </View>

          {insufficient && (
            <View style={styles.insufficientBanner}>
              <Text style={styles.insufficientText}>
                ⚠️ You need R{(fare - (wallet?.balance ?? 0)).toFixed(2)} more.
                {'\n'}A loan may be offered at checkout.
              </Text>
            </View>
          )}
        </Card>

        <PrimaryButton
          label={purchasing ? 'Processing…' : `Pay R${fare.toFixed(2)}`}
          onPress={handlePurchase}
          disabled={purchasing}
          style={styles.buyButton}
        />

        <Text style={styles.infoText}>
          Ticket is valid for 24 hours. Show QR code to the conductor.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  content:     { padding: SPACING.md },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  errorText:   { color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },

  summaryCard:  { marginBottom: SPACING.lg },
  routeTitle:   { ...(TYPOGRAPHY.h3 as object), marginBottom: SPACING.xs, textAlign: 'center', color: COLORS.textPrimary ?? '#1E293B' },
  distance:     { ...(TYPOGRAPHY.caption as object), color: COLORS.textMuted, textAlign: 'center', marginBottom: SPACING.md },
  divider:      { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.sm },

  fareRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
  fareLabel:    { ...(TYPOGRAPHY.bodyBold as object), color: COLORS.textPrimary ?? '#1E293B' },
  fareAmount:   { fontSize: 22, fontWeight: '800', color: COLORS.primary },

  balanceRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.xs },
  balanceLabel: { ...(TYPOGRAPHY.caption as object), color: COLORS.textMuted },
  balanceAmount:{ ...(TYPOGRAPHY.caption as object), fontWeight: '700', color: COLORS.textPrimary ?? '#1E293B' },

  insufficientBanner: {
    marginTop:       SPACING.md,
    padding:         SPACING.sm,
    backgroundColor: '#FEF3C7',
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     '#FCD34D',
  },
  insufficientText: { fontSize: 13, color: '#92400E', lineHeight: 20 },

  buyButton: { marginBottom: SPACING.sm },
  infoText:  { ...(TYPOGRAPHY.caption as object), textAlign: 'center', color: COLORS.textMuted, lineHeight: 20 },
});