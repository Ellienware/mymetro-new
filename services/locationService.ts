import * as Location from "expo-location"
import type { Station, LocationCoords } from "../types"
import { MAP_CONFIG } from "@/constants/realData"


export class LocationService {
  static async requestPermissions(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync()
    return status === "granted"
  }

  static async getCurrentLocation(): Promise<Location.LocationObject | null> {
    try {
      const hasPermission = await this.requestPermissions()
      if (!hasPermission) {
        throw new Error("Location permission denied")
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      return location
    } catch (error) {
      console.error("Error getting location:", error)
      return null
    }
  }

  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1)
    const dLon = this.deg2rad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const d = R * c // Distance in km
    return d
  }

  static findNearbyStations(
    userCoords: LocationCoords,
    stations: Station[],
    radiusInKm: number = MAP_CONFIG.NEARBY_RADIUS_KM,
  ): Station[] {
    return stations
      .filter((station) => {
        const distance = this.calculateDistance(
          userCoords.latitude,
          userCoords.longitude,
          station.coordinates.latitude,
          station.coordinates.longitude,
        )
        return distance <= radiusInKm
      })
      .sort((a, b) => {
        const distanceA = this.calculateDistance(
          userCoords.latitude,
          userCoords.longitude,
          a.coordinates.latitude,
          a.coordinates.longitude,
        )
        const distanceB = this.calculateDistance(
          userCoords.latitude,
          userCoords.longitude,
          b.coordinates.latitude,
          b.coordinates.longitude,
        )
        return distanceA - distanceB
      })
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180)
  }
}
