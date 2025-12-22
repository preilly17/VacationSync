type RestaurantProposalInput = {
  preferredMealTime?: string | null;
  preferredDates?: string[] | null;
};

const ensureNonEmptyText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const ensureTextOrFallback = (value: unknown, fallback: string): string => {
  return ensureNonEmptyText(value) ?? fallback;
};

const normalizeRating = (value: unknown): number | string | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
};

const normalizeRestaurantId = (restaurant: unknown): number | null => {
  if (!restaurant || typeof restaurant !== "object") {
    return null;
  }

  const rawId = (restaurant as { id?: unknown }).id;
  const parsedId = Number.parseInt(String(rawId ?? ""), 10);
  if (!Number.isFinite(parsedId)) {
    return null;
  }

  const candidate = restaurant as { tripId?: unknown; trip_id?: unknown };
  const hasTripId =
    candidate.tripId !== undefined ||
    candidate.trip_id !== undefined;

  return hasTripId ? parsedId : null;
};

const extractReservationUrl = (restaurant: unknown): string | null => {
  if (!restaurant || typeof restaurant !== "object") {
    return null;
  }

  const record = restaurant as {
    reservationUrl?: unknown;
    openTableUrl?: unknown;
    bookingLinks?: Array<{ url?: unknown }>;
  };

  const directUrl = ensureNonEmptyText(record.reservationUrl);
  if (directUrl) {
    return directUrl;
  }

  const openTableUrl = ensureNonEmptyText(record.openTableUrl);
  if (openTableUrl) {
    return openTableUrl;
  }

  const bookingLink = record.bookingLinks?.find((link) => ensureNonEmptyText(link?.url));
  return bookingLink ? ensureNonEmptyText(bookingLink.url) : null;
};

export const buildRestaurantProposalRequestBody = (
  restaurant: unknown,
  options: RestaurantProposalInput = {},
): Record<string, unknown> => {
  const record = restaurant as {
    name?: unknown;
    restaurantName?: unknown;
    address?: unknown;
    location?: unknown;
    cuisineType?: unknown;
    cuisine?: unknown;
    priceRange?: unknown;
    rating?: unknown;
    phoneNumber?: unknown;
    phone?: unknown;
    website?: unknown;
    platform?: unknown;
  };

  const restaurantName = ensureTextOrFallback(
    record.name ?? record.restaurantName,
    "Restaurant to be decided",
  );
  const address = ensureTextOrFallback(
    record.address ?? record.location,
    "Address to be confirmed",
  );
  const cuisineType = ensureNonEmptyText(record.cuisineType ?? record.cuisine);
  const priceRange = ensureNonEmptyText(record.priceRange) ?? "$$";
  const rating = normalizeRating(record.rating);
  const phoneNumber = ensureNonEmptyText(record.phoneNumber ?? record.phone);
  const website = ensureNonEmptyText(record.website);
  const platform = ensureTextOrFallback(record.platform, "Foursquare");
  const reservationUrl = extractReservationUrl(restaurant);

  const payload: Record<string, unknown> = {
    restaurantName,
    address,
    cuisineType,
    priceRange,
    rating,
    phoneNumber,
    website,
    reservationUrl,
    platform,
    preferredMealTime: options.preferredMealTime ?? null,
    preferredDates: options.preferredDates ?? [],
  };

  const restaurantId = normalizeRestaurantId(restaurant);
  if (restaurantId != null) {
    payload.restaurantId = restaurantId;
  }

  return payload;
};
