import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { COLORS } from '@/constants/theme';
import { databases, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { TaxiRoute } from '@/types';
import { DriverProfile } from '@/types/appwrite';
import { Query, ID } from 'appwrite';


export default function DriverSelectRouteScreen() {
  const { user } = useUser();
  const [routes, setRoutes] = useState<TaxiRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [useCustomFare, setUseCustomFare] = useState(false);
  const [customFare, setCustomFare] = useState('');
  const [usePerKm, setUsePerKm] = useState(false);
  const [farePerKm, setFarePerKm] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<TaxiRoute | null>(null);

  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    try {
      const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.TAXI_ROUTES);
      setRoutes(res.documents as TaxiRoute[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const startRide = async (route: TaxiRoute) => {
  try {
    // Get driver profile
    const profiles = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.DRIVER_PROFILES,
      [Query.equal('userId', user!.id)]
    );
    if (profiles.documents.length === 0) throw new Error('Driver profile not found');
    const profile = profiles.documents[0] as DriverProfile;

    // Prepare ride data
    const rideData: any = {
      driverId: user!.id,
      vehicleType: profile.vehicleType,
      vehicleReg: profile.vehicleReg,
      capacity: profile.capacity,
      availableSeats: profile.capacity,
      routeId: route.$id,
      currentLocation: JSON.stringify({ latitude: -26.204, longitude: 28.047 }),
      heading: 0,
      status: 'active',
      geohash: '',
      lastUpdate: new Date().toISOString(),
      etaToNextStop: 5,
    };

    // Fare settings
    if (useCustomFare) {
      const fare = parseFloat(customFare);
      if (isNaN(fare) || fare <= 0) {
        Alert.alert('Invalid fare', 'Please enter a valid custom fare');
        return;
      }
      rideData.fareType = 'custom';
      rideData.customFare = fare;
    } else if (usePerKm) {
      const perKm = parseFloat(farePerKm);
      if (isNaN(perKm) || perKm <= 0) {
        Alert.alert('Invalid rate', 'Please enter a valid per‑km rate');
        return;
      }
      rideData.fareType = 'per_km';
      rideData.farePerKm = perKm;
    } else {
      rideData.fareType = 'route';
    }

    // Create ride
    const ride = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.SHARED_TAXI_RIDES,
      ID.unique(),
      rideData
    );

    // Update driver profile
    await databases.updateDocument(DATABASE_ID, COLLECTIONS.DRIVER_PROFILES, profile.$id, {
      currentRideId: ride.$id,
      isAvailable: false,
    });

    // Close modal and navigate
    setSelectedRoute(null);
    router.push({ pathname: '/driver/minibus-taxi/active-ride', params: { rideId: ride.$id } });
  } catch (error: any) {
    console.error('Error starting ride:', error);
    Alert.alert('Error', error.message || 'Failed to start ride');
  }
};

  if (loading) return <View><Text>Loading routes...</Text></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Route</Text>
        <View style={{ width: 50 }} />
      </View>
      <FlatList
        data={routes}
        keyExtractor={(item) => item.$id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.routeCard} onPress={() => setSelectedRoute(item)}>
            <Text style={styles.routeName}>{item.name}</Text>
            <Text>{item.fromRank} → {item.toRank}</Text>
            <Text>{item.distanceKm} km</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
      />

      {selectedRoute && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Fare for {selectedRoute.name}</Text>
            <View style={styles.option}>
              <Text>Use default route fare</Text>
              <Switch
                value={!useCustomFare && !usePerKm}
                onValueChange={(val) => {
                  if (val) {
                    setUseCustomFare(false);
                    setUsePerKm(false);
                  }
                }}
              />
            </View>
            <View style={styles.option}>
              <Text>Set custom fixed fare</Text>
              <Switch value={useCustomFare} onValueChange={setUseCustomFare} />
            </View>
            {useCustomFare && (
              <TextInput
                style={styles.input}
                placeholder="Fixed fare amount (R)"
                value={customFare}
                onChangeText={setCustomFare}
                keyboardType="numeric"
              />
            )}
            <View style={styles.option}>
              <Text>Per‑km rate (e‑hailing)</Text>
              <Switch value={usePerKm} onValueChange={setUsePerKm} />
            </View>
            {usePerKm && (
              <TextInput
                style={styles.input}
                placeholder="Rate per km (R)"
                value={farePerKm}
                onChangeText={setFarePerKm}
                keyboardType="numeric"
              />
            )}
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setSelectedRoute(null)}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.startButton} onPress={() => startRide(selectedRoute)}>
                <Text style={styles.startButtonText}>Start Ride</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: { padding: 5 },
  backText: { fontSize: 16, color: COLORS.primary },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  list: { padding: 20 },
  routeCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  routeName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cancelButton: {
    padding: 10,
    backgroundColor: '#ccc',
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  startButton: {
    padding: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  startButtonText: { color: 'white', fontWeight: '600' },
});