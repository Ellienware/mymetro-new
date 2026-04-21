import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { useUserWallet, usePaymentMethods } from '../../hooks/useAppwrite';
import { useTicketPurchase } from '../../hooks/useTicketPurchase';
import { StationSelector } from '../../components/StationSelector';
import { ALL_STOPS } from '../../constants/allStops';
import { PaymentMethodModal } from '../../components/PaymentMethodModal';
import { COLORS } from '../../constants/theme';
import { GAUTRAIN_STATIONS, getGautrainFare } from '../../constants/gautrainFares';
import type { PaymentMethod as ModalPaymentMethod } from '../../components/PaymentMethodModal';

// Helper to convert display name to fare table key
const toFareKey = (displayName: string): string => {
  return displayName.replace(/\sStation$/, '').trim();
};

// Build list of Gautrain stops from ALL_STOPS
const GAUTRAIN_STOPS = ALL_STOPS.filter(stop => {
  if (stop.mode !== 'train') return false;
  const key = toFareKey(stop.name);
  return GAUTRAIN_STATIONS.includes(key as any);
});

// Helper to map Appwrite payment methods to modal format
const mapToModalPaymentMethod = (methods: any[]): ModalPaymentMethod[] => {
  return methods.map(method => ({
    id: method.$id,
    name: method.name,
    icon: method.type === 'card' ? '💳' : '🏦',
    description: method.description,
    available: true,
    isCustom: true,
    lastFour: method.lastFour,
    expiryDate: method.expiryDate,
    cardType: method.cardType,
  }));
};

export default function GautrainBuyTicketScreen() {
  const { user } = useUser();
  const { wallet, payForTransport } = useUserWallet();
  const { paymentMethods } = usePaymentMethods();
  const { purchaseWithLoanSupport } = useTicketPurchase();
  const [fromStation, setFromStation] = useState<any>(null);
  const [toStation, setToStation] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [fare, setFare] = useState<number>(0);

  const calculateFare = () => {
    if (!fromStation || !toStation) return 0;
    const fromKey = toFareKey(fromStation.name);
    const toKey = toFareKey(toStation.name);
    // For now, use peak fare (we can later add time‑based logic)
    const fareAmount = getGautrainFare(fromKey, toKey, true);
    return fareAmount;
  };

  const handleBuyPress = () => {
    if (!fromStation || !toStation) {
      Alert.alert('Select Stations', 'Please select both origin and destination.');
      return;
    }
    const calculatedFare = calculateFare();
    if (calculatedFare <= 0) {
      Alert.alert('Error', 'Could not calculate fare. Please check station selection.');
      return;
    }
    setFare(calculatedFare);
    setShowPaymentModal(true);
  };

  const handlePaymentSelect = async (method: string, service?: string, journeyDetails?: any) => {
    if (method !== 'wallet') {
      Alert.alert('Coming Soon', 'Only wallet payments are supported.');
      return;
    }
    try {
      await purchaseWithLoanSupport({
        service: 'gautrain',
        amount: fare,
        description: `Gautrain ticket: ${fromStation.name} → ${toStation.name}`,
        from: fromStation.name,
        to: toStation.name,
        onSuccess: () => {
          Alert.alert('Success', 'Ticket purchased! Check your tickets.');
          setShowPaymentModal(false);
          router.back();
        },
        onInsufficient: () => {
          Alert.alert('Insufficient Balance', 'Please top up your wallet.');
        },
      });
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Purchase failed');
    }
  };

  const modalPaymentMethods = mapToModalPaymentMethod(paymentMethods);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buy Gautrain Ticket</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.content}>
        <StationSelector
          label="FROM"
          selectedStation={fromStation}
          onStationSelect={setFromStation}
          placeholder="Select departure station"
          stations={GAUTRAIN_STOPS}
        />
        <StationSelector
          label="TO"
          selectedStation={toStation}
          onStationSelect={setToStation}
          placeholder="Select destination station"
          stations={GAUTRAIN_STOPS}
        />
        {fromStation && toStation && (
          <Text style={styles.fareText}>Estimated Fare: R{calculateFare().toFixed(2)}</Text>
        )}
        <TouchableOpacity
          style={[styles.buyButton, (!fromStation || !toStation) && styles.disabled]}
          onPress={handleBuyPress}
          disabled={!fromStation || !toStation}
        >
          <Text style={styles.buyButtonText}>Buy Ticket</Text>
        </TouchableOpacity>
      </View>

      <PaymentMethodModal
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSelectPayment={handlePaymentSelect}
        onAddPaymentMethod={() => router.push('/payment-methods/add')}
        amount={fare}
        walletBalance={wallet?.balance || 0}
        customPaymentMethods={modalPaymentMethods}
        service="gautrain"
        journeyDetails={{ from: fromStation?.name, to: toStation?.name }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: { padding: 5 },
  backText: { fontSize: 16, color: COLORS.primary },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  content: { padding: 20, gap: 20 },
  fareText: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary, textAlign: 'center' },
  buyButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buyButtonText: { color: 'white', fontSize: 18, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});