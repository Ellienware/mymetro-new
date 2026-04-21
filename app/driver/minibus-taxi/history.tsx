// app/driver/minibus-taxi/trip-history.tsx
// FIX: '@/constants/themes' → '@/constants/theme'
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router, useFocusEffect } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '@/lib/appwrite';
import { ScreenHeader, Card, LoadingScreen, EmptyState } from '@/components/ui';

export default function MinibusTripHistory() {
  const { user } = useUser();
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const totalEarnings = trips.reduce((s, t) => s + (t.driverEarnings || 0), 0);
  const totalPassengers = trips.reduce((s, t) => s + (t.passengerCount || 0), 0);
  const avgEarnings = trips.length > 0 ? totalEarnings / trips.length : 0;

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const drivers = await databases.listDocuments(DATABASE_ID, COLLECTIONS.TAXI_DRIVERS, [Query.equal('userId', user!.id)]);
        if (!drivers.documents.length) return;
        const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.TAXI_TRIPS, [
          Query.equal('driverId', drivers.documents[0].$id),
          Query.equal('status', 'completed'),
          Query.orderDesc('endedAt'),
        ]);
        setTrips(res.documents);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []));

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Trip History" onBack={() => router.back()} />
      <FlatList
        data={trips}
        keyExtractor={item => item.$id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => trips.length > 0 ? (
          <View style={styles.summaryRow}>
            {[{ icon: '🛣️', label: 'Trips', value: trips.length.toString() }, { icon: '👥', label: 'Passengers', value: totalPassengers.toString() }, { icon: '💰', label: 'Total earned', value: `R${totalEarnings.toFixed(0)}` }, { icon: '📊', label: 'Avg / trip', value: `R${avgEarnings.toFixed(0)}` }].map(s => (
              <View key={s.label} style={styles.summaryStat}>
                <Text style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</Text>
                <Text style={[TYPOGRAPHY.h3, { color: COLORS.primary, fontSize: 16 }]}>{s.value}</Text>
                <Text style={[TYPOGRAPHY.caption, { textAlign: 'center', marginTop: 2 }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
        ListEmptyComponent={<EmptyState icon="🛣️" title="No completed trips yet" subtitle="Your trip history will appear here once you've completed your first trip." />}
        renderItem={({ item }) => {
          const date = item.endedAt ? new Date(item.endedAt) : null;
          return (
            <Card style={styles.tripCard}>
              <View style={styles.tripTop}>
                <View>
                  <Text style={TYPOGRAPHY.bodyBold}>{date ? date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</Text>
                  <Text style={[TYPOGRAPHY.caption, { marginTop: 2 }]}>{date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
                </View>
                <View style={styles.earningsBadge}><Text style={styles.earningsBadgeText}>R{(item.driverEarnings ?? 0).toFixed(2)}</Text></View>
              </View>
              <Text style={[TYPOGRAPHY.caption, { color: COLORS.textMuted, marginBottom: SPACING.sm }]}>Route: {item.routeId}</Text>
              <View style={styles.statsGrid}>
                {[{ icon: '👥', value: item.passengerCount ?? 0, label: 'Passengers' }, { icon: '💵', value: `R${(item.cashCollected ?? 0).toFixed(0)}`, label: 'Cash' }, { icon: '📱', value: `R${(item.digitalCollected ?? 0).toFixed(0)}`, label: 'Digital' }, { icon: '🏠', value: `R${(item.dailyRental ?? 0).toFixed(0)}`, label: 'Rental', red: true }].map((s, i, arr) => (
                  <View key={s.label} style={{ flexDirection: 'row' }}>
                    <View style={styles.gridStat}>
                      <Text style={{ fontSize: 14, marginBottom: 2 }}>{s.icon}</Text>
                      <Text style={[TYPOGRAPHY.bodyBold, { fontSize: 13, color: s.red ? COLORS.error : COLORS.textPrimary }]}>{s.value}</Text>
                      <Text style={[TYPOGRAPHY.caption, { textAlign: 'center', marginTop: 1 }]}>{s.label}</Text>
                    </View>
                    {i < arr.length - 1 && <View style={{ width: 1, backgroundColor: COLORS.border }} />}
                  </View>
                ))}
              </View>
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: SPACING.md, paddingBottom: 48 },
  summaryRow: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, ...SHADOWS.sm },
  summaryStat: { flex: 1, alignItems: 'center' },
  tripCard: { marginBottom: SPACING.sm },
  tripTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.xs },
  earningsBadge: { backgroundColor: COLORS.successLight, paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.full },
  earningsBadgeText: { ...TYPOGRAPHY.bodyBold, color: COLORS.success, fontSize: 15 },
  statsGrid: { flexDirection: 'row', backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: SPACING.sm },
  gridStat: { flex: 1, alignItems: 'center', paddingVertical: 4 },
});