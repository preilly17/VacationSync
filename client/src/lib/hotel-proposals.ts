import { formatCurrency } from "@/lib/utils";
import type { HotelSearchResult, HotelWithDetails } from "@shared/schema";

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
    const bookingUrl = hotel.bookingUrl?.trim().length
      ? hotel.bookingUrl
      : "";

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

  const bookingUrl = hotel.bookingUrl?.trim().length
    ? hotel.bookingUrl
    : hotel.purchaseUrl?.trim().length
      ? hotel.purchaseUrl
      : "";

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
  };
};
