import type { QueryKey } from "@tanstack/react-query";

const normalizeTripSegment = (tripId: number | string | null | undefined): string => {
  if (tripId === null || tripId === undefined) {
    return "";
  }

  if (typeof tripId === "number") {
    return Number.isFinite(tripId) ? String(tripId) : "";
  }

  const trimmed = tripId.trim();
  return trimmed;
};

export const scheduledActivitiesQueryKey = (
  tripId: number | string | null | undefined,
): QueryKey => ["/api/trips", normalizeTripSegment(tripId), "activities"] as const;

export const calendarActivitiesQueryKey = scheduledActivitiesQueryKey;

export const proposalActivitiesQueryKey = (
  tripId: number | string | null | undefined,
): QueryKey => ["/api/trips", normalizeTripSegment(tripId), "proposals", "activities"] as const;

export const activitiesEndpoint = (tripId: number | string): string => `/api/trips/${tripId}/activities`;
export const activityProposalsEndpoint = (tripId: number | string): string => `/api/trips/${tripId}/proposals/activities`;
