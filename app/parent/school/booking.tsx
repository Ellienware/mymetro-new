// app/parent/school/booking.tsx
// FIXES:
// - childIds now stores child IDs (not names) — names resolved at render
// - Uses Google Places autocomplete for address (not native geocoder)
// - Pricing uses weeklyPrice/monthlyPrice fields correctly
// app/parent/school/booking.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView, FlatList, Modal, TextInput,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { useUserWallet } from '@/hooks/useAppwrite';
import { AppwriteService } from '@/services/appwriteService';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { databases, DATABASE_ID, COLLECTIONS, Query, ID } from '@/lib/appwrite';
import { ScreenHeader, PrimaryButton, Card, LoadingScreen } from '@/components/ui';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

export default function ParentSchoolBookingScreen() {
  const { offeringId } = useLocalSearchParams<{ offeringId: string }>();
  const { user } = useUser();
  const { wallet, refetch } = useUserWallet();

  const [offering, setOffering] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Address autocomplete – direct Google Places API
  const [homeAddress, setHomeAddress] = useState('');
  const [homeCoords, setHomeCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildren, setSelectedChildren] = useState<Set<string>>(new Set());
  const [showChildrenPicker, setShowChildrenPicker] = useState(false);
  const [loadingChildren, setLoadingChildren] = useState(true);

  const [selectedPeriod, setSelectedPeriod] = useState<'weekly' | 'monthly' | null>(null);
  const [selectedPrice, setSelectedPrice] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const doc = await databases.getDocument(DATABASE_ID, COLLECTIONS.DRIVER_SCHOOL_OFFERINGS, offeringId);
        setOffering(doc);
        if (doc.weeklyPrice) { setSelectedPeriod('weekly'); setSelectedPrice(doc.weeklyPrice); }
        else if (doc.monthlyPrice) { setSelectedPeriod('monthly'); setSelectedPrice(doc.monthlyPrice); }
      } catch {
        Alert.alert('Error', 'Offering not found');
        router.back();
      } finally { setLoading(false); }
    };
    load();

    const loadChildren = async () => {
      try {
        const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.CHILDREN, [Query.equal('parentId', user!.id)]);
        setChildren(res.documents);
      } catch (e) { console.error(e); }
      finally { setLoadingChildren(false); }
    };
    loadChildren();
  }, []);

  // Direct Google Places Autocomplete
  const onAddressChange = (text: string) => {
    setHomeAddress(text);
    setHomeCoords(null);
    if (text.length < 3) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      try {
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
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry,formatted_address&key=${API_KEY}`;
      const detailsRes = await fetch(detailsUrl);
      const detailsData = await detailsRes.json();
      if (detailsData.status === 'OK' && detailsData.result) {
        const lat = detailsData.result.geometry.location.lat;
        const lng = detailsData.result.geometry.location.lng;
        setHomeAddress(detailsData.result.formatted_address);
        setHomeCoords({ lat, lng });
      } else {
        Alert.alert('Error', 'Could not get address coordinates');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to fetch address details');
    }
  };

  const toggleChild = (childId: string) => {
    const next = new Set(selectedChildren);
    next.has(childId) ? next.delete(childId) : next.add(childId);
    setSelectedChildren(next);
  };

  const selectedChildrenList = children.filter(c => selectedChildren.has(c.$id));
  const totalPrice = selectedPrice * selectedChildrenList.length;

  const handleBook = async () => {
  if (selectedChildrenList.length === 0) { Alert.alert('Select children', 'Please select at least one child.'); return; }
  if (!homeAddress.trim() || !homeCoords) { Alert.alert('Missing address', 'Please select your home address from the suggestions.'); return; }
  if (offering.availableSeats < selectedChildrenList.length) {
    Alert.alert('Not enough seats', `Only ${offering.availableSeats} seat(s) available.`);
    return;
  }
  if (!wallet || wallet.balance < totalPrice) {
    Alert.alert('Insufficient balance', `R${totalPrice} required. Your balance: R${wallet?.balance ?? 0}`);
    return;
  }

  setBookingLoading(true);
  try {
    await AppwriteService.updateWalletBalance(user!.id, wallet.balance - totalPrice);
    await AppwriteService.createTransaction(user!.id, {
      type: 'school_booking',
      amount: -totalPrice,
      currency: 'ZAR',
      description: `School transport for ${selectedChildrenList.map(c => c.name).join(', ')} to ${offering.schoolName}`,
      status: 'completed',
      paymentMethod: 'wallet',
    });

    // ✅ Add routeId (use offeringId as routeId)
    await databases.createDocument(DATABASE_ID, COLLECTIONS.SCHOOL_BOOKINGS, ID.unique(), {
      parentId: user!.id,
      offeringId: offering.$id,
      routeId: offering.$id,                     // ← REQUIRED FIELD ADDED
      selectedSchool: offering.schoolName,
      period: selectedPeriod,
      childIds: JSON.stringify(selectedChildrenList.map(c => c.$id)),
      childNames: JSON.stringify(selectedChildrenList.map(c => c.name)),
      pickupAddress: homeAddress,
      homeLat: homeCoords.lat,
      homeLng: homeCoords.lng,
      startDate: new Date().toISOString(),
      endDate: selectedPeriod === 'weekly'
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      totalAmount: totalPrice,
      paymentStatus: 'paid',
      status: 'active',
      createdAt: new Date().toISOString(),
    });

    await AppwriteService.creditSchoolDriverWallet(
      offering.driverId,
      totalPrice,
      `Booking for ${selectedChildrenList.map(c => c.name).join(', ')} – ${selectedPeriod} period to ${offering.schoolName}`
    );

    await databases.updateDocument(DATABASE_ID, COLLECTIONS.DRIVER_SCHOOL_OFFERINGS, offering.$id, {
      availableSeats: offering.availableSeats - selectedChildrenList.length,
    });

    await refetch();
    router.replace({ pathname: '/parent/school/booking-success', params: { schoolName: offering.schoolName } });
  } catch (error: any) {
    Alert.alert('Booking failed', error?.message || 'Please try again');
  } finally {
    setBookingLoading(false);
  }
};

  if (loading) return <LoadingScreen />;
  if (!offering) return null;

  const hasWeekly = !!offering.weeklyPrice;
  const hasMonthly = !!offering.monthlyPrice;
  const hasBoth = hasWeekly && hasMonthly;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Book Transport" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Offering summary */}
        <Card style={styles.offeringCard}>
          <View style={styles.offeringTop}>
            <Text style={styles.schoolEmoji}>🏫</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.schoolName}>{offering.schoolName}</Text>
              <Text style={styles.offeringMeta}>
                ⏰ {offering.operatingHoursMorning} · 💺 {offering.availableSeats} seats left
              </Text>
            </View>
          </View>
          <View style={styles.priceBadges}>
            {hasWeekly && (
              <View style={styles.priceBadge}>
                <Text style={styles.priceBadgeLabel}>Weekly</Text>
                <Text style={styles.priceBadgeValue}>R{offering.weeklyPrice}</Text>
              </View>
            )}
            {hasMonthly && (
              <View style={[styles.priceBadge, { backgroundColor: COLORS.accentLight }]}>
                <Text style={[styles.priceBadgeLabel, { color: COLORS.accentDark }]}>Monthly</Text>
                <Text style={[styles.priceBadgeValue, { color: COLORS.accentDark }]}>R{offering.monthlyPrice}</Text>
              </View>
            )}
          </View>
          {offering.note && <Text style={styles.note}>💬 {offering.note}</Text>}
        </Card>

        {/* Period selection */}
        {hasBoth && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>BILLING PERIOD</Text>
            <View style={styles.periodRow}>
              <TouchableOpacity
                style={[styles.periodBtn, selectedPeriod === 'weekly' && styles.periodBtnActive]}
                onPress={() => { setSelectedPeriod('weekly'); setSelectedPrice(offering.weeklyPrice); }}
              >
                <Text style={[styles.periodBtnLabel, selectedPeriod === 'weekly' && styles.periodBtnLabelActive]}>Weekly</Text>
                <Text style={[styles.periodBtnPrice, selectedPeriod === 'weekly' && styles.periodBtnPriceActive]}>R{offering.weeklyPrice}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodBtn, selectedPeriod === 'monthly' && styles.periodBtnActive]}
                onPress={() => { setSelectedPeriod('monthly'); setSelectedPrice(offering.monthlyPrice); }}
              >
                <Text style={[styles.periodBtnLabel, selectedPeriod === 'monthly' && styles.periodBtnLabelActive]}>Monthly</Text>
                <Text style={[styles.periodBtnPrice, selectedPeriod === 'monthly' && styles.periodBtnPriceActive]}>R{offering.monthlyPrice}</Text>
                <View style={styles.savingBadge}><Text style={styles.savingText}>Save more</Text></View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Address with direct Google Places */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PICKUP ADDRESS</Text>
          <TextInput
            style={[styles.input, homeCoords && styles.inputVerified]}
            placeholder="Start typing your home address..."
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
          {homeCoords && <Text style={styles.verifiedHint}>✓ Address verified</Text>}
        </View>

        {/* Children */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CHILDREN</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowChildrenPicker(true)}>
            <Text style={selectedChildrenList.length ? styles.pickerBtnText : styles.pickerBtnPlaceholder}>
              {selectedChildrenList.length === 0
                ? 'Select children to add...'
                : selectedChildrenList.map(c => c.name).join(', ')}
            </Text>
            <Text style={styles.pickerChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Total + wallet */}
        {selectedChildrenList.length > 0 && (
          <Card style={styles.totalCard}>
            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalLabel}>Total due</Text>
                <Text style={styles.totalSub}>
                  R{selectedPrice} × {selectedChildrenList.length} child{selectedChildrenList.length !== 1 ? 'ren' : ''}
                  {selectedPeriod ? ` · ${selectedPeriod}` : ''}
                </Text>
              </View>
              <Text style={styles.totalAmount}>R{totalPrice}</Text>
            </View>
            <View style={styles.walletRow}>
              <Text style={styles.walletLabel}>Wallet balance</Text>
              <Text style={[styles.walletBalance, (wallet?.balance ?? 0) < totalPrice && { color: COLORS.error }]}>
                R{wallet?.balance ?? 0}
              </Text>
            </View>
          </Card>
        )}

        <PrimaryButton
          label="Confirm Booking"
          onPress={handleBook}
          loading={bookingLoading}
          disabled={!homeCoords || selectedChildrenList.length === 0}
          style={styles.bookBtn}
        />
      </ScrollView>

      {/* Children picker modal (unchanged) */}
      <Modal visible={showChildrenPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Children</Text>
            {loadingChildren ? <ActivityIndicator color={COLORS.primary} /> :
              children.length === 0 ? (
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyText}>No children added yet.</Text>
                  <TouchableOpacity onPress={() => { setShowChildrenPicker(false); router.push('/parent/school/children'); }}>
                    <Text style={styles.modalEmptyAction}>+ Add a child</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={children}
                  keyExtractor={item => item.$id}
                  renderItem={({ item }) => {
                    const selected = selectedChildren.has(item.$id);
                    return (
                      <TouchableOpacity style={[styles.childRow, selected && styles.childRowSelected]} onPress={() => toggleChild(item.$id)}>
                        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                          {selected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.childRowName}>{item.name}</Text>
                          {item.school && <Text style={styles.childRowSchool}>{item.school}</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              )
            }
            <PrimaryButton label="Done" onPress={() => setShowChildrenPicker(false)} style={{ marginTop: SPACING.md }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ... (keep all existing styles exactly as they were, they are unchanged)
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 48 },
  offeringCard: { marginBottom: SPACING.md },
  offeringTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.sm, gap: SPACING.sm },
  schoolEmoji: { fontSize: 32 },
  schoolName: { ...TYPOGRAPHY.h3 },
  offeringMeta: { ...TYPOGRAPHY.caption, marginTop: 4 },
  priceBadges: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.xs },
  priceBadge: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' },
  priceBadgeLabel: { fontSize: 11, fontWeight: '600', color: COLORS.primaryDark },
  priceBadgeValue: { fontSize: 16, fontWeight: '700', color: COLORS.primaryDark },
  note: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: SPACING.xs },
  section: { marginBottom: SPACING.md },
  sectionLabel: { ...TYPOGRAPHY.label, marginBottom: SPACING.xs, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  periodRow: { flexDirection: 'row', gap: SPACING.sm },
  periodBtn: {
    flex: 1, borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.border,
    padding: SPACING.md, alignItems: 'center', backgroundColor: COLORS.surface,
  },
  periodBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  periodBtnLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  periodBtnLabelActive: { color: COLORS.primaryDark },
  periodBtnPrice: { fontSize: 20, fontWeight: '700', color: COLORS.textMuted, marginTop: 2 },
  periodBtnPriceActive: { color: COLORS.primaryDark },
  savingBadge: { backgroundColor: COLORS.accent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full, marginTop: 4 },
  savingText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 15, color: COLORS.textPrimary,
  },
  inputVerified: { borderColor: COLORS.success },
  predictions: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, marginTop: 2, ...SHADOWS.sm },
  predictionItem: { padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  predictionText: { ...TYPOGRAPHY.body },
  verifiedHint: { fontSize: 12, color: COLORS.success, fontWeight: '600', marginTop: 4 },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md,
  },
  pickerBtnText: { flex: 1, ...TYPOGRAPHY.bodyBold },
  pickerBtnPlaceholder: { flex: 1, ...TYPOGRAPHY.body, color: COLORS.textMuted },
  pickerChevron: { fontSize: 20, color: COLORS.textMuted },
  totalCard: { marginBottom: SPACING.md },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  totalLabel: { ...TYPOGRAPHY.h4 },
  totalSub: { ...TYPOGRAPHY.caption, marginTop: 2 },
  totalAmount: { fontSize: 32, fontWeight: '800', color: COLORS.primary },
  walletRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: SPACING.xs, borderTopWidth: 1, borderTopColor: COLORS.border },
  walletLabel: { ...TYPOGRAPHY.caption },
  walletBalance: { ...TYPOGRAPHY.captionBold, color: COLORS.success },
  bookBtn: { marginTop: SPACING.xs },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, maxHeight: '75%' },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  modalTitle: { ...TYPOGRAPHY.h3, marginBottom: SPACING.md },
  modalEmpty: { alignItems: 'center', padding: SPACING.lg },
  modalEmptyText: { ...TYPOGRAPHY.body, marginBottom: SPACING.sm },
  modalEmptyAction: { color: COLORS.primary, fontWeight: '700', fontSize: 16 },
  childRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm },
  childRowSelected: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, marginBottom: 2 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  childRowName: { ...TYPOGRAPHY.bodyBold },
  childRowSchool: { ...TYPOGRAPHY.caption, marginTop: 2 },
});