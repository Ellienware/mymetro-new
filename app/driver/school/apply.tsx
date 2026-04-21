// app/driver/school/apply.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TextInput,
  TouchableOpacity, Alert, ScrollView, Image, ActivityIndicator,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from '@/lib/appwrite';
import { uploadService } from '@/services/upload-service';
import { ScreenHeader, PrimaryButton, Card, LoadingScreen } from '@/components/ui';

interface DocUploadFieldProps {
  label: string;
  required?: boolean;
  uri: string | null;
  onPick: () => void;
}

function DocUploadField({ label, required, uri, onPick }: DocUploadFieldProps) {
  return (
    <TouchableOpacity style={[styles.uploadField, uri && styles.uploadFieldDone]} onPress={onPick} activeOpacity={0.8}>
      <View style={styles.uploadLeft}>
        <View style={[styles.uploadIconWrap, uri && styles.uploadIconWrapDone]}>
          <Text style={styles.uploadIcon}>{uri ? '✓' : '📄'}</Text>
        </View>
        <View>
          <Text style={styles.uploadLabel}>{label}{required && <Text style={styles.required}> *</Text>}</Text>
          <Text style={styles.uploadSub}>{uri ? 'Document selected' : 'Tap to upload'}</Text>
        </View>
      </View>
      {uri && <Image source={{ uri }} style={styles.uploadPreview} />}
    </TouchableOpacity>
  );
}

export default function SchoolDriverApplicationScreen() {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState('');
  const [driverLicense, setDriverLicense] = useState('');
  const [pdpNumber, setPdpNumber] = useState('');
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [licenseImageUri, setLicenseImageUri] = useState<string | null>(null);
  const [pdpImageUri, setPdpImageUri] = useState<string | null>(null);
  const [policeClearanceUri, setPoliceClearanceUri] = useState<string | null>(null);

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
    if (!fullName.trim() || !phone.trim() || !driverLicense.trim()) {
      Alert.alert('Missing fields', 'Please fill in all required personal details.');
      return;
    }
    if (!profileImageUri || !licenseImageUri || !policeClearanceUri) {
      Alert.alert('Missing documents', 'Please upload your profile photo, driver\'s licence, and police clearance.');
      return;
    }
    if (pdpNumber.trim() && !pdpImageUri) {
      Alert.alert('Missing document', 'Please upload your PrDP document.');
      return;
    }
    setLoading(true);
    try {
      const uploads: Promise<string>[] = [
        uploadImage(profileImageUri),
        uploadImage(licenseImageUri),
        uploadImage(policeClearanceUri),
      ];
      if (pdpImageUri) uploads.push(uploadImage(pdpImageUri));
      const [profileId, licenseId, policeId, pdpId] = await Promise.all(uploads);

      const documents: any = { profileId, licenseId, policeId };
      if (pdpId) documents.pdpId = pdpId;

      const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_DRIVERS, [
        Query.equal('userId', user!.id),
      ]);
      if (existing.documents.length > 0) {
        await databases.updateDocument(DATABASE_ID, COLLECTIONS.SCHOOL_DRIVERS, existing.documents[0].$id, {
          fullName, phone, driverLicense,
          pdpNumber: pdpNumber.trim() || null,
          documents: JSON.stringify(documents),
          verificationStatus: 'pending',
        });
      } else {
        await databases.createDocument(DATABASE_ID, COLLECTIONS.SCHOOL_DRIVERS, ID.unique(), {
          userId: user!.id,
          fullName, phone,
          email: user?.emailAddresses[0]?.emailAddress,
          driverLicense,
          pdpNumber: pdpNumber.trim() || null,
          documents: JSON.stringify(documents),
          verificationStatus: 'pending',
          rating: 0,
          totalRatings: 0,
          createdAt: new Date().toISOString(),
        });
      }
      Alert.alert('Application submitted! 🎉', 'We\'ll review your documents and notify you once approved.');
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const completedDocs = [profileImageUri, licenseImageUri, policeClearanceUri, pdpNumber ? pdpImageUri : 'skip'].filter(Boolean).length;
  const totalDocs = pdpNumber.trim() ? 4 : 3;
  const progress = Math.min(completedDocs / totalDocs, 1);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Driver Application" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Progress */}
        <Card style={styles.progressCard}>
          <View style={styles.progressTop}>
            <Text style={styles.progressTitle}>Application progress</Text>
            <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressSub}>Upload all required documents to submit</Text>
        </Card>

        {/* Personal info */}
        <Text style={styles.sectionLabel}>PERSONAL DETAILS</Text>
        <Card style={styles.formCard}>
          <Text style={styles.fieldLabel}>Full Name <Text style={styles.required}>*</Text></Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Your full name" placeholderTextColor={COLORS.textMuted} />

          <Text style={styles.fieldLabel}>Phone Number <Text style={styles.required}>*</Text></Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="e.g. 0712345678" placeholderTextColor={COLORS.textMuted} keyboardType="phone-pad" />

          <Text style={styles.fieldLabel}>Driver's Licence Number <Text style={styles.required}>*</Text></Text>
          <TextInput style={styles.input} value={driverLicense} onChangeText={setDriverLicense} placeholder="e.g. 12345678" placeholderTextColor={COLORS.textMuted} />

          <Text style={styles.fieldLabel}>PrDP Number <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={[styles.input, { marginBottom: 0 }]}
            value={pdpNumber} onChangeText={setPdpNumber}
            placeholder="Professional Driving Permit number"
            placeholderTextColor={COLORS.textMuted}
          />
        </Card>

        {/* Documents */}
        <Text style={styles.sectionLabel}>DOCUMENTS</Text>
        <Card style={styles.docsCard}>
          <DocUploadField label="Profile Photo" required uri={profileImageUri} onPick={() => pickImage(setProfileImageUri)} />
          <View style={styles.docDivider} />
          <DocUploadField label="Driver's Licence" required uri={licenseImageUri} onPick={() => pickImage(setLicenseImageUri)} />
          <View style={styles.docDivider} />
          <DocUploadField label="Police Clearance Certificate" required uri={policeClearanceUri} onPick={() => pickImage(setPoliceClearanceUri)} />
          {pdpNumber.trim() && (
            <>
              <View style={styles.docDivider} />
              <DocUploadField label="PrDP Document" required uri={pdpImageUri} onPick={() => pickImage(setPdpImageUri)} />
            </>
          )}
        </Card>

        {/* What happens next */}
        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>What happens next?</Text>
          <Text style={styles.infoStep}>① We review your documents (1-2 business days)</Text>
          <Text style={styles.infoStep}>② You receive an approval notification</Text>
          <Text style={styles.infoStep}>③ Register your vehicle and start offering trips</Text>
        </Card>

        <PrimaryButton label="Submit Application" onPress={handleSubmit} loading={loading} style={styles.submitBtn} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 48 },

  progressCard: { marginBottom: SPACING.md },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
  progressTitle: { ...TYPOGRAPHY.bodyBold },
  progressPct: { ...TYPOGRAPHY.h3, color: COLORS.primary },
  progressTrack: { height: 8, backgroundColor: COLORS.border, borderRadius: RADIUS.full, overflow: 'hidden', marginBottom: SPACING.xs },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: RADIUS.full },
  progressSub: { ...TYPOGRAPHY.caption },

  sectionLabel: { ...TYPOGRAPHY.label, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.xs, marginTop: SPACING.xs },

  formCard: { marginBottom: SPACING.md, gap: 0 },
  fieldLabel: { ...TYPOGRAPHY.label, marginBottom: 6, marginTop: SPACING.sm },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 15, color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  required: { color: COLORS.error },
  optional: { color: COLORS.textMuted, fontWeight: '400' },

  docsCard: { marginBottom: SPACING.md, padding: 0, overflow: 'hidden' },
  uploadField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: SPACING.md, backgroundColor: COLORS.surface,
  },
  uploadFieldDone: { backgroundColor: COLORS.primaryLight },
  uploadLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  uploadIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },
  uploadIconWrapDone: { backgroundColor: COLORS.primary },
  uploadIcon: { fontSize: 18 },
  uploadLabel: { ...TYPOGRAPHY.bodyBold, fontSize: 14 },
  uploadSub: { ...TYPOGRAPHY.caption, marginTop: 2 },
  uploadPreview: { width: 48, height: 48, borderRadius: RADIUS.sm },
  docDivider: { height: 1, backgroundColor: COLORS.border },

  infoCard: { marginBottom: SPACING.md, backgroundColor: COLORS.accentLight },
  infoTitle: { ...TYPOGRAPHY.bodyBold, marginBottom: SPACING.sm },
  infoStep: { ...TYPOGRAPHY.body, marginBottom: SPACING.xs, lineHeight: 22 },

  submitBtn: { marginTop: SPACING.xs },
});