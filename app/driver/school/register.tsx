// app/driver/school/register.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity,
  Alert, ScrollView, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from '@/lib/appwrite';
import * as DocumentPicker from 'expo-document-picker';
import { uploadService } from '@/services/upload-service';
import { ScreenHeader, PrimaryButton, Card, LoadingScreen } from '@/components/ui';

interface SchoolDriver {
  $id: string;
  fullName: string;
  phone: string;
  email?: string;
  verificationStatus: string;
}

export default function RegisterVehicleScreen() {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(true);

  const [plateNumber, setPlateNumber] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [capacity, setCapacity] = useState('');
  const [documents, setDocuments] = useState<string[]>([]);

  const [drivers, setDrivers] = useState<SchoolDriver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedDriverName, setSelectedDriverName] = useState('');
  const [currentDriverId, setCurrentDriverId] = useState<string | null>(null);
  const [showDriverPicker, setShowDriverPicker] = useState(false);

  useEffect(() => { loadDrivers(); }, []);

  const loadDrivers = async () => {
    setLoadingDrivers(true);
    try {
      const mine = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_DRIVERS, [
        Query.equal('userId', user!.id),
      ]);
      if (mine.documents.length === 0) {
        Alert.alert('Not registered', 'Please complete your driver application first.');
        router.push('/driver/school/apply');
        return;
      }
      const current = mine.documents[0] as unknown as SchoolDriver;
      setCurrentDriverId(current.$id);
      setSelectedDriverId(current.$id);
      setSelectedDriverName(`${current.fullName} (you)`);

      const all = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_DRIVERS, [
        Query.equal('verificationStatus', 'approved'),
      ]);
      const others = (all.documents as unknown as SchoolDriver[]).filter(d => d.$id !== current.$id);
      setDrivers(others);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not load drivers');
    } finally {
      setLoadingDrivers(false);
    }
  };

  const uploadDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
    if (result.canceled) return;
    try {
      const res = await uploadService.uploadDriverDocument(result.assets[0].uri);
      const fileId = typeof res === 'string' ? res : res.fileId;
      setDocuments(prev => [...prev, fileId]);
    } catch {
      Alert.alert('Upload failed', 'Could not upload document. Please try again.');
    }
  };

  const sendNotification = async (driverId: string, title: string, message: string) => {
    try {
      await databases.createDocument(DATABASE_ID, COLLECTIONS.NOTIFICATIONS, ID.unique(), {
        userId: driverId, title, message, read: false, createdAt: new Date().toISOString(),
      });
    } catch (e) { console.error('Notification failed', e); }
  };

  const handleSubmit = async () => {
    if (!plateNumber.trim()) { Alert.alert('Missing field', 'Plate number is required.'); return; }
    if (!capacity.trim()) { Alert.alert('Missing field', 'Capacity is required.'); return; }
    if (!selectedDriverId) { Alert.alert('Select driver', 'Please select the driver for this vehicle.'); return; }
    const cap = parseInt(capacity);
    if (isNaN(cap) || cap < 1) { Alert.alert('Invalid capacity', 'Enter a valid number of seats.'); return; }

    setLoading(true);
    try {
      const driversRes = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_DRIVERS, [
        Query.equal('userId', user!.id),
      ]);
      const ownerId = (driversRes.documents[0] as unknown as SchoolDriver).$id;
      const isSelf = selectedDriverId === ownerId;

      await databases.createDocument(DATABASE_ID, COLLECTIONS.DRIVER_VEHICLES, ID.unique(), {
        ownerId,
        assignedDriverId: selectedDriverId,
        assignmentStatus: isSelf ? 'active' : 'pending',
        plateNumber: plateNumber.trim().toUpperCase(),
        make: make.trim() || null,
        model: model.trim() || null,
        year: year ? parseInt(year) : null,
        capacity: cap,
        vehicleDocuments: JSON.stringify(documents),
        verificationStatus: 'pending',
        createdAt: new Date().toISOString(),
      });

      if (!isSelf) {
        await sendNotification(
          selectedDriverId,
          '🚐 Vehicle Assignment',
          `You've been assigned as driver for vehicle ${plateNumber.toUpperCase()}. Please accept in your dashboard.`
        );
      }

      Alert.alert(
        'Vehicle registered! 🚐',
        isSelf
          ? 'Your vehicle is pending admin approval.'
          : `Vehicle registered. ${selectedDriverName} has been notified.`
      );
      router.back();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to register vehicle. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingDrivers) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Register Vehicle" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Assigned driver */}
        <Text style={styles.sectionLabel}>ASSIGNED DRIVER</Text>
        <TouchableOpacity style={styles.driverPickerBtn} onPress={() => setShowDriverPicker(true)} activeOpacity={0.8}>
          <View style={styles.driverPickerLeft}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>{selectedDriverName.charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.driverPickerName}>{selectedDriverName || 'Select a driver'}</Text>
              <Text style={styles.driverPickerSub}>Tap to change</Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Vehicle details */}
        <Text style={styles.sectionLabel}>VEHICLE DETAILS</Text>
        <Card style={styles.formCard}>
          <Text style={styles.fieldLabel}>Plate Number <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input} value={plateNumber}
            onChangeText={t => setPlateNumber(t.toUpperCase())}
            placeholder="e.g. CA 123-456" placeholderTextColor={COLORS.textMuted}
            autoCapitalize="characters"
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Make</Text>
              <TextInput style={styles.input} value={make} onChangeText={setMake} placeholder="e.g. Toyota" placeholderTextColor={COLORS.textMuted} />
            </View>
            <View style={{ width: SPACING.sm }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Model</Text>
              <TextInput style={styles.input} value={model} onChangeText={setModel} placeholder="e.g. Hiace" placeholderTextColor={COLORS.textMuted} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Year</Text>
              <TextInput style={styles.input} value={year} onChangeText={setYear} placeholder="e.g. 2020" placeholderTextColor={COLORS.textMuted} keyboardType="numeric" />
            </View>
            <View style={{ width: SPACING.sm }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Seats <Text style={styles.required}>*</Text></Text>
              <TextInput style={[styles.input, { marginBottom: 0 }]} value={capacity} onChangeText={setCapacity} placeholder="e.g. 8" placeholderTextColor={COLORS.textMuted} keyboardType="numeric" />
            </View>
          </View>
        </Card>

        {/* Documents */}
        <Text style={styles.sectionLabel}>VEHICLE DOCUMENTS</Text>
        <TouchableOpacity style={styles.uploadBtn} onPress={uploadDocument} activeOpacity={0.8}>
          <Text style={styles.uploadIcon}>📎</Text>
          <View>
            <Text style={styles.uploadBtnText}>Upload Registration & Insurance</Text>
            <Text style={styles.uploadBtnSub}>
              {documents.length > 0 ? `✓ ${documents.length} file(s) uploaded` : 'Tap to select documents'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Note */}
        <Card style={styles.noteCard}>
          <Text style={styles.noteText}>
            📋 Your vehicle will be reviewed by our team before you can offer trips. This usually takes 1-2 business days.
          </Text>
        </Card>

        <PrimaryButton label="Register Vehicle" onPress={handleSubmit} loading={loading} style={styles.submitBtn} />
      </ScrollView>

      {/* Driver picker modal */}
      <Modal visible={showDriverPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Driver</Text>

            {/* Always show self first */}
            <TouchableOpacity
              style={[styles.driverOption, selectedDriverId === currentDriverId && styles.driverOptionSelected]}
              onPress={() => {
                setSelectedDriverId(currentDriverId);
                setSelectedDriverName(`${drivers.find(d => false)?.fullName ?? 'You'} (you)`);
                setShowDriverPicker(false);
              }}
            >
              <View style={styles.driverOptionAvatar}>
                <Text style={styles.driverAvatarText}>Y</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverOptionName}>Myself (you)</Text>
                <Text style={styles.driverOptionSub}>Assign to your own profile</Text>
              </View>
              {selectedDriverId === currentDriverId && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>

            <FlatList
              data={drivers}
              keyExtractor={item => item.$id}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No other approved drivers found.</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.driverOption, selectedDriverId === item.$id && styles.driverOptionSelected]}
                  onPress={() => {
                    setSelectedDriverId(item.$id);
                    setSelectedDriverName(item.fullName);
                    setShowDriverPicker(false);
                  }}
                >
                  <View style={styles.driverOptionAvatar}>
                    <Text style={styles.driverAvatarText}>{item.fullName.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.driverOptionName}>{item.fullName}</Text>
                    <Text style={styles.driverOptionSub}>{item.phone}</Text>
                  </View>
                  {selectedDriverId === item.$id && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              )}
            />
            <PrimaryButton label="Cancel" variant="ghost" onPress={() => setShowDriverPicker(false)} style={{ marginTop: SPACING.sm }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 48 },

  sectionLabel: { ...TYPOGRAPHY.label, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.xs, marginTop: SPACING.xs },

  driverPickerBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.sm, marginBottom: SPACING.md,
  },
  driverPickerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  driverAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  driverAvatarText: { fontSize: 18, fontWeight: '700', color: COLORS.primaryDark },
  driverPickerName: { ...TYPOGRAPHY.bodyBold },
  driverPickerSub: { ...TYPOGRAPHY.caption, marginTop: 2 },
  chevron: { fontSize: 24, color: COLORS.textMuted },

  formCard: { marginBottom: SPACING.md },
  fieldLabel: { ...TYPOGRAPHY.label, marginBottom: 6, marginTop: SPACING.xs },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 15, color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  required: { color: COLORS.error },
  row: { flexDirection: 'row' },

  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    ...SHADOWS.sm, marginBottom: SPACING.md,
    borderWidth: 1.5, borderColor: COLORS.border, borderStyle: 'dashed',
  },
  uploadIcon: { fontSize: 28 },
  uploadBtnText: { ...TYPOGRAPHY.bodyBold, fontSize: 14 },
  uploadBtnSub: { ...TYPOGRAPHY.caption, marginTop: 2, color: COLORS.primary },

  noteCard: { backgroundColor: COLORS.accentLight, marginBottom: SPACING.md },
  noteText: { ...TYPOGRAPHY.body, fontSize: 13, lineHeight: 22 },

  submitBtn: {},

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, maxHeight: '75%' },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  modalTitle: { ...TYPOGRAPHY.h3, marginBottom: SPACING.md },
  driverOption: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  driverOptionSelected: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm },
  driverOptionAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  driverOptionName: { ...TYPOGRAPHY.bodyBold },
  driverOptionSub: { ...TYPOGRAPHY.caption, marginTop: 2 },
  checkmark: { color: COLORS.primary, fontWeight: '700', fontSize: 18 },
  emptyText: { ...TYPOGRAPHY.body, color: COLORS.textMuted, textAlign: 'center', padding: SPACING.lg },
});