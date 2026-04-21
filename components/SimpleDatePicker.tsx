import type React from "react"
import { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native"
import { COLORS, TYPOGRAPHY, SPACING } from "../constants/theme"


interface SimpleDatePickerProps {
  label: string
  value: Date
  onChange: (date: Date) => void
  minimumDate?: Date
  maximumDate?: Date
}

export const SimpleDatePicker: React.FC<SimpleDatePickerProps> = ({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
}) => {
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

  const generateDateOptions = () => {
    const dates = []
    const today = new Date()

    // Generate next 30 days
    for (let i = 0; i < 30; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      dates.push(date)
    }

    return dates
  }

  const handleDateSelect = (selectedDate: Date) => {
    onChange(selectedDate)
    setShowPicker(false)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(true)}>
        <Text style={styles.dateText}>{formatDate(value)}</Text>
        <Text style={styles.changeText}>Change</Text>
      </TouchableOpacity>

      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text style={styles.modalButton}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Select {label}</Text>
              <View style={{ width: 60 }} />
            </View>

            <View style={styles.dateList}>
              {generateDateOptions().map((date, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.dateOption, date.toDateString() === value.toDateString() && styles.selectedDateOption]}
                  onPress={() => handleDateSelect(date)}
                >
                  <Text
                    style={[
                      styles.dateOptionText,
                      date.toDateString() === value.toDateString() && styles.selectedDateOptionText,
                    ]}
                  >
                    {formatDate(date)}
                  </Text>
                  <Text
                    style={[
                      styles.dateOptionDay,
                      date.toDateString() === value.toDateString() && styles.selectedDateOptionDay,
                    ]}
                  >
                    {date.toLocaleDateString("en-ZA", { weekday: "short" })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
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
    maxHeight: "70%",
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
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSizes.lg,
    fontWeight: "600",
    color: COLORS.gray900,
  },
  dateList: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  dateOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.gray50,
  },
  selectedDateOption: {
    backgroundColor: COLORS.primary,
  },
  dateOptionText: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    fontWeight: "600",
    color: COLORS.gray900,
  },
  selectedDateOptionText: {
    color: COLORS.white,
  },
  dateOptionDay: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    color: COLORS.gray500,
  },
  selectedDateOptionDay: {
    color: COLORS.white,
  },
})
