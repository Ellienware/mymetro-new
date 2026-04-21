// hooks/useTicketPurchase.ts
//
// Central hook for the journey → payment flow.
// Handles:
//   • Wallet balance check
//   • Loan eligibility check if balance insufficient
//   • Deducting wallet
//   • Persisting trip / ticket to Appwrite
//   • Logging transport transaction
//
// hooks/useTicketPurchase.ts
// ─────────────────────────────────────────────────────────────────────────────
// Central hook for all transport payment flows.
// Handles wallet deductions, loan offers, ticket generation and trip persistence.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { databases, DATABASE_ID, COLLECTIONS, ID } from '@/lib/appwrite';
import { getProvider } from '@/services/transport/providers';
import { isPeakHour } from '@/services/transport/fareEngine';
import { FareResult, Ticket, TransportStop, Trip } from '@/services/transport/types';
import { AppwriteService } from '@/services/appwriteService';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PurchaseOptions {
  /** Provider id: 'gautrain' | 'reavaya' | 'metrorail' | 'metrobus' */
  service:          string;
  amount:           number;
  description:      string;
  from:             string;
  to:               string;
  onSuccess:        () => void;
  onInsufficient?:  () => void;
  onTicketIssued?:  (ticket: Ticket) => void;
}

export interface TicketPurchaseHook {
  purchasing:              boolean;
  purchaseWithLoanSupport: (opts: PurchaseOptions) => Promise<void>;
  buyTicket:               (opts: BuyTicketOpts) => Promise<Ticket | null>;
  startTripFlow:           (opts: StartTripOpts) => Promise<Trip | null>;
  completeTripFlow:        (opts: CompleteTripOpts) => Promise<{ trip: Trip; fare: FareResult } | null>;
}

interface BuyTicketOpts {
  userId:      string;
  providerId:  string;
  origin:      TransportStop;
  destination: TransportStop;
  categoryId?: string;
}

interface StartTripOpts {
  userId:     string;
  providerId: string;
  origin:     TransportStop;
}

interface CompleteTripOpts {
  userId:      string;
  trip:        Trip;
  destination: TransportStop;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useTicketPurchase(): TicketPurchaseHook {
  const { user } = useUser();
  const [purchasing, setPurchasing] = useState(false);

  // ── purchaseWithLoanSupport ────────────────────────────────────────────────
  // FIX: was passing '__current__' to getUserWallet — now uses the Clerk userId
  // from the hook's own context instead.
  const purchaseWithLoanSupport = useCallback(async (opts: PurchaseOptions) => {
    const { service, amount, description, from, to, onSuccess, onInsufficient } = opts;

    if (!user?.id) {
      Alert.alert('Not logged in', 'Please sign in to continue.');
      return;
    }

    setPurchasing(true);
    try {
      const wallet = await AppwriteService.getUserWallet(user.id);
      if (!wallet) {
        Alert.alert('Error', 'Could not load your wallet. Please try again.');
        return;
      }

      // Sufficient balance — deduct and proceed
      if (wallet.balance >= amount) {
        await _deductAndLog(user.id, amount, description, service, from, to);
        onSuccess();
        return;
      }

      // Insufficient — check loan eligibility
      const shortfall = amount - wallet.balance;
      const { eligible, reason } = await AppwriteService.checkLoanEligibility(user.id);

      if (!eligible) {
        onInsufficient?.();
        Alert.alert(
          'Insufficient Balance',
          `You need R${shortfall.toFixed(2)} more.\n\n${reason ?? 'Top up your wallet to continue.'}`,
        );
        return;
      }

      // Offer loan
      await new Promise<void>(resolve => {
        Alert.alert(
          'Wallet Top-Up Loan',
          `You're R${shortfall.toFixed(2)} short.\n\nWe can issue a micro-loan of R${shortfall.toFixed(2)} repayable within 7 days.\n\nAccept?`,
          [
            { text: 'Decline', style: 'cancel', onPress: () => { onInsufficient?.(); resolve(); } },
            {
              text: 'Accept Loan',
              onPress: async () => {
                try {
                  const loan = await AppwriteService.createLoan({
                    userId:       user.id,
                    amount:       shortfall,
                    status:       'active',
                    issuedAt:     new Date().toISOString(),
                    dueDate:      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    repaidAmount: 0,
                  });

                  await AppwriteService.updateWalletBalance(user.id, wallet.balance + shortfall);

                  await AppwriteService.createTransaction(user.id, {
                    type:        'loan_issued',
                    amount:      shortfall,
                    currency:    'ZAR',
                    description: `Micro-loan for ${service} fare`,
                    status:      'completed',
                    referenceId: loan.$id,
                  });

                  await _deductAndLog(user.id, amount, description, service, from, to);
                  onSuccess();
                } catch (e) {
                  console.error('Loan flow error:', e);
                  Alert.alert('Error', 'Could not process the loan. Please try again.');
                } finally {
                  resolve();
                }
              },
            },
          ],
        );
      });
    } catch (e) {
      console.error('purchaseWithLoanSupport:', e);
      Alert.alert('Error', 'Payment failed. Please try again.');
    } finally {
      setPurchasing(false);
    }
  }, [user?.id]);

  // ── buyTicket ─────────────────────────────────────────────────────────────
  const buyTicket = useCallback(async (opts: BuyTicketOpts): Promise<Ticket | null> => {
    const { userId, providerId, origin, destination, categoryId } = opts;
    setPurchasing(true);
    try {
      const provider = getProvider(providerId);
      if (!provider.supportsTickets || !provider.purchaseTicket) {
        throw new Error(`${provider.name} does not support ticket purchase`);
      }

      const wallet = await AppwriteService.getUserWallet(userId);
      if (!wallet) throw new Error('Wallet not found');

      const fare = provider.calculateFare(origin, destination, { isPeak: isPeakHour(), categoryId });

      if (wallet.balance < fare.amount) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      const ticket = await provider.purchaseTicket(userId, origin, destination, {
        isPeak: isPeakHour(), categoryId,
      });

      await AppwriteService.updateWalletBalance(userId, wallet.balance - fare.amount);

      await AppwriteService.createTicket(userId, {
        ticketType:      'single',
        serviceCategory: (categoryId ?? 'metro') as any,
        fromStation:     origin.name,
        toStation:       destination.name,
        fromStationId:   origin.id,
        toStationId:     destination.id,
        distance:        0,
        price:           fare.amount,
        currency:        'ZAR',
        status:          'active',
        validFrom:       ticket.validFrom.toISOString(),
        validUntil:      ticket.validUntil.toISOString(),
        qrCode:          ticket.qrCode,
        purchaseMethod:  'wallet',
      });

      await AppwriteService.createTransaction(userId, {
        type:          'ticket_purchase',
        amount:        -fare.amount,
        currency:      'ZAR',
        description:   `${provider.name}: ${origin.name} → ${destination.name}`,
        status:        'completed',
        paymentMethod: 'wallet',
        metadata:      JSON.stringify({ ticketId: ticket.id, fare }),
      });

      return ticket;
    } catch (e: any) {
      if (e.message === 'INSUFFICIENT_BALANCE') throw e;
      console.error('buyTicket:', e);
      return null;
    } finally {
      setPurchasing(false);
    }
  }, []);

  // ── startTripFlow ─────────────────────────────────────────────────────────
  const startTripFlow = useCallback(async (opts: StartTripOpts): Promise<Trip | null> => {
    const { userId, providerId, origin } = opts;
    setPurchasing(true);
    try {
      const provider = getProvider(providerId);
      if (!provider.supportsTap || !provider.tapIn) {
        throw new Error(`${provider.name} does not support tap-in`);
      }

      const wallet = await AppwriteService.getUserWallet(userId);
      if (!wallet) throw new Error('Wallet not found');

      // Use the same-stop minimum as a proxy — we do not know destination yet
      if (wallet.balance < provider.minimumBalance(origin, origin)) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      const trip = await provider.tapIn(userId, origin);
      await _persistTrip(trip);
      return trip;
    } catch (e: any) {
      if (e.message === 'INSUFFICIENT_BALANCE') throw e;
      console.error('startTripFlow:', e);
      return null;
    } finally {
      setPurchasing(false);
    }
  }, []);

  // ── completeTripFlow ──────────────────────────────────────────────────────
  const completeTripFlow = useCallback(async (
    opts: CompleteTripOpts,
  ): Promise<{ trip: Trip; fare: FareResult } | null> => {
    const { userId, trip, destination } = opts;
    setPurchasing(true);
    try {
      const provider = getProvider(trip.provider);
      if (!provider.tapOut) throw new Error(`${provider.name} does not support tap-out`);

      const { trip: completed, fare } = await provider.tapOut(trip, destination);

      const wallet = await AppwriteService.getUserWallet(userId);
      if (!wallet) throw new Error('Wallet not found');
      await AppwriteService.updateWalletBalance(userId, wallet.balance - fare.amount);

      await AppwriteService.createTransaction(userId, {
        type:          'transport',
        amount:        -fare.amount,
        currency:      'ZAR',
        description:   `${provider.name}: ${trip.origin.name} → ${destination.name}`,
        status:        'completed',
        paymentMethod: 'wallet',
        metadata:      JSON.stringify({ trip: completed, fare }),
      });

      return { trip: completed, fare };
    } catch (e) {
      console.error('completeTripFlow:', e);
      return null;
    } finally {
      setPurchasing(false);
    }
  }, []);

  return { purchasing, purchaseWithLoanSupport, buyTicket, startTripFlow, completeTripFlow };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function _deductAndLog(
  userId:      string,
  amount:      number,
  description: string,
  service:     string,
  from:        string,
  to:          string,
): Promise<void> {
  const wallet = await AppwriteService.getUserWallet(userId);
  if (!wallet) throw new Error('Wallet not found');
  await AppwriteService.updateWalletBalance(userId, wallet.balance - amount);
  await AppwriteService.createTransaction(userId, {
    type:          'transport',
    amount:        -amount,
    currency:      'ZAR',
    description,
    status:        'completed',
    paymentMethod: 'wallet',
    metadata:      JSON.stringify({ service, from, to }),
  });
}

// FIX: removed dynamic require() inside the function — static import at top.
// FIX: made non-fatal warnings less verbose (single warn line).
async function _persistTrip(trip: Trip): Promise<void> {
  try {
    await databases.createDocument(DATABASE_ID, COLLECTIONS.TRIPS ?? 'TRIPS', ID.unique(), {
      tripId:     trip.id,
      userId:     trip.userId,
      provider:   trip.provider,
      originId:   trip.origin.id,
      originName: trip.origin.name,
      destId:     trip.destination.id,
      destName:   trip.destination.name,
      startTime:  trip.startTime.toISOString(),
      status:     trip.status,
      metadata:   JSON.stringify(trip.metadata ?? {}),
    });
  } catch {
    // Non-fatal — trip still exists in memory
  }
}