import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { databases, COLLECTIONS, DATABASE_ID, ID, Query } from '../../lib/appwrite';
import { useUserWallet } from '../../hooks/useAppwrite';
import { AppwriteService } from '../../services/appwriteService';
import { COLORS } from '../../constants/theme';

interface VirtualCard {
  $id: string;
  userId: string;
  name: string;
  last4: string;
  type: string;      // 'Gautrain'
  balance: number;
}

export default function GautrainVirtualCardsScreen() {
  const { user } = useUser();
  const { wallet, refetch: refetchWallet } = useUserWallet();
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [topUpModalVisible, setTopUpModalVisible] = useState(false);
  const [selectedCard, setSelectedCard] = useState<VirtualCard | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('');

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    if (!user) return;
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.VIRTUAL_CARDS,
        [
          Query.equal('userId', user.id),
          Query.equal('type', 'Gautrain')
        ]
      );
      setCards(response.documents as unknown as VirtualCard[]);
    } catch (error) {
      console.error('Failed to load cards', error);
    } finally {
      setLoading(false);
    }
  };

  const generateLast4 = () => Math.floor(1000 + Math.random() * 9000).toString();

  const handleAddCard = async () => {
    if (!newCardName.trim()) {
      Alert.alert('Error', 'Please enter a card name');
      return;
    }
    try {
      const newCard = await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.VIRTUAL_CARDS,
        ID.unique(),
        {
          userId: user!.id,
          name: newCardName,
          last4: generateLast4(),
          type: 'Gautrain',
          balance: 0,
        }
      );
      setCards([newCard as unknown as VirtualCard, ...cards]);
      setNewCardName('');
      setModalVisible(false);
      Alert.alert('Success', 'Virtual card added');
    } catch (error) {
      console.error('Add card error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not add card');
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    Alert.alert(
      'Delete Card',
      'Are you sure you want to delete this card?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await databases.deleteDocument(DATABASE_ID, COLLECTIONS.VIRTUAL_CARDS, cardId);
              setCards(cards.filter(c => c.$id !== cardId));
            } catch (error) {
              Alert.alert('Error', 'Could not delete card');
            }
          },
        },
      ]
    );
  };

  const handleTopUp = async (card: VirtualCard) => {
    setSelectedCard(card);
    setTopUpAmount('');
    setTopUpModalVisible(true);
  };

  const confirmTopUp = async () => {
    if (!selectedCard) return;
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount greater than 0.');
      return;
    }
    if (!wallet || wallet.balance < amount) {
      Alert.alert('Insufficient balance', 'Your wallet balance is insufficient.');
      return;
    }
    try {
      // Deduct from wallet
      await AppwriteService.deductFromWallet(user!.id, amount, `Top-up virtual card: ${selectedCard.name}`);
      // Add to card balance
      const newBalance = selectedCard.balance + amount;
      await databases.updateDocument(DATABASE_ID, COLLECTIONS.VIRTUAL_CARDS, selectedCard.$id, {
        balance: newBalance,
      });
      // Update local state
      setCards(cards.map(c => c.$id === selectedCard.$id ? { ...c, balance: newBalance } : c));
      Alert.alert('Success', `R${amount.toFixed(2)} added to ${selectedCard.name}`);
      setTopUpModalVisible(false);
      await refetchWallet(); // refresh wallet balance
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Top-up failed');
    }
  };

  const renderCard = ({ item }: { item: VirtualCard }) => (
    <View style={styles.cardItem}>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.name}</Text>
        <Text style={styles.cardNumber}>•••• {item.last4}</Text>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.cardBalance}>R{item.balance.toFixed(2)}</Text>
        <TouchableOpacity style={styles.topUpButtonSmall} onPress={() => handleTopUp(item)}>
          <Text style={styles.topUpButtonTextSmall}>Top Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text>Loading cards...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gautrain Virtual Cards</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.walletBalanceCard}>
        <Text style={styles.walletBalanceLabel}>Wallet Balance</Text>
        <Text style={styles.walletBalanceValue}>R{wallet?.balance.toFixed(2) || '0.00'}</Text>
      </View>

      <FlatList
        data={cards}
        renderItem={renderCard}
        keyExtractor={(item) => item.$id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No virtual cards yet. Tap + to add one.</Text>
        }
      />

      {/* Add Card Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Virtual Card</Text>
            <TextInput
              style={styles.input}
              placeholder="Card name (e.g., Work Card)"
              value={newCardName}
              onChangeText={setNewCardName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleAddCard}>
                <Text style={styles.confirmButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Top-up Modal */}
      <Modal visible={topUpModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.amountModal}>
            <Text style={styles.modalTitle}>Top up {selectedCard?.name}</Text>
            <Text style={styles.modalSubtitle}>Current balance: R{selectedCard?.balance.toFixed(2)}</Text>
            <TextInput
              style={styles.input}
              placeholder="Amount (R)"
              keyboardType="numeric"
              value={topUpAmount}
              onChangeText={setTopUpAmount}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setTopUpModalVisible(false)}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={confirmTopUp}>
                <Text style={styles.confirmButtonText}>Top Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: { padding: 5 },
  backText: { fontSize: 16, color: COLORS.primary },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  addButton: { padding: 5 },
  addButtonText: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  walletBalanceCard: {
    backgroundColor: COLORS.primary,
    margin: 20,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  walletBalanceLabel: { fontSize: 16, color: 'white', marginBottom: 8 },
  walletBalanceValue: { fontSize: 28, fontWeight: 'bold', color: 'white' },
  list: { padding: 20 },
  cardItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 4 },
  cardNumber: { fontSize: 14, color: '#666' },
  cardRight: { alignItems: 'flex-end' },
  cardBalance: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary, marginBottom: 8 },
  topUpButtonSmall: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  topUpButtonTextSmall: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#666' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
  },
  amountModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelButton: { padding: 10, backgroundColor: '#E5E7EB', borderRadius: 8, flex: 1, marginRight: 10, alignItems: 'center' },
  confirmButton: { padding: 10, backgroundColor: COLORS.primary, borderRadius: 8, flex: 1, alignItems: 'center' },
  confirmButtonText: { color: 'white', fontWeight: '600' },
});