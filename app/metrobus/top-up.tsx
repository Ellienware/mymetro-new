import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { AppwriteService } from '../../services/appwriteService';
import { useUserWallet } from '../../hooks/useAppwrite';
import { COLORS } from '../../constants/theme';

export default function TopUpMetrobusScreen() {
  const { user } = useUser();
  const router = useRouter();
  const { wallet, refetch } = useUserWallet();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTopUp = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      Alert.alert('Invalid amount');
      return;
    }
    if (!wallet || wallet.balance < num) {
      Alert.alert('Insufficient wallet balance');
      return;
    }
    setLoading(true);
    try {
      await AppwriteService.topUpMetrobusBalance(user!.id, num);
      await refetch();
      Alert.alert('Success', `R${num} added to Metrobus balance`);
      router.back();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Top Up Metrobus Balance</Text>
      <Text style={styles.walletBalance}>Wallet: R{wallet?.balance.toFixed(2)}</Text>
      <TextInput
        style={styles.input}
        placeholder="Amount"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />
      <TouchableOpacity style={styles.button} onPress={handleTopUp} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Processing...' : 'Top Up'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  walletBalance: { fontSize: 18, marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 20 },
  button: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
});