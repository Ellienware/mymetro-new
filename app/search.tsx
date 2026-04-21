import { useState, useRef, useEffect, useMemo } from "react"
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  Animated,
  Dimensions,
  ScrollView,
} from "react-native"
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps"
import { TrainNumberLookup } from "../components/TrainNumberLookup"
import { ALL_STOPS } from "../constants/allStops"
import { GAUTENG_ROUTES } from "../constants/realData"
import { databases, DATABASE_ID, COLLECTIONS, Query } from "../lib/appwrite"
import { COLORS, TYPOGRAPHY, SPACING } from "../constants/theme"

const { width } = Dimensions.get("window")

// Mode icons and labels – must match the `mode` field in ALL_STOPS
const MODES = [
  { id: "all", label: "All", icon: "🌐" },
  { id: "train", label: "Trains", icon: "🚆" },
  { id: "brt", label: "Rea Vaya", icon: "🚍" },
  { id: "bus", label: "Metro Bus", icon: "🚌" },
  { id: "taxi", label: "Taxis", icon: "🚖" },
]

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("stations")
  const [selectedMode, setSelectedMode] = useState("all")
  const [selectedStop, setSelectedStop] = useState<any>(null)
  const [showMap, setShowMap] = useState(false)
  const [taxiRoutes, setTaxiRoutes] = useState<any[]>([])
  const mapViewHeight = useRef(new Animated.Value(0)).current

  // Fetch taxi routes from Appwrite
  useEffect(() => {
    const loadTaxiRoutes = async () => {
      try {
        const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.TAXI_ROUTES)
        setTaxiRoutes(response.documents as any[])
      } catch (error) {
        console.error("Failed to load taxi routes", error)
      }
    }
    loadTaxiRoutes()
  }, [])

  // Combine all route types
  const allRoutes = useMemo(() => {
    // Train routes (from realData)
    const trainRoutes = GAUTENG_ROUTES.map(route => ({
      ...route,
      type: "train",
      name: route.name,
      details: `${route.stations} stations • ${route.duration}`,
    }))

    // Taxi routes (from Appwrite)
    const taxiFormatted = taxiRoutes.map(route => ({
      ...route,
      type: "taxi",
      name: route.name || `${route.fromRank} → ${route.toRank}`,
      details: route.distanceKm ? `${route.distanceKm} km` : "",
    }))

    // Bus routes (if you have a bus route collection, add here)
    // const busRoutes = ...

    return [...trainRoutes, ...taxiFormatted]
  }, [taxiRoutes])

  // Filter stops based on mode and search query
  const filteredStops = useMemo(() => {
    let stops = [...ALL_STOPS]
    if (selectedMode !== "all") {
      stops = stops.filter(stop => stop.mode === selectedMode)
    }
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase()
      stops = stops.filter(
        stop =>
          stop.name.toLowerCase().includes(query) ||
          (stop.lines && stop.lines.some(line => line.toLowerCase().includes(query)))
      )
    }
    stops.sort((a, b) => a.name.localeCompare(b.name))
    return stops
  }, [selectedMode, searchQuery])

  // Filter routes based on search query
  const filteredRoutes = useMemo(() => {
    if (searchQuery.trim() === "") return allRoutes
    const query = searchQuery.toLowerCase()
    return allRoutes.filter(route =>
      route.name.toLowerCase().includes(query) ||
      (route.fromRank?.toLowerCase().includes(query)) ||
      (route.toRank?.toLowerCase().includes(query))
    )
  }, [searchQuery, allRoutes])

  const handleStopPress = (stop: any) => {
    setSelectedStop(stop)
    toggleMapView(true)
  }

  const toggleMapView = (show: boolean) => {
    setShowMap(show)
    Animated.timing(mapViewHeight, {
      toValue: show ? 300 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start()
  }

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case "train": return "🚆"
      case "brt": return "🚍"
      case "bus": return "🚌"
      case "taxi": return "🚖"
      default: return "📍"
    }
  }

  const getRouteIcon = (type: string) => {
    switch (type) {
      case "train": return "🚆"
      case "taxi": return "🚖"
      case "bus": return "🚌"
      default: return "🗺️"
    }
  }

  const renderStopItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.stopItem} onPress={() => handleStopPress(item)}>
      <View style={styles.stopInfo}>
        <View style={styles.stopHeader}>
          <Text style={styles.stopName}>{item.name}</Text>
          <Text style={styles.stopModeIcon}>{getModeIcon(item.mode)}</Text>
        </View>
        <Text style={styles.stopDetails}>
          {item.lines?.join(" • ") || (item.mode === "taxi" ? "Taxi route" : "")}
        </Text>
      </View>
      <Text style={styles.arrow}>→</Text>
    </TouchableOpacity>
  )

  const renderRouteItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.routeItem}>
      <View style={styles.routeIconContainer}>
        <Text style={styles.routeIcon}>{getRouteIcon(item.type)}</Text>
      </View>
      <View style={styles.routeInfo}>
        <Text style={styles.routeName}>{item.name}</Text>
        <Text style={styles.routeDetails}>{item.details}</Text>
      </View>
      <Text style={styles.routeArrow}>→</Text>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search & Lookup</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search stations, routes..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={COLORS.gray400}
          />
        </View>
      </View>

      {/* Compact mode filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.modeFilterContent}
        style={styles.modeFilter}
      >
        {MODES.map(mode => (
          <TouchableOpacity
            key={mode.id}
            style={[styles.modeChip, selectedMode === mode.id && styles.modeChipActive]}
            onPress={() => setSelectedMode(mode.id)}
          >
            <Text style={styles.modeChipIcon}>{mode.icon}</Text>
            <Text style={styles.modeChipLabel}>{mode.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.lookupContainer}>
        <TrainNumberLookup />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "stations" && styles.activeTab]}
          onPress={() => setActiveTab("stations")}
        >
          <Text style={[styles.tabText, activeTab === "stations" && styles.activeTabText]}>Stations / Stops</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "routes" && styles.activeTab]}
          onPress={() => setActiveTab("routes")}
        >
          <Text style={[styles.tabText, activeTab === "routes" && styles.activeTabText]}>Routes</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.mapViewContainer, { height: mapViewHeight }]}>
        {showMap && selectedStop && (
          <MapView
            style={styles.mapView}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: selectedStop.coordinates.latitude,
              longitude: selectedStop.coordinates.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            <Marker
              coordinate={selectedStop.coordinates}
              title={selectedStop.name}
              description={`${selectedStop.mode} stop`}
            />
          </MapView>
        )}
        {showMap && (
          <TouchableOpacity style={styles.closeMapButton} onPress={() => toggleMapView(false)}>
            <Text style={styles.closeMapButtonText}>Close Map</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      <View style={styles.content}>
        {activeTab === "stations" ? (
          <FlatList
            data={filteredStops}
            renderItem={renderStopItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
          />
        ) : (
          <FlatList
            data={filteredRoutes}
            renderItem={renderRouteItem}
            keyExtractor={(item, index) => `${item.type}-${item.$id || item.id || index}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizes["2xl"],
    fontWeight: "700",
    color: COLORS.gray900,
  },
  searchContainer: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.gray100,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  searchIcon: {
    marginRight: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizes.base,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizes.base,
    color: COLORS.gray900,
  },
  modeFilter: {
    backgroundColor: COLORS.white,
  },
  modeFilterContent: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: 4,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginRight: SPACING.sm,
  },
  modeChipActive: {
    backgroundColor: COLORS.primary,
  },
  modeChipIcon: {
    fontSize: 12,
    marginRight: 4,
    color: COLORS.gray900,
  },
  modeChipLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.gray900,
  },
  lookupContainer: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.white,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.xs,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    fontWeight: "500",
    color: COLORS.gray500,
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  mapViewContainer: {
    width: "100%",
    overflow: "hidden",
  },
  mapView: {
    width: "100%",
    height: "100%",
  },
  closeMapButton: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
  },
  closeMapButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: TYPOGRAPHY.fontSizes.sm,
  },
  content: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
  stopItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    padding: SPACING.sm,
    borderRadius: 10,
    marginBottom: SPACING.xs,
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  stopInfo: {
    flex: 1,
  },
  stopHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  stopName: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    fontWeight: "600",
    color: COLORS.gray900,
    flex: 1,
  },
  stopModeIcon: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    marginLeft: 8,
  },
  stopDetails: {
    fontSize: TYPOGRAPHY.fontSizes.xs,
    color: COLORS.gray500,
  },
  arrow: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    color: COLORS.gray400,
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    padding: SPACING.sm,
    borderRadius: 10,
    marginBottom: SPACING.xs,
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  routeIconContainer: {
    width: 32,
    alignItems: "center",
  },
  routeIcon: {
    fontSize: 18,
  },
  routeInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  routeName: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    fontWeight: "600",
    color: COLORS.gray900,
    marginBottom: 2,
  },
  routeDetails: {
    fontSize: TYPOGRAPHY.fontSizes.xs,
    color: COLORS.gray500,
  },
  routeArrow: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    color: COLORS.gray400,
  },
})
