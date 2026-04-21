import { Permission, Role } from "appwrite";
import {
  databases,
  DATABASE_ID,
  COLLECTIONS,
  ID,
  Query,
} from "../lib/appwrite";
import type {
  UserProfile,
  UserTicket,
  Transaction,
  UserWallet,
  FavoriteStation,
  PaymentMethod,
} from "../types/appwrite";
import { MetrobusTrip } from "@/types";
import { calculateDistance } from "@/constants/metrorailFares";
import { Hold } from "@/types/taxi";

function defaultPermissions() {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.any()),
    Permission.write(Role.any()),
  ];
}

function fullPermissions() {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.any()),
    Permission.write(Role.any()),
    Permission.delete(Role.any()),
  ];
}

export class AppwriteService {
  // USER PROFILE METHODS
  static async initializeUser(
    userId: string,
    profileData: Partial<UserProfile>
  ): Promise<void> {
    try {
      await Promise.all([
        this.createUserProfile(userId, profileData),
        this.createWallet(userId),
      ]);
    } catch (error) {
      console.error("Error initializing user:", error);
      throw error;
    }
  }

static async createUserProfile(
  userId: string,
  profileData: Partial<UserProfile>
): Promise<UserProfile> {
  try {
    const response = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.USERS,
      userId,
      {
        clerkUserId: userId,
        ...profileData,
        trustScore: profileData.trustScore ?? 100,
        reaVayaPoints: profileData.reaVayaPoints ?? 0,
        metrobusBalance: profileData.metrobusBalance ?? 0,
        notifications: profileData.notifications ?? false,
        locationServices: profileData.locationServices ?? false,
        defaultPaymentMethod: profileData.defaultPaymentMethod ?? "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      fullPermissions()
    );
    return response as unknown as UserProfile;
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw error;
  }
}
  
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const response = await databases.getDocument(
        DATABASE_ID,
        COLLECTIONS.USERS,
        userId
      );
      return response as unknown as UserProfile;
    } catch (error: any) {
      if (error.code === 404) return null;
      console.error("Error getting user profile:", error);
      throw error;
    }
  }

  static async updateUserProfile(
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<UserProfile> {
    try {
      const exists = await this.getUserProfile(userId);
      if (!exists) {
        return await this.createUserProfile(userId, updates);
      }

      const response = await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.USERS,
        userId,
        {
          ...updates,
          notifications: updates.notifications ?? false,
          locationServices: updates.locationServices ?? false,
          defaultPaymentMethod: updates.defaultPaymentMethod ?? "",
          updatedAt: new Date().toISOString(),
        }
      );

      return response as unknown as UserProfile;
    } catch (error) {
      console.error("Error updating user profile:", error);
      throw error;
    }
  }

  // WALLET METHODS
 static async createWallet(userId: string): Promise<UserWallet> {
  try {
    const response = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.WALLETS,
      ID.unique(),  // ← use unique ID, not userId
      {
        userId,      // ← store userId as a field
        balance: 0,
        currency: "ZAR",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      fullPermissions()
    );
    return response as unknown as UserWallet;
  } catch (error) {
    console.error("Error creating wallet:", error);
    throw error;
  }
}

 static async getUserWallet(userId: string): Promise<UserWallet | null> {
  try {
    const wallets = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.WALLETS,
      [Query.equal('userId', userId)]
    );
    if (wallets.documents.length > 0) {
      return wallets.documents[0] as unknown as UserWallet;
    }
    return null;
  } catch (error) {
    console.error("Error getting wallet:", error);
    throw error;
  }
}

  static async updateWalletBalance(
  userId: string,
  newBalance: number
): Promise<UserWallet> {
  try {
    const wallet = await this.getUserWallet(userId);
    if (!wallet) {
      throw new Error("Wallet not found");
    }
    const response = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.WALLETS,
      wallet.$id, // ← use the document ID, not userId
      {
        balance: newBalance,
        updatedAt: new Date().toISOString(),
      }
    );
    return response as unknown as UserWallet;
  } catch (error) {
    console.error("Error updating wallet balance:", error);
    throw error;
  }
}

  // TRANSACTION METHODS
  static async createTransaction(
    userId: string,
    transactionData: Omit<Transaction, "$id" | "userId" | "createdAt">
  ): Promise<Transaction> {
    try {
      const response = await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.TRANSACTIONS,
        ID.unique(),
        {
          userId,
          ...transactionData,
          createdAt: new Date().toISOString(),
        },
        defaultPermissions()
      );
      return response as unknown as Transaction;
    } catch (error) {
      console.error("Error creating transaction:", error);
      throw error;
    }
  }

  static async getUserTransactions(
    userId: string,
    limit = 50
  ): Promise<Transaction[]> {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.TRANSACTIONS,
        [
          Query.equal("userId", userId),
          Query.orderDesc("createdAt"),
          Query.limit(limit),
        ]
      );
      return response.documents as unknown as Transaction[];
    } catch (error) {
      console.error("Error getting transactions:", error);
      throw error;
    }
  }

  // TICKET METHODS
    static async createTicket(userId: string, ticketData: Omit<UserTicket, "$id" | "userId" | "createdAt">): Promise<UserTicket> { 
        try {
          const response = await databases.createDocument(
            DATABASE_ID,
            COLLECTIONS.TICKETS,
            ID.unique(),
            {
              userId,
              ...ticketData,
              createdAt: new Date().toISOString(),
            },
            fullPermissions(),
          )
          return response as unknown as UserTicket
        } catch (error) {
          console.error(`Error creating ticket:`, error)
          throw error
        }   
    }

  static async getUserTickets(userId: string): Promise<UserTicket[]> {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.TICKETS,
        [
          Query.equal("userId", userId),
          Query.orderDesc("createdAt"),
        ]
      );
      return response.documents as unknown as UserTicket[];
    } catch (error) {
      console.error("Error getting user tickets:", error);
      throw error;
    }
  }

  static async updateTicket(
    ticketId: string,
    updates: Partial<UserTicket>
  ): Promise<UserTicket> {
    try {
      const response = await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.TICKETS,
        ticketId,
        updates
      );
      return response as unknown as UserTicket;
    } catch (error) {
      console.error("Error updating ticket:", error);
      throw error;
    }
  }

  static async deleteTicket(ticketId: string): Promise<void> {
    try {
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.TICKETS, ticketId);
    } catch (error) {
      console.error("Error deleting ticket:", error);
      throw error;
    }
  }

  // FAVORITE STATIONS METHODS
  static async addFavoriteStation(
    userId: string,
    stationData: Omit<FavoriteStation, "$id" | "userId" | "createdAt">
  ): Promise<FavoriteStation> {
    try {
      const response = await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.FAVORITES,
        ID.unique(),
        {
          userId,
          ...stationData,
          createdAt: new Date().toISOString(),
        },
        fullPermissions()
      );
      return response as unknown as FavoriteStation;
    } catch (error) {
      console.error("Error adding favorite station:", error);
      throw error;
    }
  }

  static async getUserFavorites(userId: string): Promise<FavoriteStation[]> {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.FAVORITES,
        [
          Query.equal("userId", userId),
          Query.orderDesc("createdAt"),
        ]
      );
      return response.documents as unknown as FavoriteStation[];
    } catch (error) {
      console.error("Error getting favorites:", error);
      throw error;
    }
  }

  static async removeFavoriteStation(favoriteId: string): Promise<void> {
    try {
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.FAVORITES, favoriteId);
    } catch (error) {
      console.error("Error removing favorite:", error);
      throw error;
    }
  }

  // FINANCIAL OPERATIONS
  static async getUserStats(userId: string): Promise<{
    totalTrips: number;
    totalSpent: number;
    currentMonthSpent: number;
    averagePerTrip: number;
  }> {
    try {
      const transactions = await this.getUserTransactions(userId, 1000);
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();

      const ticketPurchases = transactions.filter(t => t.type === "ticket_purchase");
      const totalSpent = ticketPurchases.reduce((acc, t) => acc + Math.abs(t.amount), 0);

      const currentMonthSpent = ticketPurchases
        .filter(t => {
          const d = new Date(t.createdAt);
          return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        })
        .reduce((acc, t) => acc + Math.abs(t.amount), 0);

      return {
        totalTrips: ticketPurchases.length,
        totalSpent,
        currentMonthSpent,
        averagePerTrip: ticketPurchases.length > 0 ? totalSpent / ticketPurchases.length : 0,
      };
    } catch (error) {
      console.error("Error getting user stats:", error);
      return {
        totalTrips: 0,
        totalSpent: 0,
        currentMonthSpent: 0,
        averagePerTrip: 0,
      };
    }
  }

  static async transferMoney(
    fromUserId: string,
    toUserId: string,
    amount: number,
    description?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const [fromWallet, toWallet] = await Promise.all([
        this.getUserWallet(fromUserId),
        this.getUserWallet(toUserId),
      ]);

      if (!fromWallet || !toWallet) {
        return { success: false, error: "Wallet not found" };
      }

      if (fromWallet.balance < amount) {
        return { success: false, error: "Insufficient balance" };
      }

      const transferId = ID.unique();

      await Promise.all([
        this.createTransaction(fromUserId, {
          type: "transfer",
          amount: -amount,
          currency: "ZAR",
          description: description || `Transfer to user`,
          status: "completed",
          referenceId: transferId,
          metadata: JSON.stringify({ recipientId: toUserId, transferType: "sent" }),
        }),
        this.createTransaction(toUserId, {
          type: "transfer",
          amount: amount,
          currency: "ZAR",
          description: description || `Transfer from user`,
          status: "completed",
          referenceId: transferId,
          metadata: JSON.stringify({ senderId: fromUserId, transferType: "received" }),
        }),
        this.updateWalletBalance(fromUserId, fromWallet.balance - amount),
        this.updateWalletBalance(toUserId, toWallet.balance + amount),
      ]);

      return { success: true };
    } catch (error) {
      console.error("Error transferring money:", error);
      return { success: false, error: "Transfer failed" };
    }
  }

  static async withdrawMoney(
    userId: string,
    amount: number,
    withdrawalMethod: string,
    accountDetails: Record<string, any>
  ): Promise<{ success: boolean; error?: string; withdrawalId?: string }> {
    try {
      const wallet = await this.getUserWallet(userId);
      if (!wallet || wallet.balance < amount) {
        return { success: false, error: "Insufficient balance or wallet not found" };
      }

      const withdrawalId = ID.unique();

      await this.createTransaction(userId, {
        type: "withdrawal",
        amount: -amount,
        currency: "ZAR",
        description: `Withdrawal via ${withdrawalMethod}`,
        status: "pending",
        paymentMethod: withdrawalMethod,
        referenceId: withdrawalId,
        metadata: JSON.stringify({
          withdrawalMethod,
          accountDetails,
          withdrawalId,
        }),
      });

      await this.updateWalletBalance(userId, wallet.balance - amount);

      return { success: true, withdrawalId };
    } catch (error) {
      console.error("Error withdrawing money:", error);
      return { success: false, error: "Withdrawal failed" };
    }
  }
   // NEW PAYMENT METHODS FUNCTIONS
  static async getUserPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    try {
      const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PAYMENT_METHODS, [
        Query.equal("userId", userId),
        Query.equal("isActive", true),
        Query.orderDesc("$createdAt"),
      ])
      return response.documents.map(
        (doc) =>
          ({
            $id: doc.$id,
            $createdAt: doc.$createdAt,
            $updatedAt: doc.$updatedAt,
            userId: doc.userId,
            type: doc.type,
            name: doc.name,
            description: doc.description,
            lastFour: doc.lastFour,
            expiryDate: doc.expiryDate,
            cardType: doc.cardType,
            bankName: doc.bankName,
            accountType: doc.accountType,
            isDefault: doc.isDefault,
            isActive: doc.isActive,
          }) as PaymentMethod,
      )
    } catch (error) {
      console.error("Error getting payment methods:", error)
      return []
    }
  }

  static async createPaymentMethod(
    paymentMethodData: Omit<PaymentMethod, "$id" | "$createdAt" | "$updatedAt">,
  ): Promise<PaymentMethod> {
    const result = await databases.createDocument(DATABASE_ID, COLLECTIONS.PAYMENT_METHODS, ID.unique(), {
      ...paymentMethodData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    return {
      $id: result.$id,
      $createdAt: result.$createdAt,
      $updatedAt: result.$updatedAt,
      userId: result.userId,
      type: result.type,
      name: result.name,
      description: result.description,
      lastFour: result.lastFour,
      expiryDate: result.expiryDate,
      cardType: result.cardType,
      bankName: result.bankName,
      accountType: result.accountType,
      isDefault: result.isDefault,
      isActive: result.isActive,
    } as PaymentMethod
  }

  static async updatePaymentMethod(
    paymentMethodId: string,
    updateData: Partial<PaymentMethod>,
  ): Promise<PaymentMethod> {
    const result = await databases.updateDocument(DATABASE_ID, COLLECTIONS.PAYMENT_METHODS, paymentMethodId, {
      ...updateData,
      updatedAt: new Date().toISOString(),
    })

    return {
      $id: result.$id,
      $createdAt: result.$createdAt,
      $updatedAt: result.$updatedAt,
      userId: result.userId,
      type: result.type,
      name: result.name,
      description: result.description,
      lastFour: result.lastFour,
      expiryDate: result.expiryDate,
      cardType: result.cardType,
      bankName: result.bankName,
      accountType: result.accountType,
      isDefault: result.isDefault,
      isActive: result.isActive,
    } as PaymentMethod
  }

  static async deletePaymentMethod(paymentMethodId: string): Promise<void> {
    await databases.updateDocument(DATABASE_ID, COLLECTIONS.PAYMENT_METHODS, paymentMethodId, {
      isActive: false,
      updatedAt: new Date().toISOString(),
    })
  }

  static async setDefaultPaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    const userPaymentMethods = await this.getUserPaymentMethods(userId)

    for (const method of userPaymentMethods) {
      if (method.isDefault) {
        await this.updatePaymentMethod(method.$id, { isDefault: false })
      }
    }

    await this.updatePaymentMethod(paymentMethodId, { isDefault: true })
  }

  // USER SEARCH
  static async findUserForTransfer(searchTerm: string): Promise<UserProfile | null> {
    try {
      const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USERS, [
        Query.or([
          Query.equal("phone", searchTerm),
          Query.equal("email", searchTerm),
        ]),
      ]);
      return response.documents[0] as unknown as UserProfile || null;
    } catch (error) {
      console.error("Error finding user:", error);
      return null;
    }
  }

// ===== Rea Vaya Points =====
static async getReaVayaPoints(userId: string): Promise<number> {
  const profile = await this.getUserProfile(userId);
  return profile?.reaVayaPoints ?? 0;
}

static async addReaVayaPoints(userId: string, points: number): Promise<UserProfile> {
  const profile = await this.getUserProfile(userId);
  const currentPoints = profile?.reaVayaPoints ?? 0;
  const newPoints = currentPoints + points;
  return this.updateUserProfile(userId, { reaVayaPoints: newPoints });
}

static async deductReaVayaPoints(userId: string, points: number): Promise<UserProfile> {
  const profile = await this.getUserProfile(userId);
  const currentPoints = profile?.reaVayaPoints ?? 0;
  if (currentPoints < points) throw new Error('Insufficient points');
  const newPoints = currentPoints - points;
  return this.updateUserProfile(userId, { reaVayaPoints: newPoints });
}


// ===== Loan Methods =====

static async checkLoanEligibility(userId: string): Promise<{ eligible: boolean; reason?: string }> {
  try {
    const profile = await this.getUserProfile(userId);
    if (!profile) return { eligible: false, reason: 'User not found' };

    const trustScore = profile.trustScore ?? 100;
    if (trustScore < 50) return { eligible: false, reason: 'Trust score too low' };

    const createdAt = new Date(profile.createdAt);
    const daysSince = (Date.now() - createdAt.getTime()) / (1000 * 3600 * 24);
    if (daysSince < 7) return { eligible: false, reason: 'Account too new' };

    const activeLoans = await this.getUserLoans(userId, ['active', 'overdue']);
    if (activeLoans.length > 0) return { eligible: false, reason: 'You have an outstanding loan' };

    return { eligible: true };
  } catch (error) {
    console.error('Error checking loan eligibility:', error);
    return { eligible: false, reason: 'Service error' };
  }
}

static async getUserLoans(userId: string, status?: string[]): Promise<any[]> {
  const queries = [Query.equal('userId', userId)];
  if (status && status.length > 0) {
    queries.push(Query.equal('status', status));
  }
  const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.LOANS, queries);
  return response.documents;
}

static async createLoan(loanData: Omit<any, '$id'>): Promise<any> {
  return await databases.createDocument(
    DATABASE_ID,
    COLLECTIONS.LOANS,
    ID.unique(),
    {
      ...loanData,
      repaidAmount: 0,
      status: 'active',
      issuedAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }
  );
}

static async updateLoan(loanId: string, updates: Partial<any>): Promise<any> {
  return await databases.updateDocument(DATABASE_ID, COLLECTIONS.LOANS, loanId, updates);
}

// ... other methods ...
static async deductFromWallet(userId: string, amount: number, description: string): Promise<UserWallet> {
  const wallet = await this.getUserWallet(userId);
  if (!wallet) throw new Error('Wallet not found');
  if (wallet.balance < amount) throw new Error('Insufficient wallet balance');
  const newBalance = wallet.balance - amount;
  const updatedWallet = await this.updateWalletBalance(userId, newBalance);
  await this.createTransaction(userId, {
    type: 'transfer',
    amount: -amount,
    currency: 'ZAR',
    description: description,
    status: 'completed',
    paymentMethod: 'wallet',
  });
  return updatedWallet;
}
static async repayLoan(userId: string, loanId: string, amount: number): Promise<{ loan: any; wallet: any }> {
  const loan = await databases.getDocument(DATABASE_ID, COLLECTIONS.LOANS, loanId);
  const wallet = await this.getUserWallet(userId);
  if (!wallet) throw new Error('Wallet not found');
  if (loan.userId !== userId) throw new Error('Unauthorized');
  if (loan.status !== 'active' && loan.status !== 'overdue') throw new Error('Loan not repayable');

  const remaining = loan.amount - (loan.repaidAmount || 0);
  if (amount > remaining) amount = remaining;
  if (amount <= 0) throw new Error('Invalid amount');

  // Deduct from wallet
  const newBalance = wallet.balance - amount;
  if (newBalance < 0) throw new Error('Insufficient wallet balance');
  await this.updateWalletBalance(userId, newBalance);

  // Update loan
  const newRepaid = (loan.repaidAmount || 0) + amount;
  const updates: any = { repaidAmount: newRepaid };
  if (newRepaid >= loan.amount) {
    updates.status = 'repaid';
    updates.repaidAt = new Date().toISOString();
  }
  const updatedLoan = await this.updateLoan(loanId, updates);

  // Create transaction
  await this.createTransaction(userId, {
    type: 'loan_repayment',
    amount: -amount,
    currency: 'ZAR',
    description: `Loan repayment for loan ${loanId.slice(-6)}`,
    status: 'completed',
    paymentMethod: 'wallet',
    referenceId: loanId,
  });

  // If loan fully repaid, update trust score
  if (newRepaid >= loan.amount) {
    const profile = await this.getUserProfile(userId);
    const currentTrust = profile?.trustScore ?? 100;
    const newTrust = currentTrust + 5;
    await this.updateUserProfile(userId, { trustScore: newTrust });
  }

  const updatedWallet = await this.getUserWallet(userId);
  return { loan: updatedLoan, wallet: updatedWallet };
}

static async applyOverduePenalties(): Promise<void> {
  const now = new Date();
  const overdueLoans = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.LOANS,
    [Query.equal('status', 'active'), Query.lessThan('dueDate', now.toISOString())]
  );
  for (const loan of overdueLoans.documents) {
    await this.updateLoan(loan.$id, { status: 'overdue' });
  }

  const graceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const defaultLoans = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.LOANS,
    [
      Query.equal('status', 'overdue'),
      Query.lessThan('dueDate', graceDate.toISOString())
    ]
  );
  for (const loan of defaultLoans.documents) {
    await this.updateLoan(loan.$id, { status: 'defaulted' });
    const profile = await this.getUserProfile(loan.userId);
    if (profile) {
      const newTrust = (profile.trustScore ?? 100) - 10;
      await this.updateUserProfile(loan.userId, { trustScore: newTrust });
    }
  }
}

static async issueLoanAndCreditWallet(
  userId: string,
  amount: number,
  purpose: string
): Promise<{ loan: any; wallet: UserWallet }> {
  // Check eligibility first
  const eligibility = await this.checkLoanEligibility(userId);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason || 'Not eligible for a loan');
  }

  // Create loan document
  const loan = await this.createLoan({
    userId,
    amount,
    purpose,
    interestRate: 0, // 0% interest for now
    status: 'active',
  });

  // Credit wallet with loan amount
  const wallet = await this.getUserWallet(userId);
  if (!wallet) throw new Error('Wallet not found');
  const newBalance = (wallet.balance || 0) + amount;
  const updatedWallet = await this.updateWalletBalance(userId, newBalance);

  // Record transaction for the loan credit
  await this.createTransaction(userId, {
    type: 'loan_issued',
    amount: amount,
    currency: 'ZAR',
    description: `Loan of R${amount} for ${purpose}`,
    status: 'completed',
    referenceId: loan.$id,
  });

  return { loan, wallet: updatedWallet };
}


// ===== Metrobus Balance =====
static async getMetrobusBalance(userId: string): Promise<number> {
  const profile = await this.getUserProfile(userId);
  return profile?.metrobusBalance ?? 0;
}

static async topUpMetrobusBalance(userId: string, amount: number): Promise<UserProfile> {
  const wallet = await this.getUserWallet(userId);
  if (!wallet || wallet.balance < amount) {
    throw new Error('Insufficient wallet balance');
  }
  // Deduct from wallet
  await this.updateWalletBalance(userId, wallet.balance - amount);
  // Add to metrobus balance
  const profile = await this.getUserProfile(userId);
  const current = profile?.metrobusBalance ?? 0;
  return this.updateUserProfile(userId, { metrobusBalance: current + amount });
}

static async deductMetrobusBalance(userId: string, amount: number): Promise<UserProfile> {
  const profile = await this.getUserProfile(userId);
  const current = profile?.metrobusBalance ?? 0;
  if (current < amount) throw new Error('Insufficient Metrobus balance');
  return this.updateUserProfile(userId, { metrobusBalance: current - amount });
}

// ===== Metrobus Trips =====
static async tapIn(userId: string, entryStopId: string, entryStopName: string): Promise<MetrobusTrip> {
  // Check for existing active trip
  const activeTrips = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.METROBUS_TRIPS,
    [Query.equal('userId', userId), Query.equal('status', 'active')]
  );
  if (activeTrips.documents.length > 0) {
    throw new Error('You have already tapped in. Please tap out first.');
  }
  const trip = await databases.createDocument(
    DATABASE_ID,
    COLLECTIONS.METROBUS_TRIPS,
    ID.unique(),
    {
      userId,
      entryStopId,
      entryStopName,
      entryTimestamp: new Date().toISOString(),
      status: 'active',
    }
  );
  return trip as unknown as MetrobusTrip;
}

static async tapOut(userId: string, tripId: string, exitStopId: string, exitStopName: string): Promise<MetrobusTrip> {
  const trip = await databases.getDocument(DATABASE_ID, COLLECTIONS.METROBUS_TRIPS, tripId);
  if (!trip || trip.status !== 'active') {
    throw new Error('No active trip to tap out');
  }
  
  // Get stops coordinates from ALL_STOPS (you need to have this data)
  const { ALL_STOPS } = require('../constants/allStops'); // adjust import as needed
  const entryStop = ALL_STOPS.find((s: any) => s.id === trip.entryStopId); // fixed: use trip.entryStopId, and typed s
  const exitStop = ALL_STOPS.find((s: any) => s.id === exitStopId);
  if (!entryStop || !exitStop) {
    throw new Error('Stop information missing');
  }
  
  const distance = calculateDistance(
    entryStop.coordinates.latitude,
    entryStop.coordinates.longitude,
    exitStop.coordinates.latitude,
    exitStop.coordinates.longitude
  );
  const farePerKm = 2; // example rate, adjust as needed
  const fare = Math.round(distance * farePerKm * 100) / 100;

  // Deduct from metrobus balance
  await this.deductMetrobusBalance(userId, fare);

  const updated = await databases.updateDocument(
    DATABASE_ID,
    COLLECTIONS.METROBUS_TRIPS,
    tripId,
    {
      exitStopId,
      exitStopName,
      exitTimestamp: new Date().toISOString(),
      fare,
      status: 'completed',
    }
  );
  return updated as unknown as MetrobusTrip;
}

static async applyPenalty(userId: string, tripId: string): Promise<MetrobusTrip> {
  const penalty = 30;
  await this.deductMetrobusBalance(userId, penalty);
  const updated = await databases.updateDocument(
    DATABASE_ID,
    COLLECTIONS.METROBUS_TRIPS,
    tripId,
    {
      status: 'penalty',
      penaltyAmount: penalty,
    }
  );
  return updated as unknown as MetrobusTrip;
}

// ===== PAYMENT HOLD METHODS (with driver wallet integration) =====

static async placeHold(
  passengerId: string,
  driverId: string,
  amount: number,
  expiresMinutes = 60
): Promise<Hold> {
  const wallet = await this.getUserWallet(passengerId);
  if (!wallet) throw new Error('Passenger wallet not found');
  if (wallet.balance < amount) throw new Error('Insufficient balance');

  // Deduct immediately (will be refunded if hold expires or declined)
  await this.updateWalletBalance(passengerId, wallet.balance - amount);

  const hold = await databases.createDocument(
    DATABASE_ID,
    COLLECTIONS.HOLDS,
    ID.unique(),
    {
      passengerId,
      driverId,
      amount,
      status: 'pending',
      expiresAt: new Date(Date.now() + expiresMinutes * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    }
  );
  return hold as unknown as Hold;
}

static async captureHold(holdId: string, tripId?: string): Promise<void> {
  const hold = await databases.getDocument(DATABASE_ID, COLLECTIONS.HOLDS, holdId);
  if (hold.status !== 'pending') throw new Error('Hold is not pending');
  if (new Date(hold.expiresAt) < new Date()) throw new Error('Hold expired');

  // Ensure driver wallet exists and credit it
  let driverWallet = await this.getDriverWallet(hold.driverId);
  if (!driverWallet) {
    driverWallet = await this.createDriverWallet(hold.driverId);
  }
  await this.creditDriverWallet(hold.driverId, hold.amount, `Trip payment from passenger ${hold.passengerId}`);

  // Update hold status
  await databases.updateDocument(DATABASE_ID, COLLECTIONS.HOLDS, holdId, {
    status: 'captured',
    capturedAt: new Date().toISOString(),
    tripId,
  });

  // Record transaction for passenger (already deducted, just log)
  await this.createTransaction(hold.passengerId, {
    type: 'transport',
    amount: -hold.amount,
    currency: 'ZAR',
    description: `Taxi trip (hold captured)`,
    status: 'completed',
    referenceId: holdId,
    metadata: JSON.stringify({ driverId: hold.driverId, tripId }),
  });
}

static async releaseHold(holdId: string): Promise<void> {
  const hold = await databases.getDocument(DATABASE_ID, COLLECTIONS.HOLDS, holdId);
  if (hold.status !== 'pending') return; // Already captured or released

  // Return funds to passenger wallet
  const passengerWallet = await this.getUserWallet(hold.passengerId);
  if (passengerWallet) {
    await this.updateWalletBalance(hold.passengerId, passengerWallet.balance + hold.amount);
  }

  await databases.updateDocument(DATABASE_ID, COLLECTIONS.HOLDS, holdId, {
    status: 'released',
    releasedAt: new Date().toISOString(),
  });

  // Log release transaction for passenger
  await this.createTransaction(hold.passengerId, {
    type: 'hold_release',
    amount: hold.amount,
    currency: 'ZAR',
    description: `Hold released for taxi flag`,
    status: 'completed',
    referenceId: holdId,
    metadata: JSON.stringify({ driverId: hold.driverId }),
  });
}

// Background job: process expired holds (to be called by cron)
static async processExpiredHolds(): Promise<void> {
  const now = new Date().toISOString();
  const expiredHolds = await databases.listDocuments(DATABASE_ID, COLLECTIONS.HOLDS, [
    Query.equal('status', 'pending'),
    Query.lessThan('expiresAt', now),
    Query.limit(100),
  ]);

  for (const hold of expiredHolds.documents) {
    try {
      await this.releaseHold(hold.$id);
      console.log(`Released expired hold ${hold.$id}`);
    } catch (err) {
      console.error(`Failed to release hold ${hold.$id}:`, err);
    }
  }
}

// ===== DRIVER WALLET METHODS =====

static async getDriverWallet(driverId: string): Promise<any> {
  try {
    const wallets = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.DRIVER_WALLETS,
      [Query.equal('driverId', driverId), Query.limit(1)]
    );
    if (wallets.documents.length > 0) {
      return wallets.documents[0];
    }
    return null;
  } catch (error) {
    console.error('Error getting driver wallet:', error);
    return null;
  }
}

static async createDriverWallet(driverId: string): Promise<any> {
  try {
    const existing = await this.getDriverWallet(driverId);
    if (existing) return existing;
    
    const wallet = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.DRIVER_WALLETS,
      ID.unique(),
      {
        driverId,
        balance: 0,
        currency: 'ZAR',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
    return wallet;
  } catch (error) {
    console.error('Error creating driver wallet:', error);
    throw error;
  }
}

static async creditDriverWallet(driverId: string, amount: number, description?: string): Promise<any> {
  try {
    let wallet = await this.getDriverWallet(driverId);
    if (!wallet) {
      wallet = await this.createDriverWallet(driverId);
    }
    const newBalance = (wallet.balance || 0) + amount;
    const updated = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.DRIVER_WALLETS,
      wallet.$id,
      {
        balance: newBalance,
        updatedAt: new Date().toISOString(),
      }
    );
    
    // Create transaction record for driver
    await this.createDriverTransaction(driverId, {
      type: 'credit',
      amount,
      description: description || 'Trip earnings',
      status: 'completed',
      referenceId: wallet.$id,
    });
    
    return updated;
  } catch (error) {
    console.error('Error crediting driver wallet:', error);
    throw error;
  }
}

static async debitDriverWallet(driverId: string, amount: number, description?: string): Promise<any> {
  try {
    const wallet = await this.getDriverWallet(driverId);
    if (!wallet) throw new Error('Driver wallet not found');
    if ((wallet.balance || 0) < amount) throw new Error('Insufficient driver wallet balance');
    
    const newBalance = (wallet.balance || 0) - amount;
    const updated = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.DRIVER_WALLETS,
      wallet.$id,
      {
        balance: newBalance,
        updatedAt: new Date().toISOString(),
      }
    );
    
    // Create transaction record for driver
    await this.createDriverTransaction(driverId, {
      type: 'debit',
      amount: -amount,
      description: description || 'Withdrawal or fee',
      status: 'completed',
      referenceId: wallet.$id,
    });
    
    return updated;
  } catch (error) {
    console.error('Error debiting driver wallet:', error);
    throw error;
  }
}

static async getDriverTransactions(driverId: string, limit = 50): Promise<any[]> {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.DRIVER_TRANSACTIONS,
      [
        Query.equal('driverId', driverId),
        Query.orderDesc('createdAt'),
        Query.limit(limit),
      ]
    );
    return response.documents;
  } catch (error) {
    console.error('Error getting driver transactions:', error);
    return [];
  }
}

static async createDriverTransaction(
  driverId: string,
  data: {
    type: 'credit' | 'debit';
    amount: number;
    description: string;
    status: 'pending' | 'completed' | 'failed';
    referenceId?: string;
    metadata?: string;
  }
): Promise<any> {
  try {
    const transaction = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.DRIVER_TRANSACTIONS,
      ID.unique(),
      {
        driverId,
        ...data,
        createdAt: new Date().toISOString(),
      }
    );
    return transaction;
  } catch (error) {
    console.error('Error creating driver transaction:', error);
    throw error;
  }
}

static async requestDriverWithdrawal(
  driverId: string,
  amount: number,
  bankAccountDetails: {
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
  }
): Promise<{ success: boolean; withdrawalId?: string; error?: string }> {
  try {
    const wallet = await this.getDriverWallet(driverId);
    if (!wallet || (wallet.balance || 0) < amount) {
      return { success: false, error: 'Insufficient balance' };
    }
    
    if (amount < 50) {
      return { success: false, error: 'Minimum withdrawal amount is R50' };
    }
    
    // Create withdrawal request
    const withdrawalId = ID.unique();
    await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.DRIVER_WITHDRAWALS,
      withdrawalId,
      {
        driverId,
        amount,
        bankAccountDetails: JSON.stringify(bankAccountDetails),
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
    );
    
    // Optionally debit the wallet immediately or hold until approved
    // For now, we'll debit immediately to prevent double spending
    await this.debitDriverWallet(driverId, amount, `Withdrawal request #${withdrawalId}`);
    
    return { success: true, withdrawalId };
  } catch (error) {
    console.error('Error requesting withdrawal:', error);
    return { success: false, error: 'Withdrawal request failed' };
  }
}

// services/appwriteService.ts – add these methods

// ===== SCHOOL DRIVER WALLET METHODS =====

// Get school driver wallet
static async getSchoolDriverWallet(driverId: string): Promise<any> {
  try {
    const wallets = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_DRIVER_WALLETS, [
      Query.equal('driverId', driverId),
      Query.limit(1),
    ]);
    return wallets.documents[0] || null;
  } catch (error) {
    console.error('Error getting school driver wallet:', error);
    return null;
  }
}

// Create school driver wallet and link to driver
static async createSchoolDriverWallet(driverId: string): Promise<any> {
  try {
    const existing = await this.getSchoolDriverWallet(driverId);
    if (existing) return existing;
    
    const wallet = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.SCHOOL_DRIVER_WALLETS,
      ID.unique(),
      {
        driverId,
        balance: 0,
        currency: 'ZAR',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
    
    // Update driver document with walletId
    await databases.updateDocument(DATABASE_ID, COLLECTIONS.SCHOOL_DRIVERS, driverId, {
      walletId: wallet.$id,
    });
    
    return wallet;
  } catch (error) {
    console.error('Error creating school driver wallet:', error);
    throw error;
  }
}

// Credit school driver wallet
static async creditSchoolDriverWallet(driverId: string, amount: number, description?: string): Promise<any> {
  try {
    let wallet = await this.getSchoolDriverWallet(driverId);
    if (!wallet) wallet = await this.createSchoolDriverWallet(driverId);
    const newBalance = (wallet.balance || 0) + amount;
    const updated = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.SCHOOL_DRIVER_WALLETS,
      wallet.$id,
      { balance: newBalance, updatedAt: new Date().toISOString() }
    );
    await this.createSchoolDriverTransaction(driverId, {
      type: 'credit',
      amount,
      description: description || 'Trip earnings',
      status: 'completed',
    });
    return updated;
  } catch (error) {
    console.error('Error crediting school driver wallet:', error);
    throw error;
  }
}

// Get school driver transactions
static async getSchoolDriverTransactions(driverId: string, limit = 50): Promise<any[]> {
  try {
    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_DRIVER_TRANSACTIONS, [
      Query.equal('driverId', driverId),
      Query.orderDesc('createdAt'),
      Query.limit(limit),
    ]);
    return response.documents;
  } catch (error) {
    console.error('Error getting school driver transactions:', error);
    return [];
  }
}

// Create school driver transaction
static async createSchoolDriverTransaction(driverId: string, data: any): Promise<any> {
  return databases.createDocument(
    DATABASE_ID,
    COLLECTIONS.SCHOOL_DRIVER_TRANSACTIONS,
    ID.unique(),
    { driverId, ...data, createdAt: new Date().toISOString() }
  );
}

// services/appwriteService.ts – add these methods

static async requestSchoolDriverWithdrawal(
  driverId: string,
  amount: number,
  bankAccountDetails: {
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
  }
): Promise<{ success: boolean; withdrawalId?: string; error?: string }> {
  try {
    const wallet = await this.getSchoolDriverWallet(driverId);
    if (!wallet || (wallet.balance || 0) < amount) {
      return { success: false, error: 'Insufficient balance' };
    }
    
    if (amount < 50) {
      return { success: false, error: 'Minimum withdrawal amount is R50' };
    }
    
    // Create withdrawal request
    const withdrawalId = ID.unique();
    await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.SCHOOL_DRIVER_WITHDRAWALS,
      withdrawalId,
      {
        driverId,
        amount,
        bankAccountDetails: JSON.stringify(bankAccountDetails),
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
    );
    
    // Debit the wallet immediately to prevent double spending
    await this.debitSchoolDriverWallet(driverId, amount, `Withdrawal request #${withdrawalId}`);
    
    return { success: true, withdrawalId };
  } catch (error) {
    console.error('Error requesting school driver withdrawal:', error);
    return { success: false, error: 'Withdrawal request failed' };
  }
}

static async debitSchoolDriverWallet(driverId: string, amount: number, description?: string): Promise<any> {
  try {
    const wallet = await this.getSchoolDriverWallet(driverId);
    if (!wallet) throw new Error('Wallet not found');
    if ((wallet.balance || 0) < amount) throw new Error('Insufficient balance');
    
    const newBalance = (wallet.balance || 0) - amount;
    const updated = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.SCHOOL_DRIVER_WALLETS,
      wallet.$id,
      { balance: newBalance, updatedAt: new Date().toISOString() }
    );
    
    await this.createSchoolDriverTransaction(driverId, {
      type: 'debit',
      amount: -amount,
      description: description || 'Withdrawal',
      status: 'completed',
    });
    
    return updated;
  } catch (error) {
    console.error('Error debiting school driver wallet:', error);
    throw error;
  }
}

// ===== METER DRIVER WALLET METHODS =====

static async getMeterDriverWallet(driverId: string): Promise<any> {
  const wallets = await databases.listDocuments(DATABASE_ID, COLLECTIONS.METER_DRIVER_WALLETS, [
    Query.equal('driverId', driverId),
    Query.limit(1),
  ]);
  return wallets.documents[0] || null;
}

static async createMeterDriverWallet(driverId: string): Promise<any> {
  const existing = await this.getMeterDriverWallet(driverId);
  if (existing) return existing;
  const wallet = await databases.createDocument(DATABASE_ID, COLLECTIONS.METER_DRIVER_WALLETS, ID.unique(), {
    driverId,
    balance: 0,
    currency: 'ZAR',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  // Update driver with walletId
  await databases.updateDocument(DATABASE_ID, COLLECTIONS.METER_DRIVERS, driverId, {
    walletId: wallet.$id,
  });
  return wallet;
}

static async creditMeterDriverWallet(driverId: string, amount: number, description?: string): Promise<any> {
  let wallet = await this.getMeterDriverWallet(driverId);
  if (!wallet) wallet = await this.createMeterDriverWallet(driverId);
  const newBalance = (wallet.balance || 0) + amount;
  const updated = await databases.updateDocument(DATABASE_ID, COLLECTIONS.METER_DRIVER_WALLETS, wallet.$id, {
    balance: newBalance,
    updatedAt: new Date().toISOString(),
  });
  await this.createMeterDriverTransaction(driverId, {
    type: 'credit',
    amount,
    description: description || 'Earnings',
    status: 'completed',
  });
  return updated;
}

static async debitMeterDriverWallet(driverId: string, amount: number, description?: string): Promise<any> {
  const wallet = await this.getMeterDriverWallet(driverId);
  if (!wallet) throw new Error('Wallet not found');
  if ((wallet.balance || 0) < amount) throw new Error('Insufficient balance');
  const newBalance = (wallet.balance || 0) - amount;
  const updated = await databases.updateDocument(DATABASE_ID, COLLECTIONS.METER_DRIVER_WALLETS, wallet.$id, {
    balance: newBalance,
    updatedAt: new Date().toISOString(),
  });
  await this.createMeterDriverTransaction(driverId, {
    type: 'debit',
    amount: -amount,
    description: description || 'Withdrawal',
    status: 'completed',
  });
  return updated;
}

static async getMeterDriverTransactions(driverId: string, limit = 50): Promise<any[]> {
  const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.METER_DRIVER_TRANSACTIONS, [
    Query.equal('driverId', driverId),
    Query.orderDesc('createdAt'),
    Query.limit(limit),
  ]);
  return response.documents;
}

static async createMeterDriverTransaction(driverId: string, data: any): Promise<any> {
  return databases.createDocument(DATABASE_ID, COLLECTIONS.METER_DRIVER_TRANSACTIONS, ID.unique(), {
    driverId,
    ...data,
    createdAt: new Date().toISOString(),
  });
}

static async requestMeterDriverWithdrawal(
  driverId: string,
  amount: number,
  bankAccountDetails: { bankName: string; accountNumber: string; accountHolderName: string }
): Promise<{ success: boolean; withdrawalId?: string; error?: string }> {
  const wallet = await this.getMeterDriverWallet(driverId);
  if (!wallet || (wallet.balance || 0) < amount) return { success: false, error: 'Insufficient balance' };
  if (amount < 50) return { success: false, error: 'Minimum withdrawal amount is R50' };

  const withdrawalId = ID.unique();
  await databases.createDocument(DATABASE_ID, COLLECTIONS.METER_DRIVER_WITHDRAWALS, withdrawalId, {
    driverId,
    amount,
    bankAccountDetails: JSON.stringify(bankAccountDetails),
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  await this.debitMeterDriverWallet(driverId, amount, `Withdrawal request #${withdrawalId}`);
  return { success: true, withdrawalId };
}

}