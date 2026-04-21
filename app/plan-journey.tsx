// app/plan-journey.tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router'; // ← added useLocalSearchParams
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader, Card, PrimaryButton } from '@/components/ui';

const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

const MODES = [
  { key: 'Rail', icon: '🚆' },
  { key: 'Bus',  icon: '🚌' },
  { key: 'Taxi', icon: '🚖' },
  { key: 'Walk', icon: '🚶' }, 
];

interface PlaceResult {
  name: string;
  lat: number;
  lng: number;
}

// ─── Extracted stable components ──────────────────────────────────────────────

interface LocationCardProps {
  fromPlace: PlaceResult | null;
  toPlace:   PlaceResult | null;
  onFromSelect: (place: PlaceResult) => void;
  onToSelect:   (place: PlaceResult) => void;
}

function LocationCard({ fromPlace, toPlace, onFromSelect, onToSelect }: LocationCardProps) {
  return (
    <Card style={{ ...styles.locCard, zIndex: 20 }}>
      {/* FROM */}
      <View style={[styles.locRow, { zIndex: 11 }]}>
        <View style={styles.dotWrap}>
          <View style={styles.originDot} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.locLabel}>FROM</Text>
          <GooglePlacesAutocomplete
            placeholder="Starting point"
            fetchDetails
            onPress={(data, details) => {
              if (!details?.geometry?.location) {
                Alert.alert('Error', 'Could not get location. Please try again.');
                return;
              }
              onFromSelect({
                name: data.description,
                lat:  details.geometry.location.lat,
                lng:  details.geometry.location.lng,
              });
            }}
            query={{
              key:        GOOGLE_PLACES_KEY,
              language:   'en',
              components: 'country:za',
            }}
            keyboardShouldPersistTaps="always"
            enablePoweredByContainer={false}
            styles={{
              textInput:   [styles.gInput, fromPlace && styles.gInputDone],
              container:   { flex: 0, zIndex: 11 },
              listView: {
                position:        'absolute',
                top:             46,
                left:            0,
                right:           0,
                zIndex:          1100,
                backgroundColor: COLORS.surface,
                borderRadius:    RADIUS.md,
                ...SHADOWS.md,
              },
            }}
          />
          {fromPlace && (
            <View style={styles.selectedChip}>
              <Text style={styles.selectedChipText} numberOfLines={1}>
                📍 {fromPlace.name}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Connector line */}
      <View style={styles.connRow}>
        <View style={{ width: 20, alignItems: 'center' }}>
          <View style={styles.connLine} />
        </View>
      </View>

      {/* TO */}
      <View style={[styles.locRow, { zIndex: 10 }]}>
        <View style={styles.dotWrap}>
          <View style={styles.destDot} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.locLabel}>TO</Text>
          <GooglePlacesAutocomplete
            placeholder="Destination"
            fetchDetails
            onPress={(data, details) => {
              if (!details?.geometry?.location) {
                Alert.alert('Error', 'Could not get location. Please try again.');
                return;
              }
              onToSelect({
                name: data.description,
                lat:  details.geometry.location.lat,
                lng:  details.geometry.location.lng,
              });
            }}
            query={{
              key:        GOOGLE_PLACES_KEY,
              language:   'en',
              components: 'country:za',
            }}
            keyboardShouldPersistTaps="always"
            enablePoweredByContainer={false}
            styles={{
              textInput: [styles.gInput, toPlace && styles.gInputDone],
              container: { flex: 0, zIndex: 10 },
              listView: {
                position:        'absolute',
                top:             46,
                left:            0,
                right:           0,
                zIndex:          1000,
                backgroundColor: COLORS.surface,
                borderRadius:    RADIUS.md,
                ...SHADOWS.md,
              },
            }}
          />
          {toPlace && (
            <View style={styles.selectedChip}>
              <Text style={styles.selectedChipText} numberOfLines={1}>
                📍 {toPlace.name}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Card>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PlanJourneyScreen() {
  const params = useLocalSearchParams(); // ← get URL parameters

  const [fromPlace, setFromPlace] = useState<PlaceResult | null>(null);
  const [toPlace,   setToPlace]   = useState<PlaceResult | null>(null);

  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [adults,   setAdults]   = useState(1);
  const [children, setChildren] = useState(0);
  const [showPassengerModal, setShowPassengerModal] = useState(false);

  const [tripType,       setTripType]       = useState<'fastest' | 'cheapest'>('fastest');
  const [selectedModes, setSelectedModes] = useState(['Rail', 'Bus', 'Taxi', 'Walk']);

  // ─── Pre‑fill from Discover screen ──────────────────────────────────────────
  useEffect(() => {
    // Pre‑fill destination if provided
    if (params.destName && params.destLat && params.destLng) {
      setToPlace({
        name: params.destName as string,
        lat: parseFloat(params.destLat as string),
        lng: parseFloat(params.destLng as string),
      });
    }
    // Pre‑fill origin if provided
    if (params.fromName && params.fromLat && params.fromLng) {
      setFromPlace({
        name: params.fromName as string,
        lat: parseFloat(params.fromLat as string),
        lng: parseFloat(params.fromLng as string),
      });
    }
  }, [params.destName, params.destLat, params.destLng, params.fromName, params.fromLat, params.fromLng]);

  const toggleMode = useCallback((mode: string) => {
    setSelectedModes(prev =>
      prev.includes(mode)
        ? prev.length > 1 ? prev.filter(m => m !== mode) : prev
        : [...prev, mode],
    );
  }, []);

  const handleFindRoutes = useCallback(() => {
    if (!fromPlace || !toPlace) {
      Alert.alert('Missing Info', 'Please select both From and To locations.');
      return;
    }
    router.push({
      pathname: '/journey-results',
      params: {
        fromName: fromPlace.name, fromLat: fromPlace.lat, fromLng: fromPlace.lng,
        toName:   toPlace.name,   toLat:   toPlace.lat,   toLng:   toPlace.lng,
        date:     date.toISOString(),
        time:     time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        adults:   adults.toString(),
        children: children.toString(),
        tripType,
        modes:    selectedModes.join(','),
      },
    });
  }, [fromPlace, toPlace, date, time, adults, children, tripType, selectedModes]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const listHeader = (
    <View style={styles.content}>
      <LocationCard
        fromPlace={fromPlace}
        toPlace={toPlace}
        onFromSelect={setFromPlace}
        onToSelect={setToPlace}
      />

      {/* Trip details */}
      <Card style={styles.detailsCard}>
        {[
          {
            icon: '📅', label: 'Date',
            value: date.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' }),
            onPress: () => setShowDatePicker(true),
          },
          {
            icon: '🕐', label: 'Time',
            value: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            onPress: () => setShowTimePicker(true),
          },
          {
            icon: '👥', label: 'Passengers',
            value: `${adults} adult${adults !== 1 ? 's' : ''}${children > 0 ? `, ${children} child${children !== 1 ? 'ren' : ''}` : ''}`,
            onPress: () => setShowPassengerModal(true),
          },
        ].map((row, idx, arr) => (
          <View key={row.label}>
            <TouchableOpacity style={styles.detailRow} onPress={row.onPress}>
              <View style={styles.detailLeft}>
                <View style={styles.detailIcon}>
                  <Text style={{ fontSize: 16 }}>{row.icon}</Text>
                </View>
                <Text style={styles.detailLabel}>{row.label}</Text>
              </View>
              <Text style={styles.detailValue}>{row.value}</Text>
            </TouchableOpacity>
            {idx < arr.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </Card>

      {/* Journey preference */}
      <Text style={styles.sectionLabel}>JOURNEY PREFERENCE</Text>
      <View style={styles.tripRow}>
        {(['fastest', 'cheapest'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tripBtn, tripType === t && styles.tripBtnActive]}
            onPress={() => setTripType(t)}
          >
            <Text style={{ fontSize: 16 }}>{t === 'fastest' ? '⚡' : '💰'}</Text>
            <Text style={[styles.tripBtnText, tripType === t && styles.tripBtnTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transport modes */}
      <Text style={styles.sectionLabel}>TRANSPORT MODES</Text>
      <View style={styles.modesRow}>
        {MODES.map(m => (
          <TouchableOpacity
            key={m.key}
            style={[styles.modeChip, selectedModes.includes(m.key) && styles.modeChipActive]}
            onPress={() => toggleMode(m.key)}
          >
            <Text style={{ fontSize: 18 }}>{m.icon}</Text>
            <Text style={[styles.modeText, selectedModes.includes(m.key) && styles.modeTextActive]}>
              {m.key}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <PrimaryButton
        label="Find Routes"
        onPress={handleFindRoutes}
        disabled={!fromPlace || !toPlace}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Plan Journey" onBack={() => router.back()} />

      <FlatList
        data={[]}
        renderItem={() => null}
        keyExtractor={() => 'header'}
        ListHeaderComponent={listHeader}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      />

      {/* Date picker */}
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          minimumDate={new Date()}
          onChange={(_, d) => { setShowDatePicker(false); if (d) setDate(d); }}
        />
      )}

      {/* Time picker */}
      {showTimePicker && (
        <DateTimePicker
          value={time}
          mode="time"
          onChange={(_, t) => { setShowTimePicker(false); if (t) setTime(t); }}
        />
      )}

      {/* Passenger modal */}
      <Modal visible={showPassengerModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Passengers</Text>
            {[
              { label: 'Adults',   sub: '18+ years', v: adults,   min: 1, set: setAdults },
              { label: 'Children', sub: 'Under 18',  v: children, min: 0, set: setChildren },
            ].map(p => (
              <View key={p.label} style={styles.pRow}>
                <View>
                  <Text style={styles.pLabel}>{p.label}</Text>
                  <Text style={styles.pSub}>{p.sub}</Text>
                </View>
                <View style={styles.pCounter}>
                  <TouchableOpacity
                    style={styles.pBtn}
                    onPress={() => p.set(Math.max(p.min, p.v - 1))}
                  >
                    <Text style={styles.pBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.pCount}>{p.v}</Text>
                  <TouchableOpacity
                    style={[styles.pBtn, { backgroundColor: COLORS.primary }]}
                    onPress={() => p.set(p.v + 1)}
                  >
                    <Text style={[styles.pBtnText, { color: '#fff' }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <PrimaryButton
              label="Done"
              onPress={() => setShowPassengerModal(false)}
              style={{ marginTop: SPACING.md }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles (unchanged) ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content:   { padding: SPACING.md },

  // Location card
  locCard: { marginBottom: SPACING.md },
  locRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  dotWrap: { width: 20, alignItems: 'center', paddingTop: 20 },
  originDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary },
  destDot:   { width: 12, height: 12, borderRadius: 3, backgroundColor: COLORS.accent },
  connRow:   { paddingLeft: 9, paddingVertical: 2 },
  connLine:  { width: 2, height: 14, backgroundColor: COLORS.border },
  locLabel:  {
    ...(TYPOGRAPHY.label as object),
    fontSize: 11, marginBottom: 4, letterSpacing: 0.8,
    color: COLORS.textMuted,
  },
  gInput: {
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 14, color: COLORS.textPrimary ?? '#1E293B',
    backgroundColor: COLORS.background, height: 44,
  },
  gInputDone: { borderColor: COLORS.primary },

  selectedChip: {
    marginTop: 4,
    paddingVertical: 4, paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  selectedChipText: {
    ...(TYPOGRAPHY.caption as object),
    color: COLORS.primaryDark, fontWeight: '600',
  },

  // Details card
  detailsCard: { marginBottom: SPACING.md, padding: 0, overflow: 'hidden' },
  detailRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md },
  detailLeft:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  detailIcon:  {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  detailLabel: { ...(TYPOGRAPHY.body as object) },
  detailValue: { ...(TYPOGRAPHY.bodyBold as object), color: COLORS.primary, fontSize: 14 },
  divider:     { height: 1, backgroundColor: COLORS.border, marginLeft: SPACING.md + 32 + SPACING.sm },

  // Preferences
  sectionLabel: {
    ...(TYPOGRAPHY.label as object),
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: SPACING.xs,
    color: COLORS.textMuted,
  },
  tripRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  tripBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs, paddingVertical: 12, borderRadius: RADIUS.lg,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  tripBtnActive:     { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  tripBtnText:       { ...(TYPOGRAPHY.bodyBold as object), fontSize: 14, color: COLORS.textMuted },
  tripBtnTextActive: { color: COLORS.primaryDark },

  modesRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  modeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs, paddingVertical: 10, borderRadius: RADIUS.lg,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  modeChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  modeText:       { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  modeTextActive: { color: COLORS.primaryDark },

  // Passenger modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg, paddingBottom: 40,
  },
  handle:     { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  sheetTitle: { ...(TYPOGRAPHY.h2 as object), marginBottom: SPACING.md },
  pRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  pLabel:     { ...(TYPOGRAPHY.bodyBold as object) },
  pSub:       { ...(TYPOGRAPHY.caption as object), marginTop: 2 },
  pCounter:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  pBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  pBtnText:   { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  pCount:     { fontSize: 18, fontWeight: '700', minWidth: 24, textAlign: 'center', color: COLORS.textPrimary ?? '#1E293B' },
});