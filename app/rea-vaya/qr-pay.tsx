import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import * as crypto from 'expo-crypto';
import { COLORS } from '../../constants/theme';

export default function QrPayScreen() {
  const [qrCode, setQrCode] = useState('');

  useEffect(() => {
    // Generate a mock QR code string
    const randomBytes = crypto.getRandomValues(new Uint8Array(16));
    const code = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    setQrCode(code);
  }, []);

  const handleScan = () => {
    Alert.alert('Scan QR', 'This would open the camera to scan a QR code.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QR Payment</Text>
        <View style={{ width: 50 }} />
      </View>
      <View style={styles.content}>
        <View style={styles.qrPlaceholder}>
          <Text style={styles.qrText}>QR CODE</Text>
          <Text style={styles.qrCode}>{qrCode.slice(0, 4)}...{qrCode.slice(-4)}</Text>
        </View>
        <TouchableOpacity style={styles.scanButton} onPress={handleScan}>
          <Text style={styles.scanButtonText}>Scan QR Code</Text>
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
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  qrPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ccc',
    marginBottom: 30,
  },
  qrText: { fontSize: 16, color: '#666', marginBottom: 8 },
  qrCode: { fontSize: 14, color: '#333' },
  scanButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  scanButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});