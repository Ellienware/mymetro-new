import { useState, useEffect } from "react"
import type { Station } from "../types"
import { LocationService } from "../services/locationService"
import { StationService } from "../services/stationService"
import { useLocation } from "./useLocation"

export const useNearbyStations = (radiusKm?: number) => {
  const { location } = useLocation()
  const [nearbyStations, setNearbyStations] = useState<Station[]>([])

  useEffect(() => {
    if (location) {
      const stations = StationService.getAllStations()
      const nearby = LocationService.findNearbyStations(location.coords, stations, radiusKm)
      setNearbyStations(nearby)
    }
  }, [location, radiusKm])

  return nearbyStations
}
