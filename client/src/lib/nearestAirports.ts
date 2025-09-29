import { apiFetch } from "@/lib/api";
import type { LocationResult } from "@/components/SmartLocationSearch";

export interface NearbyAirport {
  iata: string;
  name: string;
  municipality: string | null;
  isoCountry: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
}

export interface NearestAirportResponse {
  cityName: string | null;
  countryName: string | null;
  latitude: number;
  longitude: number;
  airports: NearbyAirport[];
}

const parseNumeric = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const extractCoordinates = (location: LocationResult): { latitude: number | null; longitude: number | null } => {
  const latitude = parseNumeric(location.latitude);
  const longitude = parseNumeric(location.longitude);
  return { latitude, longitude };
};

export async function fetchNearestAirportsForLocation(location: LocationResult): Promise<NearestAirportResponse> {
  const { latitude, longitude } = extractCoordinates(location);

  if (latitude === null || longitude === null) {
    throw new Error("Selected city does not include coordinates for airport lookup");
  }

  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
  });

  const cityName = location.cityName ?? location.name ?? location.displayName;
  if (cityName) {
    params.set("city_name", cityName);
  }
  if (location.countryName) {
    params.set("country_name", location.countryName);
  }

  const response = await apiFetch(`/api/flights/airports?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch nearby airports (${response.status})`);
  }

  const data = await response.json();
  const airports = Array.isArray(data.airports)
    ? data.airports
        .map((airport: any) => {
          const iata: unknown = airport?.iata ?? airport?.iata_code;
          if (typeof iata !== "string" || iata.trim().length === 0) {
            return null;
          }

          return {
            iata: iata.toUpperCase(),
            name: typeof airport?.name === "string" ? airport.name : "",
            municipality: typeof airport?.municipality === "string" ? airport.municipality : null,
            isoCountry: typeof airport?.iso_country === "string" ? airport.iso_country : null,
            latitude: parseNumeric(airport?.latitude),
            longitude: parseNumeric(airport?.longitude),
            distanceKm: parseNumeric(airport?.distance_km),
          } satisfies NearbyAirport;
        })
        .filter((airport: NearbyAirport | null): airport is NearbyAirport => Boolean(airport && airport.name))
    : [];

  return {
    cityName: typeof data.city_name === "string" ? data.city_name : cityName ?? null,
    countryName: typeof data.country_name === "string" ? data.country_name : location.countryName ?? null,
    latitude,
    longitude,
    airports,
  };
}
