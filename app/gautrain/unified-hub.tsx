import React, { useState } from 'react';
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
import { useUserWallet, usePaymentMethods } from '../../hooks/useAppwrite';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

// Train features
const trainFeatures = [
  { id: 'train-routes', title: 'Routes', icon: '🗺️', route: '/gautrain/routes' },
  { id: 'train-stops', title: 'Train Stops', icon: '📍', route: '/gautrain/stops' },
  { id: 'train-map', title: 'Network Map', icon: '🌐', route: '/gautrain/map' },
  { id: 'train-fares', title: 'Fares', icon: '💰', route: '/gautrain/fares' },
  { id: 'train-history', title: 'My Trips', icon: '📋', route: '/gautrain/history' },
  { id: 'virtual-cards', title: 'Virtual Cards', icon: '💳', route: '/rea-vaya/cards?service=Gautrain' },
];

// Bus features
const busFeatures = [
  { id: 'bus-tracker', title: 'Live Buses', icon: '🚌', route: '/gautrain-bus/tracker' },
  { id: 'bus-stops', title: 'Bus stops', icon: '📍', route: '/gautrain-bus/stops' },
  { id: 'bus-map', title: 'Network Map', icon: '🗺️', route: '/gautrain-bus/map' },
  { id: 'bus-alerts', title: 'Alerts', icon: '⚠️', route: '/updates' },
];

export default function UnifiedGautrainHubScreen() {
  const { user } = useUser();
  const { wallet, topUpWallet } = useUserWallet();
  const { paymentMethods } = usePaymentMethods();
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(0);
  const [customAmount, setCustomAmount] = useState('');

  const handleBuyTicket = () => {
    router.push('/gautrain/buy-ticket');
  };

  const handleMyTickets = () => {
    router.push('/gautrain/history');
  };

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
    topUpWallet(amount, 'Manual Top-up')
      .then(() => {
        Alert.alert('Success', `R${amount.toFixed(2)} added to wallet.`);
      })
      .catch((error: any) => {
        Alert.alert('Error', error?.message || 'Top-up failed');
      });
  };

  const renderGridItem = ({ item }: { item: typeof trainFeatures[0] }) => (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => router.push(item.route as any)}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={['#FFFFFF', '#F9FAFB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gridGradient}
      >
        <Text style={styles.gridIcon}>{item.icon}</Text>
        <Text style={styles.gridLabel}>{item.title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gautrain</Text>
          <View style={{ width: 50 }} />
        </View>

        {/* Balance Card */}
        <TouchableOpacity onPress={handleTopUpPress} activeOpacity={0.8}>
          <LinearGradient
            colors={[COLORS.primary, COLORS.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Wallet Balance</Text>
              <Text style={styles.balanceValue}>R{wallet?.balance.toFixed(2) || '0.00'}</Text>
            </View>
            <View style={styles.topUpRow}>
              <Text style={styles.topUpText}>➕ Top Up Wallet</Text>
              <Text style={styles.arrow}>→</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleBuyTicket} activeOpacity={0.7}>
            <LinearGradient
              colors={['#FFFFFF', '#F9FAFB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.actionGradient}
            >
              <Text style={styles.actionIcon}>🎫</Text>
              <Text style={styles.actionText}>Buy Train Ticket</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleMyTickets} activeOpacity={0.7}>
            <LinearGradient
              colors={['#FFFFFF', '#F9FAFB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.actionGradient}
            >
              <Text style={styles.actionIcon}>📋</Text>
              <Text style={styles.actionText}>My Tickets</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Train Section */}
        <Text style={styles.sectionTitle}>🚆 Gautrain Train</Text>
        <FlatList
          data={trainFeatures}
          renderItem={renderGridItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          scrollEnabled={false}
        />

        {/* Bus Section */}
        <Text style={styles.sectionTitle}>🚌 Gautrain Bus</Text>
        <FlatList
          data={busFeatures}
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
  topUpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
    paddingTop: SPACING.md,
  },
  topUpText: { fontSize: TYPOGRAPHY.fontSizes.base, color: 'white', fontWeight: '600' },
  arrow: { fontSize: TYPOGRAPHY.fontSizes.lg, color: 'white' },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  actionGradient: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: 16,
  },
  actionIcon: { fontSize: TYPOGRAPHY.fontSizes["2xl"], marginBottom: SPACING.xs },
  actionText: { fontSize: TYPOGRAPHY.fontSizes.sm, fontWeight: '600', color: COLORS.gray900 },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizes.lg,
    fontWeight: '600',
    color: COLORS.gray900,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
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
    borderRadius: 16,
  },
  gridIcon: { fontSize: 32, marginBottom: SPACING.sm },
  gridLabel: { fontSize: TYPOGRAPHY.fontSizes.sm, fontWeight: '500', color: COLORS.gray900 },
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