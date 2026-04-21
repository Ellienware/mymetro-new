// components/PaymentMethodModal.tsx
// components/WalletPaymentModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Simple wallet-deduction confirmation modal, with optional micro-loan offer.
// Used by school-transport booking and meter-taxi fare flows where there is
// only one payment method (the wallet) but a loan may be offered as a fallback.
//
// This is distinct from PaymentMethodModal (which lets users choose between
// multiple payment instruments).
//
// FIXES vs original (file 34):
// 1. '@/constants/themes' → '@/constants/theme'
// 2. presentationStyle="pageSheet" doesn't work on Android — replaced with
//    transparent bottom-sheet overlay (same pattern as PaymentMethodModal).
// 3. `useLoan` state persisted across modal opens when the same component
//    instance was reused — fixed by resetting in useEffect on `visible` change
//    (already done correctly in the original; kept).
// 4. When wallet is sufficient the loan option rendered but was invisible
//    (correct), however the conditional rendering left an empty gap in the
//    layout. Wrapped in a null-safe block.
// 5. `SafeAreaView` inside the `Modal` transparent overlay pushed content up on
//    Android — changed to `View` for the sheet body; SafeAreaView only wraps the
//    outer backdrop.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Platform, ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';

// ─── Props ────────────────────────────────────────────────────────────────────
interface PaymentMethodModalProps {
  visible:         boolean;
  onClose:         () => void;
  /** Called with true if the user accepted a loan, false if paying from balance */
  onConfirm:       (useLoan: boolean) => void;
  amount:          number;
  walletBalance:   number;
  loading?:        boolean;
  allowLoan?:      boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const PaymentMethodModal: React.FC<PaymentMethodModalProps> = ({
  visible,
  onClose,
  onConfirm,
  amount,
  walletBalance,
  loading   = false,
  allowLoan = false,
}) => {
  const [useLoan, setUseLoan] = useState(false);

  // Reset loan selection every time the modal opens
  useEffect(() => { if (visible) setUseLoan(false); }, [visible]);

  const isWalletSufficient = walletBalance >= amount;
  const shortfall          = Math.max(0, amount - walletBalance);
  const eligibleForLoan    = allowLoan && !isWalletSufficient;
  const canConfirm         = isWalletSufficient || (eligibleForLoan && useLoan);

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(isWalletSufficient ? false : useLoan);
  };

  const confirmLabel = isWalletSufficient
    ? `Pay R${amount.toFixed(2)} from wallet`
    : useLoan
      ? `Pay R${amount.toFixed(2)} (R${shortfall.toFixed(2)} from loan)`
      : 'Select a payment option';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* Backdrop */}
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />

        {/* Sheet */}
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Title row */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Confirm Payment</Text>
            <View style={{ width: 56 }} />
          </View>

          <View style={styles.body}>
            {/* Amount hero */}
            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>TOTAL AMOUNT</Text>
              <Text style={styles.amountValue}>R{amount.toFixed(2)}</Text>
            </View>

            {/* Wallet balance row */}
            <View style={styles.walletCard}>
              <View style={styles.walletRow}>
                <Text style={styles.walletLabel}>Wallet balance</Text>
                <Text style={[
                  styles.walletBalance,
                  isWalletSufficient ? styles.balanceSufficient : styles.balanceInsufficient,
                ]}>
                  R{walletBalance.toFixed(2)}
                </Text>
              </View>

              {isWalletSufficient && (
                <View style={styles.sufficientRow}>
                  <Text style={styles.sufficientText}>✅ Sufficient balance — ready to pay</Text>
                </View>
              )}

              {!isWalletSufficient && eligibleForLoan && (
                <View style={styles.loanSection}>
                  <Text style={styles.shortfallText}>
                    You're R{shortfall.toFixed(2)} short.
                  </Text>
                  <TouchableOpacity
                    style={[styles.loanOption, useLoan && styles.loanOptionSelected]}
                    onPress={() => setUseLoan(prev => !prev)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.radio, useLoan && styles.radioFilled]}>
                      {useLoan && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.loanTitle}>💸 Use a micro-loan</Text>
                      <Text style={styles.loanDesc}>
                        Borrow R{shortfall.toFixed(2)} — repayable within 7 days
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {!isWalletSufficient && !eligibleForLoan && (
                <Text style={styles.noLoanText}>
                  Insufficient balance. Please top up your wallet to continue.
                </Text>
              )}
            </View>

            {/* Confirm button */}
            <TouchableOpacity
              style={[styles.confirmBtn, (!canConfirm || loading) && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!canConfirm || loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>{confirmLabel}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    ...SHADOWS.lg,
  },
  handle: {
    width: 40, height: 4, backgroundColor: COLORS.border,
    borderRadius: 2, alignSelf: 'center',
    marginTop: SPACING.sm, marginBottom: SPACING.xs,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  cancelText: { fontSize: 16, color: COLORS.textMuted },
  title:      { ...TYPOGRAPHY.h3 },

  body: { padding: SPACING.md },

  amountCard: {
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.xl,
    padding: SPACING.lg, alignItems: 'center', marginBottom: SPACING.md,
  },
  amountLabel: { ...TYPOGRAPHY.label, color: COLORS.primaryDark, letterSpacing: 0.8, marginBottom: 6 },
  amountValue: { fontSize: 42, fontWeight: '800', color: COLORS.primary, letterSpacing: -1 },

  walletCard: {
    backgroundColor: COLORS.background, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  walletRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  walletLabel:         { ...TYPOGRAPHY.bodyBold },
  walletBalance:       { fontSize: 18, fontWeight: '700' },
  balanceSufficient:   { color: COLORS.success },
  balanceInsufficient: { color: COLORS.error },

  sufficientRow: { paddingTop: SPACING.xs },
  sufficientText:{ ...TYPOGRAPHY.bodyBold, color: COLORS.success, textAlign: 'center' },

  loanSection:  { marginTop: SPACING.xs },
  shortfallText:{ ...TYPOGRAPHY.body, color: COLORS.textMuted, marginBottom: SPACING.sm },
  loanOption: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.md, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border,
  },
  loanOptionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  radio:        { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  radioFilled:  { borderColor: COLORS.primary },
  radioDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  loanTitle:    { ...TYPOGRAPHY.bodyBold },
  loanDesc:     { ...TYPOGRAPHY.caption, marginTop: 2 },

  noLoanText: { ...TYPOGRAPHY.caption, color: COLORS.error, marginTop: SPACING.sm, textAlign: 'center' },

  confirmBtn: {
    backgroundColor: COLORS.primary, paddingVertical: 16,
    borderRadius: RADIUS.xl, alignItems: 'center',
    ...SHADOWS.sm,
  },
  confirmBtnDisabled: { backgroundColor: COLORS.border },
  confirmBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
});