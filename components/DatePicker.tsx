import type React from "react"
import { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from "react-native"
import DateTimePicker from "@react-native-community/datetimepicker"
import { COLORS, TYPOGRAPHY, SPACING } from "../constants/theme"

interface DatePickerProps {
  label: string
  value: Date
  onChange: (date: Date) => void
  minimumDate?: Date
  maximumDate?: Date
}

export const DatePicker: React.FC<DatePickerProps> = ({ label, value, onChange, minimumDate, maximumDate }) => {
  const [showPicker, setShowPicker] = useState(false)

  const formatDate = (date: Date) => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.toDateString() === today.toDateString()) {
      return "Today"
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow"
    } else {
      return date.toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    }
  }

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false)
    }

    if (selectedDate) {
      onChange(selectedDate)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(true)}>
        <Text style={styles.dateText}>{formatDate(value)}</Text>
        <Text style={styles.changeText}>Change</Text>
      </TouchableOpacity>

      {showPicker && (
        <>
          {Platform.OS === "ios" ? (
            <Modal visible={showPicker} transparent animationType="slide">
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setShowPicker(false)}>
                      <Text style={styles.modalButton}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowPicker(false)}>
                      <Text style={[styles.modalButton, styles.doneButton]}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={value}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    minimumDate={minimumDate}
                    maximumDate={maximumDate}
                    textColor={COLORS.gray900}
                  />
                </View>
              </View>
            </Modal>
          ) : (
            <DateTimePicker
              value={value}
              mode="date"
              display="default"
              onChange={handleDateChange}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
            />
          )}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSizes.xs,
    color: COLORS.gray500,
    fontWeight: "600",
    marginBottom: SPACING.xs,
  },
  dateButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.md,
  },
  dateText: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    fontWeight: "600",
    color: COLORS.gray900,
  },
  changeText: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    color: COLORS.primary,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  modalButton: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    color: COLORS.primary,
  },
  doneButton: {
    fontWeight: "600",
  },
})
