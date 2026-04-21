// services/api.ts
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

async function getAuthToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem('authToken');
  }
  return await SecureStore.getItemAsync('authToken');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }
  return response.json();
}

export const api = {
  // Tap
  tapIn: (data: any) => request('/tap/in', { method: 'POST', body: JSON.stringify(data) }),
  tapOut: (data: any) => request('/tap/out', { method: 'POST', body: JSON.stringify(data) }),
  // Tickets
  purchaseTicket: (data: any) => request('/tickets/purchase', { method: 'POST', body: JSON.stringify(data) }),
  validateTicket: (data: any) => request('/tickets/validate', { method: 'POST', body: JSON.stringify(data) }),
  getTickets: () => request('/tickets'), // <-- ADD THIS
  // Metrobus manual
  startBusTrip: (data: any) => request('/metrobus/trip/start', { method: 'POST', body: JSON.stringify(data) }),
  endBusTrip: (data: any) => request('/metrobus/trip/end', { method: 'POST', body: JSON.stringify(data) }),
  // Wallet
  getWallet: () => request('/wallet/balance'),
  topUp: (data: any) => request('/wallet/topup', { method: 'POST', body: JSON.stringify(data) }),
  getTransactions: () => request('/transactions'),
  // Loans
  checkLoanEligibility: () => request('/loans/check'),
  repayLoan: (data: any) => request('/loans/repay', { method: 'POST', body: JSON.stringify(data) }),
  // Trips
  getActiveTrip: () => request('/trips/active'),
  getTripHistory: () => request('/trips'),
};