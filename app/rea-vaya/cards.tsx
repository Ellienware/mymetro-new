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
import { router, useLocalSearchParams } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { databases, COLLECTIONS, DATABASE_ID, ID, Query } from '../../lib/appwrite';
import { useUserProfile, useUserWallet } from '../../hooks/useAppwrite';
import { COLORS } from '../../constants/theme';

interface VirtualCard {
  $id: string;
  userId: string;
  name: string;
  last4: string;
  type: string;      // 'Rea Vaya' or 'Gautrain'
  balance: number;
}

export default function VirtualCardsScreen() {
  // Get service from URL (e.g., ?service=Gautrain)
  const { service } = useLocalSearchParams<{ service: string }>();
  const currentService = service || 'Rea Vaya';  // default to Rea Vaya

  const { user } = useUser();
  const { profile } = useUserProfile();
  const { wallet } = useUserWallet();

  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newCardName, setNewCardName] = useState('');

  useEffect(() => {
    loadCards();
  }, [currentService]);

  const loadCards = async () => {
    if (!user) return;
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.VIRTUAL_CARDS,
        [
          Query.equal('userId', user.id),
          Query.equal('type', currentService)
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
          type: currentService,
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

  // Determine total balance based on service
  const totalBalance = currentService === 'Gautrain'
    ? `R${wallet?.balance.toFixed(2)}`
    : `${profile?.reaVayaPoints || 0} pts`;

  const renderCard = ({ item }: { item: VirtualCard }) => (
    <TouchableOpacity
      style={styles.cardItem}
      onLongPress={() => handleDeleteCard(item.$id)}
      activeOpacity={0.7}
    >
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.name}</Text>
        <Text style={styles.cardNumber}>•••• {item.last4}</Text>
      </View>
      <Text style={styles.cardBalance}>{totalBalance}</Text>
    </TouchableOpacity>
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
        <Text style={styles.headerTitle}>{currentService} Cards</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.totalBalanceCard}>
        <Text style={styles.totalBalanceLabel}>Total Balance</Text>
        <Text style={styles.totalBalanceValue}>{totalBalance}</Text>
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
  totalBalanceCard: {
    backgroundColor: COLORS.primary,
    margin: 20,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  totalBalanceLabel: { fontSize: 16, color: 'white', marginBottom: 8 },
  totalBalanceValue: { fontSize: 28, fontWeight: 'bold', color: 'white' },
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
  cardBalance: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
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
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
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