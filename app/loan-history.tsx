import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { AppwriteService } from '../services/appwriteService';
import { COLORS } from '../constants/theme';

export default function LoanHistoryScreen() {
  const { user } = useUser();
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLoans();
  }, []);

  const loadLoans = async () => {
    if (!user?.id) return;
    const allLoans = await AppwriteService.getUserLoans(user.id);
    setLoans(allLoans);
    setLoading(false);
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10B981';
      case 'overdue': return '#F59E0B';
      case 'repaid': return '#3B82F6';
      case 'defaulted': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const repaid = item.repaidAmount || 0;
    const remaining = item.amount - repaid;
    const isFullyRepaid = remaining === 0;

    return (
      <View style={styles.loanCard}>
        <View style={styles.loanHeader}>
          <Text style={styles.amount}>R{item.amount.toFixed(2)}</Text>
          <Text style={[styles.status, { color: getStatusColor(item.status) }]}>{item.status.toUpperCase()}</Text>
        </View>
        <Text style={styles.dates}>Issued: {formatDate(item.issuedAt)}</Text>
        <Text style={styles.dates}>Due: {formatDate(item.dueDate)}</Text>
        {!isFullyRepaid && (
          <Text style={styles.remaining}>Remaining: R{remaining.toFixed(2)}</Text>
        )}
        {item.repaidAt && (
          <Text style={styles.repaid}>Repaid: {formatDate(item.repaidAt)}</Text>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loan History</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Loan History</Text>
        <TouchableOpacity onPress={loadLoans}>
          <Text style={styles.refresh}>🔄</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={loans}
        keyExtractor={item => item.$id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No loans found</Text>}
      />
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
  refresh: { fontSize: 20 },
  list: { padding: 20 },
  loanCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  loanHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  amount: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  status: { fontSize: 14, fontWeight: '600' },
  dates: { fontSize: 14, color: '#666', marginBottom: 4 },
  remaining: { fontSize: 14, fontWeight: '600', color: COLORS.primary, marginTop: 4 },
  repaid: { fontSize: 14, color: '#10B981', marginTop: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', marginTop: 40, color: '#666' },
});