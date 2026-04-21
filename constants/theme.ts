// myMetro Transit App Color Theme
export const COLORS = {
  // Primary Blues (Main brand color)
  primary: "#1E5AA8", // Metro Blue
  primaryLight: "#2563EB",
  primaryDark: "#1E3A8A",

  // Secondary Blues (Headers, accents)
  secondary: "#0066B3",
  secondaryLight: "#3B82F6",
  secondaryDark: "#1D4ED8",

  // Accent - Teal/Green (Top Up, Success actions)
  accent: "#0D9488", // Teal for Top Up button
  accentLight: "#14B8A6",
  accentDark: "#0F766E",

  // Action Colors
  sendMoney: "#3B82F6", // Blue for send
  withdraw: "#8B5CF6", // Purple for withdraw
  topUp: "#0D9488", // Teal for top up

  // Neutral
  white: "#FFFFFF",
  gray50: "#F8FAFC",
  gray100: "#F1F5F9",
  gray200: "#E2E8F0",
  gray300: "#CBD5E1",
  gray400: "#94A3B8",
  gray500: "#64748B",
  gray600: "#475569",
  gray700: "#334155",
  gray800: "#1E293B",
  gray900: "#0F172A",

  // Status
  success: "#10B981",
  successLight: "#D1FAE5",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  error: "#EF4444",
  errorLight: "#FEE2E2",
  info: "#3B82F6",
  infoLight: "#DBEAFE",

  // Transaction Colors
  credit: "#10B981", // Green for money in
  debit: "#EF4444", // Red for money out
  pending: "#F59E0B", // Orange for pending

  // Background
  background: "#F1F5F9", // Light gray background
  surface: "#FFFFFF",
  cardBorder: "#E2E8F0",

  // Text
  textPrimary: "#1E293B",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  textOnPrimary: "#FFFFFF",

  // Payment Method Colors
  visa: "#1A1F71",
  mastercard: "#EB001B",
  bankTransfer: "#059669",
}

export const TYPOGRAPHY = {
  fontSizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
    "3xl": 30,
    "4xl": 36,
    "5xl": 48,
  },
  fontWeights: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    extrabold: "800",
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
}

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
}

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
}

export const SHADOWS = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
}
