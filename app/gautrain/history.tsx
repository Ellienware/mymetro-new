import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { databases, Query } from '../../lib/appwrite';
import { DATABASE_ID, COLLECTIONS } from '../../lib/appwrite';
import { COLORS } from '../../constants/theme';
import { FARE_CATEGORIES } from '../../constants/fareData';
import type { UserTicket } from '../../types/appwrite';

export default function GautrainHistoryScreen() {
  const { user } = useUser();
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<UserTicket | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

 const loadTickets = async () => {
  if (!user) return;
  setLoading(true);
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.TICKETS,
      [
        Query.equal('userId', user.id),
        Query.equal('serviceCategory', 'gautrain'),
        Query.orderDesc('createdAt'),
      ]
    );
    setTickets(response.documents as unknown as UserTicket[]);
  } catch (error) {
    console.error('Failed to load Gautrain tickets', error);
  } finally {
    setLoading(false);
  }
};

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString();

  const renderTicket = ({ item }: { item: UserTicket }) => (
    <TouchableOpacity
      style={styles.ticketCard}
      onPress={() => {
        setSelectedTicket(item);
        setShowModal(true);
      }}
    >
      <View style={styles.ticketHeader}>
        <Text style={styles.route}>
          {item.fromStation} → {item.toStation}
        </Text>
        <Text style={[styles.status, { color: item.status === 'active' ? '#10B981' : '#6B7280' }]}>
          {item.status}
        </Text>
      </View>
      <Text style={styles.date}>
        {formatDate(item.validFrom)} – {formatDate(item.validUntil)}
      </Text>
      <View style={styles.ticketFooter}>
        <Text style={styles.price}>R{item.price.toFixed(2)}</Text>
        <Text style={styles.category}>
          {FARE_CATEGORIES.find((c) => c.id === item.serviceCategory)?.name || item.serviceCategory}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const TicketModal = ({ ticket, visible, onClose }: { ticket: UserTicket | null; visible: boolean; onClose: () => void }) => {
    if (!ticket) return null;
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Your Ticket</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.ticketDisplay}>
            <View style={styles.ticketDisplayHeader}>
              <Text style={styles.ticketDisplayType}>{ticket.ticketType}</Text>
              <Text style={styles.ticketDisplayPrice}>R{ticket.price.toFixed(2)}</Text>
            </View>
            <View style={styles.categoryTagLarge}>
              <Text style={styles.categoryTagTextLarge}>
                {FARE_CATEGORIES.find((c) => c.id === ticket.serviceCategory)?.name || ticket.serviceCategory}
              </Text>
            </View>
            <View style={styles.qrCodeContainer}>
              <View style={styles.qrCodePlaceholder}>
                <Text style={styles.qrCodeText}>QR CODE</Text>
                <Text style={styles.qrCodeId}>{ticket.qrCode}</Text>
              </View>
            </View>
            <View style={styles.ticketDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>From:</Text>
                <Text style={styles.detailValue}>{ticket.fromStation}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>To:</Text>
                <Text style={styles.detailValue}>{ticket.toStation}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Distance:</Text>
                <Text style={styles.detailValue}>{ticket.distance.toFixed(1)}km</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Valid Until:</Text>
                <Text style={styles.detailValue}>{formatDate(ticket.validUntil)}</Text>
              </View>
            </View>
            <Text style={styles.instructionText}>
              Show this QR code to the conductor when requested
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gautrain Trips</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
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
        <Text style={styles.headerTitle}>Gautrain Trips</Text>
        <TouchableOpacity onPress={loadTickets} style={styles.refreshButton}>
          <Text style={styles.refreshText}>🔄</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={tickets}
        renderItem={renderTicket}
        keyExtractor={(item) => item.$id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No trips yet. Buy a ticket to see it here.</Text>}
      />
      <TicketModal ticket={selectedTicket} visible={showModal} onClose={() => setShowModal(false)} />
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
  refreshButton: { padding: 5 },
  refreshText: { fontSize: 20 },
  list: { padding: 20 },
  ticketCard: {
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
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  route: { fontSize: 16, fontWeight: '600', color: '#000' },
  status: { fontSize: 14, fontWeight: '500', textTransform: 'capitalize' },
  date: { fontSize: 14, color: '#666', marginBottom: 8 },
  ticketFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
  category: { fontSize: 14, color: '#666', textTransform: 'capitalize' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', marginTop: 40, color: '#666' },
  modalContainer: { flex: 1, backgroundColor: 'white' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: { fontSize: 18, color: '#6B7280' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#000' },
  ticketDisplay: { flex: 1, padding: 20 },
  ticketDisplayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  ticketDisplayType: { fontSize: 20, fontWeight: 'bold', color: '#000', textTransform: 'capitalize' },
  ticketDisplayPrice: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
  categoryTagLarge: {
    alignSelf: 'center',
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 16,
  },
  categoryTagTextLarge: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  qrCodeContainer: { alignItems: 'center', marginBottom: 30 },
  qrCodePlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  qrCodeText: { fontSize: 16, fontWeight: '600', color: '#6B7280', marginBottom: 8 },
  qrCodeId: { fontSize: 12, color: '#9CA3AF' },
  ticketDetails: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 16, marginBottom: 20 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  detailLabel: { fontSize: 14, color: '#6B7280' },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#000' },
  instructionText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
});