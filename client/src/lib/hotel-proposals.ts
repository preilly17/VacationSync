import { formatCurrency } from "@/lib/utils";
import type { HotelSearchResult, HotelWithDetails } from "@shared/schema";

export type ProposableHotel = HotelSearchResult | HotelWithDetails;

export interface ManualHotelProposalRequestPayload {
  tripId: number;
  hotelId?: number;
  hotelName: string;
  address: string;
  checkIn: string | null;
  checkOut: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
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
}

type TripLocationContext = {
  id: number;
  cityName?: string | null;
  countryName?: string | null;
  destination?: string | null;
};

type UserContext = { id: string } | null | undefined;

export interface HotelProposalPayload {
  hotelName: string;
  location: string;
  price: string;
  pricePerNight: string;
  rating: number | null;
  amenities: string | null;
  platform: string;
  bookingUrl: string;
  displayName: string;
  address: string | null;
  city: string | null;
  country: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
}

export const HOTEL_PROPOSAL_AMENITIES_FALLBACK = "WiFi, Breakfast";

const formatManualCurrency = (
  value: number | null | undefined,
  currency?: string | null,
) => {
  if (value === null || value === undefined) {
    return null;
  }

  const formatted = formatCurrency(value, {
    currency: currency ?? "USD",
    fallback: "",
  });

  return formatted.trim().length > 0 ? formatted : null;
};

const stringifyAmenities = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
};

const isHotelSearchResult = (
  hotel: ProposableHotel,
): hotel is HotelSearchResult => {
  return typeof hotel.id === "string";
};

const normalizeTextValue = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeDateValue = (value: unknown): string | null => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const getTrimmedString = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const coerceNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export function buildManualHotelProposalRequestPayload(
  hotel: HotelWithDetails,
  options: { trip?: TripLocationContext | null; user: UserContext },
): ManualHotelProposalRequestPayload {
  const trip = options.trip ?? null;
  const user = options.user ?? null;

  if (!trip?.id) {
    throw new Error("Trip information is required to share this stay.");
  }

  if (!user?.id) {
    throw new Error("User information is required to share this stay.");
  }

  const normalizedHotelId = Number.parseInt(String(hotel.id), 10);
  if (!Number.isFinite(normalizedHotelId)) {
    throw new Error("Invalid stay identifier");
  }

  const trimmedHotelName = getTrimmedString(hotel.hotelName);
  const fallbackName =
    trimmedHotelName.length > 0
      ? trimmedHotelName
      : (() => {
          const legacyName = getTrimmedString((hotel as { name?: string }).name);
          return legacyName.length > 0 ? legacyName : "Manual stay";
        })();

  const listingId = (() => {
    if ("listingId" in hotel) {
      const raw = (hotel as { listingId?: unknown }).listingId;
      if (typeof raw === "string" && raw.trim().length > 0) {
        return raw.trim();
      }
      if (typeof raw === "number" && Number.isFinite(raw)) {
        return String(raw);
      }
    }

    return `manual-${normalizedHotelId}`;
  })();

  const sourceType = (() => {
    const candidates = [
      (hotel as { sourceType?: unknown }).sourceType,
      hotel.bookingSource,
      hotel.bookingPlatform,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string") {
        const trimmed = candidate.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }

    return "manual";
  })();

  const priceTotal =
    coerceNumber((hotel as { priceTotal?: unknown }).priceTotal) ??
    coerceNumber((hotel as { price?: unknown }).price) ??
    coerceNumber(hotel.totalPrice) ??
    coerceNumber(hotel.pricePerNight) ??
    0;

  const pricePerNight = coerceNumber(hotel.pricePerNight);
  const currency = (() => {
    const trimmed = getTrimmedString(hotel.currency);
    return trimmed.length > 0 ? trimmed : "USD";
  })();

  const address = getTrimmedString(hotel.address);

  const parseImageUrl = (): string | null => {
    const directImage = (hotel as { imageUrl?: unknown }).imageUrl;
    if (typeof directImage === "string" && directImage.trim().length > 0) {
      return directImage.trim();
    }

    if (typeof hotel.images === "string" && hotel.images.trim().length > 0) {
      return hotel.images.trim();
    }

    if (Array.isArray(hotel.images) && hotel.images.length > 0) {
      const firstImage = hotel.images.find((image) => typeof image === "string");
      if (typeof firstImage === "string" && firstImage.trim().length > 0) {
        return firstImage.trim();
      }
    }

    return null;
  };

  const fallbackCity = (() => {
    const cityCandidates = [getTrimmedString(hotel.city), getTrimmedString(trip.cityName), getTrimmedString(trip.destination)];
    const selected = cityCandidates.find((candidate) => candidate.length > 0);
    return selected && selected.length > 0 ? selected : "Miami";
  })();

  const fallbackCountry = (() => {
    const countryCandidates = [getTrimmedString(hotel.country), getTrimmedString(trip.countryName)];
    const selected = countryCandidates.find((candidate) => candidate.length > 0);
    return selected && selected.length > 0 ? selected : "US";
  })();

  const checkInDate = normalizeDateValue(hotel.checkInDate);
  const checkOutDate = normalizeDateValue(hotel.checkOutDate);

  return {
    tripId: trip.id,
    hotelId: normalizedHotelId,
    hotelName: fallbackName,
    address: address.length > 0 ? address : "",
    checkIn: checkInDate,
    checkOut: checkOutDate,
    checkInDate,
    checkOutDate,
    listingId,
    sourceType,
    priceTotal,
    pricePerNight,
    currency,
    imageUrl: parseImageUrl(),
    location: {
      city: fallbackCity,
      country: fallbackCountry,
    },
    createdBy: user.id,
  };
}

export const buildHotelProposalPayload = (
  hotel: ProposableHotel,
): HotelProposalPayload => {
  if (isHotelSearchResult(hotel)) {
    const price = hotel.price?.trim().length ? hotel.price : "Price TBD";
    const pricePerNight = hotel.pricePerNight?.trim().length
      ? hotel.pricePerNight
      : price;
    const location = hotel.location?.trim().length
      ? hotel.location
      : "Location TBD";
    const rating = typeof hotel.rating === "number" && hotel.rating > 0
      ? hotel.rating
      : null;
    const amenities = hotel.amenities?.trim().length
      ? hotel.amenities
      : HOTEL_PROPOSAL_AMENITIES_FALLBACK;
    const platform = hotel.platform?.trim().length
      ? hotel.platform
      : "Manual";
    const fallbackBookingUrlQuery = [hotel.name, hotel.location]
      .filter((value): value is string => Boolean(value?.trim().length))
      .join(" ")
      .trim();
    const fallbackBookingUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(
      fallbackBookingUrlQuery.length > 0 ? fallbackBookingUrlQuery : "hotel",
    )}`;
    const bookingUrl = hotel.bookingUrl?.trim().length
      ? hotel.bookingUrl
      : fallbackBookingUrl;

    return {
      hotelName: hotel.name?.trim().length ? hotel.name : "Unnamed Hotel",
      location,
      price,
      pricePerNight,
      rating,
      amenities,
      platform,
      bookingUrl,
      displayName: hotel.name?.trim().length ? hotel.name : "Unnamed Hotel",
      address: normalizeTextValue(hotel.address),
      city: null,
      country: null,
      checkInDate: null,
      checkOutDate: null,
    };
  }

  const currency = hotel.currency ?? "USD";
  const primaryPrice =
    formatManualCurrency(hotel.totalPrice, currency) ??
    formatManualCurrency(hotel.pricePerNight, currency);
  const secondaryPrice =
    formatManualCurrency(hotel.pricePerNight, currency) ??
    formatManualCurrency(hotel.totalPrice, currency);
  const price = primaryPrice ?? secondaryPrice ?? "Price TBD";
  const pricePerNight = secondaryPrice ?? primaryPrice ?? "Price TBD";

  const nameCandidate =
    (hotel.hotelName && hotel.hotelName.trim().length > 0 && hotel.hotelName) ||
    (typeof hotel.name === "string" && hotel.name.trim().length > 0
      ? hotel.name
      : null);
  const hotelName = nameCandidate ?? "Unnamed Hotel";

  const manualLocation =
    (typeof hotel.location === "string" && hotel.location.trim().length > 0
      ? hotel.location
      : null) ||
    [hotel.city, hotel.country]
      .map((part) =>
        typeof part === "string" && part.trim().length > 0 ? part.trim() : null,
      )
      .filter((part): part is string => Boolean(part))
      .join(", ");

  const location = manualLocation?.trim().length
    ? manualLocation
    : "Location TBD";

  const rating = typeof hotel.hotelRating === "number" && hotel.hotelRating > 0
    ? hotel.hotelRating
    : typeof hotel.rating === "number" && hotel.rating > 0
      ? hotel.rating
      : null;

  const amenities = stringifyAmenities(hotel.amenities) ??
    HOTEL_PROPOSAL_AMENITIES_FALLBACK;

  const platform = hotel.bookingPlatform?.trim().length
    ? hotel.bookingPlatform
    : hotel.bookingSource?.trim().length
      ? hotel.bookingSource
      : "Manual entry";

  const manualFallbackBookingUrlQuery = [hotelName, manualLocation]
    .filter((value): value is string => Boolean(value?.trim().length))
    .join(" ")
    .trim();
  const manualFallbackBookingUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(
    manualFallbackBookingUrlQuery.length > 0 ? manualFallbackBookingUrlQuery : "hotel",
  )}`;
  const bookingUrl = hotel.bookingUrl?.trim().length
    ? hotel.bookingUrl
    : hotel.purchaseUrl?.trim().length
      ? hotel.purchaseUrl
      : manualFallbackBookingUrl;

  const normalizedAddress = normalizeTextValue(hotel.address);
  const normalizedCity = normalizeTextValue(hotel.city);
  const normalizedCountry = normalizeTextValue(hotel.country);
  const normalizedCheckInDate = normalizeDateValue(hotel.checkInDate);
  const normalizedCheckOutDate = normalizeDateValue(hotel.checkOutDate);

  return {
    hotelName,
    location,
    price,
    pricePerNight,
    rating,
    amenities,
    platform,
    bookingUrl,
    displayName: hotelName,
    address: normalizedAddress,
    city: normalizedCity,
    country: normalizedCountry,
    checkInDate: normalizedCheckInDate,
    checkOutDate: normalizedCheckOutDate,
  };
};
