// constants/theme.ts
// ─────────────────────────────────────────────
// MetroPay Design System – Navy & White Brand
// ─────────────────────────────────────────────

export const COLORS = {
  // Brand – Navy from logo
  primary: '#2B3896',        // Navy
  primaryLight: '#F0F2FD',   // Tinted white
  primaryDark: '#1E2A6E',    // Deeper navy

  accent: '#F59E0B',         // Amber
  accentLight: '#FEF3C7',
  accentDark: '#D97706',

  // Semantic
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',

  // Neutrals
  white: '#FFFFFF',
  background: '#F8F9FF',      // Very light navy tint
  surface: '#FFFFFF',
  surfaceAlt: '#F8F9FF',

  // Text
  textPrimary: '#1E2A6E',     // Navy
  textSecondary: '#4B5B9B',
  textMuted: '#8890C4',
  textInverse: '#FFFFFF',

  // Borders
  border: '#E2E5F5',
  borderStrong: '#C5CBE8',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#2B3896',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#2B3896',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#2B3896',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
};

export const TYPOGRAPHY = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: COLORS.textPrimary, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const, color: COLORS.textPrimary, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '600' as const, color: COLORS.textPrimary },
  h4: { fontSize: 16, fontWeight: '600' as const, color: COLORS.textPrimary },
  body: { fontSize: 15, fontWeight: '400' as const, color: COLORS.textSecondary },
  bodyBold: { fontSize: 15, fontWeight: '600' as const, color: COLORS.textPrimary },
  caption: { fontSize: 12, fontWeight: '400' as const, color: COLORS.textMuted },
  captionBold: { fontSize: 12, fontWeight: '600' as const, color: COLORS.textSecondary },
  label: { fontSize: 13, fontWeight: '600' as const, color: COLORS.textSecondary, letterSpacing: 0.3 },
};

export const cardStyle = {
  backgroundColor: COLORS.surface,
  borderRadius: RADIUS.lg,
  padding: SPACING.md,
  ...SHADOWS.md,
};

export const inputStyle = {
  backgroundColor: COLORS.surface,
  borderWidth: 1.5,
  borderColor: COLORS.border,
  borderRadius: RADIUS.md,
  padding: SPACING.md,
  fontSize: 15,
  color: COLORS.textPrimary,
};

export const pillStyle = (color: string, bg: string) => ({
  backgroundColor: bg,
  paddingHorizontal: SPACING.sm,
  paddingVertical: 4,
  borderRadius: RADIUS.full,
  alignSelf: 'flex-start' as const,
});