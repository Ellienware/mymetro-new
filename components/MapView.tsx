import { useRef, forwardRef, useImperativeHandle } from "react"
import { StyleSheet, View, Text } from "react-native"
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from "react-native-maps"
import type { Station, Route, ActiveTaxiTrip } from "../types"

interface MapViewProps {
  stations: Station[]
  routes: Route[]
  selectedRoutes: string[]
  initialRegion: Region
  showUserLocation?: boolean
  onStationPress?: (station: Station) => void
  userLocation?: { latitude: number; longitude: number } | null

  // Taxi props
  activeTaxiTrips?: ActiveTaxiTrip[]
  onTaxiPress?: (trip: ActiveTaxiTrip) => void
  selectedTaxiTripId?: string | null
}

export interface MapViewRef {
  animateToRegion: (region: Region, duration?: number) => void
}

export const CustomMapView = forwardRef<MapViewRef, MapViewProps>(
  ({
    stations,
    routes,
    selectedRoutes,
    initialRegion,
    showUserLocation = true,
    onStationPress,
    userLocation,
    activeTaxiTrips = [],
    onTaxiPress,
    selectedTaxiTripId,
  }, ref) => {
    const mapRef = useRef<MapView>(null)

    useImperativeHandle(ref, () => ({
      animateToRegion: (region: Region, duration = 1000) => {
        mapRef.current?.animateToRegion(region, duration)
      },
    }))

    const filteredRoutes = routes.filter((route) => selectedRoutes.includes(route.id))

    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
      >
        {/* Route polylines */}
        {filteredRoutes.map((route) => (
          <Polyline key={route.id} coordinates={route.coordinates} strokeColor={route.color} strokeWidth={4} />
        ))}

        {/* Station markers */}
        {stations.map((station) => {
          const routeColor =
            routes.find((route) => route.name === station.line && selectedRoutes.includes(route.id))?.color || "#1E40AF"

          return (
            <Marker
              key={station.id}
              coordinate={station.coordinates}
              title={station.name}
              description={`${station.line} - Zone ${station.zone}`}
              onPress={() => onStationPress?.(station)}
              pinColor={routeColor}
            />
          )
        })}

        {/* Taxi trip markers */}
        {activeTaxiTrips.map((trip) => (
          <Marker
            key={trip.id}
            coordinate={{
              latitude: trip.currentLocation.latitude,
              longitude: trip.currentLocation.longitude,
            }}
            onPress={() => onTaxiPress?.(trip)}
          >
            <View style={[
              styles.taxiMarker,
              trip.isCatchable && styles.catchableMarker,
              selectedTaxiTripId === trip.id && styles.selectedTaxiMarker,
            ]}>
              <View style={styles.taxiIcon}>
                <Text style={styles.taxiIconText}>🚖</Text>
              </View>
            </View>
          </Marker>
        ))}

        {/* Polyline for selected taxi trip */}
        {selectedTaxiTripId && activeTaxiTrips.find(t => t.id === selectedTaxiTripId)?.polyline && (
          <Polyline
            coordinates={activeTaxiTrips.find(t => t.id === selectedTaxiTripId)!.polyline!}
            strokeColor="#00D4AA"
            strokeWidth={5}
            lineDashPattern={[10, 5]}
          />
        )}

        {/* User location marker */}
        {userLocation && (
          <Marker
            coordinate={userLocation}
            title="You are here"
            pinColor="#00D4AA"
          />
        )}
      </MapView>
    )
  },
)

const styles = StyleSheet.create({
  map: {
    width: "100%",
    height: "100%",
  },
  taxiMarker: {
    backgroundColor: "#FFD966",
    borderRadius: 20,
    padding: 4,
    borderWidth: 2,
    borderColor: "#B8860B",
  },
  catchableMarker: {
    backgroundColor: "#90EE90",
    borderColor: "#006400",
  },
  selectedTaxiMarker: {
    borderColor: "#0000FF",
    borderWidth: 3,
    transform: [{ scale: 1.1 }],
  },
  taxiIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taxiIconText: {
    fontSize: 20,
  },
})