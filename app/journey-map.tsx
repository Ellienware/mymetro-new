// app/journey-map.tsx
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { NavigationMap } from "@/components/NavigationMap";

export default function JourneyMapScreen() {
  const { journey } = useLocalSearchParams();
  let parsedJourney = null;
  try {
    parsedJourney = journey ? JSON.parse(journey as string) : null;
  } catch (e) {
    console.error("Invalid journey data", e);
  }

  if (!parsedJourney || !parsedJourney.legs) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Live Journey</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Text>No journey data available</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Journey</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.mapContainer}>
        <NavigationMap legs={parsedJourney.legs} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Tap on any stop marker to highlight that segment
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: { padding: 8 },
  backArrow: { fontSize: 24, color: "#1E293B" },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#1E293B" },
  mapContainer: { flex: 1 },
  footer: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    alignItems: "center",
  },
  footerText: { fontSize: 12, color: "#64748B" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  backText: { color: "#1E40AF", marginTop: 12, fontWeight: "600" },
});