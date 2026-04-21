import type { Station, Route } from "../types"
import { GAUTENG_STATIONS, GAUTENG_ROUTES } from "../constants/realData"

export class StationService {
  static getAllStations(): Station[] {
    return GAUTENG_STATIONS
  }

  static getStationById(id: string): Station | undefined {
    return GAUTENG_STATIONS.find((station) => station.id === id)
  }

  static getStationsByLine(line: string): Station[] {
    return GAUTENG_STATIONS.filter((station) => station.line === line)
  }

  static searchStations(query: string): Station[] {
    if (!query.trim()) return GAUTENG_STATIONS

    const lowercaseQuery = query.toLowerCase()
    return GAUTENG_STATIONS.filter(
      (station) =>
        station.name.toLowerCase().includes(lowercaseQuery) || station.line.toLowerCase().includes(lowercaseQuery),
    )
  }

  static getAllRoutes(): Route[] {
    return GAUTENG_ROUTES
  }

  static getRouteById(id: string): Route | undefined {
    return GAUTENG_ROUTES.find((route) => route.id === id)
  }

  static getRouteByName(name: string): Route | undefined {
    return GAUTENG_ROUTES.find((route) => route.name === name)
  }
}
