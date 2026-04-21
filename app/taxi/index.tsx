// app/taxi/index.tsx
import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/theme';
import TaxiPassengerScreen from './minibus-passenger/taxi-passenger-screen';
import MeterRequestScreen from './meter-taxi-passenger/request';

const Tab = createMaterialTopTabNavigator();

export default function TaxiPassengerTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { paddingTop: insets.top, backgroundColor: COLORS.surface },
        tabBarIndicatorStyle: { backgroundColor: COLORS.primary },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontWeight: '600', fontSize: 14, textTransform: 'capitalize' },
      }}
    >
      <Tab.Screen name="Minibus" component={TaxiPassengerScreen} />
      <Tab.Screen name="Meter Taxi" component={MeterRequestScreen} />
    </Tab.Navigator>
  );
}