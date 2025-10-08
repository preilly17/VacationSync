import type { ActivityWithDetails } from "@shared/schema";

const PROPOSAL_TYPE = "PROPOSE" as const;

type ActivityDateLike =
  | ActivityWithDetails["startTime"]
  | ActivityWithDetails["endTime"]
  | ActivityWithDetails["rsvpCloseTime"]
  | Date
  | string
  | null
  | undefined;

const isValidDate = (date: Date): boolean => !Number.isNaN(date.getTime());

export const parseActivityDate = (value: ActivityDateLike): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return isValidDate(value) ? new Date(value.getTime()) : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = new Date(trimmed);
    return isValidDate(parsed) ? parsed : null;
  }

  return null;
};

export const getNormalizedActivityType = (
  activity: Pick<ActivityWithDetails, "type">,
): string => (activity.type ?? "SCHEDULED").toUpperCase();

export const isProposalActivity = (
  activity: Pick<ActivityWithDetails, "type">,
): boolean => getNormalizedActivityType(activity) === PROPOSAL_TYPE;

export const getActivityStartDate = (
  activity: ActivityWithDetails,
): Date | null => parseActivityDate(activity.startTime);

export const getActivityEndDate = (
  activity: ActivityWithDetails,
): Date | null => parseActivityDate(activity.endTime);

export const getActivityComparisonDate = (
  activity: ActivityWithDetails,
): Date | null => {
  const end = getActivityEndDate(activity);
  if (end) {
    return end;
  }

  return getActivityStartDate(activity);
};

export const isActivityPast = (
  activity: ActivityWithDetails,
  now: Date = new Date(),
): boolean => {
  const comparisonDate = getActivityComparisonDate(activity);
  if (!comparisonDate) {
    return false;
  }

  return comparisonDate.getTime() < now.getTime();
};

export const getActivityTimeOptions = (
  activity: ActivityWithDetails,
): Date[] => {
  if (!Array.isArray(activity.timeOptions)) {
    return [];
  }

  return activity.timeOptions
    .map((option) => parseActivityDate(option ?? null))
    .filter((value): value is Date => Boolean(value));
};

export const hasDefinedActivityTime = (
  activity: ActivityWithDetails,
): boolean =>
  Boolean(getActivityStartDate(activity) || getActivityEndDate(activity));
