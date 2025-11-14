import { normalizeActivityTypeInput } from "@shared/activityValidation";
import type { ActivityType } from "@shared/schema";

const deriveFallbackFromStatus = (status: unknown): ActivityType | null => {
  if (typeof status !== "string") {
    return null;
  }

  const normalized = status.trim().toLowerCase();

  if (["proposed", "pending", "idea", "draft"].includes(normalized)) {
    return "PROPOSE";
  }

  if (["scheduled", "active", "confirmed", "in-progress", "completed"].includes(normalized)) {
    return "SCHEDULED";
  }

  if (["canceled", "cancelled"].includes(normalized)) {
    return "SCHEDULED";
  }

  return null;
};

export const getNormalizedActivityType = (
  activity: { type?: unknown; status?: unknown } | null | undefined,
  fallback: ActivityType = "SCHEDULED",
): ActivityType => {
  if (!activity) {
    return fallback;
  }

  const fallbackFromStatus = deriveFallbackFromStatus(activity.status);
  const effectiveFallback = fallbackFromStatus ?? fallback;

  return normalizeActivityTypeInput(activity.type, effectiveFallback);
};

export const isProposalActivity = (
  activity: { type?: unknown; status?: unknown } | null | undefined,
): boolean => getNormalizedActivityType(activity) === "PROPOSE";

export const isScheduledActivity = (
  activity: { type?: unknown; status?: unknown } | null | undefined,
): boolean => getNormalizedActivityType(activity) === "SCHEDULED";

