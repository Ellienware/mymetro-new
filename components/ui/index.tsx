// components/ui/index.tsx
// Shared design-system components for Kiddoride
import React from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from 'react-native';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';

// ─── StatusPill ───────────────────────────────
interface StatusPillProps {
  status: 'active' | 'pending' | 'picked_up' | 'dropped' | 'waiting' | 'started' | 'not_started' | string;
  label?: string;
}
export function StatusPill({ status, label }: StatusPillProps) {
  const config: Record<string, { bg: string; color: string; text: string }> = {
    active:      { bg: COLORS.successLight, color: COLORS.success, text: 'Active' },
    started:     { bg: COLORS.primaryLight, color: COLORS.primary, text: 'In Progress' },
    not_started: { bg: '#F1F5F9', color: COLORS.textMuted, text: 'Not Started' },
    pending:     { bg: COLORS.warningLight, color: COLORS.warning, text: 'Pending' },
    picked_up:   { bg: COLORS.primaryLight, color: COLORS.primary, text: '✓ Picked Up' },
    dropped:     { bg: COLORS.successLight, color: COLORS.success, text: '✓ At School' },
    waiting:     { bg: COLORS.warningLight, color: COLORS.accentDark, text: '⏳ Waiting' },
    approved:    { bg: COLORS.successLight, color: COLORS.success, text: 'Approved' },
    paid:        { bg: COLORS.successLight, color: COLORS.success, text: 'Paid' },
  };
  const c = config[status] ?? { bg: '#F1F5F9', color: COLORS.textMuted, text: label ?? status };
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.color }]}>{label ?? c.text}</Text>
    </View>
  );
}

// ─── LiveBadge ────────────────────────────────
export function LiveBadge() {
  return (
    <View style={styles.liveBadge}>
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );
}

// ─── SectionHeader ────────────────────────────
interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
}
export function SectionHeader({ title, action, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── PrimaryButton ────────────────────────────
interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  style?: ViewStyle;
}
export function PrimaryButton({ label, onPress, loading, disabled, variant = 'primary', style }: ButtonProps) {
  const variantStyles: Record<string, { bg: string; text: string; border?: string }> = {
    primary:   { bg: COLORS.primary, text: '#fff' },
    secondary: { bg: COLORS.primaryLight, text: COLORS.primaryDark },
    ghost:     { bg: 'transparent', text: COLORS.primary, border: COLORS.primary },
    danger:    { bg: COLORS.errorLight, text: COLORS.error },
  };
  const v = variantStyles[variant];
  return (
    <TouchableOpacity
      style={[
        styles.btn,
        { backgroundColor: v.bg, borderWidth: v.border ? 1.5 : 0, borderColor: v.border },
        (disabled || loading) && styles.btnDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
    >
      {loading
        ? <ActivityIndicator color={v.text} size="small" />
        : <Text style={[styles.btnText, { color: v.text }]}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

// ─── Card ─────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}
export function Card({ children, style, onPress }: CardProps) {
  if (onPress) {
    return (
      <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={0.85}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

// ─── ScreenHeader ─────────────────────────────
interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}
export function ScreenHeader({ title, onBack, right }: ScreenHeaderProps) {
  return (
    <View style={styles.screenHeader}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
      ) : <View style={{ width: 40 }} />}
      <Text style={styles.screenHeaderTitle}>{title}</Text>
      <View style={{ width: 40, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

// ─── EmptyState ───────────────────────────────
interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}
export function EmptyState({ icon, title, subtitle, action, onAction }: EmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
      {action && onAction && (
        <TouchableOpacity style={styles.emptyAction} onPress={onAction}>
          <Text style={styles.emptyActionText}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── LoadingScreen ────────────────────────────
export function LoadingScreen() {
  return (
    <View style={styles.loadingScreen}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );
}

// ─── InfoRow ──────────────────────────────────
interface InfoRowProps {
  icon: string;
  label: string;
  value?: string;
}
export function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
      {value && <Text style={styles.infoValue}>{value}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  // Pill
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '600' },

  // Live badge
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.success, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

  // Section header
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  sectionTitle: { ...TYPOGRAPHY.h3 },
  sectionAction: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },

  // Button
  btn: { paddingVertical: 14, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.55 },
  btnText: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  // Card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.md,
  },

  // Screen header
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.sm,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, color: COLORS.primary, fontWeight: '700' },
  screenHeaderTitle: { ...TYPOGRAPHY.h3, flex: 1, textAlign: 'center' },

  // Empty state
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { ...TYPOGRAPHY.h3, textAlign: 'center', marginBottom: SPACING.xs },
  emptySubtitle: { ...TYPOGRAPHY.body, textAlign: 'center', color: COLORS.textMuted, marginBottom: SPACING.md },
  emptyAction: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm + 2, borderRadius: RADIUS.lg },
  emptyActionText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Loading
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, gap: SPACING.sm },
  loadingText: { ...TYPOGRAPHY.body, color: COLORS.textMuted },

  // Info row
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs + 2 },
  infoIcon: { fontSize: 15, marginRight: SPACING.sm, width: 22 },
  infoLabel: { ...TYPOGRAPHY.body, flex: 1 },
  infoValue: { ...TYPOGRAPHY.bodyBold },
});