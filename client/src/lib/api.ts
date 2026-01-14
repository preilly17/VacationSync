// client/src/lib/api.ts
const globalEnv =
  typeof globalThis !== "undefined"
    ? (globalThis as { __VITE_ENV__?: Record<string, string> }).__VITE_ENV__
    : undefined;

const rawApiBaseUrl = globalEnv?.VITE_API_URL ?? "";
const DEFAULT_PROD_API_BASE_URL = "https://vacationsync-api.onrender.com";
const PROD_DOMAIN_SUFFIX = ".tripsyncbeta.com";

const API_BASE_URL = (() => {
  const sanitized = rawApiBaseUrl.replace(/\/+$/, "");

  if (typeof window === "undefined" || sanitized.length === 0) {
    if (typeof window === "undefined") {
      return sanitized;
    }

    const currentHostname = window.location.hostname?.toLowerCase();
    if (!currentHostname) {
      return sanitized;
    }

    if (currentHostname === "tripsyncbeta.com" || currentHostname.endsWith(PROD_DOMAIN_SUFFIX)) {
      return DEFAULT_PROD_API_BASE_URL;
    }

    return sanitized;
  }

  try {
    const url = new URL(sanitized);
    const currentHostname = window.location.hostname;

    if (!currentHostname) {
      return sanitized;
    }

    const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1"]);
    const isLoopback = (host: string) => LOOPBACK_HOSTNAMES.has(host);

    if (
      isLoopback(url.hostname) &&
      isLoopback(currentHostname) &&
      url.hostname !== currentHostname
    ) {
      url.hostname = currentHostname;
      return url.toString().replace(/\/+$/, "");
    }
  } catch {
    // ignore invalid URL values – treat them as relative paths
  }

  return sanitized;
})();

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

export function buildWebSocketUrl(path: string) {
  const explicitWsUrl = globalEnv?.VITE_WS_URL;

  const normalisePath = (target: string) =>
    target.startsWith("/") ? target : `/${target}`;

  const adjustLoopbackHost = (url: URL) => {
    try {
      const currentHostname = window.location.hostname;
      const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1"]);
      const isLoopback = (host: string) => LOOPBACK_HOSTNAMES.has(host);

      if (isLoopback(url.hostname) && isLoopback(currentHostname) && url.hostname !== currentHostname) {
        url.hostname = currentHostname;
      }
    } catch {
      // ignore
    }
    return url;
  };

  if (explicitWsUrl && typeof explicitWsUrl === "string") {
    try {
      const url = new URL(explicitWsUrl.replace(/\/+$/, ""));
      if (typeof window !== "undefined") {
        adjustLoopbackHost(url);
      }
      url.pathname = normalisePath(path);
      return url.toString();
    } catch {
      // fall through to relative handling
    }
  }

  if (API_BASE_URL) {
    try {
      const url = new URL(API_BASE_URL);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.pathname = normalisePath(path);
      return url.toString();
    } catch {
      // ignore invalid base url – fall back to window origin if available
    }
  }

  if (typeof window !== "undefined" && window.location) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return `${protocol}//${host}${normalisePath(path)}`;
  }

  return normalisePath(path);
}

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
