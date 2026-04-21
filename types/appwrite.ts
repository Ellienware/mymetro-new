import { Models } from "appwrite"

export interface UserProfile {
    $id: string
    clerkUserId: string
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    dateOfBirth?: string
    address?: string
    city?: string
    province?: string
    postalCode?: string
    profileImage?: string
    notifications?: boolean
    locationServices?: boolean
    defaultPaymentMethod?: string
    reaVayaPoints?: number
    metrobusBalance?: number
    trustScore?: number          // NEW: for loan eligibility
    createdAt: string
    updatedAt: string
}

export interface Loan extends Models.Document {
    userId: string
    amount: number
    repaidAmount: number
    status: 'active' | 'overdue' | 'repaid' | 'defaulted'
    issuedAt: string
    dueDate: string
    repaidAt?: string
    ticketId?: string
}
  
  export interface UserTicket {
    $id: string
    userId: string
    ticketType: "single" | "return" | "weekly" | "monthly"
    serviceCategory: "metro" | "metro_plus" | "metro_plus_express" | "gautrain";
    fromStation: string
    toStation: string
    fromStationId: string
    toStationId: string
    distance: number
    price: number
    currency: string
    status: "active" | "used" | "expired" | "cancelled"
    validFrom: string
    validUntil: string
    qrCode: string
    purchaseMethod: "wallet" | "card" | "cash" | "points"
    createdAt: string
  }
  
 export interface Transaction {
    $id: string
    userId: string
    type: "ticket_purchase" | "wallet_topup" | "refund" | "transfer" | "withdrawal" | "ticket_upgrade" | "ticket_refund" | "points_purchase" | "loan_issued" | "loan_repayment" | 'school_booking' | 'transport' | 'hold_release'
    amount: number
    currency: string
    description: string
    status: "completed" | "pending" | "failed" | "cancelled"
    paymentMethod?: string
    referenceId?: string
    metadata?: string | null
    createdAt: string
}
  
  export interface UserWallet {
    $id: string
    userId: string
    balance: number
    currency: string
    createdAt: string
    updatedAt: string
  }
  
  export interface FavoriteStation {
    $id: string
    userId: string
    stationId: string
    stationName: string
    stationType: "train" | "bus"
    nickname?: string
    createdAt: string
  }
  
  export interface PaymentMethod {
    $id: string
    $createdAt: string
    $updatedAt: string
    userId: string
    type: "card" | "bank"
    name: string
    description: string
    lastFour: string
    expiryDate?: string
    cardType?: string
    bankName?: string
    accountType?: string
    isDefault: boolean
    isActive: boolean
  }
  
  
  export interface CardData {
    cardNumber: string
    expiryDate: string
    cvv: string
    cardholderName: string
    cardType: string
  }
  
  export interface BankAccountData {
    bankName: string
    accountNumber: string
    accountType: string
    accountHolderName: string
  }
  
  export interface CardData {
    cardNumber: string
    expiryDate: string
    cvv: string
    cardholderName: string
    cardType: string
  }
  
  export interface BankAccountData {
    bankName: string
    accountNumber: string
    accountType: string
    accountHolderName: string
  }
export interface DriverProfile extends Models.Document {
  userId: string;
  fullName: string;
  idNumber: string;
  driverLicenseNumber: string;
  phone: string;
  vehicleReg: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehicleColor?: string;
  capacity: number;
  insuranceProvider?: string;
  insuranceExpiry?: string;
  prdpNumber?: string;
  prdpExpiryDate?: string;
  operatingLicenceNumber?: string;
  operatingLicenceExpiry?: string;
  profileImageId?: string;
  licenseImageId?: string;
  prdpImageId?: string;
  vehicleRegImageId?: string;
  operatingLicenceImageId?: string;

  // Taxi service
  verificationStatus: 'pending' | 'auto_approved' | 'flagged' | 'approved' | 'rejected' | 'inactive';
  verificationNotes?: string;
  extractedData?: any;

  // School transport service
  schoolVerificationStatus: 'pending' | 'flagged' | 'approved' | 'rejected' | 'inactive';
  schoolVerificationNotes?: string;

  // ✅ Compliance fields for scholar transport
  roadworthyImageId?: string;
  roadworthyExpiry?: string;
  firstAidKitPresent: boolean;
  firstAidKitImageId?: string;
  fireExtinguisherPresent: boolean;
  fireExtinguisherImageId?: string;
  policeClearanceImageId?: string;
  schoolContractImageId?: string;
  schoolName?: string;
  supervisingAdultName?: string;
  routeDescription?: string;
  morningSchedule?: string;
  afternoonSchedule?: string;

  isAvailable: boolean;
  status: 'active' | 'inactive';
  currentRideId?: string;
  rating: number;
  totalRatings: number;
  createdAt: string;
  updatedAt: string;
}

