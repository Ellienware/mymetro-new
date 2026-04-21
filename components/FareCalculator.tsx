import type React from "react"
import { useState, useEffect } from "react"
import { View, Text, StyleSheet } from "react-native"
import { calculateFare, getStationZone } from "../constants/fareData"
import { COLORS, TYPOGRAPHY, SPACING } from "../constants/theme"

interface FareCalculatorProps {
  fromStationZone: string
  toStationZone: string
  fareTypeId: string
}

export const FareCalculator: React.FC<FareCalculatorProps> = ({ fromStationZone, toStationZone, fareTypeId }) => {
  const [fare, setFare] = useState<string>("Calculating...")
  const [fromZone, setFromZone] = useState<string>("")
  const [toZone, setToZone] = useState<string>("")

  useEffect(() => {
    if (fromStationZone && toStationZone) {
      const fromZ = getStationZone(fromStationZone)
      const toZ = getStationZone(toStationZone)
      setFromZone(fromZ)
      setToZone(toZ)

      const calculatedFare = calculateFare(fromStationZone, toStationZone, fareTypeId)
      setFare(calculatedFare)
    }
  }, [fromStationZone, toStationZone, fareTypeId])

  return (
    <View style={styles.container}>
      <View style={styles.fareRow}>
        <Text style={styles.fareLabel}>From Zone:</Text>
        <Text style={styles.fareValue}>
          {fromZone ? `Zone ${fromZone} (${fromZone === "1" ? "Metro" : "Metro Plus"})` : "-"}
        </Text>
      </View>
      <View style={styles.fareRow}>
        <Text style={styles.fareLabel}>To Zone:</Text>
        <Text style={styles.fareValue}>
          {toZone ? `Zone ${toZone} (${toZone === "1" ? "Metro" : "Metro Plus"})` : "-"}
        </Text>
      </View>
      <View style={styles.fareRow}>
        <Text style={styles.fareLabel}>Price:</Text>
        <Text style={styles.farePrice}>{fare}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.gray50,
    borderRadius: 12,
    padding: SPACING.lg,
    marginVertical: SPACING.md,
  },
  fareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: SPACING.xs,
  },
  fareLabel: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    color: COLORS.gray500,
  },
  fareValue: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    fontWeight: "500",
    color: COLORS.gray700,
  },
  farePrice: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    fontWeight: "700",
    color: COLORS.primary,
  },
})
