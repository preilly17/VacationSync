import { parseISO, startOfDay, startOfYear, endOfYear } from "date-fns";
import type { TripWithDetails } from "@shared/schema";

type IsoDate = TripWithDetails["startDate"];

type TripWithMeta = TripWithDetails & {
  status?: string | null;
  tripStatus?: string | null;
  deletedAt?: IsoDate | null;
  canceledAt?: IsoDate | null;
  cancelledAt?: IsoDate | null;
  isDeleted?: boolean | null;
  archivedAt?: IsoDate | null;
};

const normalizeDate = (value: IsoDate): Date => {
  if (value instanceof Date) {
    return startOfDay(value);
  }
  return startOfDay(parseISO(value));
};

export const isTripInactive = (trip: TripWithDetails): boolean => {
  const candidate = trip as TripWithMeta;
  const normalizedStatus =
    candidate.status || candidate.tripStatus || (candidate as { state?: string }).state || null;
  if (typeof normalizedStatus === "string") {
    const lowered = normalizedStatus.toLowerCase();
    if (lowered === "canceled" || lowered === "cancelled" || lowered === "archived") {
      return true;
    }
  }

  return Boolean(
    candidate.isDeleted ||
      candidate.deletedAt ||
      candidate.canceledAt ||
      candidate.cancelledAt ||
      candidate.archivedAt,
  );
};

export const selectUpcomingTrips = (
  trips: TripWithDetails[] | null | undefined,
  today: Date,
): TripWithDetails[] => {
  if (!trips || trips.length === 0) {
    return [];
  }

  const normalizedToday = startOfDay(today);

  return trips
    .filter((trip) => {
      if (isTripInactive(trip)) {
        return false;
      }

      const startDate = normalizeDate(trip.startDate);
      return startDate.getTime() >= normalizedToday.getTime();
    })
    .sort((a, b) => normalizeDate(a.startDate).getTime() - normalizeDate(b.startDate).getTime());
};

export const selectAllDestinationsUnique = (
  trips: TripWithDetails[] | null | undefined,
  referenceDate: Date,
): Set<string | number> => {
  const unique = new Set<string | number>();
  if (!trips || trips.length === 0) {
    return unique;
  }

  const normalizedToday = startOfDay(referenceDate);
  const currentYearStart = startOfYear(normalizedToday);
  const currentYearEnd = endOfYear(normalizedToday);

  const addDestination = (trip: TripWithDetails) => {
    const key =
      (trip.geonameId ?? null) !== null
        ? trip.geonameId!
        : trip.destination?.trim().toLowerCase() || `trip-${trip.id}`;
    unique.add(key);
  };

  let addedForYear = false;
  for (const trip of trips) {
    if (isTripInactive(trip)) {
      continue;
    }

    const tripStart = normalizeDate(trip.startDate);
    const tripEnd = normalizeDate(trip.endDate);
    const overlapsYear =
      tripStart.getTime() <= currentYearEnd.getTime() &&
      tripEnd.getTime() >= currentYearStart.getTime();

    if (!overlapsYear) {
      continue;
    }

    addDestination(trip);
    addedForYear = true;
  }

  if (!addedForYear) {
    for (const trip of trips) {
      if (isTripInactive(trip)) {
        continue;
      }
      addDestination(trip);
    }
  }

  return unique;
};

export const selectUniqueTravelersThisYear = (
  trips: TripWithDetails[] | null | undefined,
  referenceDate: Date,
): Set<string> => {
  const travelerIds = new Set<string>();
  if (!trips || trips.length === 0) {
    return travelerIds;
  }

  const startOfCurrentYear = startOfYear(referenceDate);
  const endOfCurrentYear = endOfYear(referenceDate);

  for (const trip of trips) {
    if (isTripInactive(trip)) {
      continue;
    }

    const tripStart = normalizeDate(trip.startDate);
    const tripEnd = normalizeDate(trip.endDate);
    const overlapsYear =
      tripStart.getTime() <= endOfCurrentYear.getTime() &&
      tripEnd.getTime() >= startOfCurrentYear.getTime();

    if (!overlapsYear) {
      continue;
    }

    for (const member of trip.members) {
      if (member.userId) {
        travelerIds.add(member.userId);
      }
    }
  }

  return travelerIds;
};

export const selectNextTrip = (
  trips: TripWithDetails[] | null | undefined,
  today: Date,
): TripWithDetails | null => {
  const upcoming = selectUpcomingTrips(trips, today);
  return upcoming.length > 0 ? upcoming[0] ?? null : null;
};
