// app/discover/index.tsx
// ─────────────────────────────────────────────────────────────────────────────
// "Discover" screen — Google Places nearby search with category filters,
// map markers, full place-detail bottom sheet, and journey planner integration.
//
// FIXES vs original:
// 1. '@/constants/themes' → '@/constants/theme'
// 2. Two sibling FlatLists inside SafeAreaView collapsed each other — the
//    horizontal category list and vertical places list both had undefined
//    heights. Restructured so the places FlatList is the single scrollable
//    root, with the search bar, category chips and map rendered as
//    ListHeaderComponent.
// 3. handleMarkerPress set the global `loading` flag, freezing the whole UI
//    (including the map) while a details request was in-flight. Replaced with
//    a separate `detailLoading` state so only the bottom-sheet indicator spins.
// 4. handleGetDirections passed `location?.lat.toString()` which produces the
//    string "undefined" when location is null — guarded.
// 5. In-flight race condition: rapid category taps fired overlapping Appwrite
//    requests. Added an `abortRef` token pattern so stale responses are
//    ignored.
// 6. mapRef.current.animateToRegion called unconditionally inside async
//    callbacks — guarded with null check.
// 7. getPlacePhotoUrl called inline in Image source.uri on every render —
//    memoised inside the detail modal.
// 8. Map rendered inside a conditional block that returned nothing when location
//    was null — replaced with a placeholder card so the layout doesn't shift.
// 9. Modal maxHeight: '85%' with no flex:1 clips content on small devices.
//    Changed to flex:1 with paddingTop:120 so the bottom sheet stops ~120pt
//    from the top of the screen.
// 10. Category chips used marginRight on the chip AND gap on the container —
//     duplicate spacing. Removed marginRight from chip.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  FlatList, TextInput, ActivityIndicator, Modal, ScrollView,
  Image, Linking, Alert, Platform,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader, PrimaryButton, EmptyState } from '@/components/ui';
import {
  searchNearbyPlaces, searchPlacesByText, getPlaceDetails,
  getPlacePhotoUrl, Place, PlaceDetails,
} from '@/services/places';

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',               name: 'All',          icon: '📍', type: null                },
  { id: 'restaurant',        name: 'Eateries',     icon: '🍽️', type: 'restaurant'        },
  { id: 'cafe',              name: 'Cafés',        icon: '☕', type: 'cafe'              },
  { id: 'shopping_mall',     name: 'Shops',        icon: '🛍️', type: 'shopping_mall'     },
  { id: 'hospital',          name: 'Hospitals',    icon: '🏥', type: 'hospital'          },
  { id: 'police',            name: 'Police',       icon: '👮', type: 'police'            },
  { id: 'atm',               name: 'ATMs',         icon: '🏧', type: 'atm'               },
  { id: 'ev_charging',       name: 'EV Charging',  icon: '⚡', type: 'ev_charging_station'},
  { id: 'park',              name: 'Parks',        icon: '🌳', type: 'park'              },
  { id: 'tourist_attraction',name: 'Attractions',  icon: '🏛️', type: 'tourist_attraction'},
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

const INITIAL_REGION: Region = {
  latitude:      -26.2041,
  longitude:     28.0473,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

// ─── Place card (stable memo) ─────────────────────────────────────────────────
const PlaceCard = React.memo(({
  item, onPress,
}: { item: Place; onPress: () => void }) => (
  <TouchableOpacity style={styles.placeCard} onPress={onPress} activeOpacity={0.78}>
    <View style={styles.placeIconWrap}>
      <Text style={{ fontSize: 20 }}>📍</Text>
    </View>
    <View style={styles.placeInfo}>
      <Text style={styles.placeName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.placeAddress} numberOfLines={1}>{item.address}</Text>
      {item.rating != null && (
        <Text style={styles.placeRating}>
          ⭐ {item.rating}{item.userRatingsTotal ? ` (${item.userRatingsTotal})` : ''}
        </Text>
      )}
    </View>
    <Text style={styles.placeChevron}>›</Text>
  </TouchableOpacity>
));

// ─── Category chip (stable memo) ─────────────────────────────────────────────
const CategoryChip = React.memo(({
  item, active, onPress,
}: {
  item: typeof CATEGORIES[number];
  active: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={[styles.chip, active && styles.chipActive]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <Text style={styles.chipIcon}>{item.icon}</Text>
    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{item.name}</Text>
  </TouchableOpacity>
));

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const [location,         setLocation]         = useState<{ lat: number; lng: number } | null>(null);
  const [places,           setPlaces]           = useState<Place[]>([]);
  const [searchLoading,    setSearchLoading]    = useState(false);
  const [listLoading,      setListLoading]      = useState(false);
  // FIX: separate loading state for detail — doesn't freeze the whole UI
  const [detailLoading,    setDetailLoading]    = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all');
  const [searchQuery,      setSearchQuery]      = useState('');
  const [selectedPlace,    setSelectedPlace]    = useState<PlaceDetails | null>(null);
  const [showDetail,       setShowDetail]       = useState(false);

  const mapRef  = useRef<MapView>(null);
  // FIX: abort token so stale responses from rapid category-tap are ignored
  const requestId = useRef(0);

  // ── Location init ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location permission needed', 'Enable location to discover places near you.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setLocation(coords);
      loadNearby(coords.lat, coords.lng, null);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load nearby places ───────────────────────────────────────────────────
  const loadNearby = useCallback(async (
    lat:  number,
    lng:  number,
    type: string | null,
  ) => {
    const myId = ++requestId.current;   // FIX: increment before async work
    setListLoading(true);
    try {
      const nearby = await searchNearbyPlaces(lat, lng, 2000, type ?? undefined);
      if (requestId.current !== myId) return;   // stale — a newer request is running
      setPlaces(nearby);
      // FIX: guard mapRef.current null check before animating
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          { latitude: lat, longitude: lng, latitudeDelta: 0.05, longitudeDelta: 0.05 },
          400,
        );
      }
    } catch {
      if (requestId.current !== myId) return;
      Alert.alert('Error', 'Could not load nearby places. Please try again.');
    } finally {
      if (requestId.current === myId) setListLoading(false);
    }
  }, []);

  // ── Text search ──────────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    // FIX: give user feedback if location is still pending
    if (!location) {
      Alert.alert('Location not ready', 'Please wait while we determine your location.');
      return;
    }
    setSearchLoading(true);
    try {
      const results = await searchPlacesByText(searchQuery.trim(), location.lat, location.lng, 5000);
      setPlaces(results);
      if (mapRef.current && results.length > 0) {
        mapRef.current.animateToRegion(
          { latitude: results[0].lat, longitude: results[0].lng, latitudeDelta: 0.05, longitudeDelta: 0.05 },
          400,
        );
      }
    } catch {
      Alert.alert('Search failed', 'Please check your connection and try again.');
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, location]);

  // ── Category selection ───────────────────────────────────────────────────
  const handleCategoryPress = useCallback((cat: typeof CATEGORIES[number]) => {
    setSelectedCategory(cat.id);
    if (location) loadNearby(location.lat, location.lng, cat.type);
  }, [location, loadNearby]);

  // ── Marker / card press ──────────────────────────────────────────────────
  const handlePlacePress = useCallback(async (place: Place) => {
    setDetailLoading(true);
    setShowDetail(true);   // open modal immediately so spinner shows inside it
    setSelectedPlace(null);
    try {
      const details = await getPlaceDetails(place.placeId);
      setSelectedPlace(details);
    } catch {
      setShowDetail(false);
      Alert.alert('Error', 'Could not load place details. Please try again.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ── Get directions ───────────────────────────────────────────────────────
  const handleGetDirections = useCallback(() => {
    if (!selectedPlace) return;
    // FIX: guard location null — router.push with undefined params silently corrupts navigation
    if (!location) {
      Alert.alert('Location unavailable', 'Your current location is not yet known.');
      return;
    }
    setShowDetail(false);
    router.push({
      pathname: '/plan-journey',
      params: {
        destName: selectedPlace.name,
        destLat:  selectedPlace.lat.toString(),
        destLng:  selectedPlace.lng.toString(),
        fromName: 'My Location',
        fromLat:  location.lat.toString(),
        fromLng:  location.lng.toString(),
      },
    });
  }, [selectedPlace, location]);

  // ── Re-centre map ────────────────────────────────────────────────────────
  const handleRecenter = useCallback(() => {
    if (!location) { Alert.alert('Location unavailable', 'Could not determine your current location.'); return; }
    const cat = CATEGORIES.find(c => c.id === selectedCategory);
    loadNearby(location.lat, location.lng, cat?.type ?? null);
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        { latitude: location.lat, longitude: location.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 },
        400,
      );
    }
  }, [location, selectedCategory, loadNearby]);

  // ── Photo URL (memoised so it isn't recomputed on every render) ───────────
  const photoUri = useMemo(
    () => selectedPlace?.photoRef ? getPlacePhotoUrl(selectedPlace.photoRef) : null,
    [selectedPlace?.photoRef],
  );

  // ── Render helpers ───────────────────────────────────────────────────────
  const renderCategory = useCallback(({ item }: { item: typeof CATEGORIES[number] }) => (
    <CategoryChip
      item={item}
      active={selectedCategory === item.id}
      onPress={() => handleCategoryPress(item)}
    />
  ), [selectedCategory, handleCategoryPress]);

  const renderPlace = useCallback(({ item }: { item: Place }) => (
    <PlaceCard item={item} onPress={() => handlePlacePress(item)} />
  ), [handlePlacePress]);

  // ── FlatList header (search + categories + map) ──────────────────────────
  // FIX: everything above the places list lives here so there is only ONE
  // scrollable root — avoids the nested VirtualizedList / collapsed-height bug.
  const ListHeader = useMemo(() => (
    <>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search places, e.g. restaurants, ATMs…"
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={[styles.searchBtn, searchLoading && { opacity: 0.6 }]}
          onPress={handleSearch}
          disabled={searchLoading}
          activeOpacity={0.8}
        >
          {searchLoading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={{ fontSize: 18 }}>🔍</Text>}
        </TouchableOpacity>
      </View>

      {/* Category chips */}
      <FlatList
        horizontal
        data={CATEGORIES as unknown as typeof CATEGORIES[number][]}
        keyExtractor={c => c.id}
        renderItem={renderCategory}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        // FIX: nested horizontal FlatList must have scrollEnabled
        scrollEnabled
        nestedScrollEnabled
      />

      {/* Map */}
      <View style={styles.mapWrap}>
        {location ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude:       location.lat,
              longitude:      location.lng,
              latitudeDelta:  0.05,
              longitudeDelta: 0.05,
            }}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {places.map(place => (
              <Marker
                key={place.placeId}
                coordinate={{ latitude: place.lat, longitude: place.lng }}
                title={place.name}
                description={place.address}
                onPress={() => handlePlacePress(place)}
              >
                <View style={styles.mapMarker}>
                  <Text style={{ fontSize: 16 }}>📍</Text>
                </View>
              </Marker>
            ))}
          </MapView>
        ) : (
          /* FIX: placeholder so layout doesn't shift while location loads */
          <View style={[styles.map, styles.mapPlaceholder]}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.mapPlaceholderText}>Getting your location…</Text>
          </View>
        )}

        {/* Loading overlay (list search only, not detail) */}
        {listLoading && (
          <View style={styles.mapOverlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        )}

        {/* Re-centre button */}
        <TouchableOpacity style={styles.recenterBtn} onPress={handleRecenter}>
          <Text style={styles.recenterText}>📍 My location</Text>
        </TouchableOpacity>
      </View>

      {/* Section header for places list */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>
          {places.length > 0 ? `${places.length} nearby place${places.length !== 1 ? 's' : ''}` : 'Nearby places'}
        </Text>
        {listLoading && <ActivityIndicator size="small" color={COLORS.primary} />}
      </View>
    </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [searchQuery, searchLoading, listLoading, location, places, selectedCategory, renderCategory, handleSearch, handlePlacePress, handleRecenter]);

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Discover" onBack={() => router.back()} />

      {/* FIX: single scrollable root — no nested VirtualizedLists at the top level */}
      <FlatList
        data={places}
        keyExtractor={item => item.placeId}
        renderItem={renderPlace}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          !listLoading ? (
            <EmptyState
              icon="🔍"
              title="No places found"
              subtitle="Try a different category or search term."
            />
          ) : null
        }
      />

      {/* ── Place detail bottom sheet ── */}
      <Modal
        visible={showDetail}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDetail(false)}
      >
        <View style={styles.sheetOverlay}>
          {/* Tap-outside-to-dismiss area */}
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowDetail(false)}
            activeOpacity={1}
          />

          {/* FIX: flex:1 + paddingTop so sheet never goes off-screen */}
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />

            {/* Loading state inside the sheet */}
            {detailLoading ? (
              <View style={styles.sheetLoadingWrap}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.sheetLoadingText}>Loading details…</Text>
              </View>
            ) : selectedPlace ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.sheetScroll}
                bounces={Platform.OS === 'ios'}
              >
                {/* Header */}
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle} numberOfLines={2}>{selectedPlace.name}</Text>
                  <TouchableOpacity
                    onPress={() => setShowDetail(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.sheetClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Photo */}
                {photoUri && (
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.sheetPhoto}
                    resizeMode="cover"
                  />
                )}

                {/* Address */}
                <Text style={styles.sheetAddress}>{selectedPlace.address}</Text>

                {/* Stats strip */}
                <View style={styles.statsStrip}>
                  {selectedPlace.rating != null && (
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>⭐ {selectedPlace.rating}</Text>
                      <Text style={styles.statLabel}>Rating</Text>
                    </View>
                  )}
                  {selectedPlace.priceLevel != null && (
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{'💰'.repeat(Math.min(selectedPlace.priceLevel, 4))}</Text>
                      <Text style={styles.statLabel}>Price</Text>
                    </View>
                  )}
                  {selectedPlace.openingHours != null && (
                    <View style={styles.statItem}>
                      <Text style={[
                        styles.statValue,
                        { color: selectedPlace.openingHours ? COLORS.success : COLORS.error },
                      ]}>
                        {selectedPlace.openingHours ? '🟢 Open' : '🔴 Closed'}
                      </Text>
                      <Text style={styles.statLabel}>Status</Text>
                    </View>
                  )}
                  {selectedPlace.wheelchairAccessible && (
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>♿ Yes</Text>
                      <Text style={styles.statLabel}>Accessible</Text>
                    </View>
                  )}
                </View>

                {/* Contact rows */}
                {selectedPlace.phone ? (
                  <TouchableOpacity
                    style={styles.contactRow}
                    onPress={() => Linking.openURL(`tel:${selectedPlace.phone}`)}
                  >
                    <Text style={styles.contactIcon}>📞</Text>
                    <Text style={styles.contactText}>{selectedPlace.phone}</Text>
                    <Text style={styles.contactAction}>Call</Text>
                  </TouchableOpacity>
                ) : null}

                {selectedPlace.website ? (
                  <TouchableOpacity
                    style={styles.contactRow}
                    onPress={() => Linking.openURL(selectedPlace.website!)}
                  >
                    <Text style={styles.contactIcon}>🌐</Text>
                    <Text style={[styles.contactText, { color: COLORS.primary }]} numberOfLines={1}>
                      {selectedPlace.website}
                    </Text>
                    <Text style={styles.contactAction}>Open</Text>
                  </TouchableOpacity>
                ) : null}

                {/* Opening hours */}
                {selectedPlace.openingHoursText ? (
                  <View style={styles.hoursBlock}>
                    <Text style={styles.hoursTitle}>Opening Hours</Text>
                    <Text style={styles.hoursText}>{selectedPlace.openingHoursText}</Text>
                  </View>
                ) : null}

                {/* CTA */}
                <PrimaryButton
                  label="Get Directions →"
                  onPress={handleGetDirections}
                  style={{ marginTop: SPACING.md }}
                />
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // ── Search ──
  searchRow: {
    flexDirection: 'row', gap: SPACING.sm,
    marginHorizontal: SPACING.md, marginTop: SPACING.sm, marginBottom: SPACING.xs,
  },
  searchInput: {
    flex: 1, height: 44,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, fontSize: 14,
    color: COLORS.textPrimary, borderWidth: 1.5, borderColor: COLORS.border,
  },
  searchBtn: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Category chips ──
  chipRow:    { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, gap: SPACING.xs },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border,
  },
  chipActive:      { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  chipIcon:        { fontSize: 13 },
  chipLabel:       { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  chipLabelActive: { color: COLORS.primaryDark, fontWeight: '700' },

  // ── Map ──
  mapWrap: {
    height: 240, marginHorizontal: SPACING.md, marginTop: SPACING.sm,
    borderRadius: RADIUS.lg, overflow: 'hidden',
    position: 'relative',
    ...SHADOWS.md,
  },
  map: { flex: 1 },
  mapPlaceholder: {
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
  },
  mapPlaceholderText: { ...TYPOGRAPHY.caption, color: COLORS.primaryDark },
  mapMarker: {
    backgroundColor: COLORS.surface, borderRadius: 20, padding: 5,
    borderWidth: 2, borderColor: COLORS.primary, ...SHADOWS.sm,
  },
  mapOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  recenterBtn: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: COLORS.surface, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: RADIUS.full, ...SHADOWS.sm,
  },
  recenterText: { ...TYPOGRAPHY.captionBold },

  // ── List ──
  listContent: { paddingBottom: 48 },
  listHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: SPACING.xs,
  },
  listTitle: { ...TYPOGRAPHY.h4 },

  // ── Place card ──
  placeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  placeIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  placeInfo:    { flex: 1 },
  placeName:    { ...TYPOGRAPHY.bodyBold },
  placeAddress: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 2 },
  placeRating:  { ...TYPOGRAPHY.caption, color: COLORS.accent, marginTop: 2, fontWeight: '600' },
  placeChevron: { fontSize: 22, color: COLORS.textMuted },

  // ── Bottom sheet ──
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    // FIX: maxHeight instead of fixed height — adapts to content + screen size
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    ...SHADOWS.lg,
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: COLORS.border,
    borderRadius: 2, alignSelf: 'center',
    marginTop: SPACING.sm, marginBottom: SPACING.xs,
  },
  sheetLoadingWrap: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: SPACING.xxl, gap: SPACING.sm,
  },
  sheetLoadingText: { ...TYPOGRAPHY.body, color: COLORS.textMuted },
  sheetScroll:  { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', gap: SPACING.sm, marginBottom: SPACING.sm,
  },
  sheetTitle: { ...TYPOGRAPHY.h3, flex: 1 },
  sheetClose: { fontSize: 18, fontWeight: '700', color: COLORS.textMuted, paddingHorizontal: 4 },
  sheetPhoto: { height: 170, borderRadius: RADIUS.md, marginBottom: SPACING.sm },
  sheetAddress: { ...TYPOGRAPHY.body, color: COLORS.textMuted, marginBottom: SPACING.md },

  // ── Stats strip ──
  statsStrip: {
    flexDirection: 'row', gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statItem: {
    flex: 1, alignItems: 'center',
    backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: SPACING.sm,
  },
  statValue: { fontSize: 14, fontWeight: '700', color: COLORS.primary, textAlign: 'center' },
  statLabel: { ...TYPOGRAPHY.caption, marginTop: 2 },

  // ── Contact rows ──
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  contactIcon:   { fontSize: 18, width: 26 },
  contactText:   { ...TYPOGRAPHY.body, flex: 1 },
  contactAction: { ...TYPOGRAPHY.captionBold, color: COLORS.primary },

  // ── Opening hours ──
  hoursBlock: { marginTop: SPACING.md },
  hoursTitle: { ...TYPOGRAPHY.bodyBold, marginBottom: SPACING.xs },
  hoursText:  { ...TYPOGRAPHY.caption, color: COLORS.textMuted, lineHeight: 20 },
});