import { buildApiUrl } from "./api";

export interface AddRestaurantPayload {
  name: string;
  address: string;
  city?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  url?: string | null;
  notes?: string | null;
  priceLevel?: string | number | null;
  priceRange?: string | null;
  rating?: number | null;
  reservationDate?: string | Date | null;
  reservationTime?: string | null;
  partySize?: number | null;
  cuisineType?: string | null;
  website?: string | null;
  openTableUrl?: string | null;
  phoneNumber?: string | null;
  reservationStatus?: string | null;
  confirmationNumber?: string | null;
  specialRequests?: string | null;
  zipCode?: string | null;
}

const sanitizePayload = (payload: AddRestaurantPayload): Record<string, unknown> => {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
};

const priceLevelToRange = (value?: string | number | null): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const clamped = Math.max(1, Math.min(4, Math.round(value)));
    return "$".repeat(clamped);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  return undefined;
};

export async function addRestaurant(
  tripId: number | string,
  data: AddRestaurantPayload,
) {
  const parsedTripId = typeof tripId === "string" ? Number.parseInt(tripId, 10) : tripId;
  if (!Number.isFinite(parsedTripId) || parsedTripId <= 0) {
    throw new Error("A valid trip id is required to add a restaurant.");
  }

  const payload = sanitizePayload({
    ...data,
    latitude: data.latitude ?? data.lat ?? null,
    longitude: data.longitude ?? data.lng ?? null,
    priceRange: data.priceRange ?? priceLevelToRange(data.priceLevel),
    priceLevel: undefined,
  });
  const response = await fetch(buildApiUrl(`/api/trips/${parsedTripId}/restaurants`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => undefined);
    const message = (() => {
      if (errorBody && typeof errorBody === "object") {
        if (typeof (errorBody as { error?: unknown }).error === "string") {
          return (errorBody as { error: string }).error;
        }

        if (typeof (errorBody as { message?: unknown }).message === "string") {
          return (errorBody as { message: string }).message;
        }

        if (typeof (errorBody as { details?: unknown }).details === "string") {
          return (errorBody as { details: string }).details;
        }
      }

      return response.statusText || "Failed to add restaurant";
    })();

    throw new Error(`[${response.status}] ${message}`);
  }

  const result = await response.json();
  console.log(`✅ Restaurant created for trip ${parsedTripId}`);
  return result;
}

