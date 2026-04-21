export interface FareCategory {
  id: string
  name: string
  description: string
}

export interface DistanceRange {
  id: string
  label: string
  minKm: number
  maxKm: number | null
}

export interface FareType {
  id: string
  name: string
  description: string
}

export interface FarePrice {
  categoryId: string
  distanceRangeId: string
  fareTypeId: string
  price: number
}

// PRASA Metrorail categories
export const FARE_CATEGORIES: FareCategory[] = [
  { id: "metro", name: "Metro", description: "Standard metro service" },
  { id: "metro_plus", name: "MetroPlus", description: "Enhanced metro service" },
  { id: "metro_plus_express", name: "MetroPlus Express", description: "Premium express service" },
]

// Distance ranges based on PRASA structure
export const DISTANCE_RANGES: DistanceRange[] = [
  { id: "range_1", label: "<1–10km", minKm: 0, maxKm: 10 },
  { id: "range_2", label: "11–19km", minKm: 11, maxKm: 19 },
  { id: "range_3", label: "20–30km", minKm: 20, maxKm: 30 },
  { id: "range_4", label: "31–50km", minKm: 31, maxKm: 50 },
  { id: "range_5", label: "51–100km", minKm: 51, maxKm: 100 },
  { id: "range_6", label: ">100km", minKm: 101, maxKm: null },
]

// Fare types
export const FARE_TYPES: FareType[] = [
  { id: "single", name: "Single", description: "One-way journey" },
  { id: "return", name: "Return", description: "Round trip (same day)" },
  { id: "weekly", name: "Weekly", description: "7 consecutive days" },
  { id: "monthly", name: "Monthly", description: "Calendar month" },
]

// Complete fare pricing structure
export const FARE_PRICES: FarePrice[] = [
  // Metro Category
  { categoryId: "metro", distanceRangeId: "range_1", fareTypeId: "single", price: 7.5 },
  { categoryId: "metro", distanceRangeId: "range_1", fareTypeId: "return", price: 14.5 },
  { categoryId: "metro", distanceRangeId: "range_1", fareTypeId: "weekly", price: 46.0 },
  { categoryId: "metro", distanceRangeId: "range_1", fareTypeId: "monthly", price: 142.0 },

  { categoryId: "metro", distanceRangeId: "range_2", fareTypeId: "single", price: 7.5 },
  { categoryId: "metro", distanceRangeId: "range_2", fareTypeId: "return", price: 14.5 },
  { categoryId: "metro", distanceRangeId: "range_2", fareTypeId: "weekly", price: 46.0 },
  { categoryId: "metro", distanceRangeId: "range_2", fareTypeId: "monthly", price: 142.0 },

  { categoryId: "metro", distanceRangeId: "range_3", fareTypeId: "single", price: 8.5 },
  { categoryId: "metro", distanceRangeId: "range_3", fareTypeId: "return", price: 16.5 },
  { categoryId: "metro", distanceRangeId: "range_3", fareTypeId: "weekly", price: 50.0 },
  { categoryId: "metro", distanceRangeId: "range_3", fareTypeId: "monthly", price: 160.0 },

  { categoryId: "metro", distanceRangeId: "range_4", fareTypeId: "single", price: 9.5 },
  { categoryId: "metro", distanceRangeId: "range_4", fareTypeId: "return", price: 18.5 },
  { categoryId: "metro", distanceRangeId: "range_4", fareTypeId: "weekly", price: 60.0 },
  { categoryId: "metro", distanceRangeId: "range_4", fareTypeId: "monthly", price: 190.0 },

  { categoryId: "metro", distanceRangeId: "range_5", fareTypeId: "single", price: 11.5 },
  { categoryId: "metro", distanceRangeId: "range_5", fareTypeId: "return", price: 22.5 },
  { categoryId: "metro", distanceRangeId: "range_5", fareTypeId: "weekly", price: 75.0 },
  { categoryId: "metro", distanceRangeId: "range_5", fareTypeId: "monthly", price: 235.0 },

  { categoryId: "metro", distanceRangeId: "range_6", fareTypeId: "single", price: 12.5 },
  { categoryId: "metro", distanceRangeId: "range_6", fareTypeId: "return", price: 24.5 },
  { categoryId: "metro", distanceRangeId: "range_6", fareTypeId: "weekly", price: 80.0 },
  { categoryId: "metro", distanceRangeId: "range_6", fareTypeId: "monthly", price: 252.0 },

  // MetroPlus Category
  { categoryId: "metro_plus", distanceRangeId: "range_1", fareTypeId: "single", price: 9.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_1", fareTypeId: "return", price: 18.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_1", fareTypeId: "weekly", price: 75.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_1", fareTypeId: "monthly", price: 235.0 },

  { categoryId: "metro_plus", distanceRangeId: "range_2", fareTypeId: "single", price: 10.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_2", fareTypeId: "return", price: 20.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_2", fareTypeId: "weekly", price: 80.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_2", fareTypeId: "monthly", price: 250.0 },

  { categoryId: "metro_plus", distanceRangeId: "range_3", fareTypeId: "single", price: 11.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_3", fareTypeId: "return", price: 22.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_3", fareTypeId: "weekly", price: 90.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_3", fareTypeId: "monthly", price: 270.0 },

  { categoryId: "metro_plus", distanceRangeId: "range_4", fareTypeId: "single", price: 13.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_4", fareTypeId: "return", price: 26.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_4", fareTypeId: "weekly", price: 105.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_4", fareTypeId: "monthly", price: 325.0 },

  { categoryId: "metro_plus", distanceRangeId: "range_5", fareTypeId: "single", price: 18.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_5", fareTypeId: "return", price: 36.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_5", fareTypeId: "weekly", price: 145.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_5", fareTypeId: "monthly", price: 450.0 },

  { categoryId: "metro_plus", distanceRangeId: "range_6", fareTypeId: "single", price: 21.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_6", fareTypeId: "return", price: 42.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_6", fareTypeId: "weekly", price: 170.0 },
  { categoryId: "metro_plus", distanceRangeId: "range_6", fareTypeId: "monthly", price: 530.0 },

  // MetroPlus Express Category
  { categoryId: "metro_plus_express", distanceRangeId: "range_1", fareTypeId: "single", price: 11.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_1", fareTypeId: "return", price: 22.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_1", fareTypeId: "weekly", price: 90.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_1", fareTypeId: "monthly", price: 275.0 },

  { categoryId: "metro_plus_express", distanceRangeId: "range_2", fareTypeId: "single", price: 12.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_2", fareTypeId: "return", price: 24.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_2", fareTypeId: "weekly", price: 100.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_2", fareTypeId: "monthly", price: 302.0 },

  { categoryId: "metro_plus_express", distanceRangeId: "range_3", fareTypeId: "single", price: 13.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_3", fareTypeId: "return", price: 26.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_3", fareTypeId: "weekly", price: 110.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_3", fareTypeId: "monthly", price: 335.0 },

  { categoryId: "metro_plus_express", distanceRangeId: "range_4", fareTypeId: "single", price: 16.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_4", fareTypeId: "return", price: 32.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_4", fareTypeId: "weekly", price: 135.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_4", fareTypeId: "monthly", price: 420.0 },

  { categoryId: "metro_plus_express", distanceRangeId: "range_5", fareTypeId: "single", price: 23.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_5", fareTypeId: "return", price: 46.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_5", fareTypeId: "weekly", price: 180.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_5", fareTypeId: "monthly", price: 560.0 },

  { categoryId: "metro_plus_express", distanceRangeId: "range_6", fareTypeId: "single", price: 25.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_6", fareTypeId: "return", price: 50.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_6", fareTypeId: "weekly", price: 200.0 },
  { categoryId: "metro_plus_express", distanceRangeId: "range_6", fareTypeId: "monthly", price: 620.0 },
]


export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371 
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // Distance in kilometers
}


export const getDistanceRange = (distanceKm: number): DistanceRange | null => {
  return (
    DISTANCE_RANGES.find((range) => {
      if (range.maxKm === null) {
        return distanceKm >= range.minKm
      }
      return distanceKm >= range.minKm && distanceKm <= range.maxKm
    }) || null
  )
}

// Calculate fare based on distance and service category
export const calculateFareByDistance = (distanceKm: number, categoryId: string, fareTypeId: string): number => {
  const distanceRange = getDistanceRange(distanceKm)
  if (!distanceRange) return 0

  const farePrice = FARE_PRICES.find(
    (price) =>
      price.categoryId === categoryId && price.distanceRangeId === distanceRange.id && price.fareTypeId === fareTypeId,
  )

  return farePrice ? farePrice.price : 0
}

// Get fare price with formatted currency
export const getFarePrice = (distanceKm: number, categoryId: string, fareTypeId: string): string => {
  const price = calculateFareByDistance(distanceKm, categoryId, fareTypeId)
  return price > 0 ? `R${price.toFixed(2)}` : "Price not available"
}


export const calculateFare = (fromZone: string, toZone: string, fareTypeId: string): string => {

  const zoneDistance = Math.abs(Number.parseInt(fromZone) - Number.parseInt(toZone)) * 15 
  const categoryId = Number.parseInt(fromZone) <= 2 ? "metro" : "metro_plus"

  return getFarePrice(zoneDistance, categoryId, fareTypeId)
}
