import type { HotelWithDetails, TripCalendar, TripMember, User } from "@shared/schema";

type TripMemberLike = Pick<TripMember, "id" | "userId"> & {
  user?: Pick<User, "id"> | null;
};

type TripLocationDetails =
  | (Partial<Pick<TripCalendar, "id" | "cityName" | "countryName" | "destination">> & {
      city?: string | null;
      country?: string | null;
      members?: TripMemberLike[] | null;
    })
  | null
  | undefined;

type MinimalUser = (Pick<User, "id"> & { tripMemberId?: string | number | null }) | null | undefined;

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
  tripMemberId: string | number | null;
  createdBy: string;
};

const ensureNullableText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const ensureString = (value: unknown, fallback: string): string => {
  return ensureNullableText(value) ?? fallback;
};

const toNumericValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeDateInput = (value: unknown): string | null => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const normalizeIdentifier = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }

  return null;
};

const extractDestinationParts = (value: unknown): { city: string | null; country: string | null } => {
  const text = ensureNullableText(value);
  if (!text) {
    return { city: null, country: null };
  }

  const parts = text.split(",").map((part) => ensureNullableText(part));
  if (parts.length === 1) {
    return { city: parts[0], country: null };
  }

  return {
    city: parts[0],
    country: parts[parts.length - 1],
  };
};

const resolveStayLocationParts = (
  stay: HotelWithDetails,
  trip: TripLocationDetails,
): { city: string; country: string } => {
  const stayLocation = (stay as { location?: unknown }).location;
  const stayLocationObject =
    stayLocation && typeof stayLocation === "object" && !Array.isArray(stayLocation)
      ? (stayLocation as { city?: unknown; country?: unknown })
      : null;
  const stayLocationText =
    typeof stayLocation === "string" ? stayLocation : ensureNullableText((stayLocationObject as { text?: string })?.text);

  const locationTextParts = extractDestinationParts(stayLocationText);
  const tripDestinationParts = extractDestinationParts(trip?.destination);
  const tripCityCandidate =
    ensureNullableText((trip as { city?: string | null })?.city) ??
    ensureNullableText(trip?.cityName) ??
    tripDestinationParts.city;
  const tripCountryCandidate =
    ensureNullableText((trip as { country?: string | null })?.country) ??
    ensureNullableText(trip?.countryName) ??
    tripDestinationParts.country;

  const city =
    ensureNullableText(stay.city) ??
    ensureNullableText(stayLocationObject?.city) ??
    locationTextParts.city ??
    tripCityCandidate ??
    "Unknown";
  const country =
    ensureNullableText(stay.country) ??
    ensureNullableText(stayLocationObject?.country) ??
    locationTextParts.country ??
    tripCountryCandidate ??
    "Unknown";

  return { city, country };
};

const resolveTripMemberId = (
  trip: TripLocationDetails,
  normalizedUserId: string | null,
  fallbackTripMemberId: string | number | null | undefined,
): string | number | null => {
  const members = trip?.members ?? null;
  if (members && normalizedUserId) {
    for (const member of members) {
      const memberUserId =
        normalizeIdentifier(member.userId) ?? normalizeIdentifier(member.user?.id);
      if (memberUserId && memberUserId === normalizedUserId) {
        if (member.id !== undefined && member.id !== null) {
          return member.id;
        }
      }
    }
  }

  if (fallbackTripMemberId !== undefined && fallbackTripMemberId !== null && fallbackTripMemberId !== "") {
    return fallbackTripMemberId;
  }

  return null;
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
  user,
}: {
  stay: HotelWithDetails;
  parsedHotelId: number;
  trip?: TripLocationDetails;
  fallbackTripId: number;
  user?: MinimalUser;
}): ManualHotelProposalPayload {
  const normalizedTripId = Number.isFinite(stay.tripId)
    ? stay.tripId
    : trip?.id ?? fallbackTripId;
  const normalizedHotelName =
    ensureString(stay.hotelName, ensureString((stay as { name?: string }).name, "Unnamed Stay"));
  const normalizedAddress = ensureNullableText(stay.address);
  const { city: normalizedCity, country: normalizedCountry } = resolveStayLocationParts(stay, trip);
  const normalizedCurrency = ensureString(stay.currency, "USD");
  const normalizedSourceType =
    ensureString((stay as { sourceType?: string | null }).sourceType, "") ||
    ensureString(stay.bookingPlatform, "") ||
    ensureString(stay.bookingSource, "manual");
  const normalizedListingId = (() => {
    const rawListingId =
      ensureNullableText((stay as { listingId?: string | null }).listingId) ??
      ensureNullableText(stay.bookingReference);
    return rawListingId ?? `manual-${parsedHotelId}`;
  })();
  const normalizedPriceTotal =
    toNumericValue((stay as { priceTotal?: unknown }).priceTotal) ??
    toNumericValue(stay.totalPrice) ??
    toNumericValue((stay as { price?: unknown }).price) ??
    0;
  const normalizedPricePerNight =
    toNumericValue(stay.pricePerNight) ??
    toNumericValue((stay as { nightlyRate?: unknown }).nightlyRate) ??
    toNumericValue((stay as { pricePerNightValue?: unknown }).pricePerNightValue) ??
    null;
  const normalizedImageUrl =
    resolveImageUrl((stay as { imageUrl?: string | null }).imageUrl ?? stay.images) ?? null;
  const normalizedCheckIn = normalizeDateInput(
    (stay as { start_date?: unknown }).start_date ??
      (stay as { startDate?: unknown }).startDate ??
      stay.checkInDate,
  );
  const normalizedCheckOut = normalizeDateInput(
    (stay as { end_date?: unknown }).end_date ??
      (stay as { endDate?: unknown }).endDate ??
      stay.checkOutDate,
  );
  const normalizedUserId = normalizeIdentifier(user?.id ?? stay.userId);
  const normalizedTripMemberId = resolveTripMemberId(
    trip,
    normalizedUserId,
    user?.tripMemberId ?? (user as { activeTripMemberId?: string | number | null })?.activeTripMemberId,
  );
  const normalizedSource =
    ensureNullableText((stay as { sourceType?: string | null }).sourceType) ??
    ensureNullableText(stay.bookingPlatform) ??
    ensureNullableText(stay.bookingSource) ??
    "manual";

  return {
    hotelId: parsedHotelId,
    tripId: normalizedTripId,
    hotelName: normalizedHotelName,
    address: normalizedAddress,
    checkIn: normalizedCheckIn,
    checkOut: normalizedCheckOut,
    listingId: normalizedListingId,
    sourceType: normalizedSourceType || normalizedSource,
    priceTotal: Number.isFinite(normalizedPriceTotal) ? normalizedPriceTotal : 0,
    pricePerNight: normalizedPricePerNight,
    currency: normalizedCurrency,
    imageUrl: normalizedImageUrl,
    location: {
      city: normalizedCity,
      country: normalizedCountry,
    },
    tripMemberId: normalizedTripMemberId,
    createdBy: normalizeIdentifier(user?.id) ?? normalizeIdentifier(stay.userId) ?? "system",
  };
}

export function buildHotelProposalRequestBody(
  payload: ManualHotelProposalPayload,
): Record<string, unknown> {
  const city = ensureString(payload.location.city, "City to be decided");
  const country = ensureString(payload.location.country, "Country to be decided");

  return {
    hotelId: payload.hotelId,
    hotelName: ensureString(payload.hotelName, "Saved stay"),
    address:
      ensureNullableText(payload.address) ??
      ensureNullableText(`${payload.hotelName}, ${city}, ${country}`) ??
      "Address to be provided",
    checkIn: payload.checkIn ?? payload.checkOut ?? new Date().toISOString(),
    checkOut:
      payload.checkOut ??
      new Date(
        new Date(payload.checkIn ?? new Date().toISOString()).getTime() + 2 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    nightlyPrice: payload.pricePerNight ?? payload.priceTotal ?? 0,
    totalPrice: Number.isFinite(payload.priceTotal) ? payload.priceTotal : null,
    currency: ensureString(payload.currency, "USD"),
    bookingUrl: ensureNullableText(payload.imageUrl),
    imageUrl: ensureNullableText(payload.imageUrl),
    source: ensureString(payload.sourceType, "Manual"),
  };
}
