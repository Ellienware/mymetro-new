// hooks/useAppwrite.tsx
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-expo';
import { AppwriteService } from '@/services/appwriteService';
import type {
  UserProfile,
  UserTicket,
  Transaction,
  UserWallet,
  PaymentMethod,
  CardData,
  BankAccountData,
} from '@/types/appwrite';
import { generateQRCode } from '@/utils/qrCode';

// ----------------------------------------------------------------------
// 1. User Profile
// ----------------------------------------------------------------------
export function useUserProfile() {
  const { user } = useUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      let userProfile = await AppwriteService.getUserProfile(user.id);
      if (!userProfile) {
        userProfile = await AppwriteService.createUserProfile(user.id, {
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.emailAddresses[0]?.emailAddress || '',
          notifications: true,
          locationServices: false,
        });
      }
      setProfile(userProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user?.id) throw new Error('Not authenticated');
    const updated = await AppwriteService.updateUserProfile(user.id, updates);
    setProfile(updated);
    return updated;
  };

  return { profile, loading, error, updateProfile, refetch: loadProfile };
}

// ----------------------------------------------------------------------
// 2. Tickets
// ----------------------------------------------------------------------
export function useUserTickets() {
  const { user } = useUser();
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = useCallback(async (showLoading = true) => {
    if (!user?.id) return;
    if (showLoading) setLoading(true);
    try {
      const userTickets = await AppwriteService.getUserTickets(user.id);
      setTickets(userTickets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const createTicket = async (ticketData: Omit<UserTicket, '$id' | 'userId' | 'createdAt'>) => {
    if (!user?.id) throw new Error('Not authenticated');
    const newTicket = await AppwriteService.createTicket(user.id, ticketData);
    setTickets(prev => [newTicket, ...prev]);
    return newTicket;
  };

  const updateTicket = async (ticketId: string, updates: Partial<UserTicket>) => {
    const updated = await AppwriteService.updateTicket(ticketId, updates);
    setTickets(prev => prev.map(t => t.$id === ticketId ? { ...t, ...updated } : t));
    return updated;
  };

  const deleteTicket = async (ticketId: string) => {
    await AppwriteService.deleteTicket(ticketId);
    setTickets(prev => prev.filter(t => t.$id !== ticketId));
  };

  return { tickets, loading, error, createTicket, updateTicket, deleteTicket, refetch: () => loadTickets(false) };
}

// ----------------------------------------------------------------------
// 3. Wallet & Transactions
// ----------------------------------------------------------------------
export function useUserWallet() {
  const { user } = useUser();
  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWalletData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [userWallet, userTransactions] = await Promise.all([
        AppwriteService.getUserWallet(user.id),
        AppwriteService.getUserTransactions(user.id),
      ]);
      setWallet(userWallet);
      setTransactions(userTransactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wallet');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadWalletData(); }, [loadWalletData]);

  const topUpWallet = async (amount: number, paymentMethod: string) => {
    if (!user?.id || !wallet) throw new Error('Not authenticated or wallet missing');
    // Auto-repay active loans first
    const activeLoans = await AppwriteService.getUserLoans(user.id, ['active', 'overdue']);
    let remaining = amount;
    for (const loan of activeLoans) {
      const owed = (loan.amount ?? 0) - (loan.repaidAmount ?? 0);
      if (owed <= 0) continue;
      const payment = Math.min(remaining, owed);
      await AppwriteService.repayLoan(user.id, loan.$id, payment);
      remaining -= payment;
      if (remaining <= 0) break;
    }
    if (remaining > 0) {
      const newBalance = wallet.balance + remaining;
      await AppwriteService.updateWalletBalance(user.id, newBalance);
      setWallet({ ...wallet, balance: newBalance });
    } else {
      await loadWalletData();
    }
    await AppwriteService.createTransaction(user.id, {
      type: 'wallet_topup',
      amount,
      currency: 'ZAR',
      description: `Wallet top-up via ${paymentMethod}`,
      status: 'completed',
      paymentMethod,
    });
    await loadWalletData();
  };

  const purchaseTicket = async (ticketData: Omit<UserTicket, '$id' | 'userId' | 'createdAt'>, amount: number) => {
    if (!user?.id || !wallet) throw new Error('Not authenticated');
    if (wallet.balance < amount) throw new Error('Insufficient balance');
    const newTicket = await AppwriteService.createTicket(user.id, ticketData);
    await AppwriteService.createTransaction(user.id, {
      type: 'ticket_purchase',
      amount: -amount,
      currency: 'ZAR',
      description: `${ticketData.ticketType} ticket: ${ticketData.fromStation} → ${ticketData.toStation}`,
      status: 'completed',
      paymentMethod: 'wallet',
      referenceId: newTicket.$id,
    });
    const newBalance = wallet.balance - amount;
    const updatedWallet = await AppwriteService.updateWalletBalance(user.id, newBalance);
    setWallet(updatedWallet);
    await loadWalletData();
    return { ticket: newTicket, wallet: updatedWallet };
  };

  const chargeUser = async (amount: number, description: string) => {
    if (!user?.id || !wallet) throw new Error('Not authenticated');
    await AppwriteService.createTransaction(user.id, {
      type: 'ticket_upgrade',
      amount: -amount,
      currency: 'ZAR',
      description,
      status: 'completed',
      paymentMethod: 'wallet',
    });
    const newBalance = wallet.balance - amount;
    const updatedWallet = await AppwriteService.updateWalletBalance(user.id, newBalance);
    setWallet(updatedWallet);
    return updatedWallet;
  };

  const refundUser = async (amount: number, description: string) => {
    if (!user?.id || !wallet) throw new Error('Not authenticated');
    await AppwriteService.createTransaction(user.id, {
      type: 'ticket_refund',
      amount,
      currency: 'ZAR',
      description,
      status: 'completed',
      paymentMethod: 'wallet',
    });
    const newBalance = wallet.balance + amount;
    const updatedWallet = await AppwriteService.updateWalletBalance(user.id, newBalance);
    setWallet(updatedWallet);
    return updatedWallet;
  };

  // Legacy method – not used by new transport system, kept for compatibility
  const payForTransport = async (params: {
    service: 'metrorail' | 'metrobus' | 'rea_vaya' | 'gautrain';
    amount: number;
    description: string;
    from?: string;
    to?: string;
    routeId?: string;
    validUntil?: string;
  }) => {
    if (!user?.id || !wallet) throw new Error('Not authenticated');
    if (wallet.balance < params.amount) throw new Error('Insufficient balance');
    const newBalance = wallet.balance - params.amount;
    await AppwriteService.updateWalletBalance(user.id, newBalance);
    setWallet({ ...wallet, balance: newBalance });
    await AppwriteService.createTransaction(user.id, {
      type: 'ticket_purchase',
      amount: -params.amount,
      currency: 'ZAR',
      description: params.description,
      status: 'completed',
      paymentMethod: 'wallet',
      metadata: JSON.stringify({ service: params.service, from: params.from, to: params.to }),
    });
    if (params.service === 'metrobus') {
      const profile = await AppwriteService.getUserProfile(user.id);
      const current = profile?.metrobusBalance || 0;
      await AppwriteService.updateUserProfile(user.id, { metrobusBalance: current + params.amount });
    } else if (params.service === 'rea_vaya') {
      const profile = await AppwriteService.getUserProfile(user.id);
      const current = profile?.reaVayaPoints || 0;
      await AppwriteService.updateUserProfile(user.id, { reaVayaPoints: current + params.amount });
    } else {
      const validUntil = params.validUntil || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await AppwriteService.createTicket(user.id, {
        ticketType: 'single',
        serviceCategory: params.service === 'metrorail' ? 'metro' : 'gautrain',
        fromStation: params.from || '',
        toStation: params.to || '',
        fromStationId: '',
        toStationId: '',
        distance: 0,
        price: params.amount,
        currency: 'ZAR',
        status: 'active',
        validFrom: new Date().toISOString(),
        validUntil,
        qrCode: generateQRCode(),
        purchaseMethod: 'wallet',
      });
    }
    await loadWalletData();
    return { success: true };
  };

  return {
    wallet,
    transactions,
    loading,
    error,
    topUpWallet,
    purchaseTicket,
    chargeUser,
    refundUser,
    payForTransport,
    refetch: loadWalletData,
  };
}

// ----------------------------------------------------------------------
// 4. User Stats
// ----------------------------------------------------------------------
export function useUserStats() {
  const { user } = useUser();
  const [stats, setStats] = useState({ totalTrips: 0, totalSpent: 0, currentMonthSpent: 0, averagePerTrip: 0 });
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const userStats = await AppwriteService.getUserStats(user.id);
      setStats(userStats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadStats(); }, [loadStats]);

  return { stats, loading, refetch: loadStats };
}

// ----------------------------------------------------------------------
// 5. Wallet Transfers & Withdrawals
// ----------------------------------------------------------------------
export function useWalletTransfers() {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transferMoney = async (recipientIdentifier: string, amount: number, description?: string) => {
    setLoading(true);
    setError(null);
    try {
      if (!user?.id) throw new Error('Not authenticated');
      const recipient = await AppwriteService.findUserForTransfer(recipientIdentifier);
      if (!recipient) throw new Error('Recipient not found');
      if (recipient.clerkUserId === user.id) throw new Error('Cannot transfer to yourself');
      const result = await AppwriteService.transferMoney(user.id, recipient.clerkUserId, amount, description);
      if (!result.success) throw new Error(result.error || 'Transfer failed');
      return { success: true, recipient };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transfer failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const withdrawMoney = async (amount: number, withdrawalMethod: string, accountDetails: Record<string, any>) => {
    setLoading(true);
    setError(null);
    try {
      if (!user?.id) throw new Error('Not authenticated');
      const result = await AppwriteService.withdrawMoney(user.id, amount, withdrawalMethod, accountDetails);
      if (!result.success) throw new Error(result.error || 'Withdrawal failed');
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Withdrawal failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const findUser = async (identifier: string) => {
    try {
      return await AppwriteService.findUserForTransfer(identifier);
    } catch {
      return null;
    }
  };

  return { transferMoney, withdrawMoney, findUser, loading, error };
}

// ----------------------------------------------------------------------
// 6. Payment Methods (Cards & Bank Accounts)
// ----------------------------------------------------------------------
export function usePaymentMethods() {
  const { user } = useUser();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMethods = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const fetched = await AppwriteService.getUserPaymentMethods(user.id);
      setPaymentMethods(fetched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadMethods(); }, [loadMethods]);

  const addCard = async (cardData: CardData) => {
    if (!user?.id) throw new Error('Not authenticated');
    const paymentMethodData = {
      userId: user.id,
      type: 'card' as const,
      name: `${cardData.cardType} Card`,
      description: `${cardData.cardType} ending in ${cardData.cardNumber.slice(-4)}`,
      lastFour: cardData.cardNumber.slice(-4),
      expiryDate: cardData.expiryDate,
      cardType: cardData.cardType,
      isDefault: paymentMethods.length === 0,
      isActive: true,
    };
    const newMethod = await AppwriteService.createPaymentMethod(paymentMethodData);
    setPaymentMethods(prev => [newMethod, ...prev]);
  };

  const addBankAccount = async (bankData: BankAccountData) => {
    if (!user?.id) throw new Error('Not authenticated');
    const paymentMethodData = {
      userId: user.id,
      type: 'bank' as const,
      name: `${bankData.bankName} ${bankData.accountType}`,
      description: `${bankData.bankName} account ending in ${bankData.accountNumber.slice(-4)}`,
      lastFour: bankData.accountNumber.slice(-4),
      bankName: bankData.bankName,
      accountType: bankData.accountType,
      isDefault: paymentMethods.length === 0,
      isActive: true,
    };
    const newMethod = await AppwriteService.createPaymentMethod(paymentMethodData);
    setPaymentMethods(prev => [newMethod, ...prev]);
  };

  const removePaymentMethod = async (paymentMethodId: string) => {
    await AppwriteService.deletePaymentMethod(paymentMethodId);
    setPaymentMethods(prev => prev.filter(m => m.$id !== paymentMethodId));
  };

  const setDefaultPaymentMethod = async (paymentMethodId: string) => {
    if (!user?.id) throw new Error('Not authenticated');
    await AppwriteService.setDefaultPaymentMethod(user.id, paymentMethodId);
    setPaymentMethods(prev => prev.map(m => ({ ...m, isDefault: m.$id === paymentMethodId })));
  };

  return {
    paymentMethods,
    loading,
    error,
    addCard,
    addBankAccount,
    removePaymentMethod,
    setDefaultPaymentMethod,
    refreshPaymentMethods: loadMethods,
  };
}

// ----------------------------------------------------------------------
// 7. Loans
// ----------------------------------------------------------------------
export function useLoans() {
  const { user } = useUser();
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLoans = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const loans = await AppwriteService.getUserLoans(user.id, ['active', 'overdue']);
      setActiveLoans(loans);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load loans');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  const repayLoan = async (loanId: string, amount: number) => {
    if (!user?.id) return;
    await AppwriteService.repayLoan(user.id, loanId, amount);
    await fetchLoans();
  };

  return { activeLoans, loading, error, refresh: fetchLoans, repayLoan };
}