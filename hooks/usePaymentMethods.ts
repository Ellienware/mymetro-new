import { useState, useEffect } from "react"
import { useUser } from "@clerk/clerk-expo"
import { AppwriteService } from "../services/appwriteService"
import type { BankAccountData, CardData, PaymentMethod } from "../types/appwrite"



export const usePaymentMethods = () => {
  const { user } = useUser()
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPaymentMethods = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const methods = await AppwriteService.getUserPaymentMethods(user.id)
      setPaymentMethods(methods)
      setError(null)
    } catch (err) {
      console.error("Error loading payment methods:", err)
      setError(err instanceof Error ? err.message : "Failed to load payment methods")
    } finally {
      setLoading(false)
    }
  }

  const addCard = async (cardData: CardData): Promise<void> => {
    if (!user?.id) throw new Error("User not authenticated")

    try {
      const paymentMethodData = {
        userId: user.id,
        type: "card" as const,
        name: `${cardData.cardType} Card`,
        description: `${cardData.cardType} ending in ${cardData.cardNumber.slice(-4)}`,
        lastFour: cardData.cardNumber.slice(-4),
        expiryDate: cardData.expiryDate,
        cardType: cardData.cardType,
        isDefault: paymentMethods.length === 0,
        isActive: true,
      }

      const newPaymentMethod = await AppwriteService.createPaymentMethod(paymentMethodData)
      setPaymentMethods((prev) => [newPaymentMethod, ...prev])
    } catch (err) {
      console.error("Error adding card:", err)
      throw err
    }
  }

  const addBankAccount = async (bankData: BankAccountData): Promise<void> => {
    if (!user?.id) throw new Error("User not authenticated")

    try {
      const paymentMethodData = {
        userId: user.id,
        type: "bank" as const,
        name: `${bankData.bankName} ${bankData.accountType}`,
        description: `${bankData.bankName} account ending in ${bankData.accountNumber.slice(-4)}`,
        lastFour: bankData.accountNumber.slice(-4),
        bankName: bankData.bankName,
        accountType: bankData.accountType,
        isDefault: paymentMethods.length === 0,
        isActive: true,
      }

      const newPaymentMethod = await AppwriteService.createPaymentMethod(paymentMethodData)
      setPaymentMethods((prev) => [newPaymentMethod, ...prev])
    } catch (err) {
      console.error("Error adding bank account:", err)
      throw err
    }
  }

  const removePaymentMethod = async (paymentMethodId: string): Promise<void> => {
    try {
      await AppwriteService.deletePaymentMethod(paymentMethodId)
      setPaymentMethods((prev) => prev.filter((method) => method.$id !== paymentMethodId))
    } catch (err) {
      console.error("Error removing payment method:", err)
      throw err
    }
  }

  const setDefaultPaymentMethod = async (paymentMethodId: string): Promise<void> => {
    if (!user?.id) throw new Error("User not authenticated")

    try {
      await AppwriteService.setDefaultPaymentMethod(user.id, paymentMethodId)
      setPaymentMethods((prev) =>
        prev.map((method) => ({
          ...method,
          isDefault: method.$id === paymentMethodId,
        })),
      )
    } catch (err) {
      console.error("Error setting default payment method:", err)
      throw err
    }
  }

  useEffect(() => {
    loadPaymentMethods()
  }, [user?.id])

  return {
    paymentMethods,
    loading,
    error,
    addCard,
    addBankAccount,
    removePaymentMethod,
    setDefaultPaymentMethod,
    refreshPaymentMethods: loadPaymentMethods,
  }
}






