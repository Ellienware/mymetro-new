import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '@/lib/appwrite';
import { COLORS } from '@/constants/theme';
import type { DriverProfile } from '@/types/appwrite';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DriverHubScreen() {
  const { user } = useUser();
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDriverProfile();
  }, []);

  const loadDriverProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const storedId = await AsyncStorage.getItem('driverProfileId');
      if (storedId) {
        try {
          const doc = await databases.getDocument(
            DATABASE_ID,
            COLLECTIONS.DRIVER_PROFILES,
            storedId
          ) as DriverProfile;
          setDriverProfile(doc);
          setLoading(false);
          return;
        } catch (err) {}
      }
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.DRIVER_PROFILES,
        [Query.equal('userId', user.id)]
      );
      if (response.documents.length > 0) {
        const doc = response.documents[0] as DriverProfile;
        setDriverProfile(doc);
        await AsyncStorage.setItem('driverProfileId', doc.$id);
      } else {
        setDriverProfile(null);
      }
    } catch (error) {
      console.error('Failed to load driver profile', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterTaxi = () => router.push('/driver/minibus-taxi/register');
  const handleRegisterSchool = () => router.push('/driver/school/apply');

  const handleReapplyTaxi = () => {
    Alert.alert('Reapply', 'Your previous application was rejected. You can submit a new one.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reapply', onPress: () => router.push('/driver/minibus-taxi/register') },
    ]);
  };

  const handleReapplySchool = () => {
    Alert.alert('Reapply', 'Your previous application was rejected. You can submit a new one.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reapply', onPress: () => router.push('/driver/school/apply') },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!driverProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Driver Hub</Text>
          <Text style={styles.subtitle}>You are not registered as any driver yet.</Text>
          <TouchableOpacity style={styles.registerButton} onPress={handleRegisterTaxi}>
            <Text style={styles.registerButtonText}>Register as Taxi Driver</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.registerButton} onPress={handleRegisterSchool}>
            <Text style={styles.registerButtonText}>Register as School Transport Driver</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const taxiStatus = driverProfile.verificationStatus;
  const schoolStatus = driverProfile.schoolVerificationStatus;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Driver Dashboard</Text>

        {/* Taxi Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🚖 Taxi Driver</Text>
          {taxiStatus === 'pending' && (
            <View style={styles.statusBadgePending}>
              <Text style={styles.statusText}>Pending Review</Text>
            </View>
          )}
          {taxiStatus === 'approved' && (
            <>
              <View style={styles.statusBadgeApproved}>
                <Text style={styles.statusText}>Approved</Text>
              </View>
              <TouchableOpacity
                style={styles.dashboardButton}
                onPress={() => router.push('/driver/minibus-taxi/dashboard')}
              >
                <Text style={styles.dashboardButtonText}>Go to Taxi Dashboard</Text>
              </TouchableOpacity>
            </>
          )}
          {taxiStatus === 'rejected' && (
            <>
              <View style={styles.statusBadgeRejected}>
                <Text style={styles.statusText}>Rejected</Text>
              </View>
              {driverProfile.verificationNotes && (
                <Text style={styles.rejectReason}>Reason: {driverProfile.verificationNotes}</Text>
              )}
              <TouchableOpacity style={styles.reapplyButton} onPress={handleReapplyTaxi}>
                <Text style={styles.reapplyButtonText}>Reapply as Taxi Driver</Text>
              </TouchableOpacity>
            </>
          )}
          {!taxiStatus || taxiStatus === 'inactive' && (
            <TouchableOpacity style={styles.registerButton} onPress={handleRegisterTaxi}>
              <Text style={styles.registerButtonText}>Register as Taxi Driver</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* School Transport Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏫 School Transport Driver</Text>
          {schoolStatus === 'pending' && (
            <View style={styles.statusBadgePending}>
              <Text style={styles.statusText}>Pending Review</Text>
            </View>
          )}
          {schoolStatus === 'approved' && (
            <>
              <View style={styles.statusBadgeApproved}>
                <Text style={styles.statusText}>Approved</Text>
              </View>
              <TouchableOpacity
                style={styles.dashboardButton}
                onPress={() => router.push('/driver/school/hub')}
              >
                <Text style={styles.dashboardButtonText}>Go to School Dashboard</Text>
              </TouchableOpacity>
            </>
          )}
          {schoolStatus === 'rejected' && (
            <>
              <View style={styles.statusBadgeRejected}>
                <Text style={styles.statusText}>Rejected</Text>
              </View>
              {driverProfile.schoolVerificationNotes && (
                <Text style={styles.rejectReason}>Reason: {driverProfile.schoolVerificationNotes}</Text>
              )}
              <TouchableOpacity style={styles.reapplyButton} onPress={handleReapplySchool}>
                <Text style={styles.reapplyButtonText}>Reapply as School Transport Driver</Text>
              </TouchableOpacity>
            </>
          )}
          {(!schoolStatus || schoolStatus === 'inactive') && (
            <TouchableOpacity style={styles.registerButton} onPress={handleRegisterSchool}>
              <Text style={styles.registerButtonText}>Register as School Transport Driver</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 20 },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  statusBadgeApproved: {
    backgroundColor: '#D1FAE5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  statusBadgeRejected: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  statusText: { fontWeight: '600', fontSize: 14 },
  rejectReason: { fontSize: 14, color: '#DC2626', marginBottom: 12 },
  registerButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  registerButtonText: { color: 'white', fontWeight: '600' },
  dashboardButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  dashboardButtonText: { color: 'white', fontWeight: '600' },
  reapplyButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  reapplyButtonText: { color: 'white', fontWeight: '600' },
});