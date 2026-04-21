import { useState } from 'react';
import { useUser } from '@clerk/clerk-expo';
import { AppwriteService } from '../services/appwriteService';

export const useLoan = () => {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkEligibility = async () => {
    if (!user?.id) return { eligible: false, reason: 'Not logged in' };
    setLoading(true);
    try {
      const result = await AppwriteService.checkLoanEligibility(user.id);
      return result;
    } catch (err: any) {
      setError(err.message);
      return { eligible: false, reason: err.message };
    } finally {
      setLoading(false);
    }
  };

  const requestLoan = async (amount: number, ticketId?: string) => {
    if (!user?.id) throw new Error('Not logged in');
    setLoading(true);
    try {
      const loan = await AppwriteService.createLoan({
        userId: user.id,
        amount,
        ticketId,
      });
      // Add loan amount to wallet
      const wallet = await AppwriteService.getUserWallet(user.id);
      if (!wallet) throw new Error('Wallet not found');
      const newBalance = wallet.balance + amount;
      await AppwriteService.updateWalletBalance(user.id, newBalance);
      // Create loan_issued transaction
      await AppwriteService.createTransaction(user.id, {
        type: 'loan_issued',
        amount: amount,
        currency: 'ZAR',
        description: `Micro‑loan of R${amount.toFixed(2)}`,
        status: 'completed',
        paymentMethod: 'loan',
        referenceId: loan.$id,
      });
      return loan;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const repayLoan = async (loanId: string, amount: number) => {
    if (!user?.id) throw new Error('Not logged in');
    setLoading(true);
    try {
      const result = await AppwriteService.repayLoan(user.id, loanId, amount);
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveLoans = async () => {
    if (!user?.id) return [];
    try {
      const loans = await AppwriteService.getUserLoans(user.id, ['active', 'overdue']);
      return loans;
    } catch (err: any) {
      setError(err.message);
      return [];
    }
  };

  return {
    checkEligibility,
    requestLoan,
    repayLoan,
    fetchActiveLoans,
    loading,
    error,
  };
};