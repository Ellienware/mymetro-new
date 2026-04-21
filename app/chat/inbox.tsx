// app/chat/inbox.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { COLORS } from '@/constants/theme';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '@/lib/appwrite';

export default function ChatInboxScreen() {
  const { user } = useUser();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      const allRooms = await databases.listDocuments(DATABASE_ID, COLLECTIONS.CHAT_ROOMS, []);
      const userRooms = allRooms.documents.filter(room => {
        const participants = JSON.parse(room.participants);
        return participants.includes(user!.id);
      });
      // Sort by lastMessageAt desc
      userRooms.sort((a, b) => (b.lastMessageAt || '') > (a.lastMessageAt || '') ? 1 : -1);
      setRooms(userRooms);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderRoom = ({ item }: any) => {
    const participants = JSON.parse(item.participants);
    const otherUserId = participants.find((id: string) => id !== user!.id);
    // We need to fetch the other user's name – simplify by using "Driver" or lookup
    return (
      <TouchableOpacity
        style={styles.roomCard}
        onPress={() => router.push({ pathname: '/chat', params: { roomId: item.$id, otherUserName: 'Driver' } })}
      >
        <Text style={styles.roomName}>🚐 Driver Chat</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage || 'No messages yet'}</Text>
        <Text style={styles.time}>{item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleDateString() : ''}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) return <ActivityIndicator size="large" style={styles.loader} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 50 }} />
      </View>
      {rooms.length === 0 ? (
        <Text style={styles.empty}>No conversations yet.</Text>
      ) : (
        <FlatList data={rooms} renderItem={renderRoom} keyExtractor={item => item.$id} contentContainerStyle={styles.list} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backButton: { padding: 5 },
  backText: { fontSize: 16, color: COLORS.primary },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  list: { padding: 16 },
  roomCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, elevation: 2 },
  roomName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  lastMessage: { fontSize: 14, color: '#6B7280' },
  time: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  loader: { marginTop: 40 },
  empty: { textAlign: 'center', marginTop: 40, color: '#666' },
});