// app/meter/tracking.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import { databases, DATABASE_ID, COLLECTIONS, Query, client } from '@/lib/appwrite';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader, Card, LoadingScreen, StatusPill, LiveBadge } from '@/components/ui';

const STATUS_STEPS = [
  { key: 'pending',   label: 'Finding driver',      icon: '🔍' },
  { key: 'accepted',  label: 'Driver on the way',    icon: '🚖' },
  { key: 'started',   label: 'Trip in progress',     icon: '▶️' },
  { key: 'completed', label: 'Arrived at destination', icon: '✅' },
];

export default function MeterTrackingScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const [request, setRequest] = useState<any>(null);
  const [ride, setRide] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  // Subscribe to driver location once we have the ride
  useEffect(() => {
    if (!ride) return;
    const unsub = client.subscribe(
      `databases.${DATABASE_ID}.collections.METER_DRIVER_LOCATIONS.documents`,
      (response) => {
        const payload = response.payload as any;
        if (payload?.driverId === ride.driverId) {
          setDriverLocation({ latitude: payload.lat, longitude: payload.lng });
        }
      }
    );
    return () => unsub();
  }, [ride]);

  const loadData = async () => {
    try {
      const reqDoc = await databases.getDocument(DATABASE_ID, COLLECTIONS.METER_RIDE_REQUESTS, requestId);
      setRequest(reqDoc);
      if (reqDoc.status === 'accepted' || reqDoc.status === 'started') {
        const rides = await databases.listDocuments(DATABASE_ID, COLLECTIONS.METER_RIDES, [
          Query.equal('requestId', requestId),
        ]);
        if (rides.documents.length) setRide(rides.documents[0]);
      }
    } catch {
      Alert.alert('Error', 'Could not load ride details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingScreen />;
  if (!request) return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Track Ride" onBack={() => router.back()} />
      <View style={styles.center}><Text style={TYPOGRAPHY.body}>Request not found.</Text></View>
    </SafeAreaView>
  );

  const currentStepIdx = STATUS_STEPS.findIndex(s => s.key === request.status);
  const isLive = request.status === 'started' || request.status === 'accepted';

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Track Your Ride"
        onBack={() => router.back()}
        right={isLive ? <LiveBadge /> : undefined}
      />

      {/* Map */}
      <MapView
        style={styles.map}
        region={driverLocation ? {
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        } : {
          latitude: request.pickupLat ?? -26.2041,
          longitude: request.pickupLng ?? 28.0473,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation={false}
      >
        {driverLocation && (
          <Marker coordinate={driverLocation} title="Driver">
            <View style={styles.driverMarker}><Text style={{ fontSize: 20 }}>🚖</Text></View>
          </Marker>
        )}
        {request.pickupLat && (
          <Marker coordinate={{ latitude: request.pickupLat, longitude: request.pickupLng }} title="Pickup">
            <View style={styles.pickupMarker}><Text style={{ fontSize: 16 }}>📍</Text></View>
          </Marker>
        )}
        {request.dropoffLat && (
          <Marker coordinate={{ latitude: request.dropoffLat, longitude: request.dropoffLng }} title="Dropoff">
            <View style={styles.dropoffMarker}><Text style={{ fontSize: 16 }}>🏁</Text></View>
          </Marker>
        )}
      </MapView>

      {/* Info panel */}
      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>

        {/* Status timeline */}
        <Text style={styles.sectionLabel}>TRIP STATUS</Text>
        <Card style={styles.timelineCard}>
          {STATUS_STEPS.map((step, idx) => {
            const done = idx <= currentStepIdx;
            const active = idx === currentStepIdx;
            return (
              <View key={step.key} style={styles.timelineStep}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineCircle, done && styles.timelineCircleDone, active && styles.timelineCircleActive]}>
                    <Text style={styles.timelineStepIcon}>{done ? '✓' : step.icon}</Text>
                  </View>
                  {idx < STATUS_STEPS.length - 1 && (
                    <View style={[styles.timelineLine, done && styles.timelineLineDone]} />
                  )}
                </View>
                <Text style={[styles.timelineLabel, done && styles.timelineLabelDone, active && styles.timelineLabelActive]}>
                  {step.label}
                </Text>
              </View>
            );
          })}
        </Card>

        {/* Ride details */}
        <Text style={styles.sectionLabel}>TRIP DETAILS</Text>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {[
            { icon: '📍', label: 'Pickup', value: request.pickupAddress },
            { icon: '🏁', label: 'Dropoff', value: request.dropoffAddress },
            { icon: '💰', label: 'Estimated fare', value: `R${request.estimatedFare ?? '—'}` },
          ].map((row, idx, arr) => (
            <View key={row.label}>
              <View style={styles.detailRow}>
                <View style={styles.detailIconWrap}><Text style={{ fontSize: 16 }}>{row.icon}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={styles.detailValue} numberOfLines={2}>{row.value ?? '—'}</Text>
                </View>
              </View>
              {idx < arr.length - 1 && <View style={styles.detailDivider} />}
            </View>
          ))}
        </Card>

        {/* Cancel */}
        {(request.status === 'pending' || request.status === 'accepted') && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => Alert.alert('Cancel Ride', 'Cancellation feature coming soon.')}
          >
            <Text style={styles.cancelBtnText}>Cancel Ride</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  map: { height: 260 },

  panel: { flex: 1 },
  panelContent: { padding: SPACING.md, paddingBottom: 48 },
  sectionLabel: { ...TYPOGRAPHY.label, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.xs },

  // Markers
  driverMarker: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 4, ...SHADOWS.sm },
  pickupMarker: { backgroundColor: COLORS.primaryLight, borderRadius: 16, padding: 4, ...SHADOWS.sm },
  dropoffMarker: { backgroundColor: COLORS.accentLight, borderRadius: 16, padding: 4, ...SHADOWS.sm },

  // Timeline
  timelineCard: { marginBottom: SPACING.md },
  timelineStep: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.xs },
  timelineLeft: { alignItems: 'center', marginRight: SPACING.sm, width: 32 },
  timelineCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border },
  timelineCircleDone: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  timelineCircleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  timelineStepIcon: { fontSize: 13 },
  timelineLine: { width: 2, height: 20, backgroundColor: COLORS.border, marginTop: 2 },
  timelineLineDone: { backgroundColor: COLORS.primary },
  timelineLabel: { ...TYPOGRAPHY.body, paddingTop: 6, color: COLORS.textMuted },
  timelineLabelDone: { color: COLORS.textPrimary },
  timelineLabelActive: { fontWeight: '700', color: COLORS.primary },

  // Details
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', padding: SPACING.md, gap: SPACING.sm },
  detailIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  detailLabel: { ...TYPOGRAPHY.caption, marginBottom: 2 },
  detailValue: { ...TYPOGRAPHY.bodyBold, fontSize: 14 },
  detailDivider: { height: 1, backgroundColor: COLORS.border, marginLeft: SPACING.md + 32 + SPACING.sm },

  cancelBtn: { marginTop: SPACING.md, backgroundColor: COLORS.errorLight, borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: COLORS.error, fontWeight: '700', fontSize: 15 },
});