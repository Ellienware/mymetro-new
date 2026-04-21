// components/TransferMoneyModal.tsx
// FIXES:
// 1. Import paths '../hooks/useAppwrite' and '../constants/theme' were relative
//    — changed to '@/' aliases.
// 2. presentationStyle="pageSheet" is iOS-only — doesn't work on Android.
//    Replaced with transparent bottom-sheet overlay.
// 3. `useWalletTransfers` hook is not defined in the codebase — the functionality
//    (findUser, transferMoney) lives in AppwriteService. Created a thin inline
//    implementation using AppwriteService directly so the component compiles.
// 4. renderRecipientStep / renderAmountStep / renderConfirmStep were defined as
//    functions inside the component body — new function references on every render
//    cause unnecessary re-renders. Replaced with inline JSX blocks inside a
//    single-return conditional.
// 5. Amount input accepted free-form text with no input masking — user could type
//    "123.456.789" and parseFloat would return 123. Added a regex filter.
// 6. transferMoney was called with `recipientIdentifier` (the search string)
//    instead of `recipientUser.$id` — the service layer needs a userId, not a
//    phone/email search term.
// 7. Hard-coded hex colours replaced with design-system tokens.
// 8. No scroll view on the confirm step — on small screens the Send button was
//    below the fold. Wrapped each step body in ScrollView.
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import { AppwriteService } from '@/services/appwriteService';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';

// ─── Props ────────────────────────────────────────────────────────────────────
interface TransferMoneyModalProps {
  visible:       boolean;
  onClose:       () => void;
  onSuccess:     () => void;
  walletBalance: number;
  /** The Clerk userId of the current user (sender) */
  senderId:      string;
}

type Step = 'recipient' | 'amount' | 'confirm';

// ─── Component ────────────────────────────────────────────────────────────────
export const TransferMoneyModal: React.FC<TransferMoneyModalProps> = ({
  visible, onClose, onSuccess, walletBalance, senderId,
}) => {
  const [step,                  setStep]                = useState<Step>('recipient');
  const [recipientSearch,       setRecipientSearch]     = useState('');
  const [amount,                setAmount]              = useState('');
  const [description,           setDescription]         = useState('');
  const [recipientUser,         setRecipientUser]       = useState<any>(null);
  const [findLoading,           setFindLoading]         = useState(false);
  const [transferLoading,       setTransferLoading]     = useState(false);

  const reset = () => {
    setStep('recipient');
    setRecipientSearch('');
    setAmount('');
    setDescription('');
    setRecipientUser(null);
  };

  const handleClose = () => { reset(); onClose(); };

  // ── Step 1: find recipient ─────────────────────────────────────────────────
  const handleFindRecipient = async () => {
    const q = recipientSearch.trim();
    if (!q) { Alert.alert('Required', 'Please enter a phone number or email address.'); return; }
    setFindLoading(true);
    try {
      const found = await AppwriteService.findUserForTransfer(q);
      if (!found) { Alert.alert('Not found', 'No user found with that phone number or email.'); return; }
      if (found.clerkUserId === senderId) { Alert.alert('Invalid', 'You cannot transfer money to yourself.'); return; }
      setRecipientUser(found);
      setStep('amount');
    } catch {
      Alert.alert('Error', 'Failed to find user. Please try again.');
    } finally {
      setFindLoading(false);
    }
  };

  // ── Step 2: validate amount ────────────────────────────────────────────────
  const handleAmountNext = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0)          { Alert.alert('Invalid Amount', 'Please enter a valid amount.'); return; }
    if (val < 1)                         { Alert.alert('Minimum R1',   'Minimum transfer amount is R1.00.'); return; }
    if (val > walletBalance)             { Alert.alert('Insufficient Balance', `Your balance is R${walletBalance.toFixed(2)}.`); return; }
    if (val > 5000)                      { Alert.alert('Maximum R5 000', 'Maximum transfer per transaction is R5,000.00.'); return; }
    setStep('confirm');
  };

  // ── Step 3: execute transfer ───────────────────────────────────────────────
  const handleConfirmTransfer = async () => {
    setTransferLoading(true);
    try {
      const result = await AppwriteService.transferMoney(
        senderId,
        recipientUser.clerkUserId,
        parseFloat(amount),
        description || undefined,
      );
      if (!result.success) throw new Error(result.error ?? 'Transfer failed');
      Alert.alert('Sent ✅', `R${parseFloat(amount).toFixed(2)} sent successfully!`, [
        { text: 'OK', onPress: () => { handleClose(); onSuccess(); } },
      ]);
    } catch (e: any) {
      Alert.alert('Transfer Failed', e.message ?? 'Please try again.');
    } finally {
      setTransferLoading(false);
    }
  };

  // ── Amount filter: allow only valid decimal input ──────────────────────────
  const handleAmountChange = (text: string) => {
    // Allow digits and at most one decimal point
    const filtered = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setAmount(filtered);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={handleClose} activeOpacity={1} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Transfer Money</Text>
            <View style={{ width: 56 }} />
          </View>

          {/* Step indicator */}
          <View style={styles.stepBar}>
            {(['recipient', 'amount', 'confirm'] as Step[]).map((s, i) => {
              const done   = (step === 'amount' && i < 1) || (step === 'confirm' && i < 2);
              const active = step === s;
              return (
                <React.Fragment key={s}>
                  <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
                    <Text style={[styles.stepNum, (active || done) && styles.stepNumActive]}>{i + 1}</Text>
                  </View>
                  {i < 2 && <View style={[styles.stepLine, done && styles.stepLineDone]} />}
                </React.Fragment>
              );
            })}
          </View>

          {/* ── Step 1: Recipient ── */}
          {step === 'recipient' && (
            <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
              <Text style={styles.stepTitle}>Find Recipient</Text>
              <Text style={styles.stepSub}>Enter the recipient's phone number or email address.</Text>

              <Text style={styles.fieldLabel}>Phone number or email</Text>
              <TextInput
                style={styles.input}
                value={recipientSearch}
                onChangeText={setRecipientSearch}
                placeholder="e.g. 0821234567 or user@email.com"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[styles.btn, (!recipientSearch.trim() || findLoading) && styles.btnDisabled]}
                onPress={handleFindRecipient}
                disabled={!recipientSearch.trim() || findLoading}
                activeOpacity={0.85}
              >
                {findLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Find Recipient</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ── Step 2: Amount ── */}
          {step === 'amount' && recipientUser && (
            <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
              <Text style={styles.stepTitle}>Transfer Amount</Text>

              {/* Recipient pill */}
              <View style={styles.recipientPill}>
                <View style={styles.recipientAvatar}>
                  <Text style={{ fontSize: 18 }}>👤</Text>
                </View>
                <View>
                  <Text style={styles.recipientName}>
                    {recipientUser.firstName} {recipientUser.lastName}
                  </Text>
                  <Text style={styles.recipientContact}>{recipientSearch}</Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Amount</Text>
              <View style={styles.amountRow}>
                <Text style={styles.currencySymbol}>R</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={handleAmountChange}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>
              <Text style={styles.balanceHint}>
                Available: R{walletBalance.toFixed(2)} · Max: R5,000
              </Text>

              <Text style={styles.fieldLabel}>Note (optional)</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder="What's this for?"
                placeholderTextColor={COLORS.textMuted}
                maxLength={100}
              />

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep('recipient')}>
                  <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnFlex, !amount && styles.btnDisabled]}
                  onPress={handleAmountNext}
                  disabled={!amount}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnText}>Next →</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* ── Step 3: Confirm ── */}
          {step === 'confirm' && recipientUser && (
            <ScrollView style={styles.body}>
              <Text style={styles.stepTitle}>Confirm Transfer</Text>

              <View style={styles.confirmCard}>
                {[
                  { label: 'To',          value: `${recipientUser.firstName} ${recipientUser.lastName}` },
                  { label: 'Contact',     value: recipientSearch },
                  { label: 'Amount',      value: `R${parseFloat(amount).toFixed(2)}`, highlight: true },
                  ...(description ? [{ label: 'Note', value: description }] : []),
                ].map((row, i, arr) => (
                  <View key={row.label} style={[styles.confirmRow, i < arr.length - 1 && styles.confirmRowBorder]}>
                    <Text style={styles.confirmLabel}>{row.label}</Text>
                    <Text style={[styles.confirmValue, row.highlight && styles.confirmValueHighlight]}>
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep('amount')}>
                  <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnFlex, transferLoading && styles.btnDisabled]}
                  onPress={handleConfirmTransfer}
                  disabled={transferLoading}
                  activeOpacity={0.85}
                >
                  {transferLoading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.btnText}>Send Money 💸</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    ...SHADOWS.lg,
  },
  handle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: SPACING.sm, marginBottom: SPACING.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  cancelText: { fontSize: 16, color: COLORS.textMuted },
  title:      { ...TYPOGRAPHY.h3 },

  stepBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.md, gap: 0 },
  stepDot:        { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  stepDotActive:  { backgroundColor: COLORS.primary },
  stepDotDone:    { backgroundColor: COLORS.success },
  stepNum:        { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  stepNumActive:  { color: '#fff' },
  stepLine:       { width: 40, height: 2, backgroundColor: COLORS.border },
  stepLineDone:   { backgroundColor: COLORS.success },

  body: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },

  stepTitle: { ...TYPOGRAPHY.h2, marginBottom: SPACING.xs },
  stepSub:   { ...TYPOGRAPHY.body, color: COLORS.textMuted, marginBottom: SPACING.lg },

  fieldLabel: { ...TYPOGRAPHY.label, marginBottom: 6, marginTop: SPACING.sm },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12,
    fontSize: 15, color: COLORS.textPrimary, marginBottom: SPACING.sm,
  },

  recipientPill: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md },
  recipientAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  recipientName:   { ...TYPOGRAPHY.bodyBold },
  recipientContact:{ ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 2 },

  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, marginBottom: SPACING.xs },
  currencySymbol: { fontSize: 22, fontWeight: '700', color: COLORS.primary, marginRight: SPACING.xs },
  amountInput: { flex: 1, paddingVertical: 12, fontSize: 24, fontWeight: '700', color: COLORS.primary },
  balanceHint: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginBottom: SPACING.md },

  confirmCard: { backgroundColor: COLORS.background, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  confirmRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm },
  confirmRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  confirmLabel:     { ...TYPOGRAPHY.caption },
  confirmValue:     { ...TYPOGRAPHY.bodyBold, textAlign: 'right', flex: 1, marginLeft: SPACING.md },
  confirmValueHighlight: { color: COLORS.primary, fontSize: 18 },

  btnRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm, marginBottom: SPACING.lg },
  btn: {
    backgroundColor: COLORS.primary, paddingVertical: 14,
    borderRadius: RADIUS.lg, alignItems: 'center', marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  btnFlex:     { flex: 1 },
  btnDisabled: { backgroundColor: COLORS.border },
  btnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },
  backBtn:     { paddingVertical: 14, paddingHorizontal: SPACING.lg, backgroundColor: COLORS.border, borderRadius: RADIUS.lg, alignItems: 'center' },
  backBtnText: { ...TYPOGRAPHY.bodyBold, color: COLORS.textSecondary },
});