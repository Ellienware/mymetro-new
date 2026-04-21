import type React from "react"
import { useState } from "react"
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from "react-native"
import { TRAIN_NUMBERS } from "../constants/realData"
import { COLORS, TYPOGRAPHY, SPACING } from "../constants/theme"

export const TrainNumberLookup: React.FC = () => {
  const [trainNumber, setTrainNumber] = useState("")

  const handleLookup = () => {
    if (!trainNumber.trim()) {
      Alert.alert("Error", "Please enter a train number")
      return
    }

    const train = TRAIN_NUMBERS.find((t) => t.number === trainNumber.trim())

    if (train) {
      Alert.alert("Train Found", `Train ${train.number}\nRoute: ${train.route}\nDeparture: ${train.departure}`, [
        { text: "OK" },
      ])
    } else {
      Alert.alert("Not Found", "Train number not found. Please check and try again.")
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Find train by number</Text>
      <Text style={styles.subtitle}>
        Find out information about your train by using its train number. This is useful if you want to know where a
        train is going, or to see its schedule.
      </Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="e.g. 9820; 0225"
          value={trainNumber}
          onChangeText={setTrainNumber}
          placeholderTextColor={COLORS.gray400}
        />
        <TouchableOpacity style={styles.goButton} onPress={handleLookup}>
          <Text style={styles.goButtonText}>GO</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.gray800,
    padding: SPACING.lg,
    borderRadius: 12,
    marginVertical: SPACING.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    fontWeight: "600",
    color: COLORS.white,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    color: COLORS.gray300,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    fontSize: TYPOGRAPHY.fontSizes.base,
    color: COLORS.gray900,
    marginRight: SPACING.sm,
  },
  goButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  goButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: TYPOGRAPHY.fontSizes.base,
  },
})
