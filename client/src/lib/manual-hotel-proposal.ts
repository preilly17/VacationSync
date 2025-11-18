import type { HotelWithDetails, TripCalendar } from "@shared/schema";

export type ManualHotelProposalPayload = {
  hotelId: number;
  tripId: number;
  hotelName: string;
  address: string | null;
  checkIn: string | null;
  checkOut: string | null;
  listingId: string;
  sourceType: string;
  priceTotal: number;
  pricePerNight: number | null;
  currency: string;
  imageUrl: string | null;
  location: {
    city: string;
    country: string;
  };
  tripMemberId: number | string;
  createdBy: string;
};

type TripLocationDetails = Pick<TripCalendar, "id" | "cityName" | "countryName" | "destination"> & {
  city?: string | null;
  country?: string | null;
};

const ensureText = (value: unknown): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return "";
};

const ensureNullableText = (value: unknown): string | null => {
  const text = ensureText(value);
  return text.length > 0 ? text : null;
};

const normalizeDateInput = (value: unknown): string | null => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const resolveImageUrl = (images: unknown): string | null => {
  if (!images) {
    return null;
  }

  if (typeof images === "string") {
    const trimmed = images.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(images)) {
    for (const item of images) {
      const resolved = resolveImageUrl(item);
      if (resolved) {
        return resolved;
      }
    }
    return null;
  }

  if (typeof images === "object") {
    const value = images as Record<string, unknown>;
    const candidates = [value.url, value.src, value.thumbnail];
    for (const candidate of candidates) {
      if (typeof candidate === "string") {
        const trimmed = candidate.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }
  }

  return null;
};

const getFirstDefinedValue = (
  source: Record<string, unknown>,
  keys: string[],
): unknown => {
  for (const key of keys) {
    if (key in source) {
      const value = source[key];
      if (value !== undefined && value !== null) {
        return value;
      }
    }
  }
  return undefined;
};

const parseNumberValue = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

export function normalizeTripMemberIdValue(value: unknown): number | string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? trimmed : parsed;
  }

  return null;
}

export function createManualHotelProposalPayload({
  stay,
  parsedHotelId,
  trip,
  fallbackTripId,
  currentUserId,
  tripMemberId,
}: {
  stay: HotelWithDetails;
  parsedHotelId: number;
  trip?: TripLocationDetails | null;
  fallbackTripId: number;
  currentUserId?: string | null;
  tripMemberId: number | string;
}): ManualHotelProposalPayload {
  const normalizedTripId = Number.isFinite(stay.tripId)
    ? stay.tripId
    : trip?.id ?? fallbackTripId;
  const normalizedHotelName =
    ensureText(stay.hotelName) || ensureText((stay as { name?: string }).name) || "Unnamed Stay";
  const normalizedAddress = ensureNullableText(stay.address);
  const stayRecord = stay as Record<string, unknown>;
  const normalizedCheckIn =
    normalizeDateInput(
      getFirstDefinedValue(stayRecord, [
        "checkInDate",
        "check_in_date",
        "checkIn",
        "startDate",
        "start_date",
        "start",
      ]),
    ) ?? null;
  const normalizedCheckOut =
    normalizeDateInput(
      getFirstDefinedValue(stayRecord, [
        "checkOutDate",
        "check_out_date",
        "checkOut",
        "endDate",
        "end_date",
        "end",
      ]),
    ) ?? null;
  const normalizedCity =
    ensureText(stay.city) ||
    ensureText((stay as { location?: { city?: string | null } }).location?.city) ||
    ensureText(trip?.city) ||
    ensureText(trip?.cityName) ||
    ensureText((trip as { destination?: string | null } | undefined)?.destination) ||
    "Miami";
  const normalizedCountry =
    ensureText(stay.country) ||
    ensureText((stay as { location?: { country?: string | null } }).location?.country) ||
    ensureText(trip?.country) ||
    ensureText(trip?.countryName) ||
    "US";
  const normalizedCurrency = ensureText(stay.currency) || "USD";
  const normalizedSourceType =
    ensureText((stay as { sourceType?: string | null }).sourceType) ||
    ensureText(stay.bookingPlatform) ||
    ensureText(stay.bookingSource) ||
    "manual";
  const normalizedListingId = (() => {
    const rawListingId = ensureText((stay as { listingId?: string | null }).listingId);
    return rawListingId.length > 0 ? rawListingId : `manual-${parsedHotelId}`;
  })();
  const normalizedPriceTotal = (() => {
    const candidates = [
      (stay as { priceTotal?: unknown }).priceTotal,
      stay.totalPrice,
      (stay as { price?: unknown }).price,
      (stay as { total_price?: unknown }).total_price,
      (stay as { totalPriceValue?: unknown }).totalPriceValue,
      (stay as { pricePerNight?: unknown }).pricePerNight,
    ];
    for (const candidate of candidates) {
      const parsed = parseNumberValue(candidate);
      if (parsed != null) {
        return parsed;
      }
    }
    return 0;
  })();
  const normalizedPricePerNight = (() => {
    const candidates = [
      stay.pricePerNight,
      (stay as { pricePerNightValue?: unknown }).pricePerNightValue,
      (stay as { nightlyRate?: unknown }).nightlyRate,
      (stay as { pricePerNightAmount?: unknown }).pricePerNightAmount,
    ];
    for (const candidate of candidates) {
      const parsed = parseNumberValue(candidate);
      if (parsed != null) {
        return parsed;
      }
    }
    return null;
  })();
  const normalizedImageUrl =
    resolveImageUrl((stay as { imageUrl?: string | null }).imageUrl ?? stay.images) ?? null;
  const normalizedTripMemberId = normalizeTripMemberIdValue(tripMemberId);
  if (normalizedTripMemberId == null) {
    throw new Error("Trip member id is required to propose a stay.");
  }

  return {
    hotelId: parsedHotelId,
    tripId: normalizedTripId,
    hotelName: normalizedHotelName,
    address: normalizedAddress,
    checkIn: normalizedCheckIn,
    checkOut: normalizedCheckOut,
    listingId: normalizedListingId,
    sourceType: normalizedSourceType,
    priceTotal: Number.isFinite(normalizedPriceTotal) ? normalizedPriceTotal : 0,
    pricePerNight: normalizedPricePerNight,
    currency: normalizedCurrency,
    imageUrl: normalizedImageUrl,
    location: {
      city: normalizedCity,
      country: normalizedCountry,
    },
    tripMemberId: normalizedTripMemberId,
    createdBy: (currentUserId ?? stay.userId) as string,
  };
}

export function buildHotelProposalRequestBody(
  payload: ManualHotelProposalPayload,
): Record<string, unknown> {
  const sanitizedLocation = {
    city: ensureText(payload.location?.city) || "Unknown",
    country: ensureText(payload.location?.country) || "Unknown",
  };

  return {
    hotelId: payload.hotelId,
    tripId: payload.tripId,
    hotelName: payload.hotelName,
    address: payload.address ?? null,
    checkIn: payload.checkIn,
    checkOut: payload.checkOut,
    checkInDate: payload.checkIn,
    checkOutDate: payload.checkOut,
    listingId: payload.listingId,
    sourceType: payload.sourceType,
    priceTotal: payload.priceTotal ?? 0,
    totalPrice: payload.priceTotal ?? 0,
    pricePerNight: payload.pricePerNight ?? null,
    currency: payload.currency,
    imageUrl: payload.imageUrl ?? null,
    location: sanitizedLocation,
    city: sanitizedLocation.city,
    country: sanitizedLocation.country,
    tripMemberId: payload.tripMemberId,
    createdBy: payload.createdBy,
  };
}
