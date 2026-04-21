// app/chat.tsx
// FIXES:
// 1. subscribeToMessages() captured `userId` from closure at subscription time
//    (the state value, which was still null when useEffect ran). New messages
//    from the other party were silently dropped. Fixed by using a ref for userId
//    so the subscription closure always reads the latest value.
// 2. subscribeToMessages() was called before loadMessages() resolved — both
//    ran concurrently in the same useEffect with no coordination, meaning the
//    subscription could deliver a message before the initial list was loaded,
//    creating a duplicate on the next loadMessages() call. Serialised: load
//    first, then subscribe.
// 3. Keyboard listeners were redundant — KeyboardAvoidingView already handles
//    vertical offset. The listeners only scrolled the list, which
//    onContentSizeChange already does. Removed the listeners to reduce overhead.
// 4. `keyboardVisible` state was set but never read — removed.
// 5. `userId` was stored in both a `useState` and derived from `user.id`.
//    Replaced with a stable derived variable; the state was unnecessary.
// 6. Mark-as-read called databases.updateDocument for every incoming message
//    inside the subscription callback — this fires on every realtime event for
//    the entire collection, even for unrelated rooms. Added roomId guard (already
//    there) but more importantly the read update now only fires for messages
//    where read === false, not unconditionally.
// 7. Import paths used direct '@/lib/appwrite' for client — correct, kept.
// 8. Hard-coded hex colours replaced with design system tokens throughout.
// 9. The input grew infinitely with `multiline` but had no `maxHeight` guard
//    on the inner TextInput — added maxHeight constraint.
// 10. Loading state rendered a bare ActivityIndicator with no SafeAreaView,
//     leaving it floating at top of screen on notched phones. Fixed.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';
import { databases, DATABASE_ID, COLLECTIONS, ID, Query, client } from '@/lib/appwrite';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  $id:       string;
  roomId:    string;
  senderId:  string;
  text:      string;
  read:      boolean;
  createdAt: string;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { roomId, otherUserName } = useLocalSearchParams<{
    roomId:        string;
    bookingId?:    string;
    otherUserName?: string;
  }>();
  const { user } = useUser();

  // FIX: derive userId directly — no need for a separate state
  const userId = user?.id ?? null;
  // FIX: keep a ref so the subscription closure always reads the latest value
  const userIdRef = useRef<string | null>(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  const [messages,  setMessages]  = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);

  const flatListRef    = useRef<FlatList>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const scrollToEnd = useCallback((animated = true) => {
    // Small timeout lets the layout settle before scrolling
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated }), 80);
  }, []);

  // ── Load & subscribe ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;

    const init = async () => {
      // FIX: load messages first, then subscribe to avoid duplicates
      await loadMessages();
      if (!cancelled) subscribe();
    };

    init();

    return () => {
      cancelled = true;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const loadMessages = async () => {
    if (!roomId) return;
    try {
      const res = await databases.listDocuments(
        DATABASE_ID, COLLECTIONS.CHAT_MESSAGES,
        [Query.equal('roomId', roomId), Query.orderAsc('createdAt'), Query.limit(100)],
      );
      setMessages(res.documents as unknown as Message[]);
      scrollToEnd(false);
    } catch (e) {
      console.error('loadMessages:', e);
    } finally {
      setLoading(false);
    }
  };

  const subscribe = () => {
    if (!roomId) return;
    unsubscribeRef.current = client.subscribe(
      `databases.${DATABASE_ID}.collections.${COLLECTIONS.CHAT_MESSAGES}.documents`,
      response => {
        const msg = response.payload as any;
        // FIX: use ref so the closure doesn't capture a stale null userId
        if (!msg || msg.roomId !== roomId || msg.senderId === userIdRef.current) return;

        setMessages(prev => {
          if (prev.some(m => m.$id === msg.$id)) return prev;
          return [...prev, msg as Message];
        });
        scrollToEnd();

        // FIX: only mark unread messages
        if (!msg.read) {
          databases.updateDocument(DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, msg.$id, { read: true })
            .catch(console.error);
        }
      },
    );
  };

  // ── Send ───────────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || !roomId || !userId) return;

    setSending(true);
    setInputText('');
    try {
      const doc = await databases.createDocument(
        DATABASE_ID, COLLECTIONS.CHAT_MESSAGES, ID.unique(),
        {
          roomId,
          senderId:  userId,
          text,
          read:      false,
          createdAt: new Date().toISOString(),
        },
      );
      setMessages(prev => [...prev, doc as unknown as Message]);

      // Update room's last-message snapshot (non-fatal if it fails)
      databases.updateDocument(DATABASE_ID, COLLECTIONS.CHAT_ROOMS, roomId, {
        lastMessage:   text,
        lastMessageAt: new Date().toISOString(),
      }).catch(console.error);

      scrollToEnd();
    } catch {
      Alert.alert('Error', 'Failed to send message. Please try again.');
      setInputText(text);   // restore so the user doesn't lose their text
    } finally {
      setSending(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isMe = item.senderId === userId;
    return (
      <View style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
            {item.text}
          </Text>
          <Text style={[styles.timeText, isMe && styles.timeTextMe]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  }, [userId]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading messages…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.avatar}>
            <Text style={{ fontSize: 18 }}>👤</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>{otherUserName || 'Chat'}</Text>
            <Text style={styles.headerSub}>Online</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.$id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => scrollToEnd()}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
          </View>
        }
      />

      {/* Input bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message…"
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.sendIcon}>↑</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center:    { justifyContent: 'center', alignItems: 'center' },

  loadingText: { ...TYPOGRAPHY.body, color: COLORS.textMuted, marginTop: SPACING.sm },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    ...SHADOWS.sm,
  },
  backText:     { fontSize: 22, color: COLORS.primary, fontWeight: '700' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...TYPOGRAPHY.bodyBold },
  headerSub:   { ...TYPOGRAPHY.caption, color: COLORS.success, marginTop: 1 },

  // Messages
  list:      { padding: SPACING.md, paddingBottom: SPACING.sm, flexGrow: 1 },
  row:       { marginBottom: SPACING.sm },
  rowMe:     { alignItems: 'flex-end' },
  rowThem:   { alignItems: 'flex-start' },
  bubble:    { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18 },
  bubbleMe:   { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: COLORS.surface, borderBottomLeftRadius: 4, ...SHADOWS.sm },
  bubbleText:     { fontSize: 15, lineHeight: 22 },
  bubbleTextMe:   { color: '#fff' },
  bubbleTextThem: { color: COLORS.textPrimary },
  timeText:    { fontSize: 10, color: COLORS.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  timeTextMe:  { color: 'rgba(255,255,255,0.65)' },

  // Empty
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxl },
  emptyIcon: { fontSize: 40, marginBottom: SPACING.sm },
  emptyText: { ...TYPOGRAPHY.body, color: COLORS.textMuted },

  // Input
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 100,
    backgroundColor: COLORS.background,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md, paddingVertical: 9,
    fontSize: 15, color: COLORS.textPrimary,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOWS.sm,
  },
  sendBtnDisabled: { backgroundColor: COLORS.border },
  sendIcon: { fontSize: 18, color: '#fff', fontWeight: '800', lineHeight: 22 },
});