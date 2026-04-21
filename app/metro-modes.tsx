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
import { usePaymentMethods, useUserProfile, useUserWallet } from '@/hooks/useAppwrite';
import { AppwriteService } from '@/services/appwriteService';
import { PaymentMethodModal } from '@/components/PaymentMethodModal';
import { COLORS, TYPOGRAPHY, SPACING } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

// Helper to map Appwrite payment methods to modal format
const mapToModalPaymentMethod = (methods: any[]): any[] => {
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

// Service definitions
const metrorailServices = [
  { id: 'routes', title: 'Routes', icon: '🗺️', route: '/metrorail/routes' },
  { id: 'stations', title: 'Stations', icon: '🚉', route: '/metrorail/stations' },
  { id: 'map', title: 'Network Map', icon: '🗺️', route: '/metrorail/map' },
  { id: 'fares', title: 'Fares/Tickets', icon: '💰', route: '/metrorail/tickets' },
  { id: 'schedules', title: 'Schedules', icon: '⏰', route: '/metrorail/schedule' },
  { id: 'history', title: 'Trip History', icon: '📋', route: '/metrorail/history' },
];

const metrobusServices = [
  { id: 'tap', title: 'Tap In/Out', icon: '🚌', route: '/metrobus' },
  { id: 'topup', title: 'Top Up', icon: '💰', route: '/metrobus/top-up' },
  { id: 'history', title: 'Trip History', icon: '📋', route: '/metrobus/history' },
  { id: 'map', title: 'Map', icon: '🗺️', route: '/metrobus/map' },
  { id: 'fares', title: 'Fares', icon: '💵', route: '/metrobus/fares' },
  { id: 'analytics', title: 'Analytics', icon: '📊', route: '/metrobus/analytics' },
];

export default function UnifiedTransportHubScreen() {
  const { user } = useUser();
  const { profile, refetch: refreshProfile } = useUserProfile();
  const { wallet, topUpWallet } = useUserWallet();
  const { paymentMethods } = usePaymentMethods();

  const [metrobusBalance, setMetrobusBalance] = useState(0);
  const [showWalletTopUpModal, setShowWalletTopUpModal] = useState(false);
  const [showMetrobusTopUpModal, setShowMetrobusTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(0);
  const [customAmount, setCustomAmount] = useState('');

  useEffect(() => {
    if (profile) {
      setMetrobusBalance(profile.metrobusBalance || 0);
    }
  }, [profile]);

  const handleWalletTopUpPress = () => {
    setCustomAmount('');
    setShowWalletTopUpModal(true);
  };

  const handleWalletTopUpConfirm = () => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount greater than 0.');
      return;
    }
    setTopUpAmount(amount);
    setShowWalletTopUpModal(false);
    topUpWallet(amount, 'Manual Top-up')
      .then(() => {
        Alert.alert('Success', `R${amount.toFixed(2)} added to wallet.`);
      })
      .catch((error: any) => {
        Alert.alert('Error', error?.message || 'Top-up failed');
      });
  };

  const handleMetrobusTopUpPress = () => {
    Alert.prompt('Top Up Metrobus', 'Enter amount (R)', [
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
          setShowMetrobusTopUpModal(true);
        },
      },
    ]);
  };

  const handleMetrobusTopUpConfirm = async (method: string) => {
    if (method !== 'wallet') {
      Alert.alert('Coming Soon', 'Only wallet payments are supported.');
      return;
    }
    try {
      await topUpWallet(topUpAmount, 'Metrobus Top-up');
      const current = profile?.metrobusBalance || 0;
      await AppwriteService.updateUserProfile(user!.id, { metrobusBalance: current + topUpAmount });
      Alert.alert('Success', `R${topUpAmount.toFixed(2)} added to your Metrobus balance.`);
      setShowMetrobusTopUpModal(false);
      await refreshProfile();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Top-up failed');
    }
  };

  const renderGridItem = (item: any, onPress?: () => void) => (
    <TouchableOpacity
      key={item.id}
      style={styles.gridItem}
      onPress={() => onPress ? onPress() : router.push(item.route)}
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

  const modalPaymentMethods = mapToModalPaymentMethod(paymentMethods);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Transport Hub</Text>
          <View style={{ width: 50 }} />
        </View>

        {/* Wallet Balance Card */}
        <TouchableOpacity onPress={handleWalletTopUpPress} activeOpacity={0.8}>
          <LinearGradient
            colors={[COLORS.primary, COLORS.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.walletCard}
          >
            <View style={styles.walletRow}>
              <Text style={styles.walletLabel}>Wallet Balance</Text>
              <Text style={styles.walletValue}>R{wallet?.balance.toFixed(2) || '0.00'}</Text>
            </View>
            <View style={styles.walletTopUpRow}>
              <Text style={styles.walletTopUpText}>➕ Top Up Wallet</Text>
              <Text style={styles.arrow}>→</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Plan a Journey Card */}
        <TouchableOpacity
          style={styles.planCardWrapper}
          onPress={() => router.push({ pathname: '/(tabs)/home', params: { mode: 'all' } })}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[COLORS.primaryLight, COLORS.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.planCard}
          >
            <View style={styles.planRow}>
              <Text style={styles.planText}>🚆 Plan a journey</Text>
              <Text style={styles.arrow}>→</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Metrorail Services */}
        <Text style={styles.sectionTitle}>🚆 Metrorail</Text>
        <View style={styles.gridRow}>
          {metrorailServices.map(item => renderGridItem(item))}
        </View>

        {/* Metrobus Services */}
        <Text style={styles.sectionTitle}>🚌 Metrobus</Text>
        <View style={styles.gridRow}>
          {metrobusServices.map(item => {
            if (item.id === 'topup') {
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.gridItem}
                  onPress={handleMetrobusTopUpPress}
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
            }
            return renderGridItem(item);
          })}
        </View>

        {/* Metrobus Balance Display */}
        <LinearGradient
          colors={['#FFFFFF', '#F9FAFB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.metrobusBalanceContainer}
        >
          <Text style={styles.metrobusBalanceLabel}>Your Metrobus Balance</Text>
          <Text style={styles.metrobusBalanceValue}>R{metrobusBalance.toFixed(2)}</Text>
        </LinearGradient>
      </ScrollView>

      {/* Wallet Top‑Up Modal */}
      <Modal visible={showWalletTopUpModal} transparent animationType="fade">
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
                onPress={() => setShowWalletTopUpModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.amountModalButton, styles.confirmButton]}
                onPress={handleWalletTopUpConfirm}
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

      {/* Metrobus Top‑Up Modal */}
      <PaymentMethodModal
        visible={showMetrobusTopUpModal}
        onClose={() => setShowMetrobusTopUpModal(false)}
        onSelectPayment={handleMetrobusTopUpConfirm}
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
  walletCard: {
    margin: SPACING.xl,
    padding: SPACING.lg,
    borderRadius: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  walletRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  walletLabel: { fontSize: TYPOGRAPHY.fontSizes.base, color: 'white', fontWeight: '500' },
  walletValue: { fontSize: TYPOGRAPHY.fontSizes["2xl"], fontWeight: 'bold', color: 'white' },
  walletTopUpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
    paddingTop: SPACING.md,
  },
  walletTopUpText: { fontSize: TYPOGRAPHY.fontSizes.base, color: 'white', fontWeight: '600' },
  arrow: { fontSize: TYPOGRAPHY.fontSizes.lg, color: 'white' },
  planCardWrapper: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  planCard: {
    padding: SPACING.lg,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planText: { fontSize: TYPOGRAPHY.fontSizes.base, color: 'white', fontWeight: '600' },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizes.lg,
    fontWeight: '600',
    color: COLORS.gray900,
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  gridItem: {
    width: '48%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: SPACING.md,
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
  metrobusBalanceContainer: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
    padding: SPACING.lg,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  metrobusBalanceLabel: { fontSize: TYPOGRAPHY.fontSizes.sm, color: COLORS.gray600, marginBottom: SPACING.xs },
  metrobusBalanceValue: { fontSize: TYPOGRAPHY.fontSizes["2xl"], fontWeight: 'bold', color: COLORS.primary },
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