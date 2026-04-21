import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from "react-native"
import { useRouter } from "expo-router"
import { useUser } from "@clerk/clerk-expo"
import { FavoriteStation } from "@/types/appwrite"
import { COLORS } from "@/constants/theme"
import { AppwriteService } from "@/services/appwriteService"


export default function FavoritesScreen() {
  const router = useRouter()
  const { user } = useUser()
  const [favorites, setFavorites] = useState<FavoriteStation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({
    stationName: "",
    stationId: "",
    stationType: "train" as "train" | "bus",
    nickname: "",
  })

  const loadFavorites = async () => {
    if (!user?.id) return

    try {
      const userFavorites = await AppwriteService.getUserFavorites(user.id)
      setFavorites(userFavorites)
    } catch (error) {
      console.error("Error loading favorites:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadFavorites()
  }, [user?.id])

  const onRefresh = () => {
    setRefreshing(true)
    loadFavorites()
  }

  const handleAddFavorite = async () => {
    if (!user?.id || !addForm.stationName || !addForm.stationId) {
      Alert.alert("Error", "Please fill in all required fields")
      return
    }

    try {
      await AppwriteService.addFavoriteStation(user.id, {
        stationName: addForm.stationName,
        stationId: addForm.stationId,
        stationType: addForm.stationType,
        nickname: addForm.nickname,
      })

      setAddForm({ stationName: "", stationId: "", stationType: "train", nickname: "" })
      setShowAddModal(false)
      loadFavorites()
      Alert.alert("Success", "Station added to favorites!")
    } catch (error) {
      Alert.alert("Error", "Failed to add favorite station")
    }
  }

  const handleRemoveFavorite = (favoriteId: string, stationName: string) => {
    Alert.alert("Remove Favorite", `Remove ${stationName} from your favorites?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await AppwriteService.removeFavoriteStation(favoriteId)
            loadFavorites()
          } catch (error) {
            Alert.alert("Error", "Failed to remove favorite")
          }
        },
      },
    ])
  }

  const getStationTypeColor = (stationType: string) => {
    return stationType === "train" ? "#3B82F6" : "#10B981"
  }

  const getStationTypeIcon = (stationType: string) => {
    return stationType === "train" ? "🚇" : "🚌"
  }

  const renderFavoriteItem = (favorite: FavoriteStation) => (
    <View key={favorite.$id} style={styles.favoriteCard}>
      <View style={styles.favoriteHeader}>
        <View style={styles.stationInfo}>
          <View style={styles.stationNameRow}>
            <Text style={styles.stationTypeIcon}>{getStationTypeIcon(favorite.stationType)}</Text>
            <Text style={styles.stationName}>{favorite.nickname || favorite.stationName}</Text>
          </View>
          {favorite.nickname && <Text style={styles.actualStationName}>{favorite.stationName}</Text>}
          <View style={styles.stationDetails}>
            <Text style={styles.stationId}>ID: {favorite.stationId}</Text>
            <View style={[styles.typeBadge, { backgroundColor: getStationTypeColor(favorite.stationType) }]}>
              <Text style={styles.typeText}>{favorite.stationType.toUpperCase()}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveFavorite(favorite.$id, favorite.stationName)}
        >
          <Text style={styles.removeButtonText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Favorites</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text>Loading favorites...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Favorites</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)}>
          <Text style={styles.addButton}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {favorites.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>⭐</Text>
            <Text style={styles.emptyTitle}>No Favorite Stations</Text>
            <Text style={styles.emptyDescription}>Add your frequently used stations to quickly access them later.</Text>
            <TouchableOpacity style={styles.emptyAddButton} onPress={() => setShowAddModal(true)}>
              <Text style={styles.emptyAddButtonText}>Add Your First Favorite</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Your Favorite Stations ({favorites.length})</Text>
            {favorites.map(renderFavoriteItem)}
          </>
        )}
      </ScrollView>

  
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Text style={styles.closeButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Favorite Station</Text>
            <TouchableOpacity onPress={handleAddFavorite}>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Station Name *</Text>
              <TextInput
                style={styles.input}
                value={addForm.stationName}
                onChangeText={(text) => setAddForm((prev) => ({ ...prev, stationName: text }))}
                placeholder="e.g., Johannesburg Park Station"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Station ID *</Text>
              <TextInput
                style={styles.input}
                value={addForm.stationId}
                onChangeText={(text) => setAddForm((prev) => ({ ...prev, stationId: text }))}
                placeholder="e.g., JHB001"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Station Type *</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setAddForm((prev) => ({ ...prev, stationType: "train" }))}
                >
                  <View style={[styles.radio, addForm.stationType === "train" && styles.radioSelected]} />
                  <Text style={styles.radioText}>🚇 Train</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setAddForm((prev) => ({ ...prev, stationType: "bus" }))}
                >
                  <View style={[styles.radio, addForm.stationType === "bus" && styles.radioSelected]} />
                  <Text style={styles.radioText}>🚌 Bus</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nickname (Optional)</Text>
              <TextInput
                style={styles.input}
                value={addForm.nickname}
                onChangeText={(text) => setAddForm((prev) => ({ ...prev, nickname: text }))}
                placeholder="e.g., Work, Home, Gym"
              />
            </View>

            <Text style={styles.helpText}>
              💡 Add a nickname to easily identify this station in your favorites list.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    fontSize: 16,
    color: COLORS.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  addButton: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    marginBottom: 20,
  },
  favoriteCard: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  favoriteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  stationInfo: {
    flex: 1,
  },
  stationNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  stationTypeIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  stationName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    flex: 1,
  },
  actualStationName: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
    marginLeft: 28,
  },
  stationDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 28,
  },
  stationId: {
    fontSize: 14,
    color: "#6B7280",
    marginRight: 12,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    fontSize: 12,
    color: "white",
    fontWeight: "600",
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  removeButtonText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    paddingHorizontal: 40,
    marginBottom: 24,
  },
  emptyAddButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyAddButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "white",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  closeButton: {
    fontSize: 16,
    color: "#6B7280",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  saveButton: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "white",
  },
  radioGroup: {
    flexDirection: "row",
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 24,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    marginRight: 8,
  },
  radioSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  radioText: {
    fontSize: 16,
    color: "#374151",
  },
  helpText: {
    fontSize: 14,
    color: "#6B7280",
    fontStyle: "italic",
    marginTop: 10,
  },
})
