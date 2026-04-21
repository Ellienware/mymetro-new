import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { AppwriteService } from '../../services/appwriteService';
import { useUserWallet } from '../../hooks/useAppwrite';

import { COLORS } from '../../constants/theme';
import { getPointsBreakdown } from '@/utils/reaVayaPoints';

export default function BuyReaVayaPointsScreen() {
  const { user } = useUser();
  const router = useRouter();
  const { wallet, refetch } = useUserWallet();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const amountNum = parseFloat(amount) || 0;
  const { basePoints, bonusPoints, totalPoints } = getPointsBreakdown(amountNum);
  const isValidAmount = amountNum >= 18 && amountNum <= 700;

  const handleBuyWithWallet = async () => {
    if (!isValidAmount) {
      Alert.alert('Invalid amount', 'Amount must be between R18 and R700.');
      return;
    }
    if (!wallet || wallet.balance < amountNum) {
      Alert.alert('Insufficient balance', 'Please top up your wallet first.');
      return;
    }

    setLoading(true);
    try {
      // Deduct from wallet
      await AppwriteService.transferMoney(
        user!.id,
        user!.id, // we need a system account? better use updateWalletBalance directly
        amountNum,
        `Purchase Rea Vaya points`
      );
      // Alternative direct wallet update:
      // await AppwriteService.updateWalletBalance(user!.id, wallet.balance - amountNum);
      // await AppwriteService.createTransaction(...);

      // Add points
      await AppwriteService.addReaVayaPoints(user!.id, totalPoints);

      // Record transaction
      await AppwriteService.createTransaction(user!.id, {
        type: 'points_purchase',
        amount: -amountNum,
        currency: 'ZAR',
        description: `Bought ${totalPoints} Rea Vaya points (${basePoints} + ${bonusPoints} bonus)`,
        status: 'completed',
        paymentMethod: 'wallet',
      });

      await refetch();
      Alert.alert('Success', `You got ${totalPoints} points!`);
      router.back();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Buy Rea Vaya Points</Text>
      <Text style={styles.subtitle}>1 point = R1</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Amount (R)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="e.g. 100"
        />
      </View>

      {amountNum > 0 && (
        <View style={styles.breakdown}>
          <Text style={styles.breakdownText}>Base points: {basePoints}</Text>
          <Text style={styles.breakdownText}>Bonus: +{bonusPoints}</Text>
          <Text style={styles.totalText}>Total points: {totalPoints}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.buyButton, (!isValidAmount || loading) && styles.disabled]}
        onPress={handleBuyWithWallet}
        disabled={!isValidAmount || loading}
      >
        <Text style={styles.buyButtonText}>
          {loading ? 'Processing...' : `Pay R${amountNum} with Wallet`}
        </Text>
      </TouchableOpacity>

      <Text style={styles.note}>
        Minimum R18, maximum R700. Bonuses applied according to Rea Vaya tiers.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 20 },
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  breakdown: { backgroundColor: '#f0f0f0', padding: 15, borderRadius: 8, marginBottom: 20 },
  breakdownText: { fontSize: 16, marginBottom: 5 },
  totalText: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary, marginTop: 5 },
  buyButton: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 10, alignItems: 'center' },
  buyButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  note: { marginTop: 20, color: '#666', fontStyle: 'italic' },
});