// app/parent/school/tracking.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { client, DATABASE_ID, COLLECTIONS, databases } from '@/lib/appwrite';
import { Query } from 'appwrite';
import { ScreenHeader, LoadingScreen, StatusPill, LiveBadge } from '@/components/ui';

export default function ParentSchoolTrackingScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [trip, setTrip] = useState<any>(null);
  const [offering, setOffering] = useState<any>(null);
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [childStatus, setChildStatus] = useState({ pickedUp: false, droppedAtSchool: false, pickupTime: '', dropoffTime: '' });

  const parseChildStatus = (trip: any) => {
    if (!trip?.childrenStatus) return;
    const statuses = JSON.parse(trip.childrenStatus || '[]');
    const entry = statuses.find((c: any) => c.bookingId === bookingId);
    if (entry) {
      setChildStatus({
        pickedUp: !!entry.pickupTime,
        droppedAtSchool: !!entry.dropoffTime,
        pickupTime: entry.pickupTime ? new Date(entry.pickupTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        dropoffTime: entry.dropoffTime ? new Date(entry.dropoffTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const bookingDoc = await databases.getDocument(DATABASE_ID, COLLECTIONS.SCHOOL_BOOKINGS, bookingId);
        setBooking(bookingDoc);
        const offeringDoc = await databases.getDocument(DATABASE_ID, COLLECTIONS.DRIVER_SCHOOL_OFFERINGS, bookingDoc.offeringId);
        setOffering(offeringDoc);
        const today = new Date().toISOString().split('T')[0];
        const trips = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_TRIPS, [
          Query.equal('offeringId', bookingDoc.offeringId),
          Query.equal('date', today),
        ]);
        if (trips.documents.length > 0) {
          const tripDoc = trips.documents[0];
          setTrip(tripDoc);
          if (tripDoc.currentLocation) setLocation(JSON.parse(tripDoc.currentLocation));
          parseChildStatus(tripDoc);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Real-time subscription
  useEffect(() => {
    if (!trip) return;
    const unsub = client.subscribe(
      `databases.${DATABASE_ID}.collections.${COLLECTIONS.SCHOOL_TRIPS}.documents`,
      (response) => {
        const payload = response.payload as any;
        if (payload?.$id === trip.$id) {
          setTrip(payload);
          if (payload.currentLocation) setLocation(JSON.parse(payload.currentLocation));
          parseChildStatus(payload);
        }
      }
    );
    return () => unsub();
  }, [trip]);

  if (loading) return <LoadingScreen />;
  if (!offering || !booking) return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Track Trip" onBack={() => router.back()} />
      <View style={styles.center}><Text style={TYPOGRAPHY.body}>No trip data found for today.</Text></View>
    </SafeAreaView>
  );

  // FIX: childIds stores IDs — we show count or names if resolved
  const childCount = JSON.parse(booking.childIds || '[]').length;
  const tripStarted = trip?.status === 'started';

  // Journey steps for the timeline
  const steps = [
    { key: 'started', label: 'Trip started', icon: '🚀', done: tripStarted },
    { key: 'pickup', label: `Picked up${childStatus.pickupTime ? ' · ' + childStatus.pickupTime : ''}`, icon: '🚌', done: childStatus.pickedUp },
    { key: 'school', label: `Arrived at school${childStatus.dropoffTime ? ' · ' + childStatus.dropoffTime : ''}`, icon: '🏫', done: childStatus.droppedAtSchool },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Track Trip"
        onBack={() => router.back()}
        right={tripStarted ? <LiveBadge /> : undefined}
      />

      {/* Map */}
      {location ? (
        <MapView
          style={styles.map}
          region={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          }}
          showsUserLocation={false}
        >
          <Marker coordinate={location} title="Driver">
            <View style={styles.driverMarker}>
              <Text style={{ fontSize: 20 }}>🚐</Text>
            </View>
          </Marker>
          <Marker
            coordinate={{ latitude: offering.schoolLat, longitude: offering.schoolLng }}
            title={offering.schoolName}
          >
            <View style={styles.schoolMarker}>
              <Text style={{ fontSize: 18 }}>🏫</Text>
            </View>
          </Marker>
          {booking.homeLat && booking.homeLng && (
            <Marker
              coordinate={{ latitude: booking.homeLat, longitude: booking.homeLng }}
              title="Pickup point"
            >
              <View style={styles.homeMarker}>
                <Text style={{ fontSize: 16 }}>🏠</Text>
              </View>
            </Marker>
          )}
        </MapView>
      ) : (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderIcon}>🗺️</Text>
          <Text style={styles.mapPlaceholderText}>
            {tripStarted ? 'Waiting for driver location...' : 'Driver has not started the trip yet'}
          </Text>
        </View>
      )}

      {/* Info panel */}
      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        {/* School + children */}
        <View style={styles.panelHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.schoolName}>{offering.schoolName}</Text>
            <Text style={styles.childrenLine}>
              {childCount} child{childCount !== 1 ? 'ren' : ''} · {offering.operatingHoursMorning} pickup
            </Text>
          </View>
          <StatusPill status={trip?.status ?? 'not_started'} />
        </View>

        {/* Journey timeline */}
        <Text style={styles.timelineTitle}>Journey Progress</Text>
        <View style={styles.timeline}>
          {steps.map((step, idx) => (
            <View key={step.key} style={styles.timelineStep}>
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineCircle, step.done && styles.timelineCircleDone]}>
                  <Text style={styles.timelineIcon}>{step.done ? '✓' : step.icon}</Text>
                </View>
                {idx < steps.length - 1 && (
                  <View style={[styles.timelineLine, step.done && styles.timelineLineDone]} />
                )}
              </View>
              <Text style={[styles.timelineLabel, step.done && styles.timelineLabelDone]}>
                {step.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Pickup address */}
        <View style={styles.addressCard}>
          <Text style={styles.addressLabel}>Pickup address</Text>
          <Text style={styles.addressValue}>📍 {booking.pickupAddress}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  map: { height: 280 },
  mapPlaceholder: {
    height: 200, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
  },
  mapPlaceholderIcon: { fontSize: 40 },
  mapPlaceholderText: { ...TYPOGRAPHY.body, color: COLORS.primary, textAlign: 'center', paddingHorizontal: SPACING.lg },

  // Markers
  driverMarker: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 4, ...SHADOWS.sm },
  schoolMarker: { backgroundColor: '#EDE9FE', borderRadius: 20, padding: 4, ...SHADOWS.sm },
  homeMarker: { backgroundColor: COLORS.accentLight, borderRadius: 20, padding: 4, ...SHADOWS.sm },

  // Panel
  panel: { flex: 1, backgroundColor: COLORS.background },
  panelContent: { padding: SPACING.md, paddingBottom: 40 },
  panelHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.md },
  schoolName: { ...TYPOGRAPHY.h3 },
  childrenLine: { ...TYPOGRAPHY.caption, marginTop: 4 },

  // Timeline
  timelineTitle: { ...TYPOGRAPHY.label, marginBottom: SPACING.sm, textTransform: 'uppercase' },
  timeline: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.sm, marginBottom: SPACING.md },
  timelineStep: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.sm },
  timelineLeft: { alignItems: 'center', marginRight: SPACING.sm, width: 32 },
  timelineCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.border,
  },
  timelineCircleDone: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  timelineIcon: { fontSize: 14 },
  timelineLine: { width: 2, height: 24, backgroundColor: COLORS.border, marginTop: 2 },
  timelineLineDone: { backgroundColor: COLORS.primary },
  timelineLabel: { ...TYPOGRAPHY.body, paddingTop: 6, flex: 1, color: COLORS.textMuted },
  timelineLabelDone: { color: COLORS.textPrimary, fontWeight: '600' },

  // Address card
  addressCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, ...SHADOWS.sm },
  addressLabel: { ...TYPOGRAPHY.label, marginBottom: 4 },
  addressValue: { ...TYPOGRAPHY.body },
});