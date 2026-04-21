import type { Station, Route } from "../types"



export const scheduleData = [
  {
    id: "1",
    route: "Vereeniging Line",
    start: "Park Station",
    end: "Vereeniging",
    trainsOutbound: [
      { time: "05:30", status: "On Time" as const, platform: "1A", trainNumber: "9820", isoTime: "2025-06-26T05:30:00+02:00" },
      { time: "06:00", status: "Delayed" as const, platform: "1A", delay: "5min", trainNumber: "9822", isoTime: "2025-06-26T06:00:00+02:00" },
      { time: "06:30", status: "On Time" as const, platform: "1B", trainNumber: "9824", isoTime: "2025-06-26T06:30:00+02:00" },
      { time: "07:00", status: "On Time" as const, platform: "1A", trainNumber: "9826", isoTime: "2025-06-26T07:00:00+02:00" },
      { time: "07:30", status: "On Time" as const, platform: "1B", trainNumber: "9828", isoTime: "2025-06-26T07:30:00+02:00" },
      { time: "08:00", status: "Delayed" as const, platform: "1A", delay: "3min", trainNumber: "9830", isoTime: "2025-06-26T08:00:00+02:00" },
    ],
  },
  {
    id: "2",
    route: "Pretoria Line",
    start: "Park Station",
    end: "Pretoria",
    trainsOutbound: [
      { time: "05:45", status: "On Time" as const, platform: "2A", trainNumber: "9840", isoTime: "2025-06-26T05:45:00+02:00" },
      { time: "06:15", status: "On Time" as const, platform: "2B", trainNumber: "9842", isoTime: "2025-06-26T06:15:00+02:00" },
      { time: "06:45", status: "On Time" as const, platform: "2A", trainNumber: "9844", isoTime: "2025-06-26T06:45:00+02:00" },
      { time: "07:15", status: "Delayed" as const, platform: "2B", delay: "2min", trainNumber: "9846", isoTime: "2025-06-26T07:15:00+02:00" },
      { time: "07:45", status: "On Time" as const, platform: "2A", trainNumber: "9848", isoTime: "2025-06-26T07:45:00+02:00" },
      { time: "08:15", status: "On Time" as const, platform: "2B", trainNumber: "9850", isoTime: "2025-06-26T08:15:00+02:00" },
    ],
  },
  {
    id: "3",
    route: "East Rand Line",
    start: "Park Station",
    end: "Springs",
    trainsOutbound: [
      { time: "05:15", status: "On Time" as const, platform: "3A", trainNumber: "9860", isoTime: "2025-06-26T05:15:00+02:00" },
      { time: "05:45", status: "On Time" as const, platform: "3B", trainNumber: "9862", isoTime: "2025-06-26T05:45:00+02:00" },
      { time: "06:15", status: "Delayed" as const, platform: "3A", delay: "10min", trainNumber: "9864", isoTime: "2025-06-26T06:15:00+02:00" },
      { time: "06:45", status: "On Time" as const, platform: "3B", trainNumber: "9866", isoTime: "2025-06-26T06:45:00+02:00" },
      { time: "07:15", status: "On Time" as const, platform: "3A", trainNumber: "9868", isoTime: "2025-06-26T07:15:00+02:00" },
      { time: "07:45", status: "On Time" as const, platform: "3B", trainNumber: "9870", isoTime: "2025-06-26T07:45:00+02:00" },
    ],
  },
  {
    id: "4",
    route: "Soweto Line",
    start: "Park Station",
    end: "Naledi",
    trainsOutbound: [
      { time: "05:00", status: "On Time" as const, platform: "4A", trainNumber: "9880", isoTime: "2025-06-26T05:00:00+02:00" },
      { time: "05:30", status: "On Time" as const, platform: "4B", trainNumber: "9882", isoTime: "2025-06-26T05:30:00+02:00" },
      { time: "06:00", status: "On Time" as const, platform: "4A", trainNumber: "9884", isoTime: "2025-06-26T06:00:00+02:00" },
      { time: "06:30", status: "Cancelled" as const, platform: "4B", trainNumber: "9886", isoTime: "2025-06-26T06:30:00+02:00" },
      { time: "07:00", status: "On Time" as const, platform: "4A", trainNumber: "9888", isoTime: "2025-06-26T07:00:00+02:00" },
      { time: "07:30", status: "On Time" as const, platform: "4B", trainNumber: "9890", isoTime: "2025-06-26T07:30:00+02:00" },
    ],
  },
].map((route) => ({
  ...route,
  trainsInbound: route.trainsOutbound
    .slice()
    .reverse()
    .map((train, idx) => ({
      ...train,
      trainNumber: `IN${train.trainNumber}`,
      id: `${route.id}-in-${idx}`,
    })),
}));



export const GAUTENG_STATIONS: Station[] = [
  // Central Johannesburg Hub
  {
    id: "park-station",
    name: "Park Station",
    line: "Central Hub",
    zone: "1",
    coordinates: { latitude: -26.2041, longitude: 28.0473 },
  },

  // Vereeniging Line
  {
    id: "vereeniging",
    name: "Vereeniging",
    line: "Vereeniging Line",
    zone: "4",
    coordinates: { latitude: -26.673, longitude: 27.9258 },
  },
  {
    id: "george-goch",
    name: "George Goch",
    line: "Vereeniging Line",
    zone: "2",
    coordinates: { latitude: -26.2308, longitude: 28.0614 },
  },

  // Pretoria Line
  {
    id: "pretoria",
    name: "Pretoria",
    line: "Pretoria Line",
    zone: "3",
    coordinates: { latitude: -25.7479, longitude: 28.2293 },
  },
  {
    id: "hatfield",
    name: "Hatfield",
    line: "Pretoria Line",
    zone: "3",
    coordinates: { latitude: -25.7497, longitude: 28.2436 },
  },

  // East Rand Line
  {
    id: "springs",
    name: "Springs",
    line: "East Rand Line",
    zone: "3",
    coordinates: { latitude: -26.25, longitude: 28.4 },
  },
  {
    id: "nigel",
    name: "Nigel",
    line: "East Rand Line",
    zone: "4",
    coordinates: { latitude: -26.4308, longitude: 28.4772 },
  },

  // West Rand Line
  {
    id: "randfontein",
    name: "Randfontein",
    line: "West Rand Line",
    zone: "4",
    coordinates: { latitude: -26.1833, longitude: 27.7 },
  },

  // Soweto Line
  {
    id: "naledi",
    name: "Naledi",
    line: "Soweto Line",
    zone: "3",
    coordinates: { latitude: -26.3167, longitude: 27.8833 },
  },

  // Additional stations
  {
    id: "leralla",
    name: "Leralla",
    line: "North Line",
    zone: "3",
    coordinates: { latitude: -26.1, longitude: 28.1 },
  },
  {
    id: "saulsville",
    name: "Saulsville",
    line: "Pretoria Line",
    zone: "3",
    coordinates: { latitude: -25.7833, longitude: 28.1167 },
  },
  {
    id: "daveyton",
    name: "Daveyton",
    line: "East Rand Line",
    zone: "3",
    coordinates: { latitude: -26.2833, longitude: 28.35 },
  },
  {
    id: "pienaarspoort",
    name: "Pienaarspoort",
    line: "Pretoria Line",
    zone: "4",
    coordinates: { latitude: -25.65, longitude: 28.2 },
  },
]

export const GAUTENG_ROUTES: Route[] = [
  {
    id: "vereeniging-line",
    name: "Vereeniging Line",
    stations: 15,
    duration: "90 min",
    color: "#E53E3E", // Red
    coordinates: [
      { latitude: -26.2041, longitude: 28.0473 }, // Park Station
      { latitude: -26.2308, longitude: 28.0614 }, // George Goch
      { latitude: -26.673, longitude: 27.9258 }, // Vereeniging
    ],
  },
  {
    id: "pretoria-line",
    name: "Pretoria Line",
    stations: 12,
    duration: "75 min",
    color: "#3182CE", // Blue
    coordinates: [
      { latitude: -26.2041, longitude: 28.0473 },
      { latitude: -25.7497, longitude: 28.2436 },
      { latitude: -25.7479, longitude: 28.2293 },
    ],
  },
  {
    id: "east-rand-line",
    name: "East Rand Line",
    stations: 10,
    duration: "60 min",
    color: "#38A169", 
    coordinates: [
      { latitude: -26.2041, longitude: 28.0473 }, 
      { latitude: -26.25, longitude: 28.4 },
      { latitude: -26.4308, longitude: 28.4772 },
    ],
  },
  {
    id: "west-rand-line",
    name: "West Rand Line",
    stations: 8,
    duration: "50 min",
    color: "#D69E2E",
    coordinates: [
      { latitude: -26.2041, longitude: 28.0473 },
      { latitude: -26.1833, longitude: 27.7 },
    ],
  },
  {
    id: "soweto-line",
    name: "Soweto Line",
    stations: 6,
    duration: "40 min",
    color: "#9F7AEA",
    coordinates: [
      { latitude: -26.2041, longitude: 28.0473 }, // Park Station
      { latitude: -26.3167, longitude: 27.8833 }, // Naledi
    ],
  },
]

// Real route connections based on Moving Gauteng data
export const ROUTE_CONNECTIONS = [
  { from: "Park Station", to: "Vereeniging", routes: 4 },
  { from: "Park Station", to: "Pretoria", routes: 2 },
  { from: "Park Station", to: "Leralla", routes: 3 },
  { from: "Park Station", to: "Randfontein", routes: 2 },
  { from: "Park Station", to: "Daveyton", routes: 1 },
  { from: "Park Station", to: "Springs", routes: 1 },
  { from: "George Goch", to: "Vereeniging", routes: 4 },
  { from: "Germiston", to: "Kwesine", routes: 1 },
  { from: "Pretoria", to: "Saulsville", routes: 3 },
  { from: "Springs", to: "Nigel", routes: 2 },
  { from: "George Goch", to: "Naledi", routes: 3 },
  { from: "Pretoria", to: "Pienaarspoort", routes: 2 },
  { from: "Pretoria", to: "De wildt", routes: 2 },
  { from: "Pretoria", to: "Oberholzer", routes: 1 },
  { from: "Pretoria", to: "Mabopane", routes: 4 },
  { from: "Belle Ombre", to: "De wildt", routes: 2 },
  { from: "Capital Park", to: "Eerste Fabrieke", routes: 4 }
]

// Train number lookup functionality (like Moving Gauteng)
export const TRAIN_NUMBERS = [
  { number: "9820", route: "Park Station - Vereeniging", departure: "06:30" },
  { number: "9821", route: "Vereeniging - Park Station", departure: "07:15" },
  { number: "9822", route: "Park Station - Pretoria", departure: "08:00" },
  { number: "9823", route: "Pretoria - Park Station", departure: "08:45" },
  { number: "9824", route: "Park Station - Springs", departure: "09:30" },
  { number: "9825", route: "Springs - Park Station", departure: "10:15" },
]

// Map configuration for the application
export const MAP_CONFIG = {
  INITIAL_REGION: {
    latitude: -26.2041, 
    longitude: 28.0473,
    latitudeDelta: 0.2,
    longitudeDelta: 0.2,
  },
  NEARBY_RADIUS_KM: 5,
  ZOOM_LEVEL: {
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  },
}
