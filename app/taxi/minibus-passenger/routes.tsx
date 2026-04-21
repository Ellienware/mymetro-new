// app/taxi/routes.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Minibus-taxi route browser.
// Lists all routes stored in Appwrite TAXI_ROUTES collection and lets the
// user tap through to route-detail for stop / fare information.
//
// FIXES vs original:
// - Import paths were '../../../' relative — changed to '@/' aliases throughout.
// - No loading state: the component rendered an empty list while the async
//   request was in-flight, then silently filled it. Added `loading` state with
//   a skeleton loader so the UI is never empty without explanation.
// - No error state: Appwrite errors were caught and console.error'd but the
//   screen stayed blank with "No routes found". Added a proper error state
//   with a Retry button.
// - No pull-to-refresh: network screens must let users refresh. Added
//   RefreshControl.
// - renderRoute was defined inline inside the component, causing a new function
//   reference on every render and unnecessary FlatList item remounts. Extracted
//   to a stable RouteCard component with React.memo.
// - keyExtractor was an inline arrow — moved to a module-level stable ref.
// - ScreenHeader replaces the hand-rolled header (consistent with every other
//   screen in the app).
// - Hard-coded hex colours replaced with design-system tokens (COLORS,
//   TYPOGRAPHY, SPACING, RADIUS, SHADOWS).
// - router.push pathname used a bare string — cast to `any` so Expo Router's
//   typed routes don't reject it at compile time.
// - distanceKm was displayed as a raw number without `.toFixed()` — fixed to
//   always show one decimal place.
// - No `Query.orderAsc('name')` — route list order was non-deterministic
//   (Appwrite default is insertion order). Added alphabetical sort.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '@/lib/appwrite';
import { ScreenHeader } from '@/components/ui';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TaxiRoute {
  $id:         string;
  name:        string;
  fromRank:    string;
  toRank:      string;
  distanceKm:  number;
  stops?:      any[];
}

// ─── Route card (stable, memoised — prevents unnecessary FlatList remounts) ──
const RouteCard = React.memo(({ item, onPress }: { item: TaxiRoute; onPress: () => void }) => (
  <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.78}>
    {/* Icon */}
    <View style={styles.cardIcon}>
      <Text style={{ fontSize: 20 }}>🚐</Text>
    </View>

    {/* Body */}
    <View style={styles.cardBody}>
      <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
      <View style={styles.cardRouteRow}>
        <View style={styles.routeDotOrigin} />
        <Text style={styles.cardFrom} numberOfLines={1}>{item.fromRank}</Text>
      </View>
      <View style={styles.routeConnectorRow}>
        <View style={styles.routeConnectorLine} />
      </View>
      <View style={styles.cardRouteRow}>
        <View style={styles.routeDotDest} />
        <Text style={styles.cardTo} numberOfLines={1}>{item.toRank}</Text>
      </View>
    </View>

    {/* Distance + chevron */}
    <View style={styles.cardRight}>
      <Text style={styles.cardDistance}>{item.distanceKm.toFixed(1)} km</Text>
      {item.stops?.length ? (
        <Text style={styles.cardStops}>{item.stops.length} stops</Text>
      ) : null}
      <Text style={styles.cardChevron}>›</Text>
    </View>
  </TouchableOpacity>
));

// Stable key extractor — module-level avoids recreation on each render
const keyExtractor = (item: TaxiRoute) => item.$id;

// ─── Skeleton placeholder ────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={[styles.card, { opacity: 0.45 }]}>
      <View style={[styles.cardIcon, { backgroundColor: COLORS.border }]} />
      <View style={styles.cardBody}>
        <View style={[styles.skeletonLine, { width: '60%', marginBottom: 8 }]} />
        <View style={[styles.skeletonLine, { width: '45%', marginBottom: 4 }]} />
        <View style={[styles.skeletonLine, { width: '50%' }]} />
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function TaxiRoutesScreen() {
  const [routes,     setRoutes]     = useState<TaxiRoute[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const loadRoutes = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);
    setError(null);

    try {
      const res = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.TAXI_ROUTES,
        [Query.orderAsc('name'), Query.limit(100)],
      );
      setRoutes(res.documents as unknown as TaxiRoute[]);
    } catch (err: any) {
      console.error('TaxiRoutesScreen.loadRoutes:', err);
      setError(err?.message ?? 'Failed to load routes. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadRoutes(); }, [loadRoutes]);

  const handlePress = useCallback((routeId: string) => {
    router.push({ pathname: '/taxi/route-detail' as any, params: { routeId } });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: TaxiRoute }) => (
      <RouteCard item={item} onPress={() => handlePress(item.$id)} />
    ),
    [handlePress],
  );

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Taxi Routes" onBack={() => router.back()} />
        <View style={styles.list}>
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </View>
      </SafeAreaView>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Taxi Routes" onBack={() => router.back()} />
        <View style={styles.centreState}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Couldn't load routes</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadRoutes()} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main list ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Taxi Routes" onBack={() => router.back()} />

      <FlatList
        data={routes}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadRoutes(true)}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListHeaderComponent={
          routes.length > 0 ? (
            <Text style={styles.resultCount}>{routes.length} route{routes.length !== 1 ? 's' : ''}</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.centreState}>
            <Text style={styles.errorIcon}>🚐</Text>
            <Text style={styles.errorTitle}>No routes yet</Text>
            <Text style={styles.errorBody}>
              Taxi routes will appear here once they have been registered.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  list: { padding: SPACING.md, paddingBottom: 48 },

  resultCount: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
  },

  // Route card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  cardIcon: {
    width: 48, height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accentLight,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardName: { ...TYPOGRAPHY.bodyBold, marginBottom: SPACING.xs },

  // Mini origin–destination display inside card
  cardRouteRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeDotOrigin:   { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  routeDotDest:     { width: 8, height: 8, borderRadius: 2, backgroundColor: COLORS.accent },
  routeConnectorRow:{ paddingLeft: 3, paddingVertical: 2 },
  routeConnectorLine:{ width: 2, height: 10, backgroundColor: COLORS.border },
  cardFrom: { ...TYPOGRAPHY.caption, fontWeight: '600', flex: 1 },
  cardTo:   { ...TYPOGRAPHY.caption, color: COLORS.textMuted, flex: 1 },

  // Right column
  cardRight:    { alignItems: 'flex-end', gap: 2 },
  cardDistance: { ...TYPOGRAPHY.captionBold, color: COLORS.primary },
  cardStops:    { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  cardChevron:  { fontSize: 20, color: COLORS.textMuted, fontWeight: '300', marginTop: 2 },

  // Skeleton
  skeletonLine: { height: 11, backgroundColor: COLORS.border, borderRadius: 6 },

  // Empty / error state
  centreState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.xxl,
  },
  errorIcon:  { fontSize: 44, marginBottom: SPACING.md },
  errorTitle: { ...TYPOGRAPHY.h3, textAlign: 'center', marginBottom: SPACING.xs },
  errorBody:  { ...TYPOGRAPHY.body, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.lg },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl, paddingVertical: 12,
    borderRadius: RADIUS.lg,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});