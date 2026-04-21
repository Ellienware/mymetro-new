// lib/google-places.ts
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

export interface PlacePrediction {
  placeId: string;
  description: string;
}

export async function fetchAddressAutocomplete(input: string): Promise<PlacePrediction[]> {
  if (!GOOGLE_PLACES_API_KEY || input.length < 2) return [];
  const url = 'https://places.googleapis.com/v1/places:autocomplete';
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      },
      body: JSON.stringify({
        input,
        includedPrimaryTypes: ['address', 'geocode', 'premise'],
        languageCode: 'en',
      }),
    });
    const data = await response.json();
    if (data.suggestions) {
      return data.suggestions.map((s: any) => ({
        placeId: s.placePrediction.placeId,
        description: s.placePrediction.text.text,
      }));
    }
    return [];
  } catch (error) {
    console.error('Address autocomplete error:', error);
    return [];
  }
}

export async function fetchSchoolAutocomplete(input: string): Promise<PlacePrediction[]> {
  if (!GOOGLE_PLACES_API_KEY || input.length < 2) return [];
  const url = 'https://places.googleapis.com/v1/places:autocomplete';
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      },
      body: JSON.stringify({
        input,
        includedPrimaryTypes: ['school'],
        languageCode: 'en',
      }),
    });
    const data = await response.json();
    if (data.suggestions) {
      return data.suggestions.map((s: any) => ({
        placeId: s.placePrediction.placeId,
        description: s.placePrediction.text.text,
      }));
    }
    return [];
  } catch (error) {
    console.error('School autocomplete error:', error);
    return [];
  }
}

export async function fetchPlaceDetails(placeId: string): Promise<{ lat: number; lng: number; name: string; address: string } | null> {
  if (!GOOGLE_PLACES_API_KEY) return null;
  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'id,displayName,location,formattedAddress',
      },
    });
    const data = await response.json();
    if (data.location) {
      return {
        lat: data.location.latitude,
        lng: data.location.longitude,
        name: data.displayName?.text || '',
        address: data.formattedAddress || '',
      };
    }
    return null;
  } catch (error) {
    console.error('Place details error:', error);
    return null;
  }
}