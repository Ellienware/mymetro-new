// app/parent/school/driver-profile.tsx
// FIXES:
// - offering.price / offering.pricePeriod → weeklyPrice / monthlyPrice
// - debounceTimer → useRef
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, ScrollView, FlatList,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { databases, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { fetchAddressAutocomplete, fetchPlaceDetails, PlacePrediction } from '@/lib/google-places';
import { ScreenHeader, Card, PrimaryButton, LoadingScreen, StatusPill } from '@/components/ui';

const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function DriverProfileScreen() {
  const { driverId, offeringId } = useLocalSearchParams<{ driverId: string; offeringId: string }>();
  const [driver, setDriver] = useState<any>(null);
  const [offering, setOffering] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [homeAddress, setHomeAddress] = useState('');
  const [homeCoords, setHomeCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [isEligible, setIsEligible] = useState<boolean | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  // FIX: useRef for debounce
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [driverDoc, offeringDoc] = await Promise.all([
          databases.getDocument(DATABASE_ID, COLLECTIONS.SCHOOL_DRIVERS, driverId),
          databases.getDocument(DATABASE_ID, COLLECTIONS.DRIVER_SCHOOL_OFFERINGS, offeringId),
        ]);
        setDriver(driverDoc);
        setOffering(offeringDoc);
      } catch {
        Alert.alert('Error', 'Could not load driver profile');
        router.back();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const onAddressChange = (text: string) => {
    setHomeAddress(text);
    setHomeCoords(null);
    setIsEligible(null);
    if (text.length < 3) { setPredictions([]); setShowPredictions(false); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const results = await fetchAddressAutocomplete(text);
      setPredictions(results);
      setShowPredictions(results.length > 0);
    }, 300);
  };

  const onSelectAddress = async (prediction: PlacePrediction) => {
    setShowPredictions(false);
    setGeocoding(true);
    const details = await fetchPlaceDetails(prediction.placeId);
    if (details) {
      setHomeAddress(details.address);
      setHomeCoords({ lat: details.lat, lng: details.lng });
      const dist = haversine(details.lat, details.lng, offering.baseLat, offering.baseLng);
      setDistance(dist);
      setIsEligible(dist <= offering.serviceRadiusKm);
    } else {
      Alert.alert('Error', 'Could not get address coordinates');
    }
    setGeocoding(false);
  };

  if (loading) return <LoadingScreen />;
  if (!driver || !offering) return null;

  const stars = Math.round(driver.rating ?? 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Driver Profile" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Driver hero card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroAvatarText}>{driver.fullName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.heroName}>{driver.fullName}</Text>
          <View style={styles.starsRow}>
            {[1,2,3,4,5].map(i => (
              <Text key={i} style={[styles.star, i <= stars && styles.starFilled]}>★</Text>
            ))}
            <Text style={styles.ratingText}>{(driver.rating ?? 0).toFixed(1)} · {driver.totalRatings ?? 0} reviews</Text>
          </View>
          <StatusPill status="active" label="Active Driver" />
        </Card>

        {/* Service details */}
        <Text style={styles.sectionLabel}>SERVICE DETAILS</Text>
        <Card style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>🏫</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>School</Text>
              <Text style={styles.detailValue}>{offering.schoolName}</Text>
            </View>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>📍</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>Base address</Text>
              <Text style={styles.detailValue}>{offering.baseAddress}</Text>
            </View>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>📏</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>Service radius</Text>
              <Text style={styles.detailValue}>{offering.serviceRadiusKm} km</Text>
            </View>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>⏰</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>Morning pickup</Text>
              <Text style={styles.detailValue}>{offering.operatingHoursMorning}</Text>
            </View>
          </View>
          {offering.operatingHoursAfternoon && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>🌇</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailLabel}>Afternoon pickup</Text>
                  <Text style={styles.detailValue}>{offering.operatingHoursAfternoon}</Text>
                </View>
              </View>
            </>
          )}
        </Card>

        {/* FIX: Pricing uses weeklyPrice/monthlyPrice */}
        <Text style={styles.sectionLabel}>PRICING</Text>
        <View style={styles.pricingRow}>
          {offering.weeklyPrice && (
            <View style={styles.priceCard}>
              <Text style={styles.priceCardPeriod}>Weekly</Text>
              <Text style={styles.priceCardAmount}>R{offering.weeklyPrice}</Text>
              <Text style={styles.priceCardSub}>per child</Text>
            </View>
          )}
          {offering.monthlyPrice && (
            <View style={[styles.priceCard, styles.priceCardAccent]}>
              <Text style={[styles.priceCardPeriod, { color: COLORS.accentDark }]}>Monthly</Text>
              <Text style={[styles.priceCardAmount, { color: COLORS.accentDark }]}>R{offering.monthlyPrice}</Text>
              <Text style={[styles.priceCardSub, { color: COLORS.accentDark }]}>per child</Text>
              {offering.weeklyPrice && (
                <View style={styles.saveBadge}>
                  <Text style={styles.saveBadgeText}>Best value</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {offering.note && (
          <Card style={styles.noteCard}>
            <Text style={styles.noteIcon}>💬</Text>
            <Text style={styles.noteText}>{offering.note}</Text>
          </Card>
        )}

        {/* Eligibility check */}
        <Text style={styles.sectionLabel}>CHECK YOUR ELIGIBILITY</Text>
        <Card style={styles.eligibilityCard}>
          <Text style={styles.eligibilityTitle}>Are you in the service area?</Text>
          <Text style={styles.eligibilitySub}>Enter your home address to check if this driver can pick up your child.</Text>

          <TextInput
            style={[
              styles.input,
              isEligible === true && styles.inputEligible,
              isEligible === false && styles.inputNotEligible,
            ]}
            placeholder="Start typing your address..."
            placeholderTextColor={COLORS.textMuted}
            value={homeAddress}
            onChangeText={onAddressChange}
          />
          {geocoding && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 4 }} />}
          {showPredictions && (
            <View style={styles.predictions}>
              {predictions.map(p => (
                <TouchableOpacity key={p.placeId} style={styles.predictionItem} onPress={() => onSelectAddress(p)}>
                  <Text style={styles.predictionText}>{p.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {isEligible === true && distance !== null && (
            <View style={styles.eligibleResult}>
              <Text style={styles.eligibleIcon}>✅</Text>
              <View>
                <Text style={styles.eligibleTitle}>You're eligible!</Text>
                <Text style={styles.eligibleSub}>{distance.toFixed(1)} km from driver's base · within {offering.serviceRadiusKm} km</Text>
              </View>
            </View>
          )}

          {isEligible === false && distance !== null && (
            <View style={styles.notEligibleResult}>
              <Text style={styles.eligibleIcon}>❌</Text>
              <View>
                <Text style={styles.notEligibleTitle}>Outside service area</Text>
                <Text style={styles.notEligibleSub}>{distance.toFixed(1)} km away · limit is {offering.serviceRadiusKm} km</Text>
              </View>
            </View>
          )}
        </Card>

        {isEligible === true && (
          <PrimaryButton
            label="Book This Driver"
            onPress={() => router.push({ pathname: '/parent/school/booking', params: { offeringId: offering.$id } })}
            style={styles.bookBtn}
          />
        )}

        {isEligible === false && (
          <PrimaryButton
            label="Back to Search"
            onPress={() => router.back()}
            variant="secondary"
            style={styles.bookBtn}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 48 },

  heroCard: { alignItems: 'center', padding: SPACING.lg, marginBottom: SPACING.md },
  heroAvatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  heroAvatarText: { fontSize: 32, fontWeight: '700', color: COLORS.primaryDark },
  heroName: { ...TYPOGRAPHY.h2, marginBottom: SPACING.xs },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: SPACING.sm },
  star: { fontSize: 18, color: COLORS.border },
  starFilled: { color: COLORS.accent },
  ratingText: { ...TYPOGRAPHY.caption, marginLeft: SPACING.xs },

  sectionLabel: { ...TYPOGRAPHY.label, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.xs, marginTop: SPACING.xs },

  detailsCard: { padding: 0, overflow: 'hidden', marginBottom: SPACING.md },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', padding: SPACING.md },
  detailDivider: { height: 1, backgroundColor: COLORS.border },
  detailIcon: { fontSize: 18, marginRight: SPACING.sm, width: 26, marginTop: 2 },
  detailLabel: { ...TYPOGRAPHY.caption, marginBottom: 2 },
  detailValue: { ...TYPOGRAPHY.bodyBold },

  pricingRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  priceCard: {
    flex: 1, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.lg,
    padding: SPACING.md, alignItems: 'center', ...SHADOWS.sm,
  },
  priceCardAccent: { backgroundColor: COLORS.accentLight },
  priceCardPeriod: { ...TYPOGRAPHY.label, color: COLORS.primaryDark, marginBottom: 4 },
  priceCardAmount: { fontSize: 28, fontWeight: '800', color: COLORS.primaryDark },
  priceCardSub: { ...TYPOGRAPHY.caption, color: COLORS.primaryDark, marginTop: 2 },
  saveBadge: { backgroundColor: COLORS.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full, marginTop: 6 },
  saveBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },

  noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: SPACING.md, backgroundColor: '#F0FFF4' },
  noteIcon: { fontSize: 18 },
  noteText: { ...TYPOGRAPHY.body, flex: 1, fontStyle: 'italic' },

  eligibilityCard: { marginBottom: SPACING.md },
  eligibilityTitle: { ...TYPOGRAPHY.h4, marginBottom: 4 },
  eligibilitySub: { ...TYPOGRAPHY.body, fontSize: 13, marginBottom: SPACING.sm, color: COLORS.textMuted },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 15, color: COLORS.textPrimary, marginBottom: 4,
  },
  inputEligible: { borderColor: COLORS.success },
  inputNotEligible: { borderColor: COLORS.error },
  predictions: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm, marginBottom: SPACING.sm },
  predictionItem: { padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  predictionText: { ...TYPOGRAPHY.body },

  eligibleResult: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.successLight, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm },
  eligibleIcon: { fontSize: 24 },
  eligibleTitle: { ...TYPOGRAPHY.bodyBold, color: COLORS.success },
  eligibleSub: { ...TYPOGRAPHY.caption, color: COLORS.success },
  notEligibleResult: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.errorLight, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm },
  notEligibleTitle: { ...TYPOGRAPHY.bodyBold, color: COLORS.error },
  notEligibleSub: { ...TYPOGRAPHY.caption, color: COLORS.error },

  bookBtn: { marginTop: SPACING.xs },
});