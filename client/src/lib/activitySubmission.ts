import { format } from "date-fns";
import type { ActivityType } from "@shared/schema";
import {
  normalizeAttendeeIds,
  normalizeCategoryInput,
  normalizeCostInput,
  normalizeMaxCapacityInput,
  type ActivityCategoryValue,
  ACTIVITY_CATEGORY_MESSAGE,
  ATTENDEE_REQUIRED_MESSAGE,
  END_TIME_AFTER_START_MESSAGE,
} from "@shared/activityValidation";

interface BaseActivitySubmissionInput {
  tripId: number;
  name: string;
  description?: string | null;
  date: string | Date;
  startTime: string | Date;
  endTime?: string | Date | null;
  location?: string | null;
  cost?: string | number | null;
  maxCapacity?: string | number | null;
  category: string;
  attendeeIds: Array<string | number>;
  type: ActivityType;
}

interface ActivitySubmissionPayload {
  tripCalendarId: number;
  name: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  location: string | null;
  cost: number | null;
  maxCapacity: number | null;
  category: ActivityCategoryValue;
  attendeeIds: string[];
  type: ActivityType;
  title: string;
  date: string;
  start_time: string;
  end_time: string | null;
  timezone: string;
  invitee_ids: string[];
  idempotency_key: string;
}

export interface ActivitySubmissionResult {
  payload: ActivitySubmissionPayload;
}

const toDateInput = (value: string | Date, label: string): Date => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`${label} must be a valid date/time.`);
    }
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid date/time.`);
  }

  return parsed;
};

const toTimeString = (value: string | Date, label: string): string => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`${label} must be a valid date/time.`);
    }
    return format(value, "HH:mm");
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) {
    throw new Error(`${label} must be in HH:MM format.`);
  }

  return trimmed;
};

const buildDateTime = (date: Date, time: string, label: string): Date => {
  const isoDate = format(date, "yyyy-MM-dd");
  const combined = new Date(`${isoDate}T${time}`);
  if (Number.isNaN(combined.getTime())) {
    throw new Error(`${label} must be a valid date/time.`);
  }
  return combined;
};

const resolveClientTimezone = (): string => {
  try {
    if (typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function") {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (typeof tz === "string" && tz.trim().length > 0) {
        return tz;
      }
    }
  } catch {
    // ignore and fall back to environment variables or UTC
  }

  try {
    const envTz =
      typeof process !== "undefined" && process?.env?.TZ ? String(process.env.TZ) : "";
    if (envTz.trim().length > 0) {
      return envTz.trim();
    }
  } catch {
    // ignore and fall back to UTC
  }

  return "UTC";
};

const generateIdempotencyKey = (): string => {
  try {
    if (typeof crypto !== "undefined") {
      if (typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }

      if (typeof crypto.getRandomValues === "function") {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.from(bytes)
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");
      }
    }
  } catch {
    // ignore and use fallback
  }

  return `activity_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

export function buildActivitySubmission(input: BaseActivitySubmissionInput): ActivitySubmissionResult {
  const tripCalendarId = Number(input.tripId);
  if (!Number.isInteger(tripCalendarId) || tripCalendarId <= 0) {
    throw new Error("A valid trip ID is required to create an activity.");
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) {
    throw new Error("Activity name is required.");
  }

  const description = typeof input.description === "string" ? input.description.trim() : "";

  const baseDate = toDateInput(input.date, "Date");
  const startTimeString = toTimeString(input.startTime, "Start time");
  const endTimeInput = input.endTime;
  const shouldUseEndTime = !(
    endTimeInput === null
    || endTimeInput === undefined
    || (typeof endTimeInput === "string" && endTimeInput.trim() === "")
  );

  const endTimeString = shouldUseEndTime
    ? toTimeString(endTimeInput, "End time")
    : null;

  const startDateTime = buildDateTime(baseDate, startTimeString, "Start time");
  const endDateTime = endTimeString ? buildDateTime(baseDate, endTimeString, "End time") : null;

  if (endDateTime && endDateTime <= startDateTime) {
    throw new Error(END_TIME_AFTER_START_MESSAGE);
  }

  const costResult = normalizeCostInput(input.cost);
  if (costResult.error) {
    throw new Error(costResult.error);
  }

  const capacityResult = normalizeMaxCapacityInput(input.maxCapacity);
  if (capacityResult.error) {
    throw new Error(capacityResult.error);
  }

  const attendeeResult = normalizeAttendeeIds(input.attendeeIds);
  if (attendeeResult.error) {
    throw new Error(attendeeResult.error ?? ATTENDEE_REQUIRED_MESSAGE);
  }

  const categoryResult = normalizeCategoryInput(input.category);
  if (!categoryResult.value) {
    throw new Error(categoryResult.error ?? ACTIVITY_CATEGORY_MESSAGE);
  }

  const location = typeof input.location === "string" ? input.location.trim() : "";

  const trimmedDescription = description.length > 0 ? description : null;
  const trimmedLocation = location.length > 0 ? location : null;

  const type = input.type === "PROPOSE" ? "PROPOSE" : "SCHEDULED";

  const timezone = resolveClientTimezone();
  const idempotencyKey = generateIdempotencyKey();
  const isoDate = format(baseDate, "yyyy-MM-dd");

  return {
    payload: {
      tripCalendarId,
      name,
      description: trimmedDescription,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime ? endDateTime.toISOString() : null,
      location: trimmedLocation,
      cost: costResult.value,
      maxCapacity: capacityResult.value,
      category: categoryResult.value,
      attendeeIds: attendeeResult.value,
      type,
      title: name,
      date: isoDate,
      start_time: startTimeString,
      end_time: endTimeString,
      timezone,
      invitee_ids: attendeeResult.value,
      idempotency_key: idempotencyKey,
    },
  };
}
