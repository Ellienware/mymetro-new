import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  Alert, Modal, TextInput, RefreshControl,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '@/lib/appwrite';
import { AppwriteService } from '@/services/appwriteService';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader, Card, PrimaryButton, LoadingScreen, EmptyState } from '@/components/ui';

export default function DriverWalletScreen() {
  const { user } = useUser();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bankAccount, setBankAccount] = useState({
    bankName: '',
    accountNumber: '',
    accountHolderName: '',
  });

  const loadData = async () => {
    try {
      // Get driver record
      const drivers = await databases.listDocuments(DATABASE_ID, COLLECTIONS.TAXI_DRIVERS, [
        Query.equal('userId', user!.id),
      ]);
      if (!drivers.documents.length) throw new Error('Driver not found');
      const driver = drivers.documents[0];
      setDriverId(driver.$id);

      // Get wallet
      const walletData = await AppwriteService.getDriverWallet(driver.$id);
      setWallet(walletData || { balance: 0 });

      // Get transactions
      const txns = await AppwriteService.getDriverTransactions(driver.$id, 50);
      setTransactions(txns);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not load wallet data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount');
      return;
    }
    if (amount < 50) {
      Alert.alert('Minimum R50', 'Minimum withdrawal amount is R50');
      return;
    }
    if (!wallet || wallet.balance < amount) {
      Alert.alert('Insufficient balance', `Your balance is R${wallet?.balance?.toFixed(2) || 0}`);
      return;
    }
    if (!bankAccount.bankName || !bankAccount.accountNumber || !bankAccount.accountHolderName) {
      Alert.alert('Missing info', 'Please fill in all bank details');
      return;
    }

    setSubmitting(true);
    try {
      const result = await AppwriteService.requestDriverWithdrawal(driverId!, amount, bankAccount);
      if (result.success) {
        Alert.alert('Withdrawal Requested', 'Your withdrawal request has been submitted and will be processed within 3-5 business days.');
        setWithdrawModalVisible(false);
        setWithdrawAmount('');
        setBankAccount({ bankName: '', accountNumber: '', accountHolderName: '' });
        await loadData();
      } else {
        Alert.alert('Error', result.error || 'Withdrawal failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not process withdrawal');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingScreen />;

  const balance = wallet?.balance || 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Driver Wallet" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        {/* Balance card */}
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>R{balance.toFixed(2)}</Text>
          <Text style={styles.balanceUpdated}>
            Updated {wallet?.updatedAt ? new Date(wallet.updatedAt).toLocaleDateString() : 'today'}
          </Text>
        </Card>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setWithdrawModalVisible(true)}>
            <Text style={styles.actionIcon}>🏧</Text>
            <Text style={styles.actionLabel}>Withdraw</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/driver/minibus-taxi/earnings')}>
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionLabel}>Earnings</Text>
          </TouchableOpacity>
        </View>

        {/* Transactions */}
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {transactions.length === 0 ? (
          <EmptyState icon="💰" title="No transactions" subtitle="Your earnings will appear here" />
        ) : (
          transactions.map((tx, idx) => (
            <Card key={tx.$id} style={styles.txCard}>
              <View style={styles.txRow}>
                <View style={[styles.txIcon, tx.amount > 0 ? styles.txIconCredit : styles.txIconDebit]}>
                  <Text>{tx.amount > 0 ? '💰' : '💸'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txDesc}>{tx.description}</Text>
                  <Text style={styles.txDate}>{new Date(tx.createdAt).toLocaleString()}</Text>
                </View>
                <Text style={[styles.txAmount, tx.amount > 0 ? styles.creditText : styles.debitText]}>
                  {tx.amount > 0 ? '+' : ''}R{Math.abs(tx.amount).toFixed(2)}
                </Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Withdrawal Modal */}
      <Modal visible={withdrawModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Withdraw Earnings</Text>
            <Text style={styles.modalSub}>Enter amount and bank details</Text>

            <Text style={styles.inputLabel}>Amount (R)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="numeric"
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
            />

            <Text style={styles.inputLabel}>Bank Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Capitec"
              value={bankAccount.bankName}
              onChangeText={(text) => setBankAccount({ ...bankAccount, bankName: text })}
            />

            <Text style={styles.inputLabel}>Account Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 1234567890"
              keyboardType="numeric"
              value={bankAccount.accountNumber}
              onChangeText={(text) => setBankAccount({ ...bankAccount, accountNumber: text })}
            />

            <Text style={styles.inputLabel}>Account Holder Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Full name as on bank account"
              value={bankAccount.accountHolderName}
              onChangeText={(text) => setBankAccount({ ...bankAccount, accountHolderName: text })}
            />

            <Text style={styles.noteText}>
              Minimum withdrawal: R50. Processing takes 3-5 business days.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setWithdrawModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <PrimaryButton
                label={submitting ? 'Processing...' : 'Request Withdrawal'}
                onPress={handleWithdraw}
                loading={submitting}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 48 },
  balanceCard: { alignItems: 'center', padding: SPACING.lg, marginBottom: SPACING.md, backgroundColor: COLORS.primary },
  balanceLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  balanceAmount: { fontSize: 48, fontWeight: '800', color: '#fff', marginBottom: 8 },
  balanceUpdated: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  actionsRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
  actionBtn: { flex: 1, backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: RADIUS.lg, alignItems: 'center', ...SHADOWS.sm },
  actionIcon: { fontSize: 28, marginBottom: 4 },
  actionLabel: { ...TYPOGRAPHY.captionBold },
  sectionTitle: { ...TYPOGRAPHY.h4, marginBottom: SPACING.md },
  txCard: { marginBottom: SPACING.sm },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txIconCredit: { backgroundColor: COLORS.successLight },
  txIconDebit: { backgroundColor: COLORS.errorLight },
  txDesc: { ...TYPOGRAPHY.bodyBold, fontSize: 14 },
  txDate: { ...TYPOGRAPHY.caption, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '700' },
  creditText: { color: COLORS.success },
  debitText: { color: COLORS.error },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: SPACING.md },
  modalContent: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg },
  modalTitle: { ...TYPOGRAPHY.h3, marginBottom: 4 },
  modalSub: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginBottom: SPACING.md },
  inputLabel: { ...TYPOGRAPHY.label, marginTop: SPACING.sm, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 15, color: COLORS.textPrimary,
  },
  noteText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: SPACING.md, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg, alignItems: 'center', backgroundColor: COLORS.border },
  cancelText: { ...TYPOGRAPHY.bodyBold, color: COLORS.textSecondary },
});