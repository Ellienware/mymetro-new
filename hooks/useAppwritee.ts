// hooks/useAppwrite.ts
//
// Lightweight React hooks wrapping AppwriteService.
// Keeps screens decoupled from the service layer.
//
// hooks/useAppwrite.ts
// ─────────────────────────────────────────────────────────────────────────────
// Wallet, payment-method, transaction and loan hooks.
// All data fetching goes through AppwriteService to keep Appwrite calls
// in one place.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-expo';
import type { UserWallet, Transaction, PaymentMethod } from '@/types/appwrite';
import { AppwriteService } from '@/services/appwriteService';

// ─── useUserWallet ────────────────────────────────────────────────────────────

interface UseUserWalletResult {
  wallet:   UserWallet | null;
  loading:  boolean;
  error:    string | null;
  refresh:  () => Promise<void>;
  // FIX: renamed from `refetch` (the tap screen used `refetch` but the hook
  // exported `refresh`) — keep both names as aliases to avoid breaking callers.
  refetch:  () => Promise<void>;
  topUp:    (amount: number, method: string) => Promise<void>;
}

export function useUserWallet(): UseUserWalletResult {
  const { user } = useUser();
  const [wallet,  setWallet]  = useState<UserWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchWallet = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      let w = await AppwriteService.getUserWallet(user.id);
      if (!w) w = await AppwriteService.createWallet(user.id);
      setWallet(w);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load wallet');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  const topUp = useCallback(async (amount: number, method: string) => {
    if (!user?.id || !wallet) return;
    const newBalance = wallet.balance + amount;
    await AppwriteService.updateWalletBalance(user.id, newBalance);
    await AppwriteService.createTransaction(user.id, {
      type:          'wallet_topup',
      amount,
      currency:      'ZAR',
      description:   `Wallet top-up via ${method}`,
      status:        'completed',
      paymentMethod: method,
    });
    // Auto-repay any active loans with the topped-up funds
    await _autoRepayLoans(user.id, amount);
    await fetchWallet();
  }, [user?.id, wallet, fetchWallet]);

  return { wallet, loading, error, refresh: fetchWallet, refetch: fetchWallet, topUp };
}

// ─── usePaymentMethods ────────────────────────────────────────────────────────

interface UsePaymentMethodsResult {
  paymentMethods: PaymentMethod[];
  loading:        boolean;
  refresh:        () => Promise<void>;
}

export function usePaymentMethods(): UsePaymentMethodsResult {
  const { user } = useUser();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading,        setLoading]        = useState(true);

  const fetchMethods = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const methods = await AppwriteService.getUserPaymentMethods(user.id);
      setPaymentMethods(methods);
    } catch (e) {
      console.error('usePaymentMethods:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchMethods(); }, [fetchMethods]);

  return { paymentMethods, loading, refresh: fetchMethods };
}

// ─── useTransactions ──────────────────────────────────────────────────────────

interface UseTransactionsResult {
  transactions: Transaction[];
  loading:      boolean;
  refresh:      () => Promise<void>;
}

export function useTransactions(limit = 50): UseTransactionsResult {
  const { user } = useUser();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading,      setLoading]      = useState(true);

  const fetch = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const txns = await AppwriteService.getUserTransactions(user.id, limit);
      setTransactions(txns);
    } catch (e) {
      console.error('useTransactions:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, limit]);

  useEffect(() => { fetch(); }, [fetch]);

  return { transactions, loading, refresh: fetch };
}

// ─── useLoans ─────────────────────────────────────────────────────────────────

interface UseLoanResult {
  activeLoans: any[];
  loading:     boolean;
  error:       string | null;
  refresh:     () => Promise<void>;
  repayLoan:   (loanId: string, amount: number) => Promise<void>;
}

export function useLoans(): UseLoanResult {
  const { user }     = useUser();
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const loans = await AppwriteService.getUserLoans(user.id, ['active', 'overdue']);
      setActiveLoans(loans);
    } catch (e: any) {
      // FIX: original swallowed the error silently — now surfaces it
      console.error('useLoans:', e);
      setError(e.message ?? 'Failed to load loans');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  const repayLoan = useCallback(async (loanId: string, amount: number) => {
    if (!user?.id) return;
    await AppwriteService.repayLoan(user.id, loanId, amount);
    await fetch();
  }, [user?.id, fetch]);

  return { activeLoans, loading, error, refresh: fetch, repayLoan };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// FIX: original loop passed the full topUpAmount to every loan instead of the
// remaining funds.  Now properly threads `remaining` through the loop.
async function _autoRepayLoans(userId: string, topUpAmount: number): Promise<void> {
  try {
    const loans = await AppwriteService.getUserLoans(userId, ['active', 'overdue']);
    let remaining = topUpAmount;
    for (const loan of loans) {
      if (remaining <= 0) break;
      const owed    = (loan.amount ?? 0) - (loan.repaidAmount ?? 0);
      if (owed <= 0) continue;
      const payment = Math.min(remaining, owed);
      await AppwriteService.repayLoan(userId, loan.$id, payment);
      remaining -= payment;
    }
  } catch (e) {
    console.warn('Auto-repay loans error:', e);
  }
}