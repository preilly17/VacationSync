import { formatCurrency } from "@/lib/utils";
import type { HotelSearchResult, HotelWithDetails, TripWithDates } from "@shared/schema";

export type ProposableHotel = HotelSearchResult | HotelWithDetails;

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
  checkInDate: string | Date | null;
  checkOutDate: string | Date | null;
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

type TripLocationHints =
  | (Pick<TripWithDates, "destination" | "startDate" | "endDate"> & {
      cityName?: string | null;
      countryName?: string | null;
    })
  | null
  | undefined;

const ensureNonEmptyText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const extractCityAndCountry = (
  value: unknown,
): { city: string | null; country: string | null } => {
  if (typeof value !== "string") {
    return { city: null, country: null };
  }

  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return { city: null, country: null };
  }

  if (parts.length === 1) {
    return { city: parts[0], country: null };
  }

  return {
    city: parts[0],
    country: parts.slice(1).join(", "),
  };
};

const DEFAULT_CITY = "Unknown city";
const DEFAULT_COUNTRY = "Unknown country";
const DEFAULT_ADDRESS = "Address TBD";

const deriveCity = (
  payload: HotelProposalPayload,
  trip: TripLocationHints,
): string => {
  return (
    ensureNonEmptyText(payload.city) ??
    ensureNonEmptyText(extractCityAndCountry(payload.location).city) ??
    ensureNonEmptyText(trip?.cityName) ??
    ensureNonEmptyText(extractCityAndCountry(trip?.destination).city) ??
    DEFAULT_CITY
  );
};

const deriveCountry = (
  payload: HotelProposalPayload,
  trip: TripLocationHints,
): string => {
  return (
    ensureNonEmptyText(payload.country) ??
    ensureNonEmptyText(extractCityAndCountry(payload.location).country) ??
    ensureNonEmptyText(trip?.countryName) ??
    ensureNonEmptyText(extractCityAndCountry(trip?.destination).country) ??
    DEFAULT_COUNTRY
  );
};

const deriveAddress = (
  payload: HotelProposalPayload,
  city: string,
  country: string,
): string => {
  return (
    ensureNonEmptyText(payload.address) ??
    ensureNonEmptyText([payload.hotelName, city, country].filter(Boolean).join(", ")) ??
    DEFAULT_ADDRESS
  );
};

const normalizePriceValue = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const cleaned = trimmed.replace(/[^0-9.,-]/g, "");
  if (!cleaned) {
    return null;
  }

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  let normalized = cleaned;
  if (lastComma >= 0 || lastDot >= 0) {
    if (lastComma >= 0 && lastDot >= 0) {
      normalized = lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(/,/g, ".")
        : cleaned.replace(/,/g, "");
    } else if (lastComma >= 0) {
      const decimalDigits = cleaned.length - lastComma - 1;
      normalized = decimalDigits > 0 && decimalDigits <= 2
        ? cleaned.replace(/,/g, ".")
        : cleaned.replace(/,/g, "");
    } else if (lastDot >= 0) {
      const decimalDigits = cleaned.length - lastDot - 1;
      normalized = decimalDigits > 0 && decimalDigits <= 2
        ? cleaned
        : cleaned.replace(/\./g, "");
    }
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const toIsoStringOrNull = (value?: string | Date | null): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const trimmed = value.toString().trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString();
};

const fallbackIsoDate = (value?: string | Date | null, fallback?: string | Date | null): string => {
  return toIsoStringOrNull(value) ?? toIsoStringOrNull(fallback) ?? new Date().toISOString();
};

export const buildAdHocHotelProposalRequestBody = (
  payload: HotelProposalPayload,
  options: { tripId: number; trip?: TripLocationHints; currency?: string },
): Record<string, unknown> => {
  const { tripId, trip } = options;
  const city = deriveCity(payload, trip);
  const country = deriveCountry(payload, trip);
  const address = deriveAddress(payload, city, country);
  const checkInDate = fallbackIsoDate(payload.checkInDate, trip?.startDate);
  const defaultCheckoutDate = trip?.endDate
    ? trip.endDate
    : new Date(new Date(checkInDate).getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const checkOutDate = fallbackIsoDate(payload.checkOutDate, defaultCheckoutDate);
  const normalizedTotalPrice =
    normalizePriceValue(payload.price) ?? normalizePriceValue(payload.pricePerNight) ?? 0;
  const normalizedPricePerNight =
    normalizePriceValue(payload.pricePerNight) ?? normalizedTotalPrice;

  return {
    hotelName: payload.hotelName,
    address,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    nightlyPrice: normalizedPricePerNight,
    totalPrice: normalizedTotalPrice,
    currency: ensureNonEmptyText(options.currency) ?? "USD",
    bookingUrl: payload.bookingUrl,
    imageUrl: null,
    source: payload.platform,
  };
};
