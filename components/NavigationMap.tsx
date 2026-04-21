// components/NavigationMap.tsx
import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import { decodePolyline } from "@/utils/decodePolyline";

interface NavigationMapProps {
  legs: any[];
  onLegSelect?: (index: number) => void;
}

export const NavigationMap = ({ legs, onLegSelect }: NavigationMapProps) => {
  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [highlightedLegIndex, setHighlightedLegIndex] = useState<number | null>(null);
  const [followUser, setFollowUser] = useState(true);

  // 1. Build full route coordinates from all legs
  const routeCoordinates = legs.flatMap((leg) =>
    leg.legGeometry?.points ? decodePolyline(leg.legGeometry.points) : []
  );

  // 2. Live location tracking
  useEffect(() => {
    let subscription: any;
    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 5,
        },
        (loc) => {
          const coords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setUserLocation(coords);
          if (followUser && mapRef.current) {
            mapRef.current.animateCamera({ center: coords, zoom: 15 });
          }
        }
      );
    };
    startTracking();
    return () => subscription?.remove();
  }, [followUser]);

  // 3. Fit map to show the whole route when it loads
  useEffect(() => {
    if (routeCoordinates.length > 0 && mapRef.current) {
      mapRef.current.fitToCoordinates(routeCoordinates, {
        edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
        animated: true,
      });
    }
  }, [routeCoordinates]);

  // 4. Helper to get coordinates for a single leg
  const getLegCoordinates = (leg: any) => {
    return leg.legGeometry?.points ? decodePolyline(leg.legGeometry.points) : [];
  };

  const handleMarkerPress = (index: number) => {
    setHighlightedLegIndex(index);
    if (onLegSelect) onLegSelect(index);
  };

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.map}>
        {/* User's live location */}
        {userLocation && (
          <Marker coordinate={userLocation} title="You" pinColor="#3B82F6">
            <View style={styles.userMarker}>
              <Text style={styles.userMarkerText}>📍</Text>
            </View>
          </Marker>
        )}

        {/* Full route (grey) */}
        {routeCoordinates.length > 0 && (
          <Polyline coordinates={routeCoordinates} strokeWidth={4} strokeColor="#94A3B8" />
        )}

        {/* Highlighted leg (blue) */}
        {highlightedLegIndex !== null && legs[highlightedLegIndex] && (
          <Polyline
            coordinates={getLegCoordinates(legs[highlightedLegIndex])}
            strokeWidth={6}
            strokeColor="#1E40AF"
          />
        )}

        {/* Stop markers (from points of each leg) */}
        {legs.map((leg, idx) => {
          const fromCoord = { latitude: leg.from.lat, longitude: leg.from.lon };
          return (
            <Marker
              key={`start-${idx}`}
              coordinate={fromCoord}
              title={leg.from.name}
              onPress={() => handleMarkerPress(idx)}
            />
          );
        })}
        {/* Destination marker (last leg's to point) */}
        {legs.length > 0 && (
          <Marker
            coordinate={{ latitude: legs[legs.length - 1].to.lat, longitude: legs[legs.length - 1].to.lon }}
            title="Destination"
            pinColor="red"
          />
        )}
      </MapView>

      {/* Follow user toggle button */}
      <TouchableOpacity style={styles.followButton} onPress={() => setFollowUser(!followUser)}>
        <Text style={styles.followButtonText}>{followUser ? "🔍 Free" : "📍 Follow"}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  userMarker: {
    backgroundColor: "#3B82F6",
    borderRadius: 20,
    padding: 4,
    borderWidth: 2,
    borderColor: "white",
  },
  userMarkerText: { fontSize: 16 },
  followButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "white",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    elevation: 3,
  },
  followButtonText: { fontWeight: "600", color: "#1E40AF" },
});