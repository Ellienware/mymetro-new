import type React from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"

interface RouteCardProps {
  routeName: string
  routeDescription: string
  onPress: () => void
}

const RouteCard: React.FC<RouteCardProps> = ({ routeName, routeDescription, onPress }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardContent}>
        <Text style={styles.routeName}>{routeName}</Text>
        <Text style={styles.routeDescription}>{routeDescription}</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    padding: 16,
  },
  routeName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  routeDescription: {
    fontSize: 14,
    color: "#666",
  },
})

export default RouteCard
