// app/transport/station-select.tsx
import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '@/components/ui';
import { COLORS, SPACING, RADIUS } from '@/constants/themes';
// FIX: import allStops from the old gtfsRouter which exports it,
// NOT from transportData (separate file) or the new gtfsRouter (doesn't export it).
// If you've migrated to the new gtfsRouter (doc 29), export allStops from there too.
import { allStops } from '@/services/gtfsRouter';
import type { TransportStop } from '@/services/transport/types';

export default function StationSelectScreen() {
  const { provider } = useLocalSearchParams<{ provider: string }>();
  const [stations, setStations] = useState<TransportStop[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!provider) { setLoading(false); return; }
    // FIX: allStops items have a 'system' field — filter by it
    const filtered = allStops
      .filter(s => s.system === provider)
      .map(s => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon }));
    setStations(filtered);
    setLoading(false);
  }, [provider]);

  const selectStation = (station: TransportStop) => {
    router.push({
      pathname: '/transport/tap',
      params: {
        // FIX: normalise provider id — 'rea_vaya' passed from some screens → 'reavaya'
        provider:    provider === 'rea_vaya' ? 'reavaya' : provider,
        stationId:   station.id,
        stationName: station.name,
      },
    });
  };

  const providerLabel: Record<string, string> = {
    gautrain:  'Gautrain',
    reavaya:   'Rea Vaya',
    rea_vaya:  'Rea Vaya',
    metrorail: 'Metrorail',
    metrobus:  'Metrobus',
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title={`Select ${providerLabel[provider ?? ''] ?? provider ?? ''} Station`}
        onBack={() => router.back()}
      />
      <FlatList
        data={stations}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => selectStation(item)} activeOpacity={0.7}>
            <Text style={styles.stationName}>{item.name}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {provider ? `No stations found for ${providerLabel[provider] ?? provider}` : 'No provider specified'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: COLORS.background },
  list:      { paddingBottom: 48 },
  row: {
    flexDirection:  'row' as const,
    alignItems:     'center' as const,
    justifyContent: 'space-between' as const,
    padding:        SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor:   COLORS.surface,
  },
  stationName: { fontSize: 16, fontWeight: '500' as const, color: COLORS.textPrimary ?? '#1E293B', flex: 1 },
  chevron:     { fontSize: 22, color: COLORS.textMuted, fontWeight: '300' as const },
  empty:       { alignItems: 'center' as const, paddingVertical: 60 },
  emptyText:   { color: COLORS.textMuted, fontSize: 15 },
};