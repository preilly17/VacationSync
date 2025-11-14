import type { ActivityInviteStatus, ActivityWithDetails } from "@shared/schema";

const PEOPLE_FILTER_ALLOWED_STATUSES: ActivityInviteStatus[] = ["accepted"];

const normalizeId = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
};

export const activityMatchesPeopleFilter = (
  activity: ActivityWithDetails,
  personId: string,
): boolean => {
  const normalizedFilterId = normalizeId(personId);
  if (!normalizedFilterId) {
    return false;
  }

  const postedById = normalizeId(activity.postedBy);
  if (postedById && postedById === normalizedFilterId) {
    return true;
  }

  const posterId = normalizeId(activity.poster?.id);
  if (posterId && posterId === normalizedFilterId) {
    return true;
  }

  return (activity.invites ?? []).some((invite) => {
    const inviteUserId = normalizeId(invite.userId);
    if (!inviteUserId || inviteUserId !== normalizedFilterId) {
      return false;
    }

    const status = invite.status;
    return PEOPLE_FILTER_ALLOWED_STATUSES.includes(status);
  });
};

export const peopleFilterAllowedStatuses = PEOPLE_FILTER_ALLOWED_STATUSES;
