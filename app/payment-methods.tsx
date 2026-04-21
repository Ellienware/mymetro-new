// app/payment-methods.tsx
import { useState } from "react"
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert } from "react-native"
import { useRouter } from "expo-router"
import { usePaymentMethods } from "@/hooks/usePaymentMethods"
import { AddPaymentMethodModal } from "@/components/add-payment-method"
import { COLORS } from "@/constants/theme"

export default function PaymentMethodsScreen() {
  const router = useRouter()
  const [showAddModal, setShowAddModal] = useState(false)

  const {
    paymentMethods,
    loading,
    addCard,
    addBankAccount,
    removePaymentMethod,
    setDefaultPaymentMethod,
    refreshPaymentMethods,
  } = usePaymentMethods()

  const handleAddCard = async (cardData: any) => {
    try {
      await addCard(cardData)
      setShowAddModal(false)
      await refreshPaymentMethods?.()
      Alert.alert("Success", "Payment method added successfully!")
    } catch (error) {
      Alert.alert("Error", "Failed to add payment method")
    }
  }

  const handleAddBankAccount = async (bankData: any) => {
    try {
      await addBankAccount(bankData)
      setShowAddModal(false)
      await refreshPaymentMethods?.()
      Alert.alert("Success", "Bank account added successfully!")
    } catch (error) {
      Alert.alert("Error", "Failed to add bank account")
    }
  }

  const handleRemovePaymentMethod = (methodId: string, methodName: string) => {
    Alert.alert("Remove Payment Method", `Are you sure you want to remove ${methodName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await removePaymentMethod(methodId)
            Alert.alert("Success", "Payment method removed successfully!")
          } catch (error) {
            Alert.alert("Error", "Failed to remove payment method")
          }
        },
      },
    ])
  }

  const handleSetDefault = async (methodId: string) => {
    try {
      await setDefaultPaymentMethod(methodId)
      Alert.alert("Success", "Default payment method updated!")
    } catch (error) {
      Alert.alert("Error", "Failed to update default payment method")
    }
  }

  const renderPaymentMethod = (method: any) => (
    <View key={method.$id} style={styles.paymentMethodCard}>
      <View style={styles.paymentMethodLeft}>
        <Text style={styles.paymentMethodIcon}>{method.type === "card" ? "💳" : "🏦"}</Text>
        <View style={styles.paymentMethodInfo}>
          <Text style={styles.paymentMethodName}>{method.name}</Text>
          <Text style={styles.paymentMethodDescription}>{method.description}</Text>
          {method.isDefault && <Text style={styles.defaultBadge}>Default</Text>}
        </View>
      </View>
      <View style={styles.paymentMethodActions}>
        {!method.isDefault && (
          <TouchableOpacity style={styles.setDefaultButton} onPress={() => handleSetDefault(method.$id)}>
            <Text style={styles.setDefaultButtonText}>Set Default</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemovePaymentMethod(method.$id, method.name)}
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
          <Text style={styles.headerTitle}>Payment Methods</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text>Loading payment methods...</Text>
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
        <Text style={styles.headerTitle}>Payment Methods</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Your Payment Methods</Text>

        {paymentMethods.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={styles.emptyTitle}>No Payment Methods</Text>
            <Text style={styles.emptyDescription}>
              Add your first payment method to get started with quick payments.
            </Text>
          </View>
        ) : (
          paymentMethods.map(renderPaymentMethod)
        )}

        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <View style={styles.addButtonContent}>
            <View style={styles.addIcon}>
              <Text style={styles.addIconText}>+</Text>
            </View>
            <Text style={styles.addButtonText}>Add New Payment Method</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>💡 Payment Information</Text>
          <Text style={styles.infoText}>
            • Your payment information is encrypted and secure{"\n"}• Set a default payment method for quick payments
            {"\n"}• Remove unused payment methods anytime{"\n"}• All transactions are protected by bank-level security
            {"\n"}• Payment methods are synced across all app features
          </Text>
        </View>
      </ScrollView>

      <AddPaymentMethodModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddCard={handleAddCard}
        onAddBankAccount={handleAddBankAccount}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "white",
    borderBottomWidth: 1, borderBottomColor: "#E5E7EB"
  },
  backButton: { fontSize: 16, color: COLORS.primary },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#000" },
  content: { flex: 1, padding: 20 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16, color: "#000" },
  
  paymentMethodCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  paymentMethodLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  paymentMethodIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  paymentMethodDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  defaultBadge: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "600",
  },
  paymentMethodActions: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 8,
  },
  setDefaultButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + "10",
  },
  setDefaultButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "500",
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
    fontSize: 12,
    fontWeight: "500",
  },
  addButton: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
  },
  addButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  addIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  addIconText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    marginBottom: 20,
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
  },
  infoSection: {
    backgroundColor: "#F0F9FF",
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0369A1",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#0369A1",
    lineHeight: 20,
  },
})