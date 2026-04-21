// app/tickets/index.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
  Alert, Modal, Share,
} from 'react-native';
import { router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import QRCode from 'react-native-qrcode-svg';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader, Card, LoadingScreen } from '@/components/ui';
import { useUserWallet, useUserTickets } from '@/hooks/useAppwrite';
import type { UserTicket } from '@/types/appwrite';

// Status colours — FIX: COLORS.success / COLORS.error may not exist, use hex fallbacks
const STATUS_COLOR: Record<string, string> = {
  active:    '#16A34A',
  used:      '#6B7280',
  expired:   '#9CA3AF',
  cancelled: '#EF4444',
};

export default function TicketsScreen() {
  const { wallet }                           = useUserWallet();
  const { tickets, loading, refetch }        = useUserTickets();
  const [selectedTicket, setSelectedTicket]  = useState<UserTicket | null>(null);

  const shareTicket = useCallback((ticket: UserTicket) => {
    Share.share({
      message: `myMetro Ticket\n${ticket.fromStation} → ${ticket.toStation}\nQR: ${ticket.qrCode}`,
      title:   'myMetro Ticket',
    });
  }, []);

  const renderTicket = useCallback(({ item }: { item: UserTicket }) => (
    <Card style={styles.ticketCard}>
      <TouchableOpacity onPress={() => setSelectedTicket(item)} activeOpacity={0.8}>
        <View style={styles.ticketHeader}>
          <Text style={styles.ticketRoute} numberOfLines={1}>
            {item.fromStation} → {item.toStation}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLOR[item.status] ?? '#6B7280'}20` }]}>
            <Text style={[styles.ticketStatus, { color: STATUS_COLOR[item.status] ?? '#6B7280' }]}>
              {item.status}
            </Text>
          </View>
        </View>

        {/* FIX: price is stored in RANDS by AppwriteService — no /100 */}
        <Text style={styles.ticketPrice}>R{item.price.toFixed(2)}</Text>
        <Text style={styles.ticketValid}>
          Valid until {new Date(item.validUntil).toLocaleString()}
        </Text>

        {item.status === 'active' && (
          <TouchableOpacity
            style={styles.viewQrBtn}
            onPress={() => setSelectedTicket(item)}
          >
            <Text style={styles.viewQrText}>View QR Code →</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Card>
  ), []);

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="My Tickets" onBack={() => router.back()} />

      {/* Wallet balance strip */}
      <View style={styles.balanceStrip}>
        <Text style={styles.balanceLabel}>Wallet Balance</Text>
        <Text style={styles.balanceAmount}>R{(wallet?.balance ?? 0).toFixed(2)}</Text>
      </View>

      <FlatList
        data={tickets}
        renderItem={renderTicket}
        keyExtractor={item => item.$id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onRefresh={refetch}
        refreshing={loading}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.buyBtn}
            onPress={() => router.push('/tickets/buy' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.buyBtnText}>+ Buy New Ticket</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎫</Text>
            <Text style={styles.emptyTitle}>No tickets yet</Text>
            <Text style={styles.emptySub}>
              Buy a ticket to get started. Tickets are valid for 24 hours.
            </Text>
          </View>
        }
      />

      {/* QR code bottom sheet */}
      <Modal visible={!!selectedTicket} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Your Ticket</Text>
            {selectedTicket && (
              <>
                <Text style={styles.modalRoute}>
                  {selectedTicket.fromStation} → {selectedTicket.toStation}
                </Text>

                {/* QR code — FIX: qrCode is a string, pass directly */}
                <View style={styles.qrContainer}>
                  <QRCode
                    value={selectedTicket.qrCode || 'INVALID'}
                    size={200}
                    backgroundColor="#fff"
                  />
                </View>

                {/* FIX: price in rands — no /100 */}
                <Text style={styles.qrFare}>R{selectedTicket.price.toFixed(2)}</Text>
                <Text style={styles.qrValid}>
                  Valid until {new Date(selectedTicket.validUntil).toLocaleString()}
                </Text>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnCancel]}
                    onPress={() => setSelectedTicket(null)}
                  >
                    <Text style={styles.modalBtnTextDark}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnConfirm]}
                    onPress={() => shareTicket(selectedTicket)}
                  >
                    <Text style={styles.modalBtnTextLight}>Share</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list:      { padding: SPACING.md, paddingBottom: 56 },

  balanceStrip: {
    flexDirection:    'row',
    justifyContent:   'space-between',
    alignItems:       'center',
    paddingHorizontal: SPACING.md,
    paddingVertical:  SPACING.sm,
    backgroundColor:  COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  balanceLabel:  { ...(TYPOGRAPHY.caption as object), color: COLORS.textMuted },
  balanceAmount: { fontSize: 18, fontWeight: '700', color: COLORS.primary },

  buyBtn: {
    backgroundColor: COLORS.primary,
    borderRadius:    RADIUS.lg,
    paddingVertical: 14,
    alignItems:      'center',
    marginBottom:    SPACING.lg,
  },
  buyBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  ticketCard:   { marginBottom: SPACING.sm },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  ticketRoute:  { fontSize: 15, fontWeight: '700', flex: 1, marginRight: SPACING.sm, color: COLORS.textPrimary ?? '#1E293B' },
  statusBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  ticketStatus: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  ticketPrice:  { fontSize: 20, fontWeight: '800', color: COLORS.primary, marginBottom: 4 },
  ticketValid:  { fontSize: 12, color: COLORS.textMuted, marginBottom: 6 },
  viewQrBtn:    { alignSelf: 'flex-start' },
  viewQrText:   { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: SPACING.xl * 2 },
  emptyIcon:  { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: SPACING.xs, color: COLORS.textPrimary ?? '#1E293B' },
  emptySub:   { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor:      COLORS.surface,
    borderTopLeftRadius:  RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding:    SPACING.lg,
    paddingBottom: 36,
    alignItems: 'center',
  },
  modalHandle:   { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  modalTitle:    { fontSize: 20, fontWeight: '700', marginBottom: SPACING.xs, color: COLORS.textPrimary ?? '#1E293B' },
  modalRoute:    { ...(TYPOGRAPHY.body as object), color: COLORS.textMuted, marginBottom: SPACING.md },
  qrContainer:   { backgroundColor: '#fff', padding: SPACING.md, borderRadius: RADIUS.lg, marginBottom: SPACING.sm },
  qrFare:        { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  qrValid:       { fontSize: 12, color: COLORS.textMuted, marginBottom: SPACING.lg },

  modalButtons:       { flexDirection: 'row', gap: SPACING.sm, width: '100%' },
  modalBtn:           { flex: 1, paddingVertical: 13, borderRadius: RADIUS.lg, alignItems: 'center' },
  modalBtnCancel:     { backgroundColor: COLORS.border },
  modalBtnConfirm:    { backgroundColor: COLORS.primary },
  // FIX: two separate text styles instead of relying on COLORS.textSecondary
  modalBtnTextDark:   { fontWeight: '600', color: COLORS.textPrimary ?? '#1E293B' },
  modalBtnTextLight:  { fontWeight: '700', color: '#fff' },
});