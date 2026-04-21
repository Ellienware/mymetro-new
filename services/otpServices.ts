// services/otpServices.ts
const OTP_URL = 'http://192.168.0.199:8080/otp/routers/default/index/graphql';

interface OTPItineraryLeg {
  mode: string;
  distance: number;
  from: { name: string };
  to: { name: string };
  startTime: number;
  endTime: number;
  route?: { shortName?: string; longName?: string };
  agency?: { name?: string };
  legGeometry?: { points: string };
}

interface OTPItinerary {
  duration: number;
  walkDistance: number;
  startTime: number;
  endTime: number;
  legs: OTPItineraryLeg[];
}

// Map frontend mode names to OTP mode enums
const mapModeToOTP = (mode: string): string => {
  switch (mode.toLowerCase()) {
    case 'rail': return 'RAIL';
    case 'bus': return 'BUS';
    case 'walk': return 'WALK';
    case 'tram': return 'TRAM';
    case 'subway': return 'SUBWAY';
    default: return 'TRANSIT';
  }
};

export const planJourney = async (
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  date: string,
  time: string,
  selectedModes: string[] = ['RAIL', 'BUS', 'WALK'] // default to Rail, Bus, Walk
): Promise<OTPItinerary[]> => {
  // Build transportModes array: always include WALK, plus the selected transit modes
  const transportModes = [{ mode: 'WALK' }];
  const transitModes = selectedModes
    .filter(m => m !== 'WALK')
    .map(m => ({ mode: mapModeToOTP(m) }));
  transportModes.push(...transitModes);

  // If no transit modes selected, still allow walking only
  if (transitModes.length === 0) {
    transportModes.push({ mode: 'TRANSIT' }); // fallback
  }

  const query = `
    {
      plan(
        from: { lat: ${fromLat}, lon: ${fromLon} }
        to: { lat: ${toLat}, lon: ${toLon} }
        date: "${date}"
        time: "${time}"
        transportModes: ${JSON.stringify(transportModes).replace(/"([^"]+)":/g, '$1:')}
      ) {
        itineraries {
          duration
          walkDistance
          startTime
          endTime
          legs {
            mode
            distance
            from { name lat lon }
            to { name lat lon }
            startTime
            endTime
            route {
              shortName
              longName
            }
            agency {
              name
            }
            legGeometry {
              points
            }
          }
        }
      }
    }
  `;

  const response = await fetch(OTP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const result = await response.json();
  if (result.errors) throw new Error(result.errors[0].message);
  return result.data.plan.itineraries;
};