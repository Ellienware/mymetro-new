import { useState, useEffect } from "react"
import * as Location from "expo-location"

export const useLocation = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCurrentLocation()
  }, [])

  const getCurrentLocation = async () => {
    try {
      setLoading(true)
      setError(null)

      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") {
        setError("Location permission denied")
        setLocation({
          coords: {
            latitude: -26.2041,
            longitude: 28.0473,
            altitude: null,
            accuracy: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        })
        setLoading(false)
        return
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      setLocation(currentLocation)
    } catch (err) {
      console.error("Error getting location:", err)
      setError(err instanceof Error ? err.message : "Failed to get location")

      setLocation({
        coords: {
          latitude: -26.2041,
          longitude: 28.0473,
          altitude: null,
          accuracy: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      })
    } finally {
      setLoading(false)
    }
  }

  const refreshLocation = () => {
    getCurrentLocation()
  }

  return {
    location,
    error,
    loading,
    refreshLocation,
  }
}
