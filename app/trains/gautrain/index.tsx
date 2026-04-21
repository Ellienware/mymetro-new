// app/trains/gautrain/index.tsx
//
// ── FILE NAMING NOTE ──────────────────────────────────────────────────────────
// This navigator imports from './train-tab' and './bus-tab'.
// Ensure those two files exist in the same folder as this index.tsx.
//   • Rename your old 'gautrain.tsx'     → 'train-tab.tsx'
//   • Rename your old 'gautrain-bus.tsx' → 'bus-tab.tsx'  (if applicable)
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/themes';
import TrainTab from './train-tab';
import BusTab from './bus-tab';

// Update these paths if your filenames differ


const Tab = createMaterialTopTabNavigator();

export default function GautrainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Branded header */}
      <View style={styles.header}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>GT</Text>
        </View>
        <View>
          <Text style={styles.headerTitle}>Gautrain</Text>
          <Text style={styles.headerSub}>Rapid Rail & Feeder Bus</Text>
        </View>
      </View>

      {/* Tab navigator — TWO tabs: Train and Bus */}
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: styles.tabBar,
          tabBarIndicatorStyle: styles.tabIndicator,
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarLabelStyle: styles.tabLabel,
          tabBarItemStyle: styles.tabItem,
          tabBarPressColor: COLORS.primaryLight,
          lazy: false,
        }}
      >
        <Tab.Screen
          name="Train"
          component={TrainTab}
          options={{ tabBarLabel: '🚆  Train' }}
        />
        <Tab.Screen
          name="Bus"
          component={BusTab}
          options={{ tabBarLabel: '🚌  Feeder Bus' }}
        />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  headerTitle: {
    ...(TYPOGRAPHY.bodyBold as object),
    color: COLORS.textPrimary ?? '#1E293B',
    fontSize: 16,
  },
  headerSub: {
    ...(TYPOGRAPHY.caption as object),
    color: COLORS.textMuted,
    marginTop: 1,
  },
  tabBar: {
    backgroundColor: COLORS.surface,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    height: Platform.OS === 'android' ? 48 : 44,
  },
  tabIndicator: {
    backgroundColor: COLORS.primary,
    height: 3,
    borderRadius: 2,
  },
  tabItem: {
    paddingVertical: 0,
    minHeight: 0,
  },
  tabLabel: {
    fontWeight: '600',
    fontSize: 13,
    textTransform: 'none',
    letterSpacing: 0.2,
  },
});