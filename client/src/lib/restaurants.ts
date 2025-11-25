import { buildApiUrl } from "./api";

export interface AddRestaurantPayload {
  name: string;
  address: string;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  url?: string | null;
  notes?: string | null;
  priceLevel?: string | null;
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

export async function addRestaurant(
  tripId: number | string,
  data: AddRestaurantPayload,
) {
  const parsedTripId = typeof tripId === "string" ? Number.parseInt(tripId, 10) : tripId;
  if (!Number.isFinite(parsedTripId) || parsedTripId <= 0) {
    throw new Error("A valid trip id is required to add a restaurant.");
  }

  const payload = sanitizePayload(data);
  const response = await fetch(buildApiUrl(`/api/trips/${parsedTripId}/restaurants`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      typeof errorBody?.error === "string"
        ? errorBody.error
        : typeof errorBody?.message === "string"
          ? errorBody.message
          : "Failed to add restaurant";
    const error = new Error(`[${response.status}] ${message}`) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }

  const result = await response.json();
  console.log(`✅ Restaurant created for trip ${parsedTripId}`);
  return result;
}

