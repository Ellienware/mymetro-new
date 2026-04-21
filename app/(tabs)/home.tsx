// app/(tabs)/index.tsx — Home Screen
import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { useUserWallet } from '@/hooks/useAppwrite';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';

// ─── Wallet Card ──────────────────────────────
function WalletCard({ balance, onPress }: { balance: number; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.walletCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.walletTop}>
        <View>
          <Text style={styles.walletLabel}>metroPay Balance</Text>
          <Text style={styles.walletBalance}>R {balance.toFixed(2)}</Text>
        </View>
        <View style={styles.walletIcon}>
          <Text style={{ fontSize: 26 }}>💳</Text>
        </View>
      </View>
      <View style={styles.walletBottom}>
        <Text style={styles.walletCta}>Top up · View history →</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Quick Action ─────────────────────────────
function QuickAction({
  icon, label, onPress, accent = false,
}: { icon: string; label: string; onPress: () => void; accent?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.quickAction, accent && styles.quickActionAccent]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <Text style={styles.quickActionIcon}>{icon}</Text>
      <Text style={[styles.quickActionLabel, accent && styles.quickActionLabelAccent]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Category Card ────────────────────────────
function CategoryCard({
  title, icon, bg, onPress,
}: { title: string; icon: string; bg: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.categoryCard} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.categoryIconWrap, { backgroundColor: bg }]}>
        <Text style={{ fontSize: 26 }}>{icon}</Text>
      </View>
      <Text style={styles.categoryTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

// ─── Recent Trip ──────────────────────────────
interface RecentTrip { id: string; from: string; to: string; time: string }
function RecentTripItem({ trip, onPress, onRebook }: { trip: RecentTrip; onPress: () => void; onRebook: () => void }) {
  return (
    <TouchableOpacity style={styles.tripItem} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.tripIconWrap}>
        <Text style={{ fontSize: 16 }}>🎫</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.tripRoute} numberOfLines={1}>{trip.from} → {trip.to}</Text>
        <Text style={styles.tripTime}>{trip.time}</Text>
      </View>
      <TouchableOpacity style={styles.rebookBtn} onPress={onRebook} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.rebookText}>Rebook</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────
export default function HomeScreen() {
  const { user } = useUser();
  const { wallet, transactions, refetch } = useUserWallet();
  const [refreshing, setRefreshing] = React.useState(false);

  // Refresh wallet when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [])
  );

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const recentTrips: RecentTrip[] =
    transactions
      ?.filter(t => t.type === 'ticket_purchase')
      .slice(0, 3)
      .map(t => {
        let from = 'Origin', to = 'Destination';
        if (t.description?.includes('→')) {
          const parts = t.description.split('→');
          from = parts[0].replace('Journey:', '').trim();
          to = parts[1].trim();
        }
        return {
          id: t.$id,
          from, to,
          time: new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
      }) ?? [];

  const categories = [
    { title: 'Explore', icon: '🔍', bg: '#DBEAFE', route: '/transport-options' },
    { title: 'School', icon: '🏫', bg: COLORS.primaryLight, route: '/parent/school/dashboard' },
    { title: 'Discovery', icon: '📍', bg: '#EDE9FE', route: '/discover' },
    { title: 'Bills', icon: '💰', bg: '#FFEDD5', route: '/pay-bills' },
  ];

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.userName}>{user?.firstName ?? 'there'} 👋</Text>
          </View>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => router.push('/notifications' as any)}
          >
            <Text style={{ fontSize: 20 }}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Wallet */}
        <View style={styles.px}>
          <WalletCard balance={wallet?.balance ?? 0} onPress={() => router.push('/wallet')} />
        </View>

        {/* Search bar */}
        <TouchableOpacity style={styles.searchBar} onPress={() => router.push('/plan-journey')} activeOpacity={0.85}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Where are you going?</Text>
        </TouchableOpacity>

        {/* Quick actions */}
        <View style={styles.px}>
          <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
          <View style={styles.quickActions}>
            <QuickAction icon="🚆" label="Routes" onPress={() => router.push('/RoutesScreen')} accent />
            <QuickAction icon="🏫" label="School" onPress={() => router.push('/parent/school/search')} />
            <QuickAction icon="🚖" label="Live Taxis" onPress={() => router.push('/taxi')} />
            <QuickAction icon="💳" label="metroPay" onPress={() => router.push('/wallet')} />
          </View>
        </View>

        {/* Categories */}
        <View style={styles.px}>
          <Text style={styles.sectionLabel}>EXPLORE</Text>
          <View style={styles.categoriesGrid}>
            {categories.map(c => (
              <CategoryCard
                key={c.title}
                title={c.title}
                icon={c.icon}
                bg={c.bg}
                onPress={() => router.push(c.route as any)}
              />
            ))}
          </View>
        </View>

        {/* Recent trips */}
        <View style={styles.px}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Trips</Text>
            <TouchableOpacity onPress={() => router.push('/plan-journey')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {recentTrips.length > 0 ? (
            <View style={styles.tripList}>
              {recentTrips.map((trip, idx) => (
                <React.Fragment key={trip.id}>
                  <RecentTripItem
                    trip={trip}
                    onPress={() => router.push(`/trip-details/${trip.id}` as any)}
                    onRebook={() => router.push({ pathname: '/plan-journey', params: { from: trip.from, to: trip.to } })}
                  />
                  {idx < recentTrips.length - 1 && <View style={styles.tripDivider} />}
                </React.Fragment>
              ))}
            </View>
          ) : (
            <View style={styles.emptyTrips}>
              <Text style={styles.emptyIcon}>🎫</Text>
              <Text style={styles.emptyTitle}>No trips yet</Text>
              <Text style={styles.emptySub}>Plan your first trip to get started</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/plan-journey')}>
                <Text style={styles.emptyBtnText}>Plan a trip</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: SPACING.xl },
  px: { paddingHorizontal: SPACING.md },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.lg, paddingBottom: SPACING.sm,
  },
  greeting: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },
  userName: { ...TYPOGRAPHY.h1, marginTop: 2 },
  notifBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', ...SHADOWS.sm,
  },

  // Wallet card
  walletCard: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.xl,
    padding: SPACING.md, marginBottom: SPACING.md, ...SHADOWS.lg,
  },
  walletTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md },
  walletLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500', marginBottom: 4 },
  walletBalance: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  walletIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  walletBottom: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: SPACING.sm },
  walletCta: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },

  // Search bar
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surface, marginHorizontal: SPACING.md, marginBottom: SPACING.md,
    borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1.5, borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  searchIcon: { fontSize: 16 },
  searchPlaceholder: { ...TYPOGRAPHY.body, color: COLORS.textMuted },

  // Section labels
  sectionLabel: { ...TYPOGRAPHY.label, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  sectionTitle: { ...TYPOGRAPHY.h3 },
  seeAll: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },

  // Quick actions
  quickActions: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.lg, flexWrap: 'wrap' },
  quickAction: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.full,
    borderWidth: 1.5, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  quickActionAccent: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  quickActionIcon: { fontSize: 14 },
  quickActionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  quickActionLabelAccent: { color: '#fff' },

  // Categories
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  categoryCard: {
    width: '47.5%', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.md, alignItems: 'center', ...SHADOWS.sm,
  },
  categoryIconWrap: { width: 54, height: 54, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  categoryTitle: { ...TYPOGRAPHY.bodyBold, fontSize: 14 },

  // Trips
  tripList: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOWS.sm, marginBottom: SPACING.lg },
  tripItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.sm },
  tripDivider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.md },
  tripIconWrap: {
    width: 38, height: 38, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  tripRoute: { ...TYPOGRAPHY.bodyBold, fontSize: 14 },
  tripTime: { ...TYPOGRAPHY.caption, marginTop: 2 },
  rebookBtn: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.full },
  rebookText: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 13 },

  // Empty trips
  emptyTrips: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.xl,
    alignItems: 'center', ...SHADOWS.sm, marginBottom: SPACING.lg,
  },
  emptyIcon: { fontSize: 36, marginBottom: SPACING.sm },
  emptyTitle: { ...TYPOGRAPHY.h4, marginBottom: 4 },
  emptySub: { ...TYPOGRAPHY.body, color: COLORS.textMuted, textAlign: 'center', marginBottom: SPACING.md },
  emptyBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: 10, borderRadius: RADIUS.lg },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});