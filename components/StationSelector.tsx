import React, { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, TextInput } from "react-native"
import type { MultimodalStop } from "../types"
import { COLORS, TYPOGRAPHY, SPACING } from "../constants/theme"

interface StationSelectorProps {
  label: string
  selectedStation: MultimodalStop | null
  onStationSelect: (station: MultimodalStop) => void
  placeholder?: string
  stations: MultimodalStop[]        // now receives filtered list from parent
}

export const StationSelector: React.FC<StationSelectorProps> = ({
  label,
  selectedStation,
  onStationSelect,
  placeholder = "Select station",
  stations,
}) => {
  const [showModal, setShowModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const filteredStations = stations.filter(
    (station) =>
      station.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (station.lines && station.lines.some(line => line.toLowerCase().includes(searchQuery.toLowerCase())))
  )

  const handleStationSelect = (station: MultimodalStop) => {
    onStationSelect(station)
    setShowModal(false)
    setSearchQuery("")
  }

  const renderStationItem = ({ item }: { item: MultimodalStop }) => (
    <TouchableOpacity style={styles.stationItem} onPress={() => handleStationSelect(item)}>
      <View style={styles.stationInfo}>
        <Text style={styles.stationName}>{item.name}</Text>
        <Text style={styles.stationLine}>
          {item.mode} • {item.lines?.join(', ') || 'No route info'}
        </Text>
      </View>
      {/* Optionally show mode icon or municipality */}
      <View style={styles.stationMeta}>
        <Text style={styles.modeIcon}>
          {item.mode === 'train' ? '🚆' : item.mode === 'brt' ? '🚍' : item.mode === 'bus' ? '🚌' : '🚖'}
        </Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.selectorButton} onPress={() => setShowModal(true)}>
        <Text style={[styles.selectorText, !selectedStation && styles.placeholderText]}>
          {selectedStation ? selectedStation.name : placeholder}
        </Text>
        <Text style={styles.dropdownIcon}>⌄</Text>
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select {label}</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search stops..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={COLORS.gray400}
              />
            </View>
          </View>

          <FlatList
            data={filteredStations}
            renderItem={renderStationItem}
            keyExtractor={(item) => item.id}
            style={styles.stationsList}
            showsVerticalScrollIndicator={false}
          />
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
  selectorButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.md,
  },
  selectorText: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    fontWeight: "600",
    color: COLORS.gray900,
  },
  placeholderText: {
    color: COLORS.gray400,
    fontWeight: "400",
  },
  dropdownIcon: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    color: COLORS.gray400,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  cancelButton: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    color: COLORS.primary,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSizes.lg,
    fontWeight: "600",
    color: COLORS.gray900,
  },
  searchContainer: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.white,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.gray100,
    borderRadius: 12,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  searchIcon: {
    marginRight: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizes.base,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizes.base,
    color: COLORS.gray900,
  },
  stationsList: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },
  stationItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: 12,
    marginBottom: SPACING.md,
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  stationInfo: {
    flex: 1,
  },
  stationName: {
    fontSize: TYPOGRAPHY.fontSizes.base,
    fontWeight: "600",
    color: COLORS.gray900,
    marginBottom: 4,
  },
  stationLine: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    color: COLORS.gray500,
  },
  stationMeta: {
    marginLeft: SPACING.md,
  },
  modeIcon: {
    fontSize: 20,
  },
})
