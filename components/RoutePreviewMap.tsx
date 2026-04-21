// components/RoutePreviewMap.tsx
import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { decodePolyline } from "@/utils/decodePolyline";

interface RoutePreviewMapProps {
  legs: any[];
}

export const RoutePreviewMap = ({ legs }: RoutePreviewMapProps) => {
  // Extract all coordinates from legs
  const coordinates = useMemo(() => {
    const coords: { latitude: number; longitude: number }[] = [];
    for (const leg of legs) {
      // If leg has coordinates array directly (from walking routes)
      if (leg.coordinates && Array.isArray(leg.coordinates)) {
        coords.push(...leg.coordinates);
      } 
      // If leg has legGeometry.points (OTP format)
      else if (leg.legGeometry?.points) {
        const decoded = decodePolyline(leg.legGeometry.points);
        coords.push(...decoded);
      }
      // If leg is a transit leg (no geometry), skip
    }
    return coords;
  }, [legs]);

  // Compute region to fit all coordinates
  const region = useMemo(() => {
    if (coordinates.length === 0) return null;
    const lats = coordinates.map((c) => c.latitude);
    const lngs = coordinates.map((c) => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: maxLat - minLat + 0.05,
      longitudeDelta: maxLng - minLng + 0.05,
    };
  }, [coordinates]);

  if (!region || coordinates.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.placeholder}><Text>No route preview available</Text></View>
      </View>
    );
  }

  // Find first and last non‑walk legs for markers (or use start/end of route)
  const startPoint = legs[0]?.from;
  const endPoint = legs[legs.length - 1]?.to;

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={region}>
        <Polyline coordinates={coordinates} strokeWidth={4} strokeColor="#1E40AF" />

        {startPoint && (
          <Marker
            coordinate={{ latitude: startPoint.lat, longitude: startPoint.lon }}
            title="Start"
            pinColor="green"
          />
        )}

        {endPoint && (
          <Marker
            coordinate={{ latitude: endPoint.lat, longitude: endPoint.lon }}
            title="Destination"
            pinColor="red"
          />
        )}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { height: 250, borderRadius: 12, overflow: "hidden", margin: 16 },
  map: { flex: 1 },
  placeholder: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#E2E8F0" },
});