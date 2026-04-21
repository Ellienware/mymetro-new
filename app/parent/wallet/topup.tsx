import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { AppwriteService } from '@/services/appwriteService';
import { COLORS } from '@/constants/theme';

export default function WalletTopUpScreen() {
  const { user } = useUser();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTopUp = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid amount', 'Please enter a positive number.');
      return;
    }
    setLoading(true);
    try {
      // ✅ Use correct method: getUserWallet
      const wallet = await AppwriteService.getUserWallet(user!.id);
      if (!wallet) throw new Error('Wallet not found');
      
      const newBalance = wallet.balance + amt;
      await AppwriteService.updateWalletBalance(user!.id, newBalance);
      
      await AppwriteService.createTransaction(user!.id, {
        type: 'wallet_topup',
        amount: amt,
        currency: 'ZAR',
        description: `Wallet top-up of R${amt}`,
        status: 'completed',
        paymentMethod: 'card',
        metadata: JSON.stringify({}),
      });
      
      Alert.alert('Success', `R${amt} added to your wallet.`);
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Top-up failed.');
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
        <Text style={styles.headerTitle}>Top Up Wallet</Text>
        <View style={{ width: 50 }} />
      </View>
      <View style={styles.content}>
        <TextInput
          style={styles.input}
          placeholder="Amount (ZAR)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />
        <TouchableOpacity style={styles.button} onPress={handleTopUp} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Processing...' : 'Add Funds'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backButton: { padding: 5 },
  backText: { fontSize: 16, color: COLORS.primary },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  content: { padding: 20, alignItems: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, width: '100%', backgroundColor: 'white', marginBottom: 20 },
  button: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 8, alignItems: 'center', width: '100%' },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 16 },
});