/// app/driver/taxi/minibus/register.tsx
// Uses saasBridge service instead of direct Appwrite queries
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TextInput,
  TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from '@/lib/appwrite';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { getDriverByIdNumber, getDriverPrimaryVehicle, getTenants } from '@/services/saasBridge';
import { ScreenHeader, PrimaryButton, Card, LoadingScreen } from '@/components/ui';

type Step = 'form' | 'verifying' | 'found';

export default function MinibusDriverRegisterScreen() {
  const { user } = useUser();
  const [idNumber, setIdNumber] = useState('');
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [foundDriver, setFoundDriver] = useState<{ driver: any; vehicle: any } | null>(null);

  useEffect(() => {
    getTenants()
      .then(setTenants)
      .catch(() => Alert.alert('Error', 'Could not load associations'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (!idNumber.trim()) { Alert.alert('Missing ID', 'Please enter your ID number.'); return; }
    if (!selectedTenantId) { Alert.alert('Select Association', 'Please select your association.'); return; }

    setSubmitting(true);
    setStep('verifying');
    try {
      const driverData = await getDriverByIdNumber(idNumber.trim(), selectedTenantId);
      const vehicle = await getDriverPrimaryVehicle(driverData.driverId);

      // Upsert into myMetro TAXI_DRIVERS
      const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.TAXI_DRIVERS, [
        Query.equal('userId', user!.id),
      ]);
      const payload = {
        driverId: driverData.driverId,
        vehicleId: vehicle.$id,
        associationId: selectedTenantId,
        idNumber: idNumber.trim(),
        fullName: `${driverData.firstName} ${driverData.lastName}`,
        phone: driverData.phone,
      };
      if (existing.documents.length > 0) {
        await databases.updateDocument(DATABASE_ID, COLLECTIONS.TAXI_DRIVERS, existing.documents[0].$id, payload);
      } else {
        await databases.createDocument(DATABASE_ID, COLLECTIONS.TAXI_DRIVERS, ID.unique(), {
          userId: user!.id,
          ...payload,
          createdAt: new Date().toISOString(),
        });
      }

      setFoundDriver({ driver: driverData, vehicle });
      setStep('found');
    } catch (error: any) {
      Alert.alert('Verification Failed', error.message || 'Could not verify your details. Please check your ID number and association.');
      setStep('form');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTenant = tenants.find(t => t.$id === selectedTenantId);

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Driver Registration" onBack={() => router.back()} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.heroEmoji}>🚌</Text>
            <Text style={styles.heroTitle}>Minibus Taxi Driver</Text>
            <Text style={styles.heroSub}>
              Verify your details with your association to link your vehicle and access the driver dashboard.
            </Text>
          </View>

          {/* How it works */}
          <Card style={styles.howCard}>
            <Text style={styles.howTitle}>How it works</Text>
            {[
              { n: '1', text: 'Enter your SA ID number' },
              { n: '2', text: 'Select your taxi association' },
              { n: '3', text: 'We verify your record & link your vehicle' },
            ].map(s => (
              <View key={s.n} style={styles.howRow}>
                <View style={styles.howNum}>
                  <Text style={styles.howNumText}>{s.n}</Text>
                </View>
                <Text style={styles.howText}>{s.text}</Text>
              </View>
            ))}
          </Card>

          {/* Success state */}
          {step === 'found' && foundDriver && (
            <Card style={styles.successCard}>
              <Text style={styles.successIcon}>✅</Text>
              <Text style={styles.successTitle}>Driver Verified!</Text>
              <View style={styles.successDetails}>
                {[
                  { label: 'Name', value: foundDriver.driver.firstName + ' ' + foundDriver.driver.lastName },
                  { label: 'Vehicle', value: `${foundDriver.vehicle.registrationNumber} · ${foundDriver.vehicle.make} ${foundDriver.vehicle.model}` },
                  { label: 'Association', value: selectedTenant?.name ?? selectedTenantId },
                  { label: 'Capacity', value: `${foundDriver.vehicle.capacity} seats` },
                ].map(row => (
                  <View key={row.label} style={styles.successRow}>
                    <Text style={styles.successLabel}>{row.label}</Text>
                    <Text style={styles.successValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
              <PrimaryButton
                label="Go to Dashboard →"
                onPress={() => router.replace('/driver/minibus-taxi/dashboard')}
                style={{ marginTop: SPACING.md }}
              />
            </Card>
          )}

          {/* Form */}
          {step !== 'found' && (
            <>
              <Text style={styles.sectionLabel}>YOUR DETAILS</Text>
              <Card style={styles.formCard}>
                <Text style={styles.fieldLabel}>SA ID Number <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 8001015000088"
                  placeholderTextColor={COLORS.textMuted}
                  value={idNumber}
                  onChangeText={setIdNumber}
                  keyboardType="numeric"
                  maxLength={13}
                />
                {idNumber.length > 0 && idNumber.length < 13 && (
                  <Text style={styles.inputHint}>{13 - idNumber.length} more digits needed</Text>
                )}
                {idNumber.length === 13 && (
                  <Text style={styles.inputValid}>✓ ID number complete</Text>
                )}
              </Card>

              <Text style={styles.sectionLabel}>
                YOUR ASSOCIATION{' '}
                <Text style={styles.sectionNote}>({tenants.length} active)</Text>
              </Text>

              {tenants.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No active associations found. Please contact support.</Text>
                </Card>
              ) : (
                <View style={styles.tenantsGrid}>
                  {tenants.map(tenant => {
                    const selected = selectedTenantId === tenant.$id;
                    return (
                      <TouchableOpacity
                        key={tenant.$id}
                        style={[styles.tenantCard, selected && styles.tenantCardSelected]}
                        onPress={() => setSelectedTenantId(tenant.$id)}
                        activeOpacity={0.82}
                      >
                        <View style={[styles.tenantRadio, selected && styles.tenantRadioSelected]}>
                          {selected && <View style={styles.tenantRadioDot} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.tenantName, selected && styles.tenantNameSelected]}>
                            {tenant.name}
                          </Text>
                          {tenant.region && (
                            <Text style={styles.tenantRegion}>📍 {tenant.region}</Text>
                          )}
                        </View>
                        {selected && (
                          <View style={styles.tenantCheck}>
                            <Text style={styles.tenantCheckText}>✓</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <PrimaryButton
                label={step === 'verifying' ? 'Verifying...' : 'Verify & Continue'}
                onPress={handleSubmit}
                loading={submitting}
                disabled={!idNumber.trim() || !selectedTenantId || idNumber.length !== 13}
                style={styles.submitBtn}
              />

              <Text style={styles.footerNote}>
                Your details are verified against your association's records. Only registered drivers can proceed.
              </Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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

  howCard: { marginBottom: SPACING.md },
  howTitle: { ...TYPOGRAPHY.bodyBold, marginBottom: SPACING.sm },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  howNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  howNumText: { fontSize: 12, fontWeight: '800', color: COLORS.primaryDark },
  howText: { ...TYPOGRAPHY.body, fontSize: 13 },

  successCard: { alignItems: 'center', padding: SPACING.lg, marginBottom: SPACING.md },
  successIcon: { fontSize: 48, marginBottom: SPACING.sm },
  successTitle: { ...TYPOGRAPHY.h2, color: COLORS.success, marginBottom: SPACING.md },
  successDetails: { width: '100%', backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: SPACING.md, gap: 10 },
  successRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  successLabel: { ...TYPOGRAPHY.caption },
  successValue: { ...TYPOGRAPHY.bodyBold, fontSize: 13, textAlign: 'right', flex: 1, marginLeft: SPACING.md },

  sectionLabel: { ...TYPOGRAPHY.label, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.xs },
  sectionNote: { fontWeight: '400', textTransform: 'none', letterSpacing: 0, color: COLORS.textMuted },

  formCard: { marginBottom: SPACING.md },
  fieldLabel: { ...TYPOGRAPHY.label, marginBottom: 6 },
  required: { color: COLORS.error },
  input: {
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 18,
    color: COLORS.textPrimary, letterSpacing: 2,
  },
  inputHint: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  inputValid: { fontSize: 12, color: COLORS.success, fontWeight: '600', marginTop: 4 },

  tenantsGrid: { gap: SPACING.xs, marginBottom: SPACING.md },
  tenantCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1.5, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  tenantCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  tenantRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  tenantRadioSelected: { borderColor: COLORS.primary },
  tenantRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  tenantName: { ...TYPOGRAPHY.bodyBold, fontSize: 14 },
  tenantNameSelected: { color: COLORS.primaryDark },
  tenantRegion: { ...TYPOGRAPHY.caption, marginTop: 2 },
  tenantCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  tenantCheckText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  emptyCard: { alignItems: 'center', padding: SPACING.lg, marginBottom: SPACING.md },
  emptyText: { ...TYPOGRAPHY.body, color: COLORS.textMuted, textAlign: 'center' },

  submitBtn: { marginBottom: SPACING.sm },
  footerNote: { ...TYPOGRAPHY.caption, textAlign: 'center', color: COLORS.textMuted, lineHeight: 18 },
});