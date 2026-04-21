import type React from "react"
import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import type { Station } from "../types"

interface StationCardProps {
  station: Station
  onPress?: (station: Station) => void
  showZone?: boolean
}

export const StationCard: React.FC<StationCardProps> = ({ station, onPress, showZone = true }) => {
  return (
    <TouchableOpacity style={styles.container} onPress={() => onPress?.(station)} activeOpacity={0.7}>
      <View style={styles.stationInfo}>
        <Text style={styles.stationName}>{station.name}</Text>
        <Text style={styles.stationLine}>{station.line}</Text>
      </View>
      {showZone && (
        <View style={styles.stationZone}>
          <Text style={styles.zoneText}>Zone {station.zone}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  stationInfo: {
    flex: 1,
  },
  stationName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  stationLine: {
    fontSize: 14,
    color: "#6B7280",
  },
  stationZone: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  zoneText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
})
