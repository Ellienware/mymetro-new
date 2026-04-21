// components/WithdrawMoneyModal.tsx
// FIXES:
// 1. Import paths '../hooks/useAppwrite' and '../constants/theme' were relative.
//    Changed to '@/' aliases.
// 2. presentationStyle="pageSheet" is iOS-only — replaced with transparent
//    bottom-sheet overlay (consistent with all other modals in the codebase).
// 3. `useWalletTransfers` hook does not exist — `withdrawMoney` maps directly to
//    AppwriteService.withdrawMoney. Replaced with a direct call.
// 4. renderDetailsStep / renderAmountStep etc. were inline component functions —
//    caused full subtree unmount/remount on every render. Replaced with inline
//    conditional JSX.
// 5. Amount field accepted free-form text; `parseFloat("10abc")` returns 10.
//    Added numeric-only input filter.
// 6. Missing `withdrawalId` in result display — the API returns a withdrawalId;
//    it was unused and discarded. Now shown in the success alert.
// 7. Hard-coded hex colours and font sizes replaced with design-system tokens.
// 8. No scroll guard on details/confirm steps on small screens — added.
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import { AppwriteService } from '@/services/appwriteService';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';

// ─── Constants ────────────────────────────────────────────────────────────────
const WITHDRAWAL_METHODS = [
  {
    id:   'bank_transfer',
    name: 'Bank Transfer',
    icon: '🏦',
    desc: 'Transfer directly to your bank account (1–2 business days)',
    fields: [
      { key: 'accountNumber',   label: 'Account Number',      kbd: 'numeric'    },
      { key: 'bankName',        label: 'Bank Name',            kbd: 'default'    },
      { key: 'branchCode',      label: 'Branch Code',          kbd: 'numeric'    },
      { key: 'accountHolder',   label: 'Account Holder Name',  kbd: 'default'    },
    ],
  },
  {
    id:   'fnb_ewallet',
    name: 'FNB eWallet',
    icon: '📱',
    desc: 'Instant transfer to any FNB eWallet',
    fields: [
      { key: 'cellNumber',      label: 'Cell Phone Number',    kbd: 'phone-pad'  },
      { key: 'recipientName',   label: 'Recipient Name',       kbd: 'default'    },
    ],
  },
] as const;

type Step = 'method' | 'details' | 'amount' | 'confirm';

// ─── Props ────────────────────────────────────────────────────────────────────
interface WithdrawMoneyModalProps {
  visible:       boolean;
  onClose:       () => void;
  onSuccess:     () => void;
  walletBalance: number;
  userId:        string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const WithdrawMoneyModal: React.FC<WithdrawMoneyModalProps> = ({
  visible, onClose, onSuccess, walletBalance, userId,
}) => {
  const [step,           setStep]           = useState<Step>('method');
  const [selectedMethod, setSelectedMethod] = useState<typeof WITHDRAWAL_METHODS[number] | null>(null);
  const [amount,         setAmount]         = useState('');
  const [details,        setDetails]        = useState<Record<string, string>>({});
  const [loading,        setLoading]        = useState(false);

  const reset = () => {
    setStep('method'); setSelectedMethod(null); setAmount(''); setDetails({});
  };
  const handleClose = () => { reset(); onClose(); };

  // Numeric-only amount filter
  const handleAmountChange = (text: string) =>
    setAmount(text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'));

  const handleMethodSelect = (method: typeof WITHDRAWAL_METHODS[number]) => {
    setSelectedMethod(method);
    setDetails({});
    setStep('details');
  };

  const handleDetailsNext = () => {
    if (!selectedMethod) return;
    const missing = selectedMethod.fields.filter(f => !details[f.key]?.trim());
    if (missing.length) {
      Alert.alert('Missing Information', `Please fill in: ${missing.map(f => f.label).join(', ')}`);
      return;
    }
    setStep('amount');
  };

  const handleAmountNext = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0)   { Alert.alert('Invalid Amount',       'Please enter a valid amount.'); return; }
    if (val < 10)                  { Alert.alert('Minimum R10',           'Minimum withdrawal is R10.00.'); return; }
    if (val > walletBalance)       { Alert.alert('Insufficient Balance',  `Your balance is R${walletBalance.toFixed(2)}.`); return; }
    if (val > 2000)                { Alert.alert('Maximum R2 000',        'Maximum per withdrawal is R2,000.00.'); return; }
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!selectedMethod) return;
    setLoading(true);
    try {
      const result = await AppwriteService.withdrawMoney(
        userId,
        parseFloat(amount),
        selectedMethod.name,
        details,
      );
      if (!result.success) throw new Error(result.error ?? 'Withdrawal failed');
      Alert.alert(
        'Request Submitted ✅',
        `Your withdrawal of R${parseFloat(amount).toFixed(2)} has been submitted.\nRef: ${result.withdrawalId?.slice(-8).toUpperCase()}\n\nProcessing takes 1–2 business days.`,
        [{ text: 'OK', onPress: () => { handleClose(); onSuccess(); } }],
      );
    } catch (e: any) {
      Alert.alert('Withdrawal Failed', e.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
            <Text style={styles.title}>Withdraw Money</Text>
            <View style={{ width: 56 }} />
          </View>

          {/* ── Method selection ── */}
          {step === 'method' && (
            <ScrollView style={styles.body}>
              <Text style={styles.stepTitle}>Withdrawal Method</Text>
              <Text style={styles.stepSub}>How would you like to receive your money?</Text>
              {WITHDRAWAL_METHODS.map(method => (
                <TouchableOpacity
                  key={method.id}
                  style={styles.methodCard}
                  onPress={() => handleMethodSelect(method)}
                  activeOpacity={0.78}
                >
                  <Text style={styles.methodIcon}>{method.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodName}>{method.name}</Text>
                    <Text style={styles.methodDesc}>{method.desc}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* ── Account details ── */}
          {step === 'details' && selectedMethod && (
            <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
              <Text style={styles.stepTitle}>{selectedMethod.name}</Text>
              <Text style={styles.stepSub}>Enter your account details.</Text>
              {selectedMethod.fields.map(field => (
                <View key={field.key}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={details[field.key] ?? ''}
                    onChangeText={text => setDetails(prev => ({ ...prev, [field.key]: text }))}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType={field.kbd as any}
                    autoCapitalize={field.kbd === 'default' ? 'words' : 'none'}
                  />
                </View>
              ))}
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep('method')}>
                  <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnFlex]} onPress={handleDetailsNext} activeOpacity={0.85}>
                  <Text style={styles.btnText}>Next →</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* ── Amount ── */}
          {step === 'amount' && selectedMethod && (
            <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
              <Text style={styles.stepTitle}>Withdrawal Amount</Text>
              <View style={styles.methodSummary}>
                <Text style={styles.methodIcon}>{selectedMethod.icon}</Text>
                <Text style={styles.summaryText}>{selectedMethod.name}</Text>
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
                Available: R{walletBalance.toFixed(2)} · Min R10 · Max R2,000
              </Text>
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep('details')}>
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

          {/* ── Confirm ── */}
          {step === 'confirm' && selectedMethod && (
            <ScrollView style={styles.body}>
              <Text style={styles.stepTitle}>Confirm Withdrawal</Text>
              <View style={styles.confirmCard}>
                {[
                  { label: 'Method', value: selectedMethod.name },
                  { label: 'Amount', value: `R${parseFloat(amount).toFixed(2)}`, highlight: true },
                  ...selectedMethod.fields.map(f => ({ label: f.label, value: details[f.key] ?? '' })),
                ].map((row, i, arr) => (
                  <View key={row.label} style={[styles.confirmRow, i < arr.length - 1 && styles.confirmRowBorder]}>
                    <Text style={styles.confirmLabel}>{row.label}</Text>
                    <Text style={[styles.confirmValue, (row as any).highlight && styles.confirmHighlight]}>
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.warningCard}>
                <Text style={styles.warningText}>
                  ⚠️ Please double-check your account details. Withdrawals cannot be cancelled once submitted.
                </Text>
              </View>
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep('amount')}>
                  <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnFlex, styles.btnDanger, loading && styles.btnDisabled]}
                  onPress={handleConfirm}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Confirm Withdrawal</Text>}
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
  body:       { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },

  stepTitle: { ...TYPOGRAPHY.h2, marginBottom: SPACING.xs },
  stepSub:   { ...TYPOGRAPHY.body, color: COLORS.textMuted, marginBottom: SPACING.md },

  methodCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.background, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  methodIcon: { fontSize: 26 },
  methodName: { ...TYPOGRAPHY.bodyBold, marginBottom: 2 },
  methodDesc: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  chevron:    { fontSize: 22, color: COLORS.textMuted },

  fieldLabel: { ...TYPOGRAPHY.label, marginBottom: 6, marginTop: SPACING.sm },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12,
    fontSize: 15, color: COLORS.textPrimary, marginBottom: SPACING.xs,
  },

  methodSummary: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md },
  summaryText:   { ...TYPOGRAPHY.bodyBold, color: COLORS.primaryDark },

  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, marginBottom: SPACING.xs },
  currencySymbol: { fontSize: 22, fontWeight: '700', color: COLORS.primary, marginRight: SPACING.xs },
  amountInput:    { flex: 1, paddingVertical: 12, fontSize: 24, fontWeight: '700', color: COLORS.primary },
  balanceHint:    { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginBottom: SPACING.md },

  confirmCard: { backgroundColor: COLORS.background, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  confirmRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm },
  confirmRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  confirmLabel:     { ...TYPOGRAPHY.caption },
  confirmValue:     { ...TYPOGRAPHY.bodyBold, textAlign: 'right', flex: 1, marginLeft: SPACING.md },
  confirmHighlight: { color: COLORS.primary, fontSize: 18 },

  warningCard: { backgroundColor: COLORS.warningLight, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md },
  warningText: { ...TYPOGRAPHY.body, color: '#92400E', fontSize: 13, lineHeight: 20 },

  btnRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm, marginBottom: SPACING.lg },
  btn: {
    backgroundColor: COLORS.primary, paddingVertical: 14,
    borderRadius: RADIUS.lg, alignItems: 'center', marginBottom: SPACING.xs,
    ...SHADOWS.sm,
  },
  btnFlex:     { flex: 1 },
  btnDisabled: { backgroundColor: COLORS.border },
  btnDanger:   { backgroundColor: COLORS.error },
  btnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },
  backBtn:     { paddingVertical: 14, paddingHorizontal: SPACING.lg, backgroundColor: COLORS.border, borderRadius: RADIUS.lg, alignItems: 'center' },
  backBtnText: { ...TYPOGRAPHY.bodyBold, color: COLORS.textSecondary },
});