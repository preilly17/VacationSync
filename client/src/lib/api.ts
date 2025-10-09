// client/src/lib/api.ts
const rawApiBaseUrl = import.meta.env.VITE_API_URL ?? "";
const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, "");

const ABSOLUTE_URL_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

const parsedApiBaseUrl = (() => {
  if (!API_BASE_URL) {
    return null;
  }

  try {
    return new URL(API_BASE_URL);
  } catch (error) {
    console.warn("Invalid VITE_API_URL provided", error);
    return null;
  }
})();

const apiBaseOrigin = parsedApiBaseUrl?.origin ?? null;
const apiBasePath = parsedApiBaseUrl
  ? parsedApiBaseUrl.pathname.replace(/\/+$/, "") || "/"
  : null;
const apiBasePathLower = apiBasePath?.toLowerCase() ?? null;
const apiBasePathLowerWithSlash =
  apiBasePathLower && apiBasePathLower !== "/"
    ? `${apiBasePathLower.replace(/\/+$/, "")}/`
    : null;
const apiBaseWithSlash = API_BASE_URL ? `${API_BASE_URL}/` : null;

export function buildApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (!API_BASE_URL) {
    return path;
  }

  const normalisedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${API_BASE_URL}/${normalisedPath}`;
}

export function ensureAbsoluteApiUrl(path: string | null | undefined) {
  if (!path) {
    return null;
  }

  if (ABSOLUTE_URL_PATTERN.test(path)) {
    return path;
  }

  return buildApiUrl(path);
}

export const stripApiBaseUrl = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  if (!ABSOLUTE_URL_PATTERN.test(value)) {
    return value;
  }

  if (!API_BASE_URL) {
    return value;
  }

  if (value === API_BASE_URL) {
    return "/";
  }

  if (apiBaseWithSlash && value.startsWith(apiBaseWithSlash)) {
    const trimmed = value.slice(API_BASE_URL.length);
    return trimmed === "" ? "/" : trimmed;
  }

  if (parsedApiBaseUrl && apiBaseOrigin && apiBasePath) {
    try {
      const parsedValue = new URL(value, parsedApiBaseUrl);

      if (parsedValue.origin === apiBaseOrigin) {
        let relativePath = parsedValue.pathname;

        if (apiBasePath !== "/" && apiBasePathLower && apiBasePathLowerWithSlash) {
          const relativePathLower = relativePath.toLowerCase();

          if (relativePathLower === apiBasePathLower) {
            relativePath = "/";
          } else if (relativePathLower.startsWith(apiBasePathLowerWithSlash)) {
            const trimmedPath = relativePath.slice(apiBasePath.length);
            relativePath = trimmedPath.startsWith("/")
              ? trimmedPath
              : `/${trimmedPath}`;
          }
        }

        const suffix = `${relativePath}${parsedValue.search}${parsedValue.hash}`;
        return suffix === "" ? "/" : suffix;
      }
    } catch (error) {
      console.warn("Failed to normalise API-relative URL", error, value);
    }
  }

  return value;
};

export function apiFetch(path: string, init?: RequestInit) {
  return fetch(buildApiUrl(path), init);
}

export async function fetchJSON(path: string, init?: RequestInit) {
  const res = await apiFetch(path, init);
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
