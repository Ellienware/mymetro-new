// app/meter/request.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, Alert, ScrollView,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { requestRide } from '@/services/meterApi';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader, Card, PrimaryButton } from '@/components/ui';

export default function MeterRequestScreen() {
  const { user } = useUser();
  const [pickup, setPickup] = useState<any>(null);
  const [dropoff, setDropoff] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);

  const canRequest = !!pickup && !!dropoff && !loading;

  const handleRequest = async () => {
    if (!pickup || !dropoff) {
      Alert.alert('Missing info', 'Please select both pickup and dropoff locations.');
      return;
    }
    setLoading(true);
    try {
      const result = await requestRide(user!.id, {
        lat: pickup.details.geometry.location.lat,
        lng: pickup.details.geometry.location.lng,
        address: pickup.description,
      }, {
        lat: dropoff.details.geometry.location.lat,
        lng: dropoff.details.geometry.location.lng,
        address: dropoff.description,
      });
      setEstimatedFare(result.estimatedFare);
      router.push({ pathname: '/meter/tracking', params: { requestId: result.requestId } });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not request ride');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Request a Taxi" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🚖</Text>
          <Text style={styles.heroTitle}>Where to?</Text>
          <Text style={styles.heroSub}>Enter your pickup and dropoff locations to find nearby drivers.</Text>
        </View>

        {/* Location inputs */}
        <Card style={styles.locationsCard}>
          {/* Pickup */}
          <View style={styles.locationRow}>
            <View style={styles.locationDotWrap}>
              <View style={styles.pickupDot} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.locationLabel}>PICKUP</Text>
              <GooglePlacesAutocomplete
                placeholder="Enter pickup location"
                onPress={(data, details = null) => setPickup({ description: data.description, details })}
                query={{ key: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY, components: 'country:za' }}
                fetchDetails
                styles={{
                  textInput: [styles.googleInput, pickup && styles.googleInputFilled],
                  container: { flex: 0 },
                  listView: { zIndex: 9999 },
                }}
              />
            </View>
          </View>

          {/* Connector */}
          <View style={styles.connector}>
            <View style={styles.connectorLine} />
          </View>

          {/* Dropoff */}
          <View style={styles.locationRow}>
            <View style={styles.locationDotWrap}>
              <View style={styles.dropoffDot} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.locationLabel}>DROPOFF</Text>
              <GooglePlacesAutocomplete
                placeholder="Enter destination"
                onPress={(data, details = null) => setDropoff({ description: data.description, details })}
                query={{ key: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY, components: 'country:za' }}
                fetchDetails
                styles={{
                  textInput: [styles.googleInput, dropoff && styles.googleInputFilled],
                  container: { flex: 0 },
                  listView: { zIndex: 9998 },
                }}
              />
            </View>
          </View>
        </Card>

        {/* Estimated fare preview */}
        {estimatedFare !== null && (
          <Card style={styles.fareCard}>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Estimated fare</Text>
              <Text style={styles.fareAmount}>R{estimatedFare}</Text>
            </View>
            <Text style={styles.fareNote}>Final fare may vary based on distance and traffic.</Text>
          </Card>
        )}

        {/* Route summary — shown once both are selected */}
        {pickup && dropoff && (
          <Card style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryIcon}>📍</Text>
              <Text style={styles.summaryText} numberOfLines={1}>{pickup.description}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryIcon}>🏁</Text>
              <Text style={styles.summaryText} numberOfLines={1}>{dropoff.description}</Text>
            </View>
          </Card>
        )}

        <PrimaryButton
          label="Request Ride"
          onPress={handleRequest}
          loading={loading}
          disabled={!canRequest}
          style={styles.requestBtn}
        />

        <Text style={styles.footerNote}>
          Your nearest available driver will be notified immediately.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 48 },

  hero: { alignItems: 'center', paddingVertical: SPACING.lg, marginBottom: SPACING.md },
  heroEmoji: { fontSize: 52, marginBottom: SPACING.sm },
  heroTitle: { ...TYPOGRAPHY.h1, textAlign: 'center', marginBottom: SPACING.xs },
  heroSub: { ...TYPOGRAPHY.body, textAlign: 'center', color: COLORS.textMuted, lineHeight: 22 },

  locationsCard: { marginBottom: SPACING.md, zIndex: 10 },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  locationDotWrap: { width: 20, alignItems: 'center', paddingTop: 14 },
  pickupDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary },
  dropoffDot: { width: 12, height: 12, borderRadius: 3, backgroundColor: COLORS.accent },
  connector: { paddingLeft: 9, paddingVertical: 2 },
  connectorLine: { width: 2, height: 16, backgroundColor: COLORS.border },
  locationLabel: { ...TYPOGRAPHY.label, fontSize: 11, marginBottom: 4, letterSpacing: 0.8 },
  googleInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, fontSize: 14, color: COLORS.textPrimary,
    backgroundColor: COLORS.background, height: 44,
  },
  googleInputFilled: { borderColor: COLORS.success },

  fareCard: { marginBottom: SPACING.md },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  fareLabel: { ...TYPOGRAPHY.bodyBold },
  fareAmount: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  fareNote: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },

  summaryCard: { marginBottom: SPACING.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 4 },
  summaryIcon: { fontSize: 15, width: 20 },
  summaryText: { ...TYPOGRAPHY.body, flex: 1, fontSize: 13 },

  requestBtn: {},
  footerNote: { ...TYPOGRAPHY.caption, textAlign: 'center', color: COLORS.textMuted, marginTop: SPACING.sm, lineHeight: 18 },
});