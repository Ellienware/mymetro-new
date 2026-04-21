import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { GAUTRAIN_STATIONS, getGautrainFare } from '../../constants/gautrainFares';
import { stops as allStops, getNextDepartures, getStopById } from '../../services/gtfs';
import type { GTFSStop, GTFSTrip, GTFSRoute } from '../../types';

// Local interface for departures
interface Departure {
  trip: GTFSTrip;
  departureTime: string;
  route: GTFSRoute;
}

// Helper to convert a stop name to a station key (removes " Station" suffix)
const toStationKey = (stopName: string): string => {
  return stopName.replace(/\sStation$/, '').trim();
};

export default function GautrainStopDetailScreen() {
  const { stopId } = useLocalSearchParams<{ stopId: string }>();
  const [stop, setStop] = useState<GTFSStop | null>(null);
  const [stationName, setStationName] = useState<string>('');
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [loading, setLoading] = useState(true);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    const load = async () => {
      // Try to fetch the stop by GTFS ID first
      let gtfsStop: GTFSStop | undefined = getStopById(stopId);
      if (!gtfsStop) {
        // If not found, treat stopId as a station name and try to find a matching stop
        const candidate = allStops.find(s => toStationKey(s.stop_name) === stopId);
        if (candidate) gtfsStop = candidate;
      }

      if (gtfsStop) {
        setStop(gtfsStop);
        const key = toStationKey(gtfsStop.stop_name);
        setStationName(key);

        // Try to fetch real‑time departures
        try {
          const today = new Date().getDay() || 7;
          const now = new Date().toTimeString().split(' ')[0];
          const deps = getNextDepartures(gtfsStop.stop_id, today, now);
          setDepartures(deps);
        } catch (err) {
          console.warn('Failed to fetch departures', err);
          setUseFallback(true);
        }
      } else {
        // No GTFS stop found – treat stopId as a station name directly
        setStationName(stopId);
        setUseFallback(true);
      }
      setLoading(false);
    };
    load();
  }, [stopId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Helper to render the common fare and ticket sections
  const renderFareAndTicket = () => (
    <>
      <Text style={styles.sectionTitle}>Fares from {stationName}</Text>
      <View style={styles.fareContainer}>
        {GAUTRAIN_STATIONS.filter(s => s !== stationName).slice(0, 6).map(to => (
          <View key={to} style={styles.fareRow}>
            <Text style={styles.stationName}>{to}</Text>
            <Text style={styles.fare}>R{getGautrainFare(stationName, to, true)}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity
        style={styles.buyButton}
        onPress={() => router.push({
          pathname: '/gautrain/buy-ticket',
          params: { from: stationName }
        })}
      >
        <Text style={styles.buyButtonText}>Buy ticket from {stationName}</Text>
      </TouchableOpacity>
    </>
  );

  // If we have a GTFS stop but departures failed, show a simplified version with fares + button
  if (stop && useFallback) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{stop.stop_name}</Text>
          <View style={{ width: 50 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {renderFareAndTicket()}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // No GTFS stop at all – fallback to station info only
  if (!stop) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{stationName} Station</Text>
          <View style={{ width: 50 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>About this station</Text>
          <Text style={styles.info}>
            {stationName} is one of the 10 Gautrain stations. Fares are calculated based on distance and peak/off‑peak times.
          </Text>
          {renderFareAndTicket()}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // GTFS stop with departures available – show both
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{stop.stop_name}</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Next departures</Text>
        {departures.length === 0 ? (
          <Text style={styles.noData}>No upcoming departures</Text>
        ) : (
          <FlatList
            data={departures}
            keyExtractor={(item, idx) => idx.toString()}
            renderItem={({ item }) => (
              <View style={styles.departureRow}>
                <Text style={styles.routeShort}>{item.route.route_short_name}</Text>
                <Text style={styles.time}>{item.departureTime}</Text>
              </View>
            )}
            scrollEnabled={false}
          />
        )}
        {renderFareAndTicket()}
      </ScrollView>
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
  content: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, marginTop: 16 },
  info: { fontSize: 16, color: '#666', lineHeight: 22, marginBottom: 8 },
  noData: { fontSize: 16, color: '#666', fontStyle: 'italic', marginBottom: 16 },
  departureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  routeShort: { fontSize: 16, fontWeight: '500', color: COLORS.primary },
  time: { fontSize: 16, color: '#000' },
  fareContainer: { marginTop: 8 },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  stationName: { fontSize: 16, fontWeight: '500' },
  fare: { fontSize: 16, fontWeight: '600', color: COLORS.primary },
  buyButton: {
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
  },
  buyButtonText: { color: 'white', fontWeight: '600', fontSize: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});