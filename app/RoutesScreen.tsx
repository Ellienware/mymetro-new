// app/RoutesScreen.tsx (or app/routes.tsx)
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert } from "react-native";
import { router } from "expo-router";
import { useUserWallet } from "../hooks/useAppwrite";
import { allStops } from "../services/transportData";

// ─── Helper: find stop by name (case-insensitive, partial match) ─────────────
const findStopByName = (name: string) => {
  const normalized = name.toLowerCase().trim();
  return allStops.find(stop => stop.name.toLowerCase().includes(normalized));
};

// ─── Helper: navigate to journey results with resolved coordinates ───────────
const navigateToJourney = async (fromName: string, toName: string) => {
  const fromStop = findStopByName(fromName);
  const toStop = findStopByName(toName);

  if (!fromStop || !toStop) {
    Alert.alert(
      "Route not found",
      `Could not locate stops for "${fromName}" or "${toName}". Please try a different route.`
    );
    return;
  }

  router.push({
    pathname: "/journey-results",
    params: {
      fromName: fromStop.name,
      fromLat: fromStop.lat.toString(),
      fromLng: fromStop.lon.toString(),
      toName: toStop.name,
      toLat: toStop.lat.toString(),
      toLng: toStop.lon.toString(),
      date: new Date().toISOString(),
      time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      adults: "1",
      children: "0",
      modes: "Rail,Bus,Walk",
      tripType: "fastest",
    },
  });
};

// ─── Route Card ───────────────────────────────────────────────────────────────
interface RouteCardProps {
  title: string;
  subtitle?: string;
  onPress: () => void;
}

const RouteCard = ({ title, subtitle, onPress }: RouteCardProps) => (
  <TouchableOpacity style={styles.routeCard} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.routeIcon}>
      <Text style={{ fontSize: 18 }}>🚆</Text>
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.routeTitle}>{title}</Text>
      {subtitle && <Text style={styles.routeSubtitle}>{subtitle}</Text>}
    </View>
    <Text style={styles.arrow}>›</Text>
  </TouchableOpacity>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RoutesScreen() {
  const { transactions } = useUserWallet();

  // Build recent routes from transactions (extract from metadata or description)
  const recentRoutes = (transactions || [])
    .filter((t: any) => t.type === "ticket_purchase")
    .slice(0, 5)
    .map((t: any) => {
      let from = "Origin", to = "Destination";
      // Try metadata first
      if (t.metadata) {
        try {
          const meta = JSON.parse(t.metadata);
          if (meta.from && meta.to) {
            from = meta.from;
            to = meta.to;
          }
        } catch (e) {}
      }
      // Fallback to description
      if (t.description?.includes("→")) {
        const parts = t.description.split("→");
        from = parts[0].replace("Journey:", "").trim();
        to = parts[1].trim();
      }
      return { id: t.$id, from, to };
    });

  // Popular routes using actual Gautrain stations (from your data)
  const popularRoutes: Array<{ from: string; to: string }> = [
    { from: "Sandton", to: "Pretoria" },
    { from: "OR Tambo", to: "Sandton" },
    { from: "Park", to: "Centurion" },
    { from: "Hatfield", to: "Marlboro" },
    { from: "Rosebank", to: "Midrand" },
  ];

  const handleRoutePress = (from: string, to: string) => {
    navigateToJourney(from, to);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Routes</Text>
          <Text style={styles.subtitle}>Quick access to your journeys</Text>
        </View>

        {recentRoutes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent</Text>
            <View style={styles.cardGroup}>
              {recentRoutes.map((route: any) => (
                <RouteCard
                  key={route.id}
                  title={`${route.from} → ${route.to}`}
                  subtitle="Recent trip"
                  onPress={() => handleRoutePress(route.from, route.to)}
                />
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular</Text>
          <View style={styles.cardGroup}>
            {popularRoutes.map((route, idx) => (
              <RouteCard
                key={idx}
                title={`${route.from} → ${route.to}`}
                subtitle="Popular route"
                onPress={() => handleRoutePress(route.from, route.to)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saved</Text>
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No saved routes yet</Text>
            <TouchableOpacity onPress={() => router.push("/plan-journey")}>
              <Text style={styles.emptyAction}>Plan and save a route</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { padding: 20 },
  title: { fontSize: 28, fontWeight: "700", color: "#1E293B" },
  subtitle: { fontSize: 14, color: "#64748B", marginTop: 4 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#1E293B", marginBottom: 12 },
  cardGroup: { backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden" },
  routeCard: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  routeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center", marginRight: 12 },
  routeTitle: { fontSize: 15, fontWeight: "600", color: "#1E293B" },
  routeSubtitle: { fontSize: 13, color: "#64748B", marginTop: 2 },
  arrow: { fontSize: 22, color: "#94A3B8" },
  emptyState: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 20, alignItems: "center" },
  emptyText: { color: "#64748B" },
  emptyAction: { color: "#1E40AF", marginTop: 8, fontWeight: "600" },
});