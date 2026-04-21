// app/driver/meter/register.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TextInput,
  TouchableOpacity, Alert, ScrollView, Image,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { databases, DATABASE_ID, COLLECTIONS, ID } from '@/lib/appwrite';
import { uploadService } from '@/services/upload-service';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { ScreenHeader, PrimaryButton, Card } from '@/components/ui';

interface DocFieldProps {
  label: string;
  uri: string | null;
  onPick: () => void;
}

function DocField({ label, uri, onPick }: DocFieldProps) {
  return (
    <TouchableOpacity
      style={[styles.docField, uri && styles.docFieldDone]}
      onPress={onPick}
      activeOpacity={0.8}
    >
      <View style={[styles.docIconWrap, uri && styles.docIconWrapDone]}>
        <Text style={{ fontSize: 18 }}>{uri ? '✓' : '📄'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.docLabel}>{label}</Text>
        <Text style={styles.docSub}>{uri ? 'Document selected' : 'Tap to upload'}</Text>
      </View>
      {uri && <Image source={{ uri }} style={styles.docPreview} />}
    </TouchableOpacity>
  );
}

export default function MeterDriverRegisterScreen() {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleReg, setVehicleReg] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');

  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [licenseImageUri, setLicenseImageUri] = useState<string | null>(null);
  const [prdpImageUri, setPrdpImageUri] = useState<string | null>(null);
  const [vehicleRegImageUri, setVehicleRegImageUri] = useState<string | null>(null);
  const [policeClearanceUri, setPoliceClearanceUri] = useState<string | null>(null);

  const docsUploaded = [profileImageUri, licenseImageUri, prdpImageUri, vehicleRegImageUri, policeClearanceUri].filter(Boolean).length;
  const progress = docsUploaded / 5;

  const pickImage = async (setUri: (uri: string) => void) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow access to your photos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
    if (!result.canceled) setUri(result.assets[0].uri);
  };

  const uploadImage = async (uri: string): Promise<string> => {
    const result = await uploadService.uploadDriverDocument(uri);
    return typeof result === 'string' ? result : result.fileId;
  };

  const handleSubmit = async () => {
    if (!fullName || !phone || !vehicleReg || !vehicleMake || !vehicleModel) {
      Alert.alert('Missing fields', 'Please fill in all required vehicle and personal details.');
      return;
    }
    if (!profileImageUri || !licenseImageUri || !prdpImageUri || !vehicleRegImageUri || !policeClearanceUri) {
      Alert.alert('Missing documents', 'Please upload all 5 required documents.');
      return;
    }
    setLoading(true);
    try {
      const [profileId, licenseId, prdpId, vehicleRegId, policeId] = await Promise.all([
        uploadImage(profileImageUri),
        uploadImage(licenseImageUri),
        uploadImage(prdpImageUri),
        uploadImage(vehicleRegImageUri),
        uploadImage(policeClearanceUri),
      ]);
      await databases.createDocument(DATABASE_ID, COLLECTIONS.METER_DRIVERS, ID.unique(), {
        userId: user!.id,
        fullName,
        phone,
        vehicleReg: vehicleReg.trim().toUpperCase(),
        vehicleMake,
        vehicleModel,
        vehicleColor: vehicleColor.trim() || null,
        rating: 0,
        totalRatings: 0,
        isOnline: false,
        verificationStatus: 'pending',
        documents: JSON.stringify({ profileId, licenseId, prdpId, vehicleRegId, policeId }),
        createdAt: new Date().toISOString(),
      });
      Alert.alert('Application submitted! 🎉', 'We\'ll review your application within 1–2 business days.');
      router.replace('/driver/meter/dashboard' as any);
    } catch(error: any) {
    console.error('Registration error:', error);
      Alert.alert('Error', 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Meter Taxi Driver" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🚖</Text>
          <Text style={styles.heroTitle}>Register as Meter Taxi Driver</Text>
          <Text style={styles.heroSub}>Accept on-demand ride requests and get paid digitally.</Text>
        </View>

        {/* Progress */}
        <Card style={styles.progressCard}>
          <View style={styles.progressTop}>
            <Text style={styles.progressTitle}>Documents uploaded</Text>
            <Text style={styles.progressCount}>{docsUploaded} / 5</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>
        </Card>

        {/* Personal details */}
        <Text style={styles.sectionLabel}>PERSONAL DETAILS</Text>
        <Card style={styles.formCard}>
          {[
            { label: 'Full Name', value: fullName, set: setFullName, placeholder: 'Your full name', required: true },
            { label: 'Phone Number', value: phone, set: setPhone, placeholder: '0712345678', required: true, keyboard: 'phone-pad' as const },
          ].map(f => (
            <View key={f.label}>
              <Text style={styles.fieldLabel}>{f.label} {f.required && <Text style={styles.req}>*</Text>}</Text>
              <TextInput style={styles.input} value={f.value} onChangeText={f.set} placeholder={f.placeholder} placeholderTextColor={COLORS.textMuted} keyboardType={f.keyboard ?? 'default'} />
            </View>
          ))}
        </Card>

        {/* Vehicle details */}
        <Text style={styles.sectionLabel}>VEHICLE DETAILS</Text>
        <Card style={styles.formCard}>
          <Text style={styles.fieldLabel}>Registration Number <Text style={styles.req}>*</Text></Text>
          <TextInput style={styles.input} value={vehicleReg} onChangeText={t => setVehicleReg(t.toUpperCase())} placeholder="e.g. ABC123GP" placeholderTextColor={COLORS.textMuted} autoCapitalize="characters" />

          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Make <Text style={styles.req}>*</Text></Text>
              <TextInput style={styles.input} value={vehicleMake} onChangeText={setVehicleMake} placeholder="Toyota" placeholderTextColor={COLORS.textMuted} />
            </View>
            <View style={{ width: SPACING.sm }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Model <Text style={styles.req}>*</Text></Text>
              <TextInput style={styles.input} value={vehicleModel} onChangeText={setVehicleModel} placeholder="Corolla" placeholderTextColor={COLORS.textMuted} />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Colour <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput style={[styles.input, { marginBottom: 0 }]} value={vehicleColor} onChangeText={setVehicleColor} placeholder="e.g. White" placeholderTextColor={COLORS.textMuted} />
        </Card>

        {/* Documents */}
        <Text style={styles.sectionLabel}>REQUIRED DOCUMENTS</Text>
        <Card style={{ padding: 0, overflow: 'hidden', marginBottom: SPACING.md }}>
          {[
            { label: 'Profile Photo', uri: profileImageUri, set: setProfileImageUri },
            { label: "Driver's Licence", uri: licenseImageUri, set: setLicenseImageUri },
            { label: 'PrDP (Professional Driving Permit)', uri: prdpImageUri, set: setPrdpImageUri },
            { label: 'Vehicle Registration Document', uri: vehicleRegImageUri, set: setVehicleRegImageUri },
            { label: 'Police Clearance Certificate', uri: policeClearanceUri, set: setPoliceClearanceUri },
          ].map((doc, idx, arr) => (
            <View key={doc.label}>
              <DocField label={doc.label} uri={doc.uri} onPick={() => pickImage(doc.set)} />
              {idx < arr.length - 1 && <View style={styles.docDivider} />}
            </View>
          ))}
        </Card>

        <Card style={styles.noteCard}>
          <Text style={styles.noteText}>📋 Applications are reviewed within 1–2 business days. You'll receive a notification once approved.</Text>
        </Card>

        <PrimaryButton label="Submit Application" onPress={handleSubmit} loading={loading} />
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
  heroSub: { ...TYPOGRAPHY.body, textAlign: 'center', color: COLORS.textMuted, lineHeight: 22, paddingHorizontal: SPACING.md },

  progressCard: { marginBottom: SPACING.md },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs },
  progressTitle: { ...TYPOGRAPHY.bodyBold, fontSize: 14 },
  progressCount: { ...TYPOGRAPHY.bodyBold, color: COLORS.primary },
  progressTrack: { height: 8, backgroundColor: COLORS.border, borderRadius: RADIUS.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: RADIUS.full },

  sectionLabel: { ...TYPOGRAPHY.label, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.xs },
  formCard: { marginBottom: SPACING.md },
  fieldLabel: { ...TYPOGRAPHY.label, marginBottom: 6, marginTop: SPACING.xs },
  req: { color: COLORS.error },
  optional: { fontWeight: '400', color: COLORS.textMuted },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 15, color: COLORS.textPrimary, marginBottom: SPACING.xs,
  },
  twoCol: { flexDirection: 'row' },

  docField: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.sm, backgroundColor: COLORS.surface,
  },
  docFieldDone: { backgroundColor: COLORS.primaryLight },
  docIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  docIconWrapDone: { backgroundColor: COLORS.primary },
  docLabel: { ...TYPOGRAPHY.bodyBold, fontSize: 14 },
  docSub: { ...TYPOGRAPHY.caption, marginTop: 2 },
  docPreview: { width: 44, height: 44, borderRadius: RADIUS.sm },
  docDivider: { height: 1, backgroundColor: COLORS.border },

  noteCard: { backgroundColor: COLORS.accentLight, marginBottom: SPACING.md },
  noteText: { ...TYPOGRAPHY.body, fontSize: 13, lineHeight: 22 },
});