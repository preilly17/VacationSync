import type { RestaurantPlatform } from "@/types/restaurants";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_24H_REGEX = /^\d{2}:\d{2}$/;

type NumericLike = string | number | null | undefined;

const normalizeCitySlug = (city: string): string => {
  const trimmed = city.trim().toLowerCase();
  if (!trimmed) {
    throw new Error("City is required");
  }

  return trimmed
    .replace(/[^a-z0-9\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

const coerceNumber = (value: NumericLike): number | undefined => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) {
    throw new Error("Latitude/longitude must be numbers");
  }

  return numeric;
};

const assertValidDate = (date: string) => {
  if (!ISO_DATE_REGEX.test(date)) {
    throw new Error("Date must be in YYYY-MM-DD format");
  }
};

const assertValidTime = (time: string | undefined) => {
  if (!time) {
    throw new Error("Time is required");
  }

  if (!TIME_24H_REGEX.test(time)) {
    throw new Error("Time must be in HH:mm format");
  }
};

export interface BuildResyUrlOptions {
  city: string;
  stateCode?: string | null;
  date: string;
  partySize: number;
}

export const buildResyUrl = ({ city, stateCode, date, partySize }: BuildResyUrlOptions): string => {
  assertValidDate(date);
  const slugCity = normalizeCitySlug(city);
  const seats = Math.max(1, Number.isFinite(partySize) ? partySize : Number(partySize) || 1);
  const params = new URLSearchParams({ date, seats: String(seats) });
  const cityPart = stateCode && stateCode.trim().length > 0
    ? `${slugCity}-${stateCode.trim().toLowerCase()}`
    : slugCity;

  return `https://resy.com/cities/${cityPart}/search?${params.toString()}`;
};

export interface BuildOpenTableUrlOptions {
  city: string;
  date: string;
  time: string;
  partySize: number;
  latitude?: NumericLike;
  longitude?: NumericLike;
}

export const buildOpenTableUrl = ({
  city,
  date,
  time,
  partySize,
  latitude,
  longitude,
}: BuildOpenTableUrlOptions): string => {
  assertValidDate(date);
  assertValidTime(time);

  if (!city.trim()) {
    throw new Error("City is required");
  }

  const covers = Math.max(1, Number.isFinite(partySize) ? partySize : Number(partySize) || 1);
  const params = new URLSearchParams();
  params.set("dateTime", `${date}T${time}:00`);
  params.set("covers", String(covers));
  params.set("searchedLocationName", city.trim());

  const lat = coerceNumber(latitude);
  const lng = coerceNumber(longitude);
  const hasCoords = typeof lat === "number" && typeof lng === "number";

  params.set("shouldUseLatLongSearch", hasCoords ? "true" : "false");
  if (hasCoords) {
    params.set("latitude", String(lat));
    params.set("longitude", String(lng));
  }

  return `https://www.opentable.com/s?${params.toString()}`;
};

export const buildRestaurantUrl = (
  options: BuildResyUrlOptions | BuildOpenTableUrlOptions & { platform: RestaurantPlatform },
): string => {
  if (options.platform === "resy") {
    const { platform, ...rest } = options as { platform: RestaurantPlatform } & BuildResyUrlOptions;
    return buildResyUrl(rest);
  }

  const { platform, ...rest } = options as { platform: RestaurantPlatform } & BuildOpenTableUrlOptions;
  return buildOpenTableUrl(rest);
};

export type { RestaurantPlatform };
