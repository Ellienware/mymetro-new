// services/geocoding.ts
export const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('Missing Google Places API key');
    return null;
  }
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&components=country:ZA`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.status === 'OK' && data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry.location;
      return { lat, lng };
    }
    console.warn('Geocoding failed:', data.status);
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};