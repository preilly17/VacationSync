import type { HotelWithDetails, TripCalendar } from "@shared/schema";

export type ManualHotelProposalPayload = {
  hotelId: number;
  tripId: number;
  hotelName: string;
  address: string;
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

export function createManualHotelProposalPayload({
  stay,
  parsedHotelId,
  trip,
  fallbackTripId,
  currentUserId,
}: {
  stay: HotelWithDetails;
  parsedHotelId: number;
  trip?: TripLocationDetails | null;
  fallbackTripId: number;
  currentUserId?: string | null;
}): ManualHotelProposalPayload {
  const normalizedTripId = Number.isFinite(stay.tripId)
    ? stay.tripId
    : trip?.id ?? fallbackTripId;
  const normalizedHotelName =
    ensureText(stay.hotelName) || ensureText((stay as { name?: string }).name) || "Unnamed Stay";
  const normalizedAddress = ensureText(stay.address);
  const normalizedCity =
    ensureText(stay.city) ||
    ensureText(trip?.city) ||
    ensureText(trip?.cityName) ||
    ensureText((trip as { destination?: string | null } | undefined)?.destination) ||
    "Miami";
  const normalizedCountry =
    ensureText(stay.country) || ensureText(trip?.country) || ensureText(trip?.countryName) || "US";
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
  const normalizedPriceTotal =
    typeof stay.totalPrice === "number" && Number.isFinite(stay.totalPrice)
      ? stay.totalPrice
      : typeof stay.pricePerNight === "number" && Number.isFinite(stay.pricePerNight)
        ? stay.pricePerNight
        : 0;
  const normalizedPricePerNight =
    typeof stay.pricePerNight === "number" && Number.isFinite(stay.pricePerNight)
      ? stay.pricePerNight
      : null;
  const normalizedImageUrl =
    resolveImageUrl((stay as { imageUrl?: string | null }).imageUrl ?? stay.images) ?? null;

  return {
    hotelId: parsedHotelId,
    tripId: normalizedTripId,
    hotelName: normalizedHotelName,
    address: normalizedAddress,
    checkIn: normalizeDateInput(stay.checkInDate),
    checkOut: normalizeDateInput(stay.checkOutDate),
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
    createdBy: (currentUserId ?? stay.userId) as string,
  };
}

export function buildHotelProposalRequestBody(
  payload: ManualHotelProposalPayload,
): Record<string, unknown> {
  return {
    hotelId: payload.hotelId,
  };
}
