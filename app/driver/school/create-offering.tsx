// app/driver/school/create-offering.tsx
// FIXES:
// - Replaced base address with GooglePlacesAutocomplete
// - Fixed TypeScript errors on lat/lng
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TextInput,
  TouchableOpacity, Alert, ScrollView, FlatList, ActivityIndicator,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { databases, DATABASE_ID, COLLECTIONS, Query, ID } from '@/lib/appwrite';
import { fetchSchoolAutocomplete, fetchPlaceDetails, PlacePrediction } from '@/lib/google-places';
import { ScreenHeader, PrimaryButton, Card, LoadingScreen } from '@/components/ui';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

export default function CreateSchoolOfferingScreen() {
  const { user } = useUser();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [loadingVehicles, setLoadingVehicles] = useState(true);

  const [schoolName, setSchoolName] = useState('');
  const [schoolPlaceId, setSchoolPlaceId] = useState('');
  const [schoolCoords, setSchoolCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [baseAddress, setBaseAddress] = useState('');
  const [baseCoords, setBaseCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [serviceRadius, setServiceRadius] = useState('5');
  const [weeklyPrice, setWeeklyPrice] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [morningStart, setMorningStart] = useState('06:30');
  const [morningEnd, setMorningEnd] = useState('07:00');
  const [afternoonStart, setAfternoonStart] = useState('');
  const [afternoonEnd, setAfternoonEnd] = useState('');
  const [note, setNote] = useState('');

  const [schoolPredictions, setSchoolPredictions] = useState<PlacePrediction[]>([]);
  const [showSchoolPredictions, setShowSchoolPredictions] = useState(false);
  const schoolDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadVehicles(); }, []);

  const loadVehicles = async () => {
    try {
      const drivers = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_DRIVERS, [Query.equal('userId', user!.id)]);
      if (drivers.documents.length === 0) {
        Alert.alert('Not registered', 'Please apply as a school driver first.');
        router.push('/driver/school/apply');
        return;
      }
      const driverId = drivers.documents[0].$id;
      const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.DRIVER_VEHICLES, [
        Query.equal('assignedDriverId', driverId),
        Query.equal('verificationStatus', 'approved'),
      ]);
      setVehicles(res.documents);
      if (res.documents.length > 0) setSelectedVehicle(res.documents[0]);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not load vehicles');
    } finally {
      setLoadingVehicles(false);
    }
  };

  const onSchoolTextChange = (text: string) => {
    setSchoolName(text);
    setSchoolCoords(null);
    if (text.length < 2) { setSchoolPredictions([]); setShowSchoolPredictions(false); return; }
    if (schoolDebounce.current) clearTimeout(schoolDebounce.current);
    schoolDebounce.current = setTimeout(async () => {
      const results = await fetchSchoolAutocomplete(text);
      setSchoolPredictions(results);
      setShowSchoolPredictions(results.length > 0);
    }, 300);
  };

  const onSelectSchool = async (prediction: PlacePrediction) => {
    setShowSchoolPredictions(false);
    const details = await fetchPlaceDetails(prediction.placeId);
    if (details) {
      setSchoolName(details.name || prediction.description);
      setSchoolPlaceId(prediction.placeId);
      setSchoolCoords({ lat: details.lat, lng: details.lng });
    } else {
      Alert.alert('Error', 'Could not fetch school location');
    }
  };

  const handleSubmit = async () => {
    if (!selectedVehicle) { Alert.alert('Select a vehicle'); return; }
    if (!schoolCoords) { Alert.alert('Invalid school', 'Please select a school from the suggestions.'); return; }
    if (!baseCoords) { Alert.alert('Invalid address', 'Please select your base address from the suggestions.'); return; }
    const radius = parseFloat(serviceRadius);
    if (isNaN(radius) || radius <= 0) { Alert.alert('Invalid radius', 'Enter a valid service radius.'); return; }
    const weekly = weeklyPrice ? parseFloat(weeklyPrice) : null;
    const monthly = monthlyPrice ? parseFloat(monthlyPrice) : null;
    if (!weekly && !monthly) { Alert.alert('Missing price', 'Provide at least one price (weekly or monthly).'); return; }
    if (weekly && weekly <= 0) { Alert.alert('Invalid weekly price'); return; }
    if (monthly && monthly <= 0) { Alert.alert('Invalid monthly price'); return; }
    if (!morningStart || !morningEnd) { Alert.alert('Missing hours', 'Please set morning pickup hours.'); return; }

    setSubmitting(true);
    try {
      const drivers = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_DRIVERS, [Query.equal('userId', user!.id)]);
      const driverId = drivers.documents[0].$id;
      await databases.createDocument(DATABASE_ID, COLLECTIONS.DRIVER_SCHOOL_OFFERINGS, ID.unique(), {
        vehicleId: selectedVehicle.$id,
        driverId,
        schoolName,
        schoolLat: schoolCoords.lat,
        schoolLng: schoolCoords.lng,
        schoolPlaceId,
        baseAddress,
        baseLat: baseCoords.lat,
        baseLng: baseCoords.lng,
        serviceRadiusKm: radius,
        weeklyPrice: weekly,
        monthlyPrice: monthly,
        operatingHoursMorning: `${morningStart}-${morningEnd}`,
        operatingHoursAfternoon: afternoonStart && afternoonEnd ? `${afternoonStart}-${afternoonEnd}` : null,
        note: note.trim() || null,
        capacity: selectedVehicle.capacity,
        availableSeats: selectedVehicle.capacity,
        status: 'active',
        createdAt: new Date().toISOString(),
      });
      Alert.alert('Route created! 🎉', 'Parents in your service area can now discover and book your route.');
      router.back();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to create route. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingVehicles) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Create Route" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Vehicle selection */}
        <Text style={styles.sectionLabel}>SELECT VEHICLE</Text>
        {vehicles.length === 0 ? (
          <Card style={styles.noVehicleCard}>
            <Text style={styles.noVehicleText}>No approved vehicles found.</Text>
            <TouchableOpacity onPress={() => router.push('/driver/school/register')}>
              <Text style={styles.noVehicleAction}>+ Register a vehicle</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vehicleScroll}>
            {vehicles.map(v => (
              <TouchableOpacity
                key={v.$id}
                style={[styles.vehicleChip, selectedVehicle?.$id === v.$id && styles.vehicleChipSelected]}
                onPress={() => setSelectedVehicle(v)}
              >
                <Text style={styles.vehicleChipIcon}>🚐</Text>
                <Text style={[styles.vehicleChipPlate, selectedVehicle?.$id === v.$id && styles.vehicleChipTextSelected]}>
                  {v.plateNumber}
                </Text>
                <Text style={[styles.vehicleChipInfo, selectedVehicle?.$id === v.$id && styles.vehicleChipTextSelected]}>
                  {v.make} {v.model} · {v.capacity} seats
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* School */}
        <Text style={styles.sectionLabel}>SCHOOL</Text>
        <Card style={styles.inputCard}>
          <Text style={styles.fieldLabel}>School Name <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, schoolCoords && styles.inputVerified]}
            placeholder="Start typing school name..."
            placeholderTextColor={COLORS.textMuted}
            value={schoolName}
            onChangeText={onSchoolTextChange}
          />
          {schoolCoords && <Text style={styles.verifiedHint}>✓ School location confirmed</Text>}
          {showSchoolPredictions && (
            <View style={styles.predictions}>
              {schoolPredictions.map(p => (
                <TouchableOpacity key={p.placeId} style={styles.predictionItem} onPress={() => onSelectSchool(p)}>
                  <Text style={styles.predictionText}>🏫 {p.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>

        {/* Base address with Google Places */}
        <Text style={styles.sectionLabel}>YOUR BASE ADDRESS</Text>
        <Card style={styles.inputCard}>
          <Text style={styles.fieldLabel}>Where do you start from? <Text style={styles.required}>*</Text></Text>
          <GooglePlacesAutocomplete
            placeholder="Home or garage address..."
            onPress={(data, details = null) => {
              if (details?.geometry?.location) {
                setBaseAddress(data.description);
                setBaseCoords({
                  lat: details.geometry.location.lat,
                  lng: details.geometry.location.lng,
                });
              } else {
                Alert.alert('Error', 'Could not get address coordinates');
              }
            }}
            query={{
              key: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
              components: 'country:za',
            }}
            fetchDetails
            styles={{
              textInput: [styles.input, baseCoords && styles.inputVerified],
              container: { flex: 0, marginBottom: SPACING.xs },
              listView: { zIndex: 9999, backgroundColor: COLORS.surface, borderRadius: RADIUS.md },
            }}
          />
          {baseCoords && <Text style={styles.verifiedHint}>✓ Address confirmed</Text>}

          <Text style={styles.fieldLabel}>Service Radius (km) <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, { marginBottom: 0 }]}
            placeholder="e.g. 5"
            placeholderTextColor={COLORS.textMuted}
            value={serviceRadius}
            onChangeText={setServiceRadius}
            keyboardType="numeric"
          />
          <Text style={styles.fieldHint}>Parents within this radius can book your route</Text>
        </Card>

        {/* Pricing */}
        <Text style={styles.sectionLabel}>PRICING <Text style={styles.sectionNote}>(at least one required)</Text></Text>
        <Card style={styles.inputCard}>
          <View style={styles.priceRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Weekly price (R)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 250"
                placeholderTextColor={COLORS.textMuted}
                value={weeklyPrice}
                onChangeText={setWeeklyPrice}
                keyboardType="numeric"
              />
            </View>
            <View style={{ width: SPACING.sm }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Monthly price (R)</Text>
              <TextInput
                style={[styles.input, { marginBottom: 0 }]}
                placeholder="e.g. 900"
                placeholderTextColor={COLORS.textMuted}
                value={monthlyPrice}
                onChangeText={setMonthlyPrice}
                keyboardType="numeric"
              />
            </View>
          </View>
          {weeklyPrice && monthlyPrice && (
            <View style={styles.savingTip}>
              <Text style={styles.savingTipText}>
                💡 Monthly saves parents {Math.round((1 - parseFloat(monthlyPrice) / (parseFloat(weeklyPrice) * 4)) * 100)}% vs paying weekly
              </Text>
            </View>
          )}
        </Card>

        {/* Operating hours */}
        <Text style={styles.sectionLabel}>OPERATING HOURS</Text>
        <Card style={styles.inputCard}>
          <Text style={styles.fieldLabel}>Morning Pickup <Text style={styles.required}>*</Text></Text>
          <View style={styles.hoursRow}>
            <View style={{ flex: 1 }}>
              <TextInput style={styles.input} placeholder="Start" placeholderTextColor={COLORS.textMuted} value={morningStart} onChangeText={setMorningStart} />
            </View>
            <Text style={styles.hoursSep}>→</Text>
            <View style={{ flex: 1 }}>
              <TextInput style={styles.input} placeholder="End" placeholderTextColor={COLORS.textMuted} value={morningEnd} onChangeText={setMorningEnd} />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Afternoon Pickup <Text style={styles.optional}>(optional)</Text></Text>
          <View style={styles.hoursRow}>
            <View style={{ flex: 1 }}>
              <TextInput style={styles.input} placeholder="Start" placeholderTextColor={COLORS.textMuted} value={afternoonStart} onChangeText={setAfternoonStart} />
            </View>
            <Text style={styles.hoursSep}>→</Text>
            <View style={{ flex: 1 }}>
              <TextInput style={[styles.input, { marginBottom: 0 }]} placeholder="End" placeholderTextColor={COLORS.textMuted} value={afternoonEnd} onChangeText={setAfternoonEnd} />
            </View>
          </View>
        </Card>

        {/* Note */}
        <Text style={styles.sectionLabel}>NOTE TO PARENTS <Text style={styles.sectionNote}>(optional)</Text></Text>
        <TextInput
          style={[styles.input, styles.noteInput]}
          placeholder="e.g. I may pick up outside my radius for a small fee. Message me!"
          placeholderTextColor={COLORS.textMuted}
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={3}
        />

        <PrimaryButton label="Create Route" onPress={handleSubmit} loading={submitting} style={styles.submitBtn} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ... keep all existing styles exactly as before
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 48 },

  sectionLabel: { ...TYPOGRAPHY.label, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.xs, marginTop: SPACING.xs },
  sectionNote: { fontWeight: '400', textTransform: 'none', letterSpacing: 0, color: COLORS.textMuted },

  vehicleScroll: { marginBottom: SPACING.md },
  vehicleChip: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginRight: SPACING.sm, backgroundColor: COLORS.surface,
    alignItems: 'center', minWidth: 120, ...SHADOWS.sm,
  },
  vehicleChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  vehicleChipIcon: { fontSize: 28, marginBottom: 4 },
  vehicleChipPlate: { ...TYPOGRAPHY.bodyBold, fontSize: 14 },
  vehicleChipInfo: { ...TYPOGRAPHY.caption, textAlign: 'center', marginTop: 2 },
  vehicleChipTextSelected: { color: COLORS.primaryDark },

  noVehicleCard: { alignItems: 'center', padding: SPACING.lg, marginBottom: SPACING.md },
  noVehicleText: { ...TYPOGRAPHY.body, marginBottom: SPACING.sm },
  noVehicleAction: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },

  inputCard: { marginBottom: SPACING.md },
  fieldLabel: { ...TYPOGRAPHY.label, marginBottom: 6, marginTop: SPACING.xs },
  fieldHint: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 4 },
  required: { color: COLORS.error },
  optional: { fontWeight: '400', color: COLORS.textMuted },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 15, color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  inputVerified: { borderColor: COLORS.success },
  verifiedHint: { fontSize: 12, color: COLORS.success, fontWeight: '600', marginBottom: SPACING.xs },
  predictions: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm },
  predictionItem: { padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  predictionText: { ...TYPOGRAPHY.body },

  priceRow: { flexDirection: 'row' },
  savingTip: { backgroundColor: COLORS.successLight, borderRadius: RADIUS.md, padding: SPACING.sm, marginTop: SPACING.xs },
  savingTipText: { ...TYPOGRAPHY.caption, color: COLORS.success, fontWeight: '600' },

  hoursRow: { flexDirection: 'row', alignItems: 'center' },
  hoursSep: { fontSize: 16, color: COLORS.textMuted, marginHorizontal: SPACING.xs, paddingBottom: SPACING.xs },

  noteInput: {
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 15, color: COLORS.textPrimary,
    height: 90, textAlignVertical: 'top', marginBottom: SPACING.md,
  },

  submitBtn: {},
});