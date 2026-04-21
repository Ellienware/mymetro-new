import { useState, useEffect } from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { COLORS, TYPOGRAPHY, SPACING } from "../../constants/theme";
import type { Train, ScheduleData } from "@/types";
import { findMatchingRoute, getDirection, getFilteredTrains } from "@/services/scheduleService";

// Helper to normalize station names for comparison
const normalizeStationName = (name: string): string => {
  // Remove " Station" suffix and trim
  return name.replace(/\sStation$/i, '').trim();
};

export default function ScheduleScreen() {
  const { from, to, date } = useLocalSearchParams<{
    from: string;
    to: string;
    date: string;
  }>();
  
  const [selectedRoute, setSelectedRoute] = useState<ScheduleData | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<"outbound" | "inbound">("outbound");
  const [currentTrains, setCurrentTrains] = useState<Train[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (from && to) {
      // Normalize station names
      const fromNorm = normalizeStationName(from);
      const toNorm = normalizeStationName(to);
      
      const route = findMatchingRoute(fromNorm, toNorm);
      if (route) {
        setSelectedRoute(route);
        const direction = getDirection(fromNorm, toNorm, route);
        setSelectedDirection(direction);
        setCurrentTrains(getFilteredTrains(route, direction));
        setError(null);
      } else {
        setError(`No schedule found for ${from} → ${to}. Please check the station names.`);
      }
      setLoading(false);
    } else {
      setError("Please select both departure and arrival stations.");
      setLoading(false);
    }
  }, [from, to]);

  const getStatusColor = (status: Train["status"]) => {
    switch (status) {
      case "On Time": return COLORS.success;
      case "Delayed": return COLORS.warning;
      case "Cancelled": return COLORS.error;
      default: return COLORS.gray400;
    }
  };

  const renderTrainItem = ({ item }: { item: Train }) => (
    <View style={styles.trainItem}>
      <View style={styles.timeContainer}>
        <Text style={styles.trainTime}>{item.time}</Text>
        <Text style={styles.platform}>Platform {item.platform}</Text>
        <Text style={styles.trainNumber}>Train #{item.trainNumber}</Text>
      </View>
      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
          {item.status}
          {item.status === "Delayed" && item.delay && ` ${item.delay}`}
        </Text>
      </View>
    </View>
  );

  const toggleDirection = () => {
    if (!selectedRoute) return;
    const newDirection = selectedDirection === "outbound" ? "inbound" : "outbound";
    setSelectedDirection(newDirection);
    setCurrentTrains(getFilteredTrains(selectedRoute, newDirection));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading schedule...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !from || !to) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || "Please select both departure and arrival stations."}</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!selectedRoute) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No routes found from {from} to {to}.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{selectedRoute.route}</Text>
          <Text style={styles.headerSubtitle}>
            {from} → {to} • {date ? new Date(date).toLocaleDateString() : "Today"}
          </Text>
        </View>
      </View>

      <View style={styles.directionContainer}>
        <Text style={styles.directionText}>{selectedRoute.direction || "Direction"}</Text>
        <TouchableOpacity style={styles.swapButton} onPress={toggleDirection}>
          <Text style={styles.swapButtonText}>
            {selectedDirection === "outbound" ? "🔄 Show Return" : "🔄 Show Outbound"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scheduleHeader}>
        <Text style={styles.scheduleHeaderText}>
          {selectedDirection === "outbound" ? "Departures" : "Returns"}
        </Text>
      </View>

      {currentTrains.length === 0 ? (
        <View style={styles.noTrainsContainer}>
          <Text style={styles.noTrainsText}>
            No {selectedDirection} trains available.
          </Text>
        </View>
      ) : (
        <FlatList
          data={currentTrains}
          renderItem={renderTrainItem}
          keyExtractor={(item) => `${item.trainNumber}-${item.time}`}
          contentContainerStyle={styles.trainListContainer}
          style={styles.trainList}
        />
      )}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
          <Text style={styles.legendText}>On Time</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.warning }]} />
          <Text style={styles.legendText}>Delayed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.error }]} />
          <Text style={styles.legendText}>Cancelled</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ... (styles as originally defined, but we'll include them for completeness)
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  backButton: {
    marginRight: SPACING.lg,
  },
  backButtonText: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    color: COLORS.primary,
    fontWeight: "500",
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizes["2xl"],
    fontWeight: "700",
    color: COLORS.gray900,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    color: COLORS.gray500,
    marginTop: 4,
  },
  directionContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  directionText: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    fontWeight: "600",
    color: COLORS.gray900,
  },
  swapButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 8,
    backgroundColor: COLORS.gray100,
  },
  swapButtonText: {
    fontSize: TYPOGRAPHY.fontSizes.xs,
    color: COLORS.gray500,
  },
  scheduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  scheduleHeaderText: {
    fontSize: TYPOGRAPHY.fontSizes.lg,
    fontWeight: "600",
    color: COLORS.gray900,
  },
  trainList: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },
  trainItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  timeContainer: {
    flex: 1,
  },
  trainTime: {
    fontSize: TYPOGRAPHY.fontSizes.lg,
    fontWeight: "700",
    color: COLORS.gray900,
  },
  platform: {
    fontSize: TYPOGRAPHY.fontSizes.xs,
    color: COLORS.gray500,
    marginTop: 2,
  },
  trainNumber: {
    fontSize: TYPOGRAPHY.fontSizes.xs,
    color: COLORS.primary,
    marginTop: 2,
    fontWeight: "500",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.sm,
  },
  statusText: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    fontWeight: "500",
  },
  legend: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  legendText: {
    fontSize: TYPOGRAPHY.fontSizes.xs,
    color: COLORS.gray500,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSizes.lg,
    color: COLORS.error,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  noTrainsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  noTrainsText: {
    fontSize: TYPOGRAPHY.fontSizes.lg,
    color: COLORS.gray500,
  },
  trainListContainer: {
    paddingHorizontal: SPACING.lg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizes.base,
    color: COLORS.gray500,
  },
});