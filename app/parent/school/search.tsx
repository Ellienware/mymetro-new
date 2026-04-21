// app/parent/school/search.tsx
// FIXES:
// - debounceTimer moved to useRef (not let in component body)
// - Removed legacy SCHOOL_ROUTES reference entirely
// - Consistent design system
// app/parent/school/search.tsx
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
  ActivityIndicator, ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '@/lib/appwrite';
import { fetchSchoolAutocomplete, fetchPlaceDetails, PlacePrediction, fetchAddressAutocomplete } from '@/lib/google-places';
import { ScreenHeader, Card, LoadingScreen, EmptyState } from '@/components/ui';

const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

interface Offering {
  $id: string; schoolName: string; baseAddress: string;
  baseLat: number; baseLng: number; serviceRadiusKm: number;
  weeklyPrice?: number; monthlyPrice?: number;
  operatingHoursMorning: string; availableSeats: number;
  driverId: string; distance?: number;
}

// ─── Near Me Tab – direct Google Places API call ─────────────────────────────
function NearMeTab({ onSelect }: { onSelect: (offeringId: string) => void }) {
  const [homeAddress, setHomeAddress] = useState('');
  const [homeCoords, setHomeCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [loadingOfferings, setLoadingOfferings] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

  const onAddressChange = (text: string) => {
    setHomeAddress(text);
    setHomeCoords(null);
    if (text.length < 3) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        // Direct call to Google Places Autocomplete API
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&components=country:za&key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === 'OK' && data.predictions) {
          setPredictions(data.predictions);
          setShowPredictions(true);
        } else {
          setPredictions([]);
          setShowPredictions(false);
        }
      } catch (err) {
        console.error(err);
        setPredictions([]);
        setShowPredictions(false);
      }
    }, 300);
  };

  const onSelectAddress = async (prediction: any) => {
    setShowPredictions(false);
    try {
      // Fetch place details to get coordinates
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry,formatted_address&key=${API_KEY}`;
      const detailsRes = await fetch(detailsUrl);
      const detailsData = await detailsRes.json();
      if (detailsData.status === 'OK' && detailsData.result) {
        const lat = detailsData.result.geometry.location.lat;
        const lng = detailsData.result.geometry.location.lng;
        setHomeAddress(detailsData.result.formatted_address);
        const coords = { lat, lng };
        setHomeCoords(coords);
        await loadOfferings(coords);
      } else {
        Alert.alert('Error', 'Could not get address coordinates');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to fetch address details');
    }
  };

  const loadOfferings = async (coords: { lat: number; lng: number }) => {
    setLoadingOfferings(true);
    try {
      const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.DRIVER_SCHOOL_OFFERINGS, [
        Query.equal('status', 'active'),
      ]);
      const filtered = (res.documents as unknown as Offering[])
        .map(doc => ({ ...doc, distance: haversine(coords.lat, coords.lng, doc.baseLat, doc.baseLng) }))
        .filter(doc => doc.distance! <= doc.serviceRadiusKm)
        .sort((a, b) => a.distance! - b.distance!);
      setOfferings(filtered);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not load offerings');
    } finally {
      setLoadingOfferings(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.tabContent} keyboardShouldPersistTaps="handled">
      <Card style={styles.searchCard}>
        <Text style={styles.searchCardLabel}>Your home address</Text>
        <TextInput
          style={[styles.input, homeCoords && styles.inputVerified]}
          placeholder="Start typing your address..."
          placeholderTextColor={COLORS.textMuted}
          value={homeAddress}
          onChangeText={onAddressChange}
        />
        {showPredictions && (
          <View style={styles.predictions}>
            {predictions.map(p => (
              <TouchableOpacity key={p.place_id} style={styles.predictionItem} onPress={() => onSelectAddress(p)}>
                <Text style={styles.predictionText}>{p.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {homeCoords && <Text style={styles.verifiedHint}>✓ Showing drivers near you</Text>}
      </Card>

      {loadingOfferings && <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: SPACING.xl }} />}

      {!loadingOfferings && homeCoords && offerings.length === 0 && (
        <EmptyState icon="🔍" title="No drivers found" subtitle="No drivers serve your area yet. Try a nearby address." />
      )}

      {offerings.map(item => (
        <OfferingCard key={item.$id} offering={item} onPress={() => onSelect(item.$id)} />
      ))}
    </ScrollView>
  );
}

// ─── By School Tab (unchanged) ──────────────────────────────────────────────
function BySchoolTab({ onSelectDriver }: { onSelectDriver: (driverId: string, offeringId: string) => void }) {
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTextChange = (text: string) => {
    setSearchText(text);
    if (text.length < 2) { setPredictions([]); setShowPredictions(false); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const preds = await fetchSchoolAutocomplete(text);
      setPredictions(preds);
      setShowPredictions(preds.length > 0);
    }, 300);
  };

  const onSelectSchool = async (prediction: PlacePrediction) => {
    setShowPredictions(false);
    setSearchText(prediction.description);
    setLoading(true);
    try {
      const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.DRIVER_SCHOOL_OFFERINGS, [
        Query.equal('status', 'active'),
        Query.search('schoolName', prediction.description),
      ]);
      const driverIds = [...new Set(res.documents.map(o => o.driverId))];
      const driverDocs = await Promise.all(
        driverIds.map(id => databases.getDocument(DATABASE_ID, COLLECTIONS.SCHOOL_DRIVERS, id).catch(() => null))
      );
      const driverMap = new Map(driverDocs.filter(Boolean).map(d => [d!.$id, d]));

      const driverMap2 = new Map<string, any>();
      for (const offering of res.documents) {
        if (!driverMap2.has(offering.driverId) && driverMap.get(offering.driverId)) {
          driverMap2.set(offering.driverId, { driver: driverMap.get(offering.driverId), offering });
        }
      }
      setResults(Array.from(driverMap2.values()));
    } catch { } finally { setLoading(false); }
  };

  return (
    <ScrollView contentContainerStyle={styles.tabContent} keyboardShouldPersistTaps="handled">
      <Card style={styles.searchCard}>
        <Text style={styles.searchCardLabel}>Search by school name</Text>
        <TextInput
          style={styles.input}
          placeholder="Type school name..."
          placeholderTextColor={COLORS.textMuted}
          value={searchText}
          onChangeText={onTextChange}
        />
        {showPredictions && (
          <View style={styles.predictions}>
            {predictions.map(p => (
              <TouchableOpacity key={p.placeId} style={styles.predictionItem} onPress={() => onSelectSchool(p)}>
                <Text style={styles.predictionText}>{p.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Card>

      {loading && <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: SPACING.xl }} />}
      {!loading && searchText && results.length === 0 && (
        <EmptyState icon="🔍" title="No drivers found" subtitle="No drivers serve this school yet." />
      )}
      {results.map(item => (
        <Card
          key={item.driver.$id}
          style={styles.driverCard}
          onPress={() => onSelectDriver(item.driver.$id, item.offering.$id)}
        >
          <View style={styles.driverTop}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>{item.driver.fullName.charAt(0)}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: SPACING.sm }}>
              <Text style={styles.driverName}>{item.driver.fullName}</Text>
              <Text style={styles.driverRating}>⭐ {(item.driver.rating ?? 0).toFixed(1)} · {item.driver.totalRatings ?? 0} reviews</Text>
            </View>
          </View>
          <Text style={styles.offeringSchool}>🏫 {item.offering.schoolName}</Text>
          <View style={styles.driverMeta}>
            <Text style={styles.metaItem}>📍 {item.offering.serviceRadiusKm}km radius</Text>
            <Text style={styles.metaItem}>⏰ {item.offering.operatingHoursMorning}</Text>
          </View>
          <View style={styles.driverPrices}>
            {item.offering.weeklyPrice && <View style={styles.pricePill}><Text style={styles.pricePillText}>R{item.offering.weeklyPrice}/wk</Text></View>}
            {item.offering.monthlyPrice && <View style={[styles.pricePill, { backgroundColor: COLORS.accentLight }]}><Text style={[styles.pricePillText, { color: COLORS.accentDark }]}>R{item.offering.monthlyPrice}/mo</Text></View>}
          </View>
          <Text style={styles.profileCta}>View profile & check eligibility →</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

// ─── Offering Card ──────────────────────────────────────────────────────────
function OfferingCard({ offering, onPress }: { offering: Offering; onPress: () => void }) {
  return (
    <Card style={styles.offeringCard} onPress={onPress}>
      <View style={styles.offeringTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.offeringSchool}>🏫 {offering.schoolName}</Text>
          <Text style={styles.offeringDistance}>{offering.distance!.toFixed(1)} km from you</Text>
        </View>
        <View style={styles.seatsBox}>
          <Text style={styles.seatsNum}>{offering.availableSeats}</Text>
          <Text style={styles.seatsLabel}>seats</Text>
        </View>
      </View>
      <Text style={styles.offeringBase}>📍 {offering.baseAddress}</Text>
      <Text style={styles.offeringTime}>⏰ {offering.operatingHoursMorning}</Text>
      <View style={styles.prices}>
        {offering.weeklyPrice && <View style={styles.pricePill}><Text style={styles.pricePillText}>R{offering.weeklyPrice}/wk</Text></View>}
        {offering.monthlyPrice && <View style={[styles.pricePill, { backgroundColor: COLORS.accentLight }]}><Text style={[styles.pricePillText, { color: COLORS.accentDark }]}>R{offering.monthlyPrice}/mo</Text></View>}
      </View>
      <Text style={styles.bookCta}>Tap to book →</Text>
    </Card>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function ParentSchoolSearchScreen() {
  const [tab, setTab] = useState<'nearme' | 'byschool'>('nearme');

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Find Transport" onBack={() => router.back()} />
      <View style={styles.tabBar}>
        {(['nearme', 'byschool'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'nearme' ? '📍 Near Me' : '🏫 By School'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'nearme'
        ? <NearMeTab onSelect={id => router.push({ pathname: '/parent/school/booking', params: { offeringId: id } })} />
        : <BySchoolTab onSelectDriver={(dId, oId) => router.push({ pathname: '/parent/school/driver-profile', params: { driverId: dId, offeringId: oId } })} />
      }
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  tabBar: { flexDirection: 'row', backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: RADIUS.lg },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive: { color: '#fff' },

  tabContent: { padding: SPACING.md, paddingBottom: 40 },

  searchCard: { marginBottom: SPACING.md },
  searchCardLabel: { ...TYPOGRAPHY.label, marginBottom: SPACING.xs },
  input: {
    backgroundColor: '#F8FFFE', borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 15, color: COLORS.textPrimary,
  },
  inputVerified: { borderColor: COLORS.success },
  predictions: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, marginTop: SPACING.xs, ...SHADOWS.sm },
  predictionItem: { padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  predictionText: { ...TYPOGRAPHY.body },
  verifiedHint: { fontSize: 12, color: COLORS.success, fontWeight: '600', marginTop: 6 },

  offeringCard: { marginBottom: SPACING.sm },
  offeringTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.xs },
  offeringSchool: { ...TYPOGRAPHY.h4 },
  offeringDistance: { ...TYPOGRAPHY.caption, color: COLORS.primary, marginTop: 2 },
  offeringBase: { ...TYPOGRAPHY.body, fontSize: 13, marginBottom: 2 },
  offeringTime: { ...TYPOGRAPHY.body, fontSize: 13, marginBottom: SPACING.xs },
  seatsBox: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
  seatsNum: { fontSize: 20, fontWeight: '800', color: COLORS.primaryDark },
  seatsLabel: { fontSize: 10, color: COLORS.primaryDark },
  prices: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.xs },
  pricePill: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  pricePillText: { fontSize: 12, fontWeight: '700', color: COLORS.primaryDark },
  bookCta: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },

  driverCard: { marginBottom: SPACING.sm },
  driverTop: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  driverAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  driverAvatarText: { fontSize: 18, fontWeight: '700', color: COLORS.primaryDark },
  driverName: { ...TYPOGRAPHY.h4 },
  driverRating: { ...TYPOGRAPHY.caption, color: COLORS.accent, marginTop: 2 },
  driverMeta: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.xs },
  metaItem: { ...TYPOGRAPHY.body, fontSize: 13 },
  driverPrices: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.xs },
  profileCta: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
});