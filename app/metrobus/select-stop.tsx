import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { ALL_STOPS } from '../../constants/allStops';
import { AppwriteService } from '../../services/appwriteService';
import { COLORS } from '../../constants/theme';

export default function SelectStopScreen() {
  const { user } = useUser();
  const { action, tripId } = useLocalSearchParams<{ action: 'in' | 'out'; tripId?: string }>();
  const [selectedStop, setSelectedStop] = useState<any>(null);
  const busStops = ALL_STOPS.filter(s => s.mode === 'bus');

  const handleSelect = async () => {
    if (!selectedStop) return;
    try {
      if (action === 'in') {
        await AppwriteService.tapIn(user!.id, selectedStop.id, selectedStop.name);
        Alert.alert('Tapped In', `Boarded at ${selectedStop.name}`);
      } else {
        await AppwriteService.tapOut(user!.id, tripId!, selectedStop.id, selectedStop.name);
        Alert.alert('Tapped Out', `Exited at ${selectedStop.name}`);
      }
      router.back();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {action === 'in' ? 'Select boarding stop' : 'Select alighting stop'}
      </Text>
      <FlatList
        data={busStops}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.stopItem, selectedStop?.id === item.id && styles.selected]}
            onPress={() => setSelectedStop(item)}
          >
            <Text style={styles.stopName}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.confirmButton} onPress={handleSelect}>
        <Text style={styles.confirmText}>Confirm</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  stopItem: { padding: 15, borderBottomWidth: 1, borderColor: '#ccc' },
  selected: { backgroundColor: '#e0e0ff' },
  stopName: { fontSize: 16 },
  confirmButton: { marginTop: 20, backgroundColor: COLORS.primary, padding: 15, borderRadius: 8 },
  confirmText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
});