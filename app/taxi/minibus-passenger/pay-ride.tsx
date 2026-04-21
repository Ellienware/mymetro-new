import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { AppwriteService } from '../../../services/appwriteService';
import { useUserWallet } from '../../../hooks/useAppwrite';
import { COLORS } from '../../../constants/theme';

export default function PayRideScreen() {
  const { user } = useUser();
  const { wallet, refetch } = useUserWallet();
  const [driverId, setDriverId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    if (!driverId.trim() || !amount.trim()) {
      Alert.alert('Error', 'Please enter driver ID and amount');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Error', 'Enter a valid amount');
      return;
    }
    if (!wallet || wallet.balance < numAmount) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }
    setLoading(true);
    try {
      // Transfer money to driver's wallet using their ID (driverId should be the user ID)
      const result = await AppwriteService.transferMoney(
        user!.id,
        driverId.trim(),
        numAmount,
        'Taxi fare payment'
      );
      if (result.success) {
        await refetch();
        Alert.alert('Success', 'Payment sent!');
        setDriverId('');
        setAmount('');
      } else {
        Alert.alert('Payment Failed', result.error || 'Unknown error');
      }
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pay Ride</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.balance}>Wallet: R{wallet?.balance.toFixed(2) || '0.00'}</Text>
        <TextInput
          style={styles.input}
          placeholder="Driver ID (or phone number)"
          value={driverId}
          onChangeText={setDriverId}
        />
        <TextInput
          style={styles.input}
          placeholder="Amount (R)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />
        <TouchableOpacity
          style={styles.payButton}
          onPress={handlePay}
          disabled={loading}
        >
          <Text style={styles.payButtonText}>{loading ? 'Processing...' : 'Pay Now'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: { padding: 5 },
  backText: { fontSize: 16, color: COLORS.primary },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  content: { padding: 20 },
  balance: { fontSize: 18, fontWeight: '600', marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  payButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  payButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});