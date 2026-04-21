import React from "react"
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Alert,
} from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { COLORS } from "../constants/themes"

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const BILLERS = [
  { id: "payat",      name: "Pay@",              icon: "card-outline" as const,         category: "Payments" },
  { id: "easypay",    name: "EasyPay",            icon: "cash-outline" as const,         category: "Payments" },
  { id: "dstv",       name: "MultiChoice / DSTV", icon: "tv-outline" as const,           category: "Entertainment" },
  { id: "homechoice", name: "HomeChoice",         icon: "bag-outline" as const,          category: "Retail" },
  { id: "tshwane",    name: "City of Tshwane",    icon: "flash-outline" as const,        category: "Utilities" },
  { id: "ekurhuleni", name: "City of Ekurhuleni", icon: "flash-outline" as const,        category: "Utilities" },
  { id: "joburg",     name: "City of Joburg",     icon: "business-outline" as const,     category: "Utilities" },
] as const

type Biller = typeof BILLERS[number]

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function BillerCard({ item }: { item: Biller }) {
  const handlePress = () => {
    Alert.alert("Coming soon", `Paying ${item.name} will be available soon.`)
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.75}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={item.icon} size={22} color={COLORS.primary} />
      </View>
      <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.cardCategory}>{item.category}</Text>
    </TouchableOpacity>
  )
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function PayBillsScreen() {
  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pay bills</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Subtitle */}
      <Text style={styles.subtitle}>Select a biller to get started</Text>

      {/* Grid */}
      <FlatList
        data={BILLERS}
        renderItem={({ item }) => <BillerCard item={item} />}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.2,
  },
  headerSpacer: {
    width: 36,
  },

  // Subtitle
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
    fontWeight: "500",
  },

  // List
  list: {
    padding: 16,
    paddingTop: 12,
  },
  row: {
    justifyContent: "space-between",
    marginBottom: 12,
  },

  // Card
  card: {
    width: "48.5%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F0FDF9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cardName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 20,
    marginBottom: 2,
  },
  cardCategory: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "400",
  },
})