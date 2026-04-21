import { Stack } from "expo-router"
import { ClerkProvider } from "@clerk/clerk-expo"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { tokenCache } from "../lib/auth"
import Constants from "expo-constants"

const publishableKey = Constants.expoConfig?.extra?.clerkPublishableKey

if (!publishableKey) {
  throw new Error("Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env")
}

export default function RootLayout() {
  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      <SafeAreaProvider>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          
          {/* Existing screens */}
          <Stack.Screen name="schedules" options={{ headerShown: true }} />
          <Stack.Screen name="map" options={{ headerShown: true }} />
          <Stack.Screen name="favorites" options={{ headerShown: false }} />
          <Stack.Screen name="help-support" options={{ headerShown: false }} />
          <Stack.Screen name="payment-methods" options={{ headerShown: false }} />
          <Stack.Screen name="privacy" options={{ headerShown: false }} />
          <Stack.Screen name="terms" options={{ headerShown: false }} />
          <Stack.Screen name="updates" options={{ headerShown: true }} />

          {/* Journey Planning */}
          <Stack.Screen name="plan-journey" options={{ headerShown: false }} />
          <Stack.Screen name="journey-results" options={{ headerShown: false }} />
          <Stack.Screen name="journey-details" options={{ headerShown: false }} />
          <Stack.Screen name="journey-map" options={{ headerShown: false }} />

          {/* Gautrain & Metrorail / Buses */}
          <Stack.Screen name="trains/gautrain" options={{ headerShown: false }} />
          <Stack.Screen name="trains/gautrain-bus" options={{ headerShown: false }} />
          <Stack.Screen name="trains/metrorail" options={{ headerShown: false }} />
          
          {/* Rea Vaya BRT */}
          <Stack.Screen name="buses/reavaya" options={{ headerShown: false }} />
          
          {/* Metrobus is inside metrorail as a tab, but if you have a separate screen, add it */}
          {/* <Stack.Screen name="buses/metrobus" options={{ headerShown: false }} /> */}
        </Stack>
      </SafeAreaProvider>
    </ClerkProvider>
  )
}


