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
  START_TIME_REQUIRED_FOR_END_MESSAGE,
} from "@shared/activityValidation";

interface BaseActivitySubmissionInput {
  tripId: number;
  name: string;
  description?: string | null;
  date: string | Date;
  startTime?: string | Date | null;
  endTime?: string | Date | null;
  location?: string | null;
  cost?: string | number | null;
  maxCapacity?: string | number | null;
  category: string;
  attendeeIds: Array<string | number>;
  type: ActivityType;
  timezone?: string | null;
  idempotencyKey?: string | null;
}

interface ActivitySubmissionPayload {
  tripCalendarId: number;
  name: string;
  description: string | null;
  startTime: string | null;
  endTime: string | null;
  startDate: string;
  location: string | null;
  cost: number | null;
  maxCapacity: number | null;
  category: ActivityCategoryValue;
  attendeeIds: string[];
  type: ActivityType;
}

export interface ActivitySubmissionResult {
  payload: ActivitySubmissionPayload;
  metadata: {
    startDate: string;
    startTime: string | null;
    endTime: string | null;
  };
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

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [yearString, monthString, dayString] = trimmed.split("-");
    const year = Number(yearString);
    const month = Number(monthString);
    const day = Number(dayString);

    if (
      Number.isInteger(year)
      && Number.isInteger(month)
      && Number.isInteger(day)
    ) {
      const parsedLocal = new Date(year, month - 1, day);
      if (
        parsedLocal.getFullYear() === year
        && parsedLocal.getMonth() === month - 1
        && parsedLocal.getDate() === day
      ) {
        return parsedLocal;
      }
    }

    throw new Error(`${label} must be a valid date/time.`);
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
  const isProposal = input.type === "PROPOSE";

  const rawStartTime = input.startTime;
  const hasStartTime = !(
    rawStartTime === null
    || rawStartTime === undefined
    || (typeof rawStartTime === "string" && rawStartTime.trim() === "")
  );

  const startTimeString = hasStartTime
    ? toTimeString(rawStartTime as string | Date, "Start time")
    : null;

  if (!startTimeString && !isProposal) {
    throw new Error("Start time is required so we can place this on the calendar.");
  }

  const endTimeInput = input.endTime;
  const shouldUseEndTime = !(
    endTimeInput === null
    || endTimeInput === undefined
    || (typeof endTimeInput === "string" && endTimeInput.trim() === "")
  );

  const endTimeString = shouldUseEndTime
    ? toTimeString(endTimeInput as string | Date, "End time")
    : null;

  if (shouldUseEndTime && !startTimeString) {
    throw new Error(START_TIME_REQUIRED_FOR_END_MESSAGE);
  }

  const startDateTime = startTimeString ? buildDateTime(baseDate, startTimeString, "Start time") : null;
  const endDateTime = endTimeString && startTimeString
    ? buildDateTime(baseDate, endTimeString, "End time")
    : null;

  if (endDateTime && startDateTime && endDateTime <= startDateTime) {
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
  const startDate = format(baseDate, "yyyy-MM-dd");

  return {
    payload: {
      tripCalendarId,
      name,
      description: trimmedDescription,
      startTime: startDateTime ? startDateTime.toISOString() : null,
      endTime: endDateTime ? endDateTime.toISOString() : null,
      startDate,
      location: trimmedLocation,
      cost: costResult.value,
      maxCapacity: capacityResult.value,
      category: categoryResult.value,
      attendeeIds: attendeeResult.value,
      type,
    },
    metadata: {
      startDate,
      startTime: startTimeString,
      endTime: endTimeString,
    },
  };
}
