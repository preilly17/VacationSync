// client/src/lib/api.ts
export async function fetchJSON(path: string) {
  const res = await fetch(path);
  const text = await res.text();
  // Try to parse JSON, but return raw text if it isn't JSON
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, data: text };
  }
}

export function getHealth() {
  return fetchJSON("/health");
}

export function searchFlights(params: {
  origin: string;
  destination: string;
  departureDate: string; // YYYY-MM-DD
  returnDate?: string;
  adults?: number;
  travelClass?: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
  airline?: string;
  filter?: "best" | "cheapest" | "fastest";
  page?: number;
  limit?: number;
  provider?: "amadeus" | "duffel" | "both";
}) {
  const q = new URLSearchParams({
    origin: params.origin,
    destination: params.destination,
    departureDate: params.departureDate,
    ...(params.returnDate ? { returnDate: params.returnDate } : {}),
    ...(params.adults ? { adults: String(params.adults) } : {}),
    ...(params.travelClass ? { travelClass: params.travelClass } : {}),
    ...(params.airline ? { airline: params.airline } : {}),
    ...(params.filter ? { filter: params.filter } : {}),
    ...(params.page ? { page: String(params.page) } : {}),
    ...(params.limit ? { limit: String(params.limit) } : {}),
    ...(params.provider ? { provider: params.provider } : {}),
  });
  return fetchJSON(`/search/flights?${q.toString()}`);
}

export function searchHotels(params: {
  cityCode: string; // IATA city code, e.g. LAX, NYC, LON
  checkInDate: string;  // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  adults?: number;
  roomQuantity?: number;
}) {
  const q = new URLSearchParams({
    cityCode: params.cityCode,
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
    ...(params.adults ? { adults: String(params.adults) } : {}),
    ...(params.roomQuantity ? { roomQuantity: String(params.roomQuantity) } : {}),
  });
  return fetchJSON(`/search/hotels?${q.toString()}`);
}

export function searchActivities(params: {
  latitude: number;
  longitude: number;
  radiusKm?: number;
}) {
  const q = new URLSearchParams({
    latitude: String(params.latitude),
    longitude: String(params.longitude),
    ...(params.radiusKm ? { radius: String(params.radiusKm) } : {}),
  });
  return fetchJSON(`/search/activities?${q.toString()}`);
}
