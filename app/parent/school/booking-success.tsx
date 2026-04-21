// app/parent/school/booking-success.tsx
// Replaces the Alert.alert confirmation — proper success screen
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Animated, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/themes';

export default function BookingSuccessScreen() {
  const { schoolName } = useLocalSearchParams<{ schoolName: string }>();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 180 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.icon}>✅</Text>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
          <Text style={styles.title}>Booking confirmed!</Text>
          <Text style={styles.subtitle}>
            Your child's transport to{'\n'}
            <Text style={styles.school}>{schoolName}</Text>
            {'\n'}has been booked.
          </Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoItem}>🚌 Driver will pick up your child at the agreed time</Text>
            <Text style={styles.infoItem}>📍 You can track the trip live from your dashboard</Text>
            <Text style={styles.infoItem}>💬 Message the driver anytime from My Bookings</Text>
            <Text style={styles.infoItem}>🔔 You'll get notified when your child is picked up</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace('/parent/school/dashboard')}
          >
            <Text style={styles.primaryBtnText}>Go to Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.replace('/parent/school/bookings')}
          >
            <Text style={styles.secondaryBtnText}>View My Bookings</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },

  iconWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.successLight, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg, ...SHADOWS.md },
  icon: { fontSize: 52 },

  title: { ...TYPOGRAPHY.h1, textAlign: 'center', marginBottom: SPACING.sm },
  subtitle: { ...TYPOGRAPHY.body, textAlign: 'center', marginBottom: SPACING.lg, lineHeight: 24 },
  school: { ...TYPOGRAPHY.bodyBold, color: COLORS.primary },

  infoCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    width: '100%', ...SHADOWS.sm, gap: SPACING.sm, marginBottom: SPACING.xl,
  },
  infoItem: { ...TYPOGRAPHY.body, fontSize: 14, lineHeight: 22 },

  actions: { width: '100%', gap: SPACING.sm },
  primaryBtn: {
    backgroundColor: COLORS.primary, paddingVertical: 16,
    borderRadius: RADIUS.lg, alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    backgroundColor: COLORS.primaryLight, paddingVertical: 14,
    borderRadius: RADIUS.lg, alignItems: 'center',
  },
  secondaryBtnText: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 15 },
});