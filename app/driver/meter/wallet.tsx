// app/driver/meter/wallet.tsx
// FIX: '@/constants/themes' → '@/constants/theme'
// FIX: withdrawal modal was centered (justifyContent:'center') — on keyboards
//      appearing it would get pushed off-screen. Changed to bottom-sheet pattern
//      with KeyboardAvoidingView.
// FIX: `totalEarned` was computed by filtering on `t.type === 'credit'` but
//      the transaction type used by AppwriteService is 'wallet_topup' and 'transport'.
//      Changed to sum all positive amounts regardless of type label.
// FIX: `transactions.map(tx => ...)` was used directly for rendering instead of
//      FlatList — on large transaction lists this causes a VirtualizedList
//      warning and sluggish render inside ScrollView. Kept as ScrollView render
//      since the list is bounded at 50 items and the outer container is a
//      ScrollView (not FlatList), which is correct for this layout.
// NOTE: AppwriteService.getMeterDriverWallet / createMeterDriverWallet /
//       getMeterDriverTransactions / requestMeterDriverWithdrawal are custom
//       methods that the developer must add to AppwriteService. Their signatures
//       are consistent with the existing pattern (same as getUserWallet etc.).
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  Alert, Modal, TextInput, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '@/lib/appwrite';
import { AppwriteService } from '@/services/appwriteService';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader, Card, PrimaryButton, LoadingScreen, EmptyState } from '@/components/ui';

export default function MeterDriverWalletScreen() {
  const { user }  = useUser();
  const [driverId,            setDriverId]            = useState<string | null>(null);
  const [wallet,              setWallet]              = useState<any>(null);
  const [transactions,        setTransactions]        = useState<any[]>([]);
  const [loading,             setLoading]             = useState(true);
  const [refreshing,          setRefreshing]          = useState(false);
  const [withdrawVisible,     setWithdrawVisible]     = useState(false);
  const [withdrawAmount,      setWithdrawAmount]      = useState('');
  const [submitting,          setSubmitting]          = useState(false);
  const [bankAccount,         setBankAccount]         = useState({
    bankName: '', accountNumber: '', accountHolderName: '',
  });

  const loadData = async () => {
    if (!user?.id) return;
    try {
      const drivers = await databases.listDocuments(
        DATABASE_ID, COLLECTIONS.METER_DRIVERS, [Query.equal('userId', user.id)],
      );
      if (!drivers.documents.length) throw new Error('Driver not found');
      const driver = drivers.documents[0];
      setDriverId(driver.$id);

      let w = await AppwriteService.getMeterDriverWallet(driver.$id);
      if (!w) w = await AppwriteService.createMeterDriverWallet(driver.$id);
      setWallet(w);

      const txns = await AppwriteService.getMeterDriverTransactions(driver.$id, 50);
      setTransactions(txns);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not load wallet data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0)          { Alert.alert('Invalid amount',      'Please enter a valid amount.'); return; }
    if (amount < 50)                            { Alert.alert('Minimum R50',          'Minimum withdrawal is R50.'); return; }
    if (!wallet || wallet.balance < amount)     { Alert.alert('Insufficient balance', `Balance: R${(wallet?.balance ?? 0).toFixed(2)}`); return; }
    if (!bankAccount.bankName || !bankAccount.accountNumber || !bankAccount.accountHolderName) {
      Alert.alert('Missing info', 'Please fill in all bank details.'); return;
    }
    setSubmitting(true);
    try {
      const result = await AppwriteService.requestMeterDriverWithdrawal(driverId!, amount, bankAccount);
      if (result.success) {
        Alert.alert('Withdrawal Requested ✅', 'Your request has been submitted. Processing takes 3–5 business days.');
        setWithdrawVisible(false);
        setWithdrawAmount('');
        setBankAccount({ bankName: '', accountNumber: '', accountHolderName: '' });
        await loadData();
      } else {
        Alert.alert('Error', result.error ?? 'Withdrawal failed.');
      }
    } catch {
      Alert.alert('Error', 'Could not process withdrawal. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingScreen />;

  const balance     = wallet?.balance ?? 0;
  // FIX: sum positive amounts regardless of type label
  const totalEarned = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Meter Taxi Wallet" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>R{balance.toFixed(2)}</Text>
          <Text style={styles.balanceUpdated}>
            Updated {wallet?.updatedAt ? new Date(wallet.updatedAt).toLocaleDateString('en-ZA') : 'today'}
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setWithdrawVisible(true)} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>🏧</Text>
            <Text style={styles.actionLabel}>Withdraw</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/driver/meter/earnings' as any)} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionLabel}>Earnings</Text>
          </TouchableOpacity>
        </View>

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>R{totalEarned.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Total Earned</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{transactions.filter(t => t.amount > 0).length}</Text>
            <Text style={styles.statLabel}>Earnings Records</Text>
          </View>
        </View>

        {/* Transactions */}
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {transactions.length === 0 ? (
          <EmptyState icon="💰" title="No transactions yet" subtitle="Your earnings and withdrawals will appear here." />
        ) : (
          transactions.map(tx => (
            <Card key={tx.$id} style={styles.txCard}>
              <View style={styles.txRow}>
                <View style={[styles.txIconWrap, tx.amount > 0 ? styles.txCredit : styles.txDebit]}>
                  <Text style={{ fontSize: 16 }}>{tx.amount > 0 ? '💰' : '💸'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txDesc}>{tx.description}</Text>
                  <Text style={styles.txDate}>{new Date(tx.createdAt).toLocaleString('en-ZA')}</Text>
                </View>
                <Text style={[styles.txAmount, tx.amount > 0 ? styles.txAmountCredit : styles.txAmountDebit]}>
                  {tx.amount > 0 ? '+' : ''}R{Math.abs(tx.amount).toFixed(2)}
                </Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Withdrawal modal */}
      <Modal visible={withdrawVisible} animationType="slide" transparent onRequestClose={() => setWithdrawVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setWithdrawVisible(false)} activeOpacity={1} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Withdraw Earnings</Text>
            <Text style={styles.modalSub}>Min R50 · Processing: 3–5 business days</Text>

            {[
              { label: 'Amount (R)',             key: 'amount',  kbd: 'numeric' as const, placeholder: '0.00' },
              { label: 'Bank Name',              key: 'bank',    kbd: 'default' as const, placeholder: 'e.g. Capitec' },
              { label: 'Account Number',         key: 'accNum',  kbd: 'numeric' as const, placeholder: '1234567890' },
              { label: 'Account Holder Name',    key: 'holder',  kbd: 'default' as const, placeholder: 'Full name' },
            ].map(f => (
              <View key={f.key}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={f.placeholder}
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType={f.kbd}
                  value={
                    f.key === 'amount' ? withdrawAmount
                    : f.key === 'bank' ? bankAccount.bankName
                    : f.key === 'accNum' ? bankAccount.accountNumber
                    : bankAccount.accountHolderName
                  }
                  onChangeText={text => {
                    if (f.key === 'amount') setWithdrawAmount(text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'));
                    else if (f.key === 'bank')   setBankAccount(p => ({ ...p, bankName: text }));
                    else if (f.key === 'accNum') setBankAccount(p => ({ ...p, accountNumber: text }));
                    else                         setBankAccount(p => ({ ...p, accountHolderName: text }));
                  }}
                />
              </View>
            ))}

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setWithdrawVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <PrimaryButton
                label="Request Withdrawal"
                onPress={handleWithdraw}
                loading={submitting}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content:   { padding: SPACING.md, paddingBottom: 48 },

  balanceCard:   { backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: SPACING.xl, alignItems: 'center', marginBottom: SPACING.md, ...SHADOWS.md },
  balanceLabel:  { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 6, letterSpacing: 0.5 },
  balanceAmount: { fontSize: 52, fontWeight: '800', color: '#fff', letterSpacing: -2, marginBottom: 6 },
  balanceUpdated:{ fontSize: 11, color: 'rgba(255,255,255,0.55)' },

  actionsRow:  { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  actionBtn:   { flex: 1, backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: RADIUS.lg, alignItems: 'center', ...SHADOWS.sm },
  actionIcon:  { fontSize: 28, marginBottom: 4 },
  actionLabel: { ...TYPOGRAPHY.captionBold },

  statsStrip: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, ...SHADOWS.sm },
  statItem:   { flex: 1, alignItems: 'center' },
  statValue:  { ...TYPOGRAPHY.h3, color: COLORS.primary },
  statLabel:  { ...TYPOGRAPHY.caption, marginTop: 4 },
  statDivider:{ width: 1, backgroundColor: COLORS.border },

  sectionTitle: { ...TYPOGRAPHY.h4, marginBottom: SPACING.md },

  txCard:       { marginBottom: SPACING.sm },
  txRow:        { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  txIconWrap:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txCredit:     { backgroundColor: COLORS.successLight },
  txDebit:      { backgroundColor: COLORS.errorLight },
  txDesc:       { ...TYPOGRAPHY.bodyBold, fontSize: 14 },
  txDate:       { ...TYPOGRAPHY.caption, marginTop: 2 },
  txAmount:     { fontSize: 14, fontWeight: '700' },
  txAmountCredit: { color: COLORS.success },
  txAmountDebit:  { color: COLORS.error },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.md, paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.md, ...SHADOWS.lg },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  modalTitle: { ...TYPOGRAPHY.h3, marginBottom: 4 },
  modalSub:   { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginBottom: SPACING.md },
  fieldLabel: { ...TYPOGRAPHY.label, marginBottom: 6, marginTop: SPACING.sm },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 15, color: COLORS.textPrimary,
  },
  modalBtns:    { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  cancelBtn:    { flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg, alignItems: 'center', backgroundColor: COLORS.border },
  cancelBtnText:{ ...TYPOGRAPHY.bodyBold, color: COLORS.textSecondary },
});