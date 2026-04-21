// app/(tabs)/wallet.tsx
import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, Alert, Modal, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useUserWallet } from '@/hooks/useAppwrite';
import { TransferMoneyModal } from '@/components/TransferMoneyModal';
import { WithdrawMoneyModal } from '@/components/WithdrawMoneyModal';
import { useLoan } from '@/hooks/useLoan';
import { usePaymentMethods } from '@/hooks/useAppwrite'; // use the correct hook
import { AddPaymentMethodModal } from '@/components/add-payment-method';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader, LoadingScreen, StatusPill } from '@/components/ui';
import { useUser } from '@clerk/clerk-expo';
const LOW_BALANCE_THRESHOLD = 50;
type FilterType = 'all' | 'topup' | 'booking' | 'transfer' | 'withdrawal' | 'loan';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'topup', label: 'Top-ups' },
  { key: 'booking', label: 'Bookings' },
  { key: 'transfer', label: 'Transfers' },
  { key: 'withdrawal', label: 'Withdrawals' },
  { key: 'loan', label: 'Loans' },
];

const TX_ICONS: Record<string, string> = {
  wallet_topup: '💰',
  school_booking: '🏫',
  refund: '↩️',
  transfer: '💸',
  withdrawal: '🏧',
  loan_repayment: '🏦',
  loan_issued: '📉',
};

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.ceil(Math.abs(now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 1) return 'Today';
  if (diffDays === 2) return 'Yesterday';
  if (diffDays <= 7) return `${diffDays - 1} days ago`;
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

function WalletAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.walletAction} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.walletActionIcon}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <Text style={styles.walletActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function WalletScreen() {
  const { wallet, transactions, loading, topUpWallet, refetch } = useUserWallet();
  const { paymentMethods, loading: loadingPayments, addCard, addBankAccount, refreshPaymentMethods } = usePaymentMethods();
  const [topUpModalVisible, setTopUpModalVisible] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [emailingStatement, setEmailingStatement] = useState(false);
  const { fetchActiveLoans, repayLoan } = useLoan();
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const { user } = useUser();

  useEffect(() => {
    fetchActiveLoans().then(setActiveLoans);
  }, []);

  const lowBalance = wallet && wallet.balance < LOW_BALANCE_THRESHOLD;

  const filteredTransactions = transactions.filter(tx => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'topup') return tx.type === 'wallet_topup';
    if (selectedFilter === 'booking') return tx.type === 'school_booking';
    if (selectedFilter === 'transfer') return tx.type === 'transfer';
    if (selectedFilter === 'withdrawal') return tx.type === 'withdrawal';
    if (selectedFilter === 'loan') return tx.type === 'loan_repayment' || tx.type === 'loan_issued';
    return true;
  });

  const sendStatementViaEmail = async () => {
    setEmailingStatement(true);
    try {
      const headers = ['Date', 'Description', 'Type', 'Amount', 'Status', 'Reference'];
      const rows = transactions.map(tx => [
        new Date(tx.createdAt).toLocaleString(),
        tx.description, tx.type, tx.amount.toString(), tx.status, tx.referenceId || '',
      ]);
      const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
      const fileUri = FileSystem.documentDirectory + 'wallet_statement.csv';
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Save or share statement', UTI: 'public.comma-separated-values-text' });
    } catch {
      Alert.alert('Error', 'Could not generate statement');
    } finally {
      setEmailingStatement(false);
    }
  };

  // ✅ FIX: addCard and addBankAccount return void – no $id to access
  const handleAddCard = async (cardData: any) => {
    try {
      await addCard(cardData);
      setShowAddPaymentModal(false);
      await refreshPaymentMethods(); // reload list so new card appears
      Alert.alert('Success', 'Card added successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to add card');
    }
  };

  const handleAddBankAccount = async (bankData: any) => {
    try {
      await addBankAccount(bankData);
      setShowAddPaymentModal(false);
      await refreshPaymentMethods();
      Alert.alert('Success', 'Bank account added successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to add bank account');
    }
  };

  // ✅ FIX: topUpWallet only takes 2 arguments – remove paymentMethodId
  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    if (amount < 10) {
      Alert.alert('Minimum R10', 'Minimum top-up amount is R10.00');
      return;
    }
    if (amount > 1000) {
      Alert.alert('Maximum R1000', 'Maximum top-up amount is R1,000.00');
      return;
    }
    if (!selectedPaymentId) {
      Alert.alert('Select Payment Method', 'Please select a payment method or add a new one');
      return;
    }

    try {
      // The payment method ID is not used by the current topUpWallet implementation,
      // but you could extend it later. For now, we just pass the method as description.
      await topUpWallet(amount, `Card ${selectedPaymentId.slice(-4)}`);
      Alert.alert('Success 🎉', `R${amount.toFixed(2)} added to your wallet!`);
      setTopUpModalVisible(false);
      setTopUpAmount('');
      setSelectedPaymentId(null);
      refetch();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Top-up failed');
    }
  };

  const handleRepay = async (loan: any) => {
    const remaining = loan.amount - (loan.repaidAmount || 0);
    Alert.prompt('Repay Loan', `Enter amount to repay (max R${remaining.toFixed(2)})`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Repay',
        onPress: async (value) => {
          const amount = parseFloat(value || '0');
          if (isNaN(amount) || amount <= 0 || amount > remaining) {
            Alert.alert('Invalid amount');
            return;
          }
          try {
            await repayLoan(loan.$id, amount);
            Alert.alert('Repaid', `R${amount.toFixed(2)} repaid`);
            fetchActiveLoans().then(setActiveLoans);
            refetch();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title=""
        onBack={() => router.back()}
        right={
          <TouchableOpacity onPress={refetch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ fontSize: 18 }}>🔄</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>metro</Text>
          <Text style={styles.brandAccent}>Pay</Text>
        </View>

        {lowBalance && (
          <View style={styles.lowBalanceBanner}>
            <Text style={styles.lowBalanceIcon}>⚠️</Text>
            <Text style={styles.lowBalanceText}>
              Balance below R{LOW_BALANCE_THRESHOLD} — top up to avoid disruptions
            </Text>
          </View>
        )}

        <View style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <View>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <Text style={styles.balanceAmount}>R{(wallet?.balance ?? 0).toFixed(2)}</Text>
            </View>
            <View style={styles.balanceCardIcon}>
              <Text style={{ fontSize: 28 }}>💳</Text>
            </View>
          </View>
          <View style={styles.balanceBottom}>
            <Text style={styles.balanceUpdated}>
              Updated {wallet ? new Date(wallet.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'never'}
            </Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <WalletAction icon="💳" label="Top Up" onPress={() => setTopUpModalVisible(true)} />
          <WalletAction icon="💸" label="Transfer" onPress={() => setShowTransferModal(true)} />
          <WalletAction icon="🏧" label="Withdraw" onPress={() => setShowWithdrawModal(true)} />
        </View>

        {/* Payment methods quick view (using real data) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PAYMENT METHODS</Text>
          <View style={styles.card}>
            {paymentMethods.slice(0, 3).map((method, idx) => (
              <View key={method.$id}>
                <TouchableOpacity style={styles.methodRow} onPress={() => router.push('/payment-methods' as any)} activeOpacity={0.8}>
                  <View style={[styles.methodIcon, { backgroundColor: method.type === 'card' ? '#1A1F71' : COLORS.success }]}>
                    <Text style={styles.methodIconText}>{method.type === 'card' ? '💳' : '🏦'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodName}>{method.name}</Text>
                    {method.description && <Text style={styles.methodDetail}>{method.description}</Text>}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
                {idx < paymentMethods.length - 1 && <View style={styles.rowDivider} />}
              </View>
            ))}
            {paymentMethods.length === 0 && (
              <Text style={styles.emptyMethodsText}>No payment methods yet. Tap + to add one.</Text>
            )}
          </View>
        </View>

        {/* Active loans section */}
        {activeLoans.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ACTIVE LOANS</Text>
            <View style={styles.card}>
              {activeLoans.map((loan, idx) => {
                const remaining = loan.amount - (loan.repaidAmount || 0);
                const isOverdue = loan.status === 'overdue';
                return (
                  <View key={loan.$id}>
                    <View style={styles.loanRow}>
                      <View style={[styles.loanIconWrap, { backgroundColor: isOverdue ? COLORS.warningLight : COLORS.primaryLight }]}>
                        <Text style={{ fontSize: 20 }}>🏦</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.loanAmount}>R{remaining.toFixed(2)} remaining</Text>
                        <Text style={styles.loanDue}>Due {new Date(loan.dueDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</Text>
                        <View style={{ marginTop: 4 }}>
                          <StatusPill status={loan.status} label={loan.status} />
                        </View>
                      </View>
                      <TouchableOpacity style={styles.repayBtn} onPress={() => handleRepay(loan)}>
                        <Text style={styles.repayBtnText}>Repay</Text>
                      </TouchableOpacity>
                    </View>
                    {idx < activeLoans.length - 1 && <View style={styles.rowDivider} />}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Transactions section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>TRANSACTIONS</Text>
            <TouchableOpacity onPress={sendStatementViaEmail} disabled={emailingStatement}>
              <Text style={styles.statementBtn}>{emailingStatement ? 'Exporting...' : '📧 Export'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingRight: SPACING.md }}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, selectedFilter === f.key && styles.filterChipActive]}
                onPress={() => setSelectedFilter(f.key)}
              >
                <Text style={[styles.filterChipText, selectedFilter === f.key && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filteredTransactions.length === 0 ? (
            <View style={styles.emptyTx}>
              <Text style={styles.emptyTxIcon}>📝</Text>
              <Text style={styles.emptyTxTitle}>No transactions</Text>
              <Text style={styles.emptyTxSub}>
                {selectedFilter === 'all' ? 'Your history will appear here' : 'None for this filter'}
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              {filteredTransactions.map((tx, idx) => {
                const isPositive = tx.amount > 0;
                return (
                  <View key={tx.$id}>
                    <TouchableOpacity style={styles.txRow} onPress={() => { setSelectedTransaction(tx); setReceiptModalVisible(true); }} activeOpacity={0.8}>
                      <View style={[styles.txIconWrap, { backgroundColor: isPositive ? COLORS.successLight : COLORS.errorLight }]}>
                        <Text style={{ fontSize: 18 }}>{TX_ICONS[tx.type] ?? '💳'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
                        <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.txAmount, { color: isPositive ? COLORS.success : COLORS.error }]}>
                          {isPositive ? '+' : ''}R{Math.abs(tx.amount).toFixed(2)}
                        </Text>
                        <Text style={styles.txStatus}>{tx.status}</Text>
                      </View>
                    </TouchableOpacity>
                    {idx < filteredTransactions.length - 1 && <View style={styles.rowDivider} />}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.topUpLargeBtn} onPress={() => setTopUpModalVisible(true)} activeOpacity={0.88}>
          <Text style={styles.topUpLargeBtnText}>+ Top Up Wallet</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ─── Top Up Modal ─────────────────────── */}
      <Modal visible={topUpModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Top Up Wallet</Text>
              <TouchableOpacity onPress={() => setTopUpModalVisible(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.amountRow}>
              <Text style={styles.amountSymbol}>R</Text>
              <TextInput
                style={styles.amountInput}
                value={topUpAmount}
                onChangeText={setTopUpAmount}
                placeholder="0.00"
                keyboardType="numeric"
                placeholderTextColor={COLORS.textMuted}
                autoFocus
              />
            </View>

            <View style={styles.quickAmounts}>
              {[50, 100, 200, 500].map(a => (
                <TouchableOpacity
                  key={a}
                  style={[styles.quickAmountBtn, topUpAmount === a.toString() && styles.quickAmountBtnActive]}
                  onPress={() => setTopUpAmount(a.toString())}
                >
                  <Text style={[styles.quickAmountText, topUpAmount === a.toString() && styles.quickAmountTextActive]}>
                    R{a}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalSectionLabel}>SELECT PAYMENT METHOD</Text>
            {loadingPayments ? (
              <Text style={styles.loadingText}>Loading your saved methods...</Text>
            ) : (
              <>
                {paymentMethods.map(method => (
                  <TouchableOpacity
                    key={method.$id}
                    style={[styles.paymentOption, selectedPaymentId === method.$id && styles.paymentOptionSelected]}
                    onPress={() => setSelectedPaymentId(method.$id)}
                  >
                    <View style={[styles.paymentOptionIcon, { backgroundColor: method.type === 'card' ? '#1A1F71' : COLORS.success }]}>
                      <Text style={styles.methodIconText}>{method.type === 'card' ? '💳' : '🏦'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.paymentOptionName}>{method.name}</Text>
                      {method.description && <Text style={styles.paymentOptionDesc}>{method.description}</Text>}
                    </View>
                    {selectedPaymentId === method.$id && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.addPaymentMethodButton}
                  onPress={() => setShowAddPaymentModal(true)}
                >
                  <Text style={styles.addPaymentMethodText}>+ Add new card or bank account</Text>
                </TouchableOpacity>
                {paymentMethods.length === 0 && (
                  <Text style={styles.noMethodsHint}>
                    No saved payment methods. Tap above to add one.
                  </Text>
                )}
              </>
            )}

            <Text style={styles.topUpNote}>Min R10 · Max R1,000 · Instant credit</Text>

            <TouchableOpacity
              style={[styles.confirmBtn, (!topUpAmount || !selectedPaymentId) && styles.confirmBtnDisabled]}
              onPress={handleTopUp}
              disabled={!topUpAmount || !selectedPaymentId}
            >
              <Text style={styles.confirmBtnText}>Confirm Top Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Payment Method Modal */}
      <AddPaymentMethodModal
        visible={showAddPaymentModal}
        onClose={() => setShowAddPaymentModal(false)}
        onAddCard={handleAddCard}
        onAddBankAccount={handleAddBankAccount}
      />

      {/* Receipt Modal */}
      <Modal visible={receiptModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Receipt</Text>
              <TouchableOpacity onPress={() => setReceiptModalVisible(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            {selectedTransaction && (
              <>
                <View style={styles.receiptHero}>
                  <Text style={[styles.receiptHeroAmount, { color: selectedTransaction.amount > 0 ? COLORS.success : COLORS.error }]}>
                    {selectedTransaction.amount > 0 ? '+' : ''}R{Math.abs(selectedTransaction.amount).toFixed(2)}
                  </Text>
                  <StatusPill status={selectedTransaction.status} label={selectedTransaction.status} />
                </View>
                <View style={styles.receiptRows}>
                  {[
                    { label: 'Description', value: selectedTransaction.description },
                    { label: 'Date', value: new Date(selectedTransaction.createdAt).toLocaleString('en-ZA') },
                    { label: 'Type', value: selectedTransaction.type },
                    { label: 'Method', value: selectedTransaction.paymentMethod || 'Wallet' },
                    { label: 'Reference', value: selectedTransaction.referenceId || 'N/A' },
                  ].map(row => (
                    <View key={row.label} style={styles.receiptRow}>
                      <Text style={styles.receiptRowLabel}>{row.label}</Text>
                      <Text style={styles.receiptRowValue}>{row.value}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            <TouchableOpacity style={styles.confirmBtn} onPress={() => setReceiptModalVisible(false)}>
              <Text style={styles.confirmBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Transfer & Withdraw modals */}
      <TransferMoneyModal
        visible={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        onSuccess={refetch}
        walletBalance={wallet?.balance || 0}
        senderId={user?.id || ''}
      />
      <WithdrawMoneyModal
        visible={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        onSuccess={refetch}
        walletBalance={wallet?.balance || 0}
        userId={user?.id || ''}
      />
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 48 },

  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
  brand: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  brandAccent: { fontSize: 22, fontWeight: '800', color: COLORS.accent },

  lowBalanceBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    backgroundColor: COLORS.warningLight, borderRadius: RADIUS.md,
    padding: SPACING.sm + 2, marginBottom: SPACING.md,
  },
  lowBalanceIcon: { fontSize: 16 },
  lowBalanceText: { ...TYPOGRAPHY.body, fontSize: 13, color: '#92400E', fontWeight: '600', flex: 1 },

  balanceCard: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.xl,
    padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.lg,
  },
  balanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500', marginBottom: 4 },
  balanceAmount: { fontSize: 38, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  balanceCardIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  balanceBottom: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: SPACING.sm },
  balanceUpdated: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },

  actionsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  walletAction: { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingVertical: SPACING.md, alignItems: 'center', ...SHADOWS.sm },
  walletActionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xs },
  walletActionLabel: { ...TYPOGRAPHY.captionBold },

  section: { marginBottom: SPACING.lg },
  sectionLabel: { ...TYPOGRAPHY.label, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.sm },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  statementBtn: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOWS.sm },

  methodRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.sm },
  methodIcon: { width: 44, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  methodIconText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  methodName: { ...TYPOGRAPHY.bodyBold },
  methodDetail: { ...TYPOGRAPHY.caption, marginTop: 2 },
  chevron: { fontSize: 22, color: COLORS.textMuted },
  rowDivider: { height: 1, backgroundColor: COLORS.border, marginLeft: SPACING.md + 44 + SPACING.sm },
  emptyMethodsText: { padding: SPACING.md, textAlign: 'center', color: COLORS.textMuted },

  loanRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.sm },
  loanIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  loanAmount: { ...TYPOGRAPHY.bodyBold },
  loanDue: { ...TYPOGRAPHY.caption, marginTop: 2 },
  repayBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full },
  repayBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  filterScroll: { marginBottom: SPACING.sm },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface, marginRight: SPACING.xs,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  filterChipTextActive: { color: '#fff' },

  txRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.sm },
  txIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txDesc: { ...TYPOGRAPHY.bodyBold, fontSize: 14 },
  txDate: { ...TYPOGRAPHY.caption, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txStatus: { fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', marginTop: 2 },

  emptyTx: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.xl, alignItems: 'center', ...SHADOWS.sm },
  emptyTxIcon: { fontSize: 36, marginBottom: SPACING.sm },
  emptyTxTitle: { ...TYPOGRAPHY.h4, marginBottom: 4 },
  emptyTxSub: { ...TYPOGRAPHY.body, color: COLORS.textMuted, textAlign: 'center' },

  topUpLargeBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    paddingVertical: 16, alignItems: 'center', ...SHADOWS.md,
  },
  topUpLargeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg, paddingBottom: 40, maxHeight: '88%',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle: { ...TYPOGRAPHY.h2 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '700' },
  modalSectionLabel: { ...TYPOGRAPHY.label, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.sm, marginTop: SPACING.sm },

  amountRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.background,
  },
  amountSymbol: { fontSize: 26, fontWeight: '700', color: COLORS.textPrimary, marginRight: SPACING.xs },
  amountInput: { flex: 1, fontSize: 26, fontWeight: '700', color: COLORS.textPrimary, paddingVertical: SPACING.md },

  quickAmounts: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.md },
  quickAmountBtn: {
    flex: 1, backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    paddingVertical: 10, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border,
  },
  quickAmountBtnActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  quickAmountText: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
  quickAmountTextActive: { color: COLORS.primaryDark },

  paymentOption: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderRadius: RADIUS.md, marginBottom: SPACING.xs,
    borderWidth: 1.5, borderColor: COLORS.border, gap: SPACING.sm,
  },
  paymentOptionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  paymentOptionIcon: { width: 40, height: 26, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  paymentOptionName: { ...TYPOGRAPHY.bodyBold },
  paymentOptionDesc: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  checkmark: { fontSize: 18, color: COLORS.primary, fontWeight: '700' },
  addPaymentMethodButton: { marginTop: SPACING.xs, paddingVertical: 12, alignItems: 'center' },
  addPaymentMethodText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
  loadingText: { textAlign: 'center', padding: SPACING.md, color: COLORS.textMuted },
  noMethodsHint: { textAlign: 'center', padding: SPACING.sm, color: COLORS.textMuted, fontSize: 12 },
  topUpNote: { ...TYPOGRAPHY.caption, textAlign: 'center', marginTop: SPACING.xs, marginBottom: SPACING.md },

  confirmBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 15, alignItems: 'center' },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  
  receiptHero: { alignItems: 'center', paddingVertical: SPACING.md, gap: SPACING.xs, marginBottom: SPACING.sm },
  receiptHeroAmount: { fontSize: 36, fontWeight: '800', letterSpacing: -0.5 },
  receiptRows: { backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  receiptRowLabel: { ...TYPOGRAPHY.caption },
  receiptRowValue: { ...TYPOGRAPHY.bodyBold, fontSize: 13, flex: 1, textAlign: 'right', marginLeft: SPACING.md },
});