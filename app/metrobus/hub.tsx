import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { useUserProfile, useUserWallet, usePaymentMethods } from '../../hooks/useAppwrite';
import { AppwriteService } from '../../services/appwriteService';
import { PaymentMethodModal } from '../../components/PaymentMethodModal';
import { COLORS } from '../../constants/theme';
import type { PaymentMethod as ModalPaymentMethod } from '../../components/PaymentMethodModal';

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

const gridItems = [
  { id: 'tap', title: 'Tap In/Out', icon: '🚌', route: '/metrobus' },
  { id: 'topup', title: 'Top Up', icon: '💰', route: '/metrobus/top-up' },
  { id: 'history', title: 'Trip History', icon: '📋', route: '/metrobus/history' },
  { id: 'map', title: 'Map', icon: '🗺️', route: '/metrobus/map' },
  { id: 'fares', title: 'Fares', icon: '💵', route: '/metrobus/fares' },
  { id: 'analytics', title: 'Analytics', icon: '📊', route: '/metrobus/analytics' },
];

export default function MetrobusHubScreen() {
  const { user } = useUser();
  const { profile, refetch: refreshProfile } = useUserProfile();
  const { wallet, topUpWallet } = useUserWallet();
  const { paymentMethods } = usePaymentMethods();
  const [balance, setBalance] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(0);

  useEffect(() => {
    if (profile) {
      setBalance(profile.metrobusBalance || 0);
    }
  }, [profile]);

  const handleTapNow = () => {
    router.push('/metrobus');
  };

  const handleTopUpPress = () => {
    Alert.prompt('Top Up Amount', 'Enter amount (R)', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'OK',
        onPress: (value) => {
          const amount = parseFloat(value || '0');
          if (isNaN(amount) || amount <= 0) {
            Alert.alert('Invalid amount');
            return;
          }
          setTopUpAmount(amount);
          setShowPaymentModal(true);
        },
      },
    ]);
  };

  const handlePaymentSelect = async (method: string, service?: string, journeyDetails?: any) => {
    if (method !== 'wallet') {
      Alert.alert('Coming Soon', 'Only wallet payments are supported at the moment.');
      return;
    }
    try {
      // First, top up the wallet (this will also repay any active loans)
      await topUpWallet(topUpAmount, 'Metrobus Top-up');
      // Then add the amount to metrobus balance
      const current = profile?.metrobusBalance || 0;
      await AppwriteService.updateUserProfile(user!.id, { metrobusBalance: current + topUpAmount });
      Alert.alert('Success', `R${topUpAmount.toFixed(2)} added to your Metrobus balance.`);
      setShowPaymentModal(false);
      await refreshProfile(); // update displayed balance
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Top-up failed');
    }
  };

  const renderGridItem = ({ item }: { item: typeof gridItems[0] }) => (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => router.push(item.route)}
    >
      <Text style={styles.gridIcon}>{item.icon}</Text>
      <Text style={styles.gridTitle}>{item.title}</Text>
    </TouchableOpacity>
  );

  // Map payment methods to modal format
  const modalPaymentMethods = mapToModalPaymentMethod(paymentMethods);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Metrobus</Text>
          <View style={{ width: 50 }} />
        </View>

        <TouchableOpacity style={styles.balanceCard} onPress={handleTapNow}>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Balance</Text>
            <Text style={styles.balanceValue}>R{balance.toFixed(2)}</Text>
          </View>
          <View style={styles.tapRow}>
            <Text style={styles.tapText}>🚌 Tap Now</Text>
            <Text style={styles.arrow}>→</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.topUpButton} onPress={handleTopUpPress}>
          <Text style={styles.topUpButtonText}>➕ Top Up Metrobus Balance</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Services</Text>
        <FlatList
          data={gridItems}
          renderItem={renderGridItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          scrollEnabled={false}
        />
      </ScrollView>

      <PaymentMethodModal
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSelectPayment={handlePaymentSelect}
        onAddPaymentMethod={() => router.push('/payment-methods/add')}
        amount={topUpAmount}
        walletBalance={wallet?.balance || 0}
        customPaymentMethods={modalPaymentMethods}
        service="metrobus"
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
  balanceCard: {
    backgroundColor: COLORS.primary,
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceLabel: { fontSize: 16, color: 'white', fontWeight: '500' },
  balanceValue: { fontSize: 28, fontWeight: 'bold', color: 'white' },
  tapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
    paddingTop: 12,
  },
  tapText: { fontSize: 16, color: 'white', fontWeight: '600' },
  arrow: { fontSize: 18, color: 'white' },
  topUpButton: {
    backgroundColor: '#E5E7EB',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  topUpButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  gridRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  gridItem: {
    width: '48%',
    backgroundColor: 'white',
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  gridIcon: { fontSize: 32, marginBottom: 8 },
  gridTitle: { fontSize: 14, fontWeight: '500', color: '#000' },
});