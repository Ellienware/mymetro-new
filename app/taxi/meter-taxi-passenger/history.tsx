// app/meter/history.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router, useFocusEffect } from 'expo-router';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '@/lib/appwrite';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader, Card, LoadingScreen, EmptyState, StatusPill } from '@/components/ui';

const STATUS_ICONS: Record<string, string> = {
  completed: '✅',
  cancelled: '❌',
  pending: '⏳',
  started: '🚖',
};

export default function MeterHistoryScreen() {
  const { user } = useUser();
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const totalSpent = rides.filter(r => r.status === 'completed').reduce((s, r) => s + (r.fare || 0), 0);
  const totalRides = rides.filter(r => r.status === 'completed').length;

  const loadHistory = async () => {
    try {
      const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.METER_RIDES, [
        Query.equal('passengerId', user!.id),
        Query.orderDesc('createdAt'),
      ]);
      setRides(res.documents);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadHistory(); }, []));

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Ride History" onBack={() => router.back()} />

      <FlatList
        data={rides}
        keyExtractor={item => item.$id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() =>
          rides.length > 0 ? (
            <View style={styles.summaryRow}>
              <Card style={styles.summaryCard}>
                <Text style={styles.summaryIcon}>🚖</Text>
                <Text style={styles.summaryValue}>{totalRides}</Text>
                <Text style={styles.summaryLabel}>Rides taken</Text>
              </Card>
              <Card style={styles.summaryCard}>
                <Text style={styles.summaryIcon}>💰</Text>
                <Text style={styles.summaryValue}>R{totalSpent.toFixed(0)}</Text>
                <Text style={styles.summaryLabel}>Total spent</Text>
              </Card>
              <Card style={styles.summaryCard}>
                <Text style={styles.summaryIcon}>📊</Text>
                <Text style={styles.summaryValue}>R{totalRides > 0 ? (totalSpent / totalRides).toFixed(0) : '—'}</Text>
                <Text style={styles.summaryLabel}>Avg fare</Text>
              </Card>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="🚖"
            title="No rides yet"
            subtitle="Your meter taxi ride history will appear here."
            action="Request a Ride"
            onAction={() => router.push('/meter/request' as any)}
          />
        }
        renderItem={({ item }) => {
          const date = new Date(item.createdAt);
          const dateStr = date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
          const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const icon = STATUS_ICONS[item.status] ?? '🚖';

          return (
            <Card style={styles.rideCard}>
              <View style={styles.rideTop}>
                <View style={styles.rideIconWrap}>
                  <Text style={{ fontSize: 20 }}>{icon}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                  <Text style={styles.rideDate}>{dateStr} · {timeStr}</Text>
                </View>
                <StatusPill status={item.status} />
              </View>

              {/* Route */}
              {(item.pickupAddress || item.dropoffAddress) && (
                <View style={styles.routeSection}>
                  {item.pickupAddress && (
                    <View style={styles.routeRow}>
                      <View style={styles.pickupDot} />
                      <Text style={styles.routeText} numberOfLines={1}>{item.pickupAddress}</Text>
                    </View>
                  )}
                  {item.dropoffAddress && (
                    <View style={styles.routeRow}>
                      <View style={styles.dropoffDot} />
                      <Text style={styles.routeText} numberOfLines={1}>{item.dropoffAddress}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Fare */}
              <View style={styles.rideBottom}>
                <Text style={styles.rideDriver}>🧑‍✈️ {item.driverName ?? 'Driver'}</Text>
                {item.fare > 0 && (
                  <View style={styles.farePill}>
                    <Text style={styles.fareText}>R{item.fare}</Text>
                  </View>
                )}
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

  summaryRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  summaryCard: { flex: 1, alignItems: 'center', padding: SPACING.sm },
  summaryIcon: { fontSize: 20, marginBottom: 4 },
  summaryValue: { ...TYPOGRAPHY.h3, color: COLORS.primary, fontSize: 16 },
  summaryLabel: { ...TYPOGRAPHY.caption, textAlign: 'center', marginTop: 2 },

  rideCard: { marginBottom: SPACING.sm },
  rideTop: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  rideIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  rideDate: { ...TYPOGRAPHY.bodyBold, fontSize: 13 },

  routeSection: { marginBottom: SPACING.sm, gap: 6 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  pickupDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  dropoffDot: { width: 8, height: 8, borderRadius: 2, backgroundColor: COLORS.accent },
  routeText: { ...TYPOGRAPHY.body, fontSize: 13, flex: 1 },

  rideBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rideDriver: { ...TYPOGRAPHY.caption },
  farePill: { backgroundColor: COLORS.successLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.full },
  fareText: { ...TYPOGRAPHY.bodyBold, color: COLORS.success, fontSize: 14 },
});