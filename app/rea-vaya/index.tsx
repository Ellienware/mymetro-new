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
  Modal,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { useUserProfile, useUserWallet, usePaymentMethods } from '../../hooks/useAppwrite';
import { PaymentMethodModal } from '../../components/PaymentMethodModal';
import { AppwriteService } from '../../services/appwriteService';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
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

// Define grid items
const gridItems = [
  { id: 'cards', title: 'Virtual Cards', icon: '💳', route: '/rea-vaya/cards' },
  { id: 'history', title: 'Trip History', icon: '📋', route: '/rea-vaya/history' },
  { id: 'qr', title: 'Pay via QR', icon: '📱', route: '/rea-vaya/qr-pay' },
  { id: 'map', title: 'Map', icon: '🗺️', route: '/rea-vaya/map' },
  { id: 'analytics', title: 'Analytics', icon: '📊', route: '/rea-vaya/analytics' },
  { id: 'fares', title: 'Fares', icon: '💰', route: '/rea-vaya/fares' },
];

export default function ReaVayaHubScreen() {
  const { user } = useUser();
  const { profile, loading: profileLoading, refetch: refreshProfile } = useUserProfile();
  const { wallet, payForTransport, topUpWallet } = useUserWallet();
  const { paymentMethods } = usePaymentMethods();
  const [points, setPoints] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(0);
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [customAmount, setCustomAmount] = useState('');

  useEffect(() => {
    if (profile) {
      setPoints(profile.reaVayaPoints || 0);
    }
  }, [profile]);

  const handleTopUpPress = () => {
    setCustomAmount('');
    setShowAmountModal(true);
  };

  const handleCustomAmountConfirm = () => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount greater than 0.');
      return;
    }
    setTopUpAmount(amount);
    setShowAmountModal(false);
    setShowPaymentModal(true);
  };

  const handleQuickTopUp = (amount: number) => {
    setTopUpAmount(amount);
    setShowPaymentModal(true);
  };

  const handlePaymentSelect = async (method: string, service?: string, journeyDetails?: any) => {
    if (method !== 'wallet') {
      Alert.alert('Coming Soon', 'Only wallet payments are supported at the moment.');
      return;
    }

    try {
      await payForTransport({
        service: 'rea_vaya',
        amount: topUpAmount,
        description: `Rea Vaya points top-up`,
      });
      Alert.alert('Success', `${topUpAmount} points added to your Rea Vaya account.`);
      setShowPaymentModal(false);
      await refreshProfile();
    } catch (error: any) {
      console.error('payForTransport error:', error);
      try {
        await topUpWallet(topUpAmount, 'Rea Vaya Points');
        const current = profile?.reaVayaPoints || 0;
        await AppwriteService.updateUserProfile(user!.id, { reaVayaPoints: current + topUpAmount });
        Alert.alert('Success', `${topUpAmount} points added to your Rea Vaya account.`);
        setShowPaymentModal(false);
        await refreshProfile();
      } catch (fallbackError: any) {
        Alert.alert('Error', fallbackError?.message || 'Top-up failed');
      }
    }
  };

  const renderGridItem = ({ item }: { item: typeof gridItems[0] }) => (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => router.push(item.route)}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={['#FFFFFF', '#F9FAFB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gridGradient}
      >
        <Text style={styles.gridIcon}>{item.icon}</Text>
        <Text style={styles.gridTitle}>{item.title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  const quickAmounts = [20, 50, 100, 200];
  const modalPaymentMethods = mapToModalPaymentMethod(paymentMethods);

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rea Vaya</Text>
          <View style={{ width: 50 }} />
        </View>

        {/* Points Balance Card */}
        <TouchableOpacity onPress={handleTopUpPress} activeOpacity={0.8}>
          <LinearGradient
            colors={[COLORS.primary, COLORS.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Points Balance</Text>
              <Text style={styles.balanceValue}>{points}</Text>
            </View>
            <View style={styles.addCardRow}>
              <Text style={styles.addCardText}>➕ Top Up Points</Text>
              <Text style={styles.arrow}>→</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Tap In/Out Buttons */}
        <View style={styles.tapRow}>
          <TouchableOpacity style={styles.tapButton} onPress={() => router.push('/rea-vaya/tap-in')} activeOpacity={0.7}>
            <LinearGradient
              colors={[COLORS.primaryLight, COLORS.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tapGradient}
            >
              <Text style={styles.tapButtonText}>🚌 Tap In</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tapButton} onPress={() => router.push('/rea-vaya/tap-out')} activeOpacity={0.7}>
            <LinearGradient
              colors={[COLORS.primaryLight, COLORS.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tapGradient}
            >
              <Text style={styles.tapButtonText}>🚌 Tap Out</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Quick top‑up row */}
        <View style={styles.quickTopUpContainer}>
          <Text style={styles.sectionTitle}>Quick Top‑Up</Text>
          <View style={styles.quickTopUpRow}>
            {quickAmounts.map(amount => (
              <TouchableOpacity
                key={amount}
                style={styles.quickTopUpButton}
                onPress={() => handleQuickTopUp(amount)}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#FFFFFF', '#F9FAFB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.quickTopUpGradient}
                >
                  <Text style={styles.quickTopUpText}>R{amount}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Services Grid Section */}
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

      {/* Custom Amount Modal */}
      <Modal visible={showAmountModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={['#FFFFFF', '#F9FAFB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.amountModal}
          >
            <Text style={styles.amountModalTitle}>Enter Amount (R)</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="e.g., 50"
              keyboardType="numeric"
              value={customAmount}
              onChangeText={setCustomAmount}
              placeholderTextColor="#9CA3AF"
            />
            <View style={styles.amountModalButtons}>
              <TouchableOpacity
                style={[styles.amountModalButton, styles.cancelButton]}
                onPress={() => setShowAmountModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.amountModalButton, styles.confirmButton]}
                onPress={handleCustomAmountConfirm}
              >
                <LinearGradient
                  colors={[COLORS.primary, COLORS.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.confirmGradient}
                >
                  <Text style={styles.confirmButtonText}>OK</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>

      {/* Payment Modal */}
      <PaymentMethodModal
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSelectPayment={handlePaymentSelect}
        onAddPaymentMethod={() => router.push('/payment-methods/add')}
        amount={topUpAmount}
        walletBalance={wallet?.balance || 0}
        customPaymentMethods={modalPaymentMethods}
        service="rea_vaya"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: { padding: SPACING.xs },
  backText: { fontSize: TYPOGRAPHY.fontSizes.base, color: COLORS.primary },
  headerTitle: { fontSize: TYPOGRAPHY.fontSizes.xl, fontWeight: 'bold', color: COLORS.gray900 },
  balanceCard: {
    margin: SPACING.xl,
    padding: SPACING.lg,
    borderRadius: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  balanceLabel: { fontSize: TYPOGRAPHY.fontSizes.base, color: 'white', fontWeight: '500' },
  balanceValue: { fontSize: TYPOGRAPHY.fontSizes["2xl"], fontWeight: 'bold', color: 'white' },
  addCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
    paddingTop: SPACING.md,
  },
  addCardText: { fontSize: TYPOGRAPHY.fontSizes.base, color: 'white', fontWeight: '600' },
  arrow: { fontSize: TYPOGRAPHY.fontSizes.lg, color: 'white' },
  tapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  tapButton: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  tapGradient: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  tapButtonText: {
    color: 'white',
    fontSize: TYPOGRAPHY.fontSizes.base,
    fontWeight: '600',
  },
  quickTopUpContainer: {
    marginBottom: SPACING.lg,
  },
  quickTopUpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  quickTopUpButton: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  quickTopUpGradient: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  quickTopUpText: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    fontWeight: '600',
    color: COLORS.primary,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizes.lg,
    fontWeight: '600',
    color: COLORS.gray900,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  gridRow: {
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  gridItem: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  gridGradient: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  gridIcon: { fontSize: 32, marginBottom: SPACING.sm },
  gridTitle: { fontSize: TYPOGRAPHY.fontSizes.sm, fontWeight: '500', color: COLORS.gray900 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountModal: {
    borderRadius: 20,
    padding: SPACING.lg,
    width: '80%',
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  amountModalTitle: {
    fontSize: TYPOGRAPHY.fontSizes.lg,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
    textAlign: 'center',
    color: COLORS.gray900,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizes.base,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.white,
  },
  amountModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  amountModalButton: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
  },
  cancelButton: {
    backgroundColor: '#E5E7EB',
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: COLORS.gray700,
    fontWeight: '600',
  },
  confirmButton: {
    overflow: 'hidden',
  },
  confirmGradient: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});