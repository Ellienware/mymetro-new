import { View, Text, StyleSheet } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { COLORS, SPACING, TYPOGRAPHY } from "@/constants/theme"

export function WalletMiniCard({ balance }: { balance: number }) {
  return (
    <LinearGradient
      colors={[COLORS.primary, COLORS.primaryDark]}
      style={styles.card}
    >
      <Text style={styles.label}>Wallet Balance</Text>
      <Text style={styles.amount}>R{balance.toFixed(2)}</Text>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: 18,
  },
  label: {
    color: "rgba(255,255,255,0.8)",
    fontSize: TYPOGRAPHY.fontSizes.sm,
  },
  amount: {
    color: "#fff",
    fontSize: TYPOGRAPHY.fontSizes["2xl"],
    fontWeight: "bold",
    marginTop: 4,
  },
})