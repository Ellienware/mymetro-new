// services/places.ts
import axios from 'axios';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

export interface Place {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  openingHours?: boolean;
  wheelchairAccessible?: boolean;
  photoRef?: string;
  types: string[];
  vicinity?: string;
}

export interface PlaceDetails extends Place {
  phone?: string;
  website?: string;
  openingHoursText?: string;
  wheelchairAccessibleEntrance?: boolean;
  reviews?: any[];
}

// Search nearby places by location (lat/lng) and radius (meters)
export async function searchNearbyPlaces(
  lat: number,
  lng: number,
  radius: number = 1500,
  type?: string
): Promise<Place[]> {
  const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
  const params: any = {
    location: `${lat},${lng}`,
    radius,
    key: GOOGLE_PLACES_API_KEY,
  };
  if (type) params.type = type;
  const response = await axios.get(url, { params });
  if (response.data.status !== 'OK') return [];
  return response.data.results.map((item: any) => ({
    placeId: item.place_id,
    name: item.name,
    address: item.vicinity,
    lat: item.geometry.location.lat,
    lng: item.geometry.location.lng,
    rating: item.rating,
    userRatingsTotal: item.user_ratings_total,
    priceLevel: item.price_level,
    openingHours: item.opening_hours?.open_now,
    wheelchairAccessible: item.wheelchair_accessible_entrance,
    photoRef: item.photos?.[0]?.photo_reference,
    types: item.types,
    vicinity: item.vicinity,
  }));
}

// Text search for places by query (name, category, etc.)
export async function searchPlacesByText(
  query: string,
  lat?: number,
  lng?: number,
  radius?: number
): Promise<Place[]> {
  const url = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
  const params: any = {
    query,
    key: GOOGLE_PLACES_API_KEY,
  };
  if (lat && lng && radius) {
    params.location = `${lat},${lng}`;
    params.radius = radius;
  }
  const response = await axios.get(url, { params });
  if (response.data.status !== 'OK') return [];
  return response.data.results.map((item: any) => ({
    placeId: item.place_id,
    name: item.name,
    address: item.formatted_address,
    lat: item.geometry.location.lat,
    lng: item.geometry.location.lng,
    rating: item.rating,
    userRatingsTotal: item.user_ratings_total,
    priceLevel: item.price_level,
    openingHours: item.opening_hours?.open_now,
    photoRef: item.photos?.[0]?.photo_reference,
    types: item.types,
  }));
}

// Get detailed place information by placeId
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const url = 'https://maps.googleapis.com/maps/api/place/details/json';
  const params = {
    place_id: placeId,
    fields: 'name,formatted_address,geometry,rating,user_ratings_total,price_level,opening_hours,formatted_phone_number,website,wheelchair_accessible_entrance,reviews,photos',
    key: GOOGLE_PLACES_API_KEY,
  };
  const response = await axios.get(url, { params });
  if (response.data.status !== 'OK') return null;
  const result = response.data.result;
  return {
    placeId: result.place_id,
    name: result.name,
    address: result.formatted_address,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    rating: result.rating,
    userRatingsTotal: result.user_ratings_total,
    priceLevel: result.price_level,
    openingHours: result.opening_hours?.open_now,
    openingHoursText: result.opening_hours?.weekday_text?.join('\n'),
    phone: result.formatted_phone_number,
    website: result.website,
    wheelchairAccessible: result.wheelchair_accessible_entrance,
    reviews: result.reviews,
    photoRef: result.photos?.[0]?.photo_reference,
    types: result.types,
  };
}

// Get photo URL (max width 400)
export function getPlacePhotoUrl(photoRef: string, maxWidth = 400): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoRef}&key=${GOOGLE_PLACES_API_KEY}`;
}