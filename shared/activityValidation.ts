import type { ActivityType } from "./schema";

export const ACTIVITY_CATEGORY_VALUES = [
  "food",
  "sightseeing",
  "transport",
  "entertainment",
  "shopping",
  "culture",
  "outdoor",
  "manual",
  "other",
] as const;

export type ActivityCategoryValue = (typeof ACTIVITY_CATEGORY_VALUES)[number];

export const ACTIVITY_CATEGORY_MESSAGE = `Category must be one of: ${ACTIVITY_CATEGORY_VALUES.join(", ")}.`;
export const COST_NUMBER_MESSAGE = "Cost per person must be a number (e.g., 12.50).";
export const MAX_CAPACITY_MESSAGE = "Max participants must be at least 1 or left blank.";
export const ATTENDEE_REQUIRED_MESSAGE = "Include at least one attendee.";
export const INVITEE_NOT_MEMBER_MESSAGE =
  "Some selected invitees are no longer part of this trip.";
export const END_TIME_AFTER_START_MESSAGE = "End time must be after start time.";
export const MAX_ACTIVITY_NAME_LENGTH = 120;
export const MAX_ACTIVITY_DESCRIPTION_LENGTH = 2000;
export const MAX_ACTIVITY_LOCATION_LENGTH = 255;

export type ValidationIssue = {
  field: string;
  message: string;
};

export interface NormalizedActivityInput {
  tripCalendarId: number;
  name: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  location: string | null;
  cost: number | null;
  maxCapacity: number | null;
  category: ActivityCategoryValue;
  type: ActivityType;
}

export interface ActivityValidationResult {
  data?: NormalizedActivityInput;
  attendeeIds?: string[];
  errors?: ValidationIssue[];
}

const trimToNull = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

export const normalizeCostInput = (
  value: unknown,
): { value: number | null; error?: string } => {
  if (value === undefined || value === null) {
    return { value: null };
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || Number.isNaN(value) || value < 0) {
      return { value: null, error: COST_NUMBER_MESSAGE };
    }
    return { value };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return { value: null };
    }

    const normalized = trimmed.replace(/[$,\s]/g, "");
    if (normalized === "") {
      return { value: null, error: COST_NUMBER_MESSAGE };
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) {
      return { value: null, error: COST_NUMBER_MESSAGE };
    }

    return { value: Number.parseFloat(parsed.toFixed(2)) };
  }

  return { value: null, error: COST_NUMBER_MESSAGE };
};

export const normalizeMaxCapacityInput = (
  value: unknown,
): { value: number | null; error?: string } => {
  if (value === undefined || value === null) {
    return { value: null };
  }

  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 1) {
      return { value: null, error: MAX_CAPACITY_MESSAGE };
    }
    return { value };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return { value: null };
    }

    if (!/^\d+$/.test(trimmed)) {
      return { value: null, error: MAX_CAPACITY_MESSAGE };
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 1) {
      return { value: null, error: MAX_CAPACITY_MESSAGE };
    }

    return { value: parsed };
  }

  return { value: null, error: MAX_CAPACITY_MESSAGE };
};

export const normalizeAttendeeIds = (
  value: unknown,
): { value: string[]; error?: string } => {
  if (!Array.isArray(value)) {
    return { value: [], error: ATTENDEE_REQUIRED_MESSAGE };
  }

  const normalized = Array.from(
    new Set(
      value
        .map((id) => {
          if (id === null || id === undefined) {
            return "";
          }
          return String(id).trim();
        })
        .filter((id) => id.length > 0),
    ),
  );

  if (normalized.length === 0) {
    return { value: [], error: ATTENDEE_REQUIRED_MESSAGE };
  }

  return { value: normalized };
};

export const normalizeCategoryInput = (
  value: unknown,
): { value: ActivityCategoryValue | null; error?: string } => {
  if (typeof value !== "string") {
    return { value: null, error: ACTIVITY_CATEGORY_MESSAGE };
  }

  const normalized = value.trim().toLowerCase();
  if (ACTIVITY_CATEGORY_VALUES.includes(normalized as ActivityCategoryValue)) {
    return { value: normalized as ActivityCategoryValue };
  }

  return { value: null, error: ACTIVITY_CATEGORY_MESSAGE };
};

const normalizeDateTimeInput = (
  value: unknown,
  fieldLabel: string,
  { required }: { required: boolean },
): { value: string | null; error?: string } => {
  if (value === undefined || value === null) {
    return required
      ? { value: null, error: `${fieldLabel} is required.` }
      : { value: null };
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return { value: null, error: `${fieldLabel} must be a valid date/time.` };
    }
    return { value: value.toISOString() };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return required
        ? { value: null, error: `${fieldLabel} is required.` }
        : { value: null };
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return { value: null, error: `${fieldLabel} must be a valid date/time.` };
    }

    return { value: parsed.toISOString() };
  }

  return { value: null, error: `${fieldLabel} must be a valid date/time.` };
};

const ensureEndAfterStart = (
  startIso: string,
  endIso: string,
): string | null => {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return "End time must be a valid date/time.";
  }

  if (end <= start) {
    return END_TIME_AFTER_START_MESSAGE;
  }

  return null;
};

export const validateActivityInput = (
  rawData: Record<string, unknown>,
  {
    tripCalendarId,
    userId,
    validMemberIds,
  }: { tripCalendarId: number; userId: string; validMemberIds: Set<string> },
): ActivityValidationResult => {
  const errors: ValidationIssue[] = [];

  const nameValue = typeof rawData.name === "string" ? rawData.name.trim() : "";
  if (!nameValue) {
    errors.push({ field: "name", message: "Activity name is required." });
  } else if (nameValue.length > MAX_ACTIVITY_NAME_LENGTH) {
    errors.push({
      field: "name",
      message: `Activity name must be ${MAX_ACTIVITY_NAME_LENGTH} characters or fewer.`,
    });
  }

  const descriptionValue = trimToNull(rawData.description ?? null);
  if (descriptionValue && descriptionValue.length > MAX_ACTIVITY_DESCRIPTION_LENGTH) {
    errors.push({
      field: "description",
      message: `Description must be ${MAX_ACTIVITY_DESCRIPTION_LENGTH} characters or fewer.`,
    });
  }

  const locationValue = trimToNull(rawData.location ?? null);
  if (locationValue && locationValue.length > MAX_ACTIVITY_LOCATION_LENGTH) {
    errors.push({
      field: "location",
      message: `Location must be ${MAX_ACTIVITY_LOCATION_LENGTH} characters or fewer.`,
    });
  }

  const startResult = normalizeDateTimeInput(rawData.startTime, "Start time", { required: true });
  if (startResult.error) {
    errors.push({ field: "startTime", message: startResult.error });
  }

  const endResult = normalizeDateTimeInput(rawData.endTime, "End time", { required: false });
  if (endResult.error) {
    errors.push({ field: "endTime", message: endResult.error });
  }

  if (startResult.value && endResult.value) {
    const orderingError = ensureEndAfterStart(startResult.value, endResult.value);
    if (orderingError) {
      errors.push({ field: "endTime", message: orderingError });
    }
  }

  const costResult = normalizeCostInput(rawData.cost ?? null);
  if (costResult.error) {
    errors.push({ field: "cost", message: costResult.error });
  }

  const capacityResult = normalizeMaxCapacityInput(rawData.maxCapacity ?? null);
  if (capacityResult.error) {
    errors.push({ field: "maxCapacity", message: capacityResult.error });
  }

  const categoryResult = normalizeCategoryInput(rawData.category ?? null);
  if (categoryResult.error || !categoryResult.value) {
    errors.push({ field: "category", message: categoryResult.error ?? ACTIVITY_CATEGORY_MESSAGE });
  }

  const attendeeResult = normalizeAttendeeIds(rawData.attendeeIds ?? []);
  if (attendeeResult.error) {
    errors.push({ field: "attendeeIds", message: attendeeResult.error });
  }

  const typeValue = typeof rawData.type === "string" ? rawData.type : "SCHEDULED";
  const normalizedType = typeValue === "PROPOSE" ? "PROPOSE" : "SCHEDULED";

  const attendeeSet = new Set(attendeeResult.value ?? []);
  attendeeSet.add(userId);

  const filteredAttendees = Array.from(attendeeSet).filter((id) => validMemberIds.has(id));
  const invalidAttendeeIds = attendeeResult.value.filter((id) => !validMemberIds.has(id));

  if (invalidAttendeeIds.length > 0) {
    errors.push({ field: "attendeeIds", message: INVITEE_NOT_MEMBER_MESSAGE });
  }
  if (filteredAttendees.length === 0) {
    errors.push({ field: "attendeeIds", message: ATTENDEE_REQUIRED_MESSAGE });
  }

  if (capacityResult.value !== null && filteredAttendees.length > capacityResult.value) {
    errors.push({
      field: "maxCapacity",
      message: "Max participants cannot be less than the number of selected attendees.",
    });
  }

  if (errors.length > 0 || !startResult.value || !filteredAttendees.length || !categoryResult.value) {
    return { errors };
  }

  return {
    data: {
      tripCalendarId,
      name: nameValue,
      description: descriptionValue,
      startTime: startResult.value,
      endTime: endResult.value,
      location: locationValue,
      cost: costResult.value,
      maxCapacity: capacityResult.value,
      category: categoryResult.value,
      type: normalizedType,
    },
    attendeeIds: filteredAttendees,
  };
};
