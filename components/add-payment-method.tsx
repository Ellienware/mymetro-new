import type React from "react"
import { useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { COLORS } from "../constants/theme"

interface AddPaymentMethodModalProps {
  visible: boolean
  onClose: () => void
  onAddCard: (cardData: CardData) => void
  onAddBankAccount: (bankData: BankAccountData) => void
}

interface CardData {
  cardNumber: string
  expiryDate: string
  cvv: string
  cardholderName: string
  cardType: string
}

interface BankAccountData {
  bankName: string
  accountNumber: string
  accountType: string
  accountHolderName: string
}

type PaymentMethodType = "card" | "bank"

export const AddPaymentMethodModal: React.FC<AddPaymentMethodModalProps> = ({
  visible,
  onClose,
  onAddCard,
  onAddBankAccount,
}) => {
  const [selectedType, setSelectedType] = useState<PaymentMethodType>("card")

  // Card form state
  const [cardNumber, setCardNumber] = useState("")
  const [expiryDate, setExpiryDate] = useState("")
  const [cvv, setCvv] = useState("")
  const [cardholderName, setCardholderName] = useState("")

  // Bank account form state
  const [bankName, setBankName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountType, setAccountType] = useState("checking")
  const [accountHolderName, setAccountHolderName] = useState("")

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\s/g, "")
    const formatted = cleaned.replace(/(.{4})/g, "$1 ").trim()
    return formatted.substring(0, 19) // Max 16 digits + 3 spaces
  }

  const formatExpiryDate = (text: string) => {
    const cleaned = text.replace(/\D/g, "")
    if (cleaned.length >= 2) {
      return cleaned.substring(0, 2) + "/" + cleaned.substring(2, 4)
    }
    return cleaned
  }

  const getCardType = (number: string): string => {
    const cleaned = number.replace(/\s/g, "")
    if (cleaned.startsWith("4")) return "Visa"
    if (cleaned.startsWith("5") || cleaned.startsWith("2")) return "Mastercard"
    if (cleaned.startsWith("3")) return "American Express"
    return "Unknown"
  }

  const validateCard = (): boolean => {
    const cleanedCardNumber = cardNumber.replace(/\s/g, "")

    if (cleanedCardNumber.length < 13 || cleanedCardNumber.length > 19) {
      Alert.alert("Invalid Card", "Please enter a valid card number")
      return false
    }

    if (expiryDate.length !== 5) {
      Alert.alert("Invalid Expiry", "Please enter a valid expiry date (MM/YY)")
      return false
    }

    if (cvv.length < 3 || cvv.length > 4) {
      Alert.alert("Invalid CVV", "Please enter a valid CVV")
      return false
    }

    if (cardholderName.trim().length < 2) {
      Alert.alert("Invalid Name", "Please enter the cardholder name")
      return false
    }

    return true
  }

  const validateBankAccount = (): boolean => {
    if (bankName.trim().length < 2) {
      Alert.alert("Invalid Bank", "Please select a bank")
      return false
    }

    if (accountNumber.length < 8) {
      Alert.alert("Invalid Account", "Please enter a valid account number")
      return false
    }

    if (accountHolderName.trim().length < 2) {
      Alert.alert("Invalid Name", "Please enter the account holder name")
      return false
    }

    return true
  }

  const handleAddPaymentMethod = () => {
    if (selectedType === "card") {
      if (validateCard()) {
        const cardData: CardData = {
          cardNumber: cardNumber.replace(/\s/g, ""),
          expiryDate,
          cvv,
          cardholderName,
          cardType: getCardType(cardNumber),
        }
        onAddCard(cardData)
        resetForm()
        onClose()
      }
    } else {
      if (validateBankAccount()) {
        const bankData: BankAccountData = {
          bankName,
          accountNumber,
          accountType,
          accountHolderName,
        }
        onAddBankAccount(bankData)
        resetForm()
        onClose()
      }
    }
  }

  const resetForm = () => {
    setCardNumber("")
    setExpiryDate("")
    setCvv("")
    setCardholderName("")
    setBankName("")
    setAccountNumber("")
    setAccountHolderName("")
  }

  const renderCardForm = () => (
    <View style={styles.formContainer}>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Card Number</Text>
        <TextInput
          style={styles.textInput}
          value={cardNumber}
          onChangeText={(text) => setCardNumber(formatCardNumber(text))}
          placeholder="1234 5678 9012 3456"
          keyboardType="numeric"
          maxLength={19}
        />
        {cardNumber.length > 4 && <Text style={styles.cardType}>{getCardType(cardNumber)}</Text>}
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.inputLabel}>Expiry Date</Text>
          <TextInput
            style={styles.textInput}
            value={expiryDate}
            onChangeText={(text) => setExpiryDate(formatExpiryDate(text))}
            placeholder="MM/YY"
            keyboardType="numeric"
            maxLength={5}
          />
        </View>

        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.inputLabel}>CVV</Text>
          <TextInput
            style={styles.textInput}
            value={cvv}
            onChangeText={setCvv}
            placeholder="123"
            keyboardType="numeric"
            maxLength={4}
            secureTextEntry
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Cardholder Name</Text>
        <TextInput
          style={styles.textInput}
          value={cardholderName}
          onChangeText={setCardholderName}
          placeholder="John Doe"
          autoCapitalize="words"
        />
      </View>
    </View>
  )

  const renderBankForm = () => (
    <View style={styles.formContainer}>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Bank Name</Text>
        <TouchableOpacity style={styles.selectInput}>
          <Text style={bankName ? styles.selectText : styles.selectPlaceholder}>{bankName || "Select your bank"}</Text>
          <Text style={styles.selectArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Account Number</Text>
        <TextInput
          style={styles.textInput}
          value={accountNumber}
          onChangeText={setAccountNumber}
          placeholder="1234567890"
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Account Type</Text>
        <View style={styles.radioGroup}>
          <TouchableOpacity style={styles.radioOption} onPress={() => setAccountType("checking")}>
            <View style={[styles.radio, accountType === "checking" && styles.radioSelected]} />
            <Text style={styles.radioText}>Checking</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.radioOption} onPress={() => setAccountType("savings")}>
            <View style={[styles.radio, accountType === "savings" && styles.radioSelected]} />
            <Text style={styles.radioText}>Savings</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Account Holder Name</Text>
        <TextInput
          style={styles.textInput}
          value={accountHolderName}
          onChangeText={setAccountHolderName}
          placeholder="John Doe"
          autoCapitalize="words"
        />
      </View>
    </View>
  )

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Add Payment Method</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeOption, selectedType === "card" && styles.typeOptionSelected]}
                onPress={() => setSelectedType("card")}
              >
                <Text style={[styles.typeOptionText, selectedType === "card" && styles.typeOptionTextSelected]}>
                  💳 Card
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeOption, selectedType === "bank" && styles.typeOptionSelected]}
                onPress={() => setSelectedType("bank")}
              >
                <Text style={[styles.typeOptionText, selectedType === "bank" && styles.typeOptionTextSelected]}>
                  🏦 Bank Account
                </Text>
              </TouchableOpacity>
            </View>

            {selectedType === "card" ? renderCardForm() : renderBankForm()}

            <View style={styles.securityNote}>
              <Text style={styles.securityIcon}>🔒</Text>
              <Text style={styles.securityText}>Your payment information is encrypted and secure</Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.addButton} onPress={handleAddPaymentMethod}>
              <Text style={styles.addButtonText}>Add {selectedType === "card" ? "Card" : "Bank Account"}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  cancelButton: {
    fontSize: 16,
    color: "#6B7280",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  typeSelector: {
    flexDirection: "row",
    marginBottom: 24,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 4,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: "center",
  },
  typeOptionSelected: {
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  typeOptionText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6B7280",
  },
  typeOptionTextSelected: {
    color: "#000",
  },
  formContainer: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "white",
  },
  row: {
    flexDirection: "row",
  },
  cardType: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "600",
    marginTop: 4,
  },
  selectInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
  },
  selectText: {
    fontSize: 16,
    color: "#000",
  },
  selectPlaceholder: {
    fontSize: 16,
    color: "#9CA3AF",
  },
  selectArrow: {
    fontSize: 18,
    color: "#6B7280",
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
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  securityIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  securityText: {
    fontSize: 14,
    color: "#166534",
    flex: 1,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  addButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  addButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
})
