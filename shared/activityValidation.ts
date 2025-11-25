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
export const START_TIME_REQUIRED_FOR_END_MESSAGE = "Add a start time before setting an end time.";
export const MAX_ACTIVITY_NAME_LENGTH = 120;
export const MAX_ACTIVITY_DESCRIPTION_LENGTH = 2000;
export const MAX_ACTIVITY_LOCATION_LENGTH = 255;
export const TIMEZONE_REQUIRED_MESSAGE =
  "Date and time must include a timezone offset (for example, 2024-05-01T09:00:00-04:00).";

export type ValidationIssue = {
  field: string;
  message: string;
};

export interface NormalizedActivityInput {
  tripCalendarId: number;
  name: string;
  description: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  cost: number | null;
  maxCapacity: number | null;
  category: ActivityCategoryValue;
  type: ActivityType;
  votingDeadline: string | null;
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

const normalizeActivityTypeCandidate = (value: string): ActivityType | null => {
  const normalized = value.trim().toUpperCase();

  if (normalized === "PROPOSE" || normalized === "PROPOSED" || normalized === "PROPOSAL") {
    return "PROPOSE";
  }

  if (
    normalized === "SCHEDULED"
    || normalized === "SCHEDULE"
    || normalized === "SCHED"
    || normalized === "SCHEDULES"
  ) {
    return "SCHEDULED";
  }

  return null;
};

export const normalizeActivityTypeInput = (
  value: unknown,
  fallback: ActivityType = "SCHEDULED",
): ActivityType => {
  if (typeof value === "string" && value.trim().length > 0) {
    const normalized = normalizeActivityTypeCandidate(value);
    if (normalized) {
      return normalized;
    }
  }

  return fallback;
};

const normalizeDateTimeInput = (
  value: unknown,
  fieldLabel: string,
  { required, requiredMessage }: { required: boolean; requiredMessage?: string },
): { value: string | null; error?: string } => {
  if (value === undefined || value === null) {
    return required
      ? { value: null, error: requiredMessage ?? `${fieldLabel} is required.` }
      : { value: null };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return required
        ? { value: null, error: requiredMessage ?? `${fieldLabel} is required.` }
        : { value: null };
    }

    const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed);
    if (!hasTimezone) {
      return { value: null, error: TIMEZONE_REQUIRED_MESSAGE };
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return { value: null, error: `${fieldLabel} must be a valid date/time.` };
    }

    return { value: parsed.toISOString() };
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return { value: null, error: `${fieldLabel} must be a valid date/time.` };
    }
    return { value: value.toISOString() };
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

const toDateOnlyIsoString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toISOString().slice(0, 10);
  }

  return null;
};

const formatDateLabel = (value: string): string => {
  try {
    const [yearStr, monthStr, dayStr] = value.split("-");
    const year = Number.parseInt(yearStr ?? "", 10);
    const month = Number.parseInt(monthStr ?? "", 10);
    const day = Number.parseInt(dayStr ?? "", 10);

    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
      return value;
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } catch {
    return value;
  }
};

const buildTripDateRangeMessage = (
  min: string | null,
  max: string | null,
): string => {
  const minLabel = min ? formatDateLabel(min) : null;
  const maxLabel = max ? formatDateLabel(max) : null;

  if (minLabel && maxLabel) {
    return `Pick a date between ${minLabel} and ${maxLabel}.`;
  }

  if (minLabel) {
    return `Pick a date on or after ${minLabel}.`;
  }

  if (maxLabel) {
    return `Pick a date on or before ${maxLabel}.`;
  }

  return "Pick a date within the trip dates.";
};

export const validateActivityInput = (
  rawData: Record<string, unknown>,
  {
    tripCalendarId,
    userId,
    validMemberIds,
    tripStartDate,
    tripEndDate,
  }: {
    tripCalendarId: number;
    userId: string;
    validMemberIds: Set<string>;
    tripStartDate?: string | null;
    tripEndDate?: string | null;
  },
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
  const requiresStartTime = normalizedType !== "PROPOSE";

  const votingDurationValue =
    (rawData as { votingDurationValue?: unknown; voting_duration_value?: unknown }).votingDurationValue
    ?? (rawData as { voting_duration_value?: unknown }).voting_duration_value
    ?? null;
  const votingDurationUnit =
    (rawData as { votingDurationUnit?: unknown; voting_duration_unit?: unknown }).votingDurationUnit
    ?? (rawData as { voting_duration_unit?: unknown }).voting_duration_unit
    ?? null;
  const votingDeadlineInput =
    (rawData as { votingDeadline?: unknown; voting_deadline?: unknown }).votingDeadline
    ?? (rawData as { voting_deadline?: unknown }).voting_deadline
    ?? null;

  const startResult = normalizeDateTimeInput(rawData.startTime, "Start time", {
    required: requiresStartTime,
    requiredMessage: "Start time is required so we can place this on the calendar.",
  });
  if (startResult.error) {
    errors.push({ field: "startTime", message: startResult.error });
  }

  const endResult = normalizeDateTimeInput(rawData.endTime, "End time", { required: false });
  if (endResult.error) {
    errors.push({ field: "endTime", message: endResult.error });
  }

  if (endResult.value && !startResult.value) {
    errors.push({ field: "endTime", message: START_TIME_REQUIRED_FOR_END_MESSAGE });
  }

  if (startResult.value && endResult.value) {
    const orderingError = ensureEndAfterStart(startResult.value, endResult.value);
    if (orderingError) {
      errors.push({ field: "endTime", message: orderingError });
    }
  }

  const explicitStartDate = typeof rawData.startDate === "string" ? rawData.startDate.trim() : null;
  const fallbackDate = typeof rawData.date === "string" ? rawData.date.trim() : null;
  const normalizedStartDate =
    toDateOnlyIsoString(explicitStartDate)
    ?? toDateOnlyIsoString(fallbackDate)
    ?? (startResult.value ? toDateOnlyIsoString(startResult.value) : null);

  const normalizedTripStart = toDateOnlyIsoString(tripStartDate ?? null);
  const normalizedTripEnd = toDateOnlyIsoString(tripEndDate ?? null);

  if (normalizedStartDate && (normalizedTripStart || normalizedTripEnd)) {
    if (normalizedTripStart && normalizedStartDate < normalizedTripStart) {
      errors.push({
        field: "startDate",
        message: buildTripDateRangeMessage(normalizedTripStart, normalizedTripEnd),
      });
    } else if (normalizedTripEnd && normalizedStartDate > normalizedTripEnd) {
      errors.push({
        field: "startDate",
        message: buildTripDateRangeMessage(normalizedTripStart, normalizedTripEnd),
      });
    }
  }

  let votingDeadline: string | null = null;
  if (normalizedType === "PROPOSE") {
    const hasDurationValue = votingDurationValue !== null && votingDurationValue !== undefined
      && votingDurationValue !== "";
    const hasDurationUnit = typeof votingDurationUnit === "string" && votingDurationUnit.trim().length > 0;

    if (hasDurationValue || hasDurationUnit) {
      const parsedValue = Number(votingDurationValue);
      const normalizedUnit = typeof votingDurationUnit === "string"
        ? votingDurationUnit.trim().toLowerCase()
        : "";
      const isHours = normalizedUnit === "hours";
      const isDays = normalizedUnit === "days";

      if (!isHours && !isDays) {
        errors.push({ field: "votingDurationUnit", message: "Pick hours or days for the voting window." });
      }

      if (!Number.isFinite(parsedValue) || Number.isNaN(parsedValue)) {
        errors.push({ field: "votingDurationValue", message: "Enter how long voting should stay open." });
      } else {
        const wholeValue = Math.floor(parsedValue);
        const min = 1;
        const max = isHours ? 72 : 30;

        if (wholeValue !== parsedValue) {
          errors.push({ field: "votingDurationValue", message: "Use whole hours or days for the deadline." });
        } else if (parsedValue < min || parsedValue > max) {
          errors.push({
            field: "votingDurationValue",
            message: isHours
              ? "Voting in hours must be between 1 and 72."
              : "Voting in days must be between 1 and 30.",
          });
        } else if (isHours || isDays) {
          const now = Date.now();
          const durationMs = wholeValue * (isHours ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000);
          const deadlineMs = now + durationMs;

          if (!Number.isFinite(deadlineMs) || deadlineMs <= now) {
            errors.push({ field: "votingDurationValue", message: "Voting deadline must be in the future." });
          } else {
            votingDeadline = new Date(deadlineMs).toISOString();
          }
        }
      }
    } else if (votingDeadlineInput) {
      const parsed = normalizeDateTimeInput(votingDeadlineInput, "Voting deadline", { required: false });
      if (parsed.error) {
        errors.push({ field: "votingDeadline", message: parsed.error });
      } else if (parsed.value) {
        const parsedDate = new Date(parsed.value);
        if (Number.isNaN(parsedDate.getTime()) || parsedDate.getTime() <= Date.now()) {
          errors.push({ field: "votingDeadline", message: "Voting deadline must be in the future." });
        } else {
          votingDeadline = parsed.value;
        }
      }
    }
  }

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

  const hasValidStartTime = requiresStartTime ? Boolean(startResult.value) : true;

  if (errors.length > 0 || !hasValidStartTime || !filteredAttendees.length || !categoryResult.value) {
    return { errors };
  }

  return {
    data: {
      tripCalendarId,
      name: nameValue,
      description: descriptionValue,
      startTime: startResult.value ?? null,
      endTime: endResult.value,
      location: locationValue,
      cost: costResult.value,
      maxCapacity: capacityResult.value,
      category: categoryResult.value,
      type: normalizedType,
      votingDeadline,
    },
    attendeeIds: filteredAttendees,
  };
};
