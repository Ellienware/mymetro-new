// constants/gautrainFares.ts
export const GAUTRAIN_STATIONS = [
  "Hatfield",
  "Pretoria",
  "Centurion",
  "Midrand",
  "Marlboro",
  "Sandton",
  "Rosebank",
  "Park",
  "Rhodesfield",
  "OR Tambo"
] as const;

export type GautrainStation = typeof GAUTRAIN_STATIONS[number];

interface FareTable {
  [from: string]: {
    [to: string]: number;
  };
}

export interface FaresData {
  pay_as_you_go: {
    peak: FareTable;
    off_peak: FareTable;
  };
}

// The fare data you provided (paste the full JSON here)
export const faresData: FaresData = {
  pay_as_you_go: {
    peak: {
      "Hatfield": { "Hatfield": 0, "Pretoria": 38, "Centurion": 49, "Midrand": 77, "Marlboro": 91, "Sandton": 96, "Rosebank": 103, "Park": 110, "Rhodesfield": 103, "OR Tambo": 258 },
      "Pretoria": { "Hatfield": 38, "Pretoria": 0, "Centurion": 43, "Midrand": 61, "Marlboro": 84, "Sandton": 91, "Rosebank": 96, "Park": 103, "Rhodesfield": 96, "OR Tambo": 258 },
      "Centurion": { "Hatfield": 49, "Pretoria": 43, "Centurion": 0, "Midrand": 50, "Marlboro": 61, "Sandton": 79, "Rosebank": 83, "Park": 91, "Rhodesfield": 89, "OR Tambo": 258 },
      "Midrand": { "Hatfield": 77, "Pretoria": 61, "Centurion": 50, "Midrand": 0, "Marlboro": 43, "Sandton": 50, "Rosebank": 57, "Park": 61, "Rhodesfield": 58, "OR Tambo": 240 },
      "Marlboro": { "Hatfield": 91, "Pretoria": 84, "Centurion": 61, "Midrand": 43, "Marlboro": 0, "Sandton": 38, "Rosebank": 42, "Park": 50, "Rhodesfield": 43, "OR Tambo": 228 },
      "Sandton": { "Hatfield": 96, "Pretoria": 91, "Centurion": 79, "Midrand": 50, "Marlboro": 38, "Sandton": 0, "Rosebank": 38, "Park": 42, "Rhodesfield": 55, "OR Tambo": 228 },
      "Rosebank": { "Hatfield": 103, "Pretoria": 96, "Centurion": 83, "Midrand": 57, "Marlboro": 42, "Sandton": 38, "Rosebank": 0, "Park": 38, "Rhodesfield": 58, "OR Tambo": 240 },
      "Park": { "Hatfield": 110, "Pretoria": 103, "Centurion": 91, "Midrand": 61, "Marlboro": 50, "Sandton": 42, "Rosebank": 38, "Park": 0, "Rhodesfield": 61, "OR Tambo": 240 },
      "Rhodesfield": { "Hatfield": 103, "Pretoria": 96, "Centurion": 89, "Midrand": 58, "Marlboro": 43, "Sandton": 55, "Rosebank": 58, "Park": 61, "Rhodesfield": 0, "OR Tambo": 228 },
      "OR Tambo": { "Hatfield": 258, "Pretoria": 258, "Centurion": 258, "Midrand": 240, "Marlboro": 228, "Sandton": 228, "Rosebank": 240, "Park": 240, "Rhodesfield": 228, "OR Tambo": 0 }
    },
    off_peak: {
      "Hatfield": { "Hatfield": 0, "Pretoria": 30, "Centurion": 39, "Midrand": 62, "Marlboro": 73, "Sandton": 77, "Rosebank": 82, "Park": 88, "Rhodesfield": 82, "OR Tambo": 258 },
      "Pretoria": { "Hatfield": 30, "Pretoria": 0, "Centurion": 34, "Midrand": 49, "Marlboro": 67, "Sandton": 73, "Rosebank": 77, "Park": 82, "Rhodesfield": 77, "OR Tambo": 258 },
      "Centurion": { "Hatfield": 39, "Pretoria": 34, "Centurion": 0, "Midrand": 40, "Marlboro": 49, "Sandton": 63, "Rosebank": 66, "Park": 73, "Rhodesfield": 71, "OR Tambo": 258 },
      "Midrand": { "Hatfield": 62, "Pretoria": 49, "Centurion": 40, "Midrand": 0, "Marlboro": 34, "Sandton": 40, "Rosebank": 46, "Park": 49, "Rhodesfield": 46, "OR Tambo": 240 },
      "Marlboro": { "Hatfield": 73, "Pretoria": 67, "Centurion": 49, "Midrand": 34, "Marlboro": 0, "Sandton": 30, "Rosebank": 34, "Park": 40, "Rhodesfield": 34, "OR Tambo": 228 },
      "Sandton": { "Hatfield": 77, "Pretoria": 73, "Centurion": 63, "Midrand": 40, "Marlboro": 30, "Sandton": 0, "Rosebank": 30, "Park": 34, "Rhodesfield": 44, "OR Tambo": 228 },
      "Rosebank": { "Hatfield": 82, "Pretoria": 77, "Centurion": 66, "Midrand": 46, "Marlboro": 34, "Sandton": 30, "Rosebank": 0, "Park": 30, "Rhodesfield": 46, "OR Tambo": 240 },
      "Park": { "Hatfield": 88, "Pretoria": 82, "Centurion": 73, "Midrand": 49, "Marlboro": 40, "Sandton": 34, "Rosebank": 30, "Park": 0, "Rhodesfield": 49, "OR Tambo": 240 },
      "Rhodesfield": { "Hatfield": 82, "Pretoria": 77, "Centurion": 71, "Midrand": 46, "Marlboro": 34, "Sandton": 44, "Rosebank": 46, "Park": 49, "Rhodesfield": 0, "OR Tambo": 228 },
      "OR Tambo": { "Hatfield": 258, "Pretoria": 258, "Centurion": 258, "Midrand": 240, "Marlboro": 228, "Sandton": 228, "Rosebank": 240, "Park": 240, "Rhodesfield": 228, "OR Tambo": 0 }
    }
  }
};

export function getGautrainFare(from: string, to: string, isPeak: boolean = true): number {
  const table = isPeak ? faresData.pay_as_you_go.peak : faresData.pay_as_you_go.off_peak;
  const fromFares = table[from];
  if (!fromFares) return 0;
  return fromFares[to] || 0;
}