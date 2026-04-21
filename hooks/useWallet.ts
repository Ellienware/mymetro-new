// hooks/useWallet.ts
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

interface Transaction {
  $id: string;
  amount: number;
  description: string;
  createdAt: string;
  // ... other fields
}

export function useWallet() {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const fetchBalance = useCallback(async () => {
    try {
      const data = await api.getWallet() as { balance: number };
      setBalance(data.balance);
    } catch (err) {
      console.error('Failed to fetch balance', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const data = await api.getTransactions() as Transaction[];
      setTransactions(data);
    } catch (err) {
      console.error('Failed to fetch transactions', err);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
    fetchTransactions();
  }, []);

  return { balance, loading, transactions, refetch: fetchBalance, refetchTransactions: fetchTransactions };
}