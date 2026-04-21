// app/driver/taxi/minibus/queue-status.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '@/lib/appwrite';
import { getQueueEntry, updateQueueEntry } from '@/services/saasBridge';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader, PrimaryButton, Card, LoadingScreen } from '@/components/ui';

export default function QueueStatusScreen() {
  const { rankId, routeId } = useLocalSearchParams<{ rankId: string; routeId: string }>();
  const { user } = useUser();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [queueEntry, setQueueEntry] = useState<any>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [passengerCount, setPassengerCount] = useState(0);
  const [departing, setDeparting] = useState(false);
  const intervalRef = useRef<any>(null);
  const countdownRef = useRef<any>(null);

  useEffect(() => {
    loadDriverAndEntry();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const loadDriverAndEntry = async () => {
    try {
      const drivers = await databases.listDocuments(DATABASE_ID, COLLECTIONS.TAXI_DRIVERS, [
        Query.equal('userId', user!.id),
      ]);
      if (!drivers.documents.length) throw new Error('Driver not found');
      const driver = drivers.documents[0];
      setDriverId(driver.$id);
      await fetchQueueEntry(driver.$id);
      // Poll every 3 seconds
      intervalRef.current = setInterval(() => fetchQueueEntry(driver.$id), 3000);
    } catch (err) {
      Alert.alert('Error', 'Could not load queue status');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const fetchQueueEntry = async (dId: string) => {
    try {
      const entry = await getQueueEntry(rankId, routeId, dId);
      setQueueEntry(entry);
      await updatePosition(entry);
      if (entry.status === 'called' && !countdownRef.current) {
        startCountdown(entry.loadingDeadline);
      } else if (entry.status !== 'called' && countdownRef.current) {
        clearInterval(countdownRef.current);
        setCountdown(null);
      }
    } catch (err) {
  // ignore "No active queue entry" after departed
  const error = err as any;
  if (error?.message !== 'No active queue entry') console.warn(error);
}
  };

  const updatePosition = async (entry: any) => {
    if (entry.status !== 'waiting') {
      setPosition(null);
      return;
    }
    try {
      // We could also have a bridge endpoint for position, but we can compute locally by fetching all waiting entries for the rank+route.
      // For simplicity, we'll use a direct query (rank_queues is in the same database? No, it's in SaaS. So we need a bridge endpoint.
      // Instead, we'll skip position for now or use a separate bridge call. For MVP, we can show "N/A".
      setPosition(null);
    } catch {
      setPosition(null);
    }
  };

  const startCountdown = (deadline: string) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      const rem = new Date(deadline).getTime() - Date.now();
      if (rem <= 0) {
        clearInterval(countdownRef.current);
        setCountdown('Expired');
        Alert.alert('Timeout', 'You did not accept in time and have been skipped.');
        router.back();
      } else {
        const secs = Math.floor(rem / 1000);
        setCountdown(`${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`);
      }
    }, 1000);
  };

  const acceptCall = async () => {
    if (!queueEntry) return;
    try {
      await updateQueueEntry(queueEntry.$id, { status: 'loading' });
    } catch (err) {
      Alert.alert('Error', 'Could not accept call');
    }
  };

  const depart = async () => {
    setDeparting(true);
    try {
      await updateQueueEntry(queueEntry.$id, { status: 'departed', loadedAt: new Date().toISOString() });
      router.push({
        pathname: '/driver/taxi/minibus/trip',
        params: { routeId, initialPassengerCount: passengerCount.toString() },
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to depart');
    } finally {
      setDeparting(false);
    }
  };

  if (loading) return <LoadingScreen />;

  const status = queueEntry?.status ?? 'waiting';
  const statusLabels: Record<string, string> = { waiting: 'In Queue', called: 'Called', loading: 'Loading', departed: 'Departed' };
  const statusColors: Record<string, string> = { waiting: COLORS.primary, called: COLORS.accent, loading: COLORS.success };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Queue Status" onBack={() => router.back()} />

      <View style={styles.content}>
        {/* Position hero */}
        <Card style={styles.positionCard}>
          <Text style={styles.positionLabel}>Your position</Text>
          <Text style={styles.positionNum}>{position ?? '—'}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusColors[status] + '20' }]}>
            <Text style={[styles.statusPillText, { color: statusColors[status] ?? COLORS.textMuted }]}>
              {statusLabels[status] ?? status}
            </Text>
          </View>
        </Card>

        {/* Called — accept countdown */}
        {status === 'called' && (
          <Card style={styles.calledCard}>
            <Text style={styles.calledTitle}>🔔 You've been called!</Text>
            <Text style={styles.calledSub}>Accept before the timer runs out.</Text>
            <Text style={styles.countdown}>{countdown}</Text>
            <PrimaryButton label="Accept Call" onPress={acceptCall} />
          </Card>
        )}

        {/* Loading — passenger counter + depart */}
        {status === 'loading' && (
          <Card style={styles.loadingCard}>
            <Text style={styles.loadingTitle}>Loading passengers</Text>
            <Text style={styles.loadingSub}>Set the number of passengers you're taking.</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity style={styles.cBtn} onPress={() => setPassengerCount(Math.max(0, passengerCount - 1))}>
                <Text style={styles.cBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.cNum}>{passengerCount}</Text>
              <TouchableOpacity style={[styles.cBtn, { backgroundColor: COLORS.primary }]} onPress={() => setPassengerCount(passengerCount + 1)}>
                <Text style={[styles.cBtnText, { color: '#fff' }]}>+</Text>
              </TouchableOpacity>
            </View>
            <PrimaryButton label="Depart →" onPress={depart} loading={departing} />
          </Card>
        )}

        {/* Waiting — queue tip */}
        {status === 'waiting' && (
          <Card style={styles.tipCard}>
            <Text style={styles.tipIcon}>💡</Text>
            <Text style={styles.tipText}>
              Stay in the queue area. You'll be called when it's your turn to load passengers.
              This screen updates automatically.
            </Text>
          </Card>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, gap: SPACING.md },

  positionCard: { alignItems: 'center', padding: SPACING.xl },
  positionLabel: { ...TYPOGRAPHY.label, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.sm },
  positionNum: { fontSize: 72, fontWeight: '800', color: COLORS.primary, lineHeight: 80, marginBottom: SPACING.sm },
  statusPill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: RADIUS.full },
  statusPillText: { fontWeight: '700', fontSize: 14 },

  calledCard: { alignItems: 'center' },
  calledTitle: { ...TYPOGRAPHY.h3, marginBottom: 4 },
  calledSub: { ...TYPOGRAPHY.body, color: COLORS.textMuted, marginBottom: SPACING.md },
  countdown: { fontSize: 48, fontWeight: '800', color: COLORS.error, marginBottom: SPACING.md },

  loadingCard: {},
  loadingTitle: { ...TYPOGRAPHY.h3, marginBottom: 4 },
  loadingSub: { ...TYPOGRAPHY.body, color: COLORS.textMuted, marginBottom: SPACING.md },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.lg, marginBottom: SPACING.md },
  cBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  cBtnText: { fontSize: 28, fontWeight: '700', color: COLORS.textPrimary, lineHeight: 32 },
  cNum: { fontSize: 48, fontWeight: '800', color: COLORS.primary, lineHeight: 52, minWidth: 60, textAlign: 'center' },

  tipCard: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, backgroundColor: COLORS.primaryLight },
  tipIcon: { fontSize: 20 },
  tipText: { ...TYPOGRAPHY.body, fontSize: 13, flex: 1, lineHeight: 22, color: COLORS.primaryDark },
});