import { buildActivitySubmission } from "@/lib/activitySubmission";
import { ApiError, apiRequest } from "@/lib/queryClient";
import {
  CLIENT_VALIDATION_FALLBACK_MESSAGE,
  mapClientErrorToValidation,
} from "./clientValidation";
import type {
  ActivityAcceptance,
  ActivityInvite,
  ActivityInviteStatus,
  ActivityType,
  ActivityWithDetails,
  TripMember,
  User,
} from "@shared/schema";

export interface ActivityCreateFormValues {
  name: string;
  description?: string;
  startDate: string;
  startTime?: string;
  endTime?: string | null;
  location?: string;
  cost?: string;
  maxCapacity?: string;
  attendeeIds: string[];
  category: string;
  type: ActivityType;
}

interface ActivityFieldError {
  field: keyof ActivityCreateFormValues;
  message: string;
}

export interface ActivityValidationError {
  fieldErrors: ActivityFieldError[];
  formMessage?: string;
}

export interface PrepareSubmissionOptions {
  tripId: number;
  values: ActivityCreateFormValues;
}

export interface PreparedSubmission {
  payload: ReturnType<typeof buildActivitySubmission>["payload"];
  sanitizedValues: ActivityCreateFormValues;
}

const serverFieldMap: Partial<Record<string, keyof ActivityCreateFormValues>> = {
  name: "name",
  title: "name",
  description: "description",
  startTime: "startTime",
  start_time: "startTime",
  endTime: "endTime",
  end_time: "endTime",
  location: "location",
  cost: "cost",
  cost_per_person: "cost",
  maxCapacity: "maxCapacity",
  max_participants: "maxCapacity",
  category: "category",
  attendeeIds: "attendeeIds",
  invitee_ids: "attendeeIds",
  startDate: "startDate",
  date: "startDate",
  mode: "type",
};

const toTrimmedStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toNormalizedIdList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((entry) => {
          if (entry === null || entry === undefined) {
            return "";
          }
          return String(entry).trim();
        })
        .filter((entry) => entry.length > 0),
    ),
  );
};

const normalizeSubmissionPayload = (
  payload: ReturnType<typeof buildActivitySubmission>["payload"],
) => {
  const attendeeIds = toNormalizedIdList(payload.attendeeIds);
  const inviteeIds = toNormalizedIdList(payload.invitee_ids);
  const resolvedName = toTrimmedStringOrNull(payload.name)
    ?? toTrimmedStringOrNull(payload.title)
    ?? "Untitled activity";
  const resolvedTitle = toTrimmedStringOrNull(payload.title) ?? resolvedName;
  const resolvedDate = toTrimmedStringOrNull(payload.date) ?? "";
  const resolvedStartDate = toTrimmedStringOrNull(payload.startDate) ?? resolvedDate;
  const resolvedTimezone =
    toTrimmedStringOrNull(payload.timezone)
    ?? toTrimmedStringOrNull(payload.timeZone)
    ?? "UTC";
  const resolvedTimeZone = toTrimmedStringOrNull(payload.timeZone) ?? resolvedTimezone;

  return {
    ...payload,
    name: resolvedName,
    title: resolvedTitle,
    attendeeIds,
    invitee_ids: inviteeIds.length > 0 ? inviteeIds : attendeeIds,
    date: resolvedDate,
    startDate: resolvedStartDate,
    timezone: resolvedTimezone,
    timeZone: resolvedTimeZone,
    startTime: payload.startTime ?? null,
    endTime: payload.endTime ?? null,
    start_time: payload.start_time ?? null,
    end_time: payload.end_time ?? null,
  } satisfies ReturnType<typeof buildActivitySubmission>["payload"];
};

export class ActivitySubmissionError extends Error {
  readonly validation: ActivityValidationError;

  constructor(validation: ActivityValidationError) {
    super(
      validation.formMessage
        ?? validation.fieldErrors[0]?.message
        ?? CLIENT_VALIDATION_FALLBACK_MESSAGE,
    );
    this.name = "ActivitySubmissionError";
    this.validation = validation;
  }
}

export const prepareActivitySubmission = ({
  tripId,
  values,
}: PrepareSubmissionOptions): PreparedSubmission => {
  try {
    const { payload } = buildActivitySubmission({
      tripId,
      name: values.name,
      description: values.description,
      date: values.startDate,
      startTime: values.startTime,
      endTime: values.endTime ?? null,
      location: values.location,
      cost: values.cost,
      maxCapacity: values.maxCapacity,
      category: values.category,
      attendeeIds: values.attendeeIds,
      type: values.type,
    });

    const normalizedPayload = normalizeSubmissionPayload(payload);

    const sanitizedValues: ActivityCreateFormValues = {
      ...values,
      name: normalizedPayload.name,
      description: normalizedPayload.description ?? "",
      startDate: normalizedPayload.startDate,
      startTime:
        typeof normalizedPayload.start_time === "string" && normalizedPayload.start_time.length > 0
          ? normalizedPayload.start_time
          : undefined,
      endTime:
        typeof normalizedPayload.end_time === "string" && normalizedPayload.end_time.length > 0
          ? normalizedPayload.end_time
          : undefined,
      location: normalizedPayload.location ?? "",
      cost: values.cost,
      maxCapacity: values.maxCapacity,
      attendeeIds: normalizedPayload.attendeeIds,
      category: normalizedPayload.category,
    };

    return { payload: normalizedPayload, sanitizedValues } satisfies PreparedSubmission;
  } catch (error) {
    const validation = mapClientErrorToValidation(error);
    throw new ActivitySubmissionError(validation);
  }
};

export const mapApiErrorToValidation = (error: ApiError): ActivityValidationError | null => {
  if (error.status !== 400 && error.status !== 422) {
    return null;
  }

  const data = error.data as
    | {
        errors?: { field: string; message: string }[];
        message?: string;
      }
    | undefined;

  const serverErrors = Array.isArray(data?.errors) ? data?.errors : [];

  const fieldErrors: ActivityFieldError[] = serverErrors
    .map(({ field, message }) => {
      const mappedField = field ? serverFieldMap[field] : undefined;
      if (!mappedField) {
        return null;
      }
      return { field: mappedField, message } satisfies ActivityFieldError;
    })
    .filter((value): value is ActivityFieldError => Boolean(value));

  return {
    fieldErrors,
    formMessage: data?.message,
  } satisfies ActivityValidationError;
};

export interface SubmitActivityOptions {
  tripId: number;
  version?: "legacy" | "v2";
  payload: ReturnType<typeof buildActivitySubmission>["payload"];
}

const DATE_FIELD_KEYS = new Set([
  "startTime",
  "endTime",
  "start_time",
  "end_time",
  "startDate",
  "date",
]);

const redactDates = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactDates(entry));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (DATE_FIELD_KEYS.has(key)) {
        if (typeof entry === "string" && entry.trim().length > 0) {
          result[key] = "[redacted-date]";
        } else {
          result[key] = entry;
        }
        continue;
      }

      result[key] = redactDates(entry);
    }
    return result;
  }

  return value;
};

export const submitActivityRequest = async <T extends ActivityWithDetails>({
  tripId,
  version = "v2",
  payload,
}: SubmitActivityOptions): Promise<T> => {
  const endpoint =
    payload.type === "PROPOSE"
      ? `/api/trips/${tripId}/proposals/activities`
      : `/api/trips/${tripId}/activities`;

  const headers = version === "v2"
    ? ({ "x-activities-version": "2" } as Record<string, string>)
    : undefined;

  const normalizedPayload = normalizeSubmissionPayload(payload);
  const sanitizedPayload = redactDates(normalizedPayload);
  console.info("[activity:create] submitting", {
    tripId,
    version,
    endpoint,
    payload: sanitizedPayload,
  });

  try {
    const response = await apiRequest(endpoint, {
      method: "POST",
      body: normalizedPayload,
      headers,
    });

    const responseClone = response.clone();
    let preview: unknown = null;
    try {
      preview = await responseClone.json();
    } catch {
      try {
        preview = await responseClone.text();
      } catch {
        preview = null;
      }
    }

    const correlationId =
      response.headers.get("x-correlation-id")
      ?? response.headers.get("X-Correlation-ID")
      ?? null;

    console.info("[activity:create] success", {
      tripId,
      version,
      endpoint,
      status: response.status,
      correlationId,
      response: redactDates(preview),
    });

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      const correlationId =
        typeof error.data === "object" && error.data !== null && "correlationId" in (error.data as Record<string, unknown>)
          ? (error.data as Record<string, unknown>).correlationId
          : null;

      console.error("[activity:create] failure", {
        tripId,
        version,
        endpoint,
        status: error.status,
        message: error.message,
        correlationId,
        payload: sanitizedPayload,
        response: redactDates(error.data),
      });
    } else {
      console.error("[activity:create] failure", {
        tripId,
        version,
        endpoint,
        payload: sanitizedPayload,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    throw error;
  }
};

export const buildOptimisticActivity = (
  values: ActivityCreateFormValues,
  payload: ReturnType<typeof buildActivitySubmission>["payload"],
  optimisticId: number,
  members: (TripMember & { user: User })[],
  currentUserId?: string,
): ActivityWithDetails => {
  const now = new Date().toISOString();
  const creator = members.find((member) => member.userId === currentUserId)?.user ?? null;

  const poster: User =
    creator ??
    ({
      id: currentUserId ?? "unknown",
      email: "",
      username: null,
      firstName: null,
      lastName: null,
      phoneNumber: null,
      passwordHash: null,
      profileImageUrl: null,
      cashAppUsername: null,
      cashAppUsernameLegacy: null,
      cashAppPhone: null,
      cashAppPhoneLegacy: null,
      venmoUsername: null,
      venmoPhone: null,
      timezone: null,
      defaultLocation: null,
      defaultLocationCode: null,
      defaultCity: null,
      defaultCountry: null,
      authProvider: null,
      notificationPreferences: null,
      hasSeenHomeOnboarding: false,
      hasSeenTripOnboarding: false,
      createdAt: now,
      updatedAt: now,
    } satisfies User);

  const attendeeLookup = new Map<string, TripMember & { user: User }>();
  members.forEach((member) => {
    attendeeLookup.set(String(member.userId), member);
  });

  const invites: (ActivityInvite & { user: User })[] = values.attendeeIds.map(
    (attendeeId, index): ActivityInvite & { user: User } => {
      const member = attendeeLookup.get(String(attendeeId));
      const inviteUser = member?.user ?? poster;
      const isCreator = String(attendeeId) === String(currentUserId ?? "");
      const status: ActivityInviteStatus =
        values.type === "SCHEDULED" && isCreator ? "accepted" : "pending";
      return {
        id: optimisticId * 100 - index,
        activityId: optimisticId,
        userId: String(attendeeId),
        status,
        respondedAt: status === "accepted" ? now : null,
        createdAt: now,
        updatedAt: now,
        user: inviteUser,
      };
    },
  );

  const acceptances: (ActivityAcceptance & { user: User })[] = invites
    .filter((invite) => invite.status === "accepted")
    .map(
      (invite, index): ActivityAcceptance & { user: User } => ({
        id: optimisticId * 1000 - index,
        activityId: optimisticId,
        userId: invite.userId,
        acceptedAt: now,
        user: invite.user,
      }),
    );

  const currentUserInvite = invites.find(
    (invite) => invite.userId === String(currentUserId ?? ""),
  );
  const currentUserResponded =
    currentUserInvite !== undefined && currentUserInvite.status !== "pending";

  return {
    id: optimisticId,
    tripCalendarId: payload.tripCalendarId,
    postedBy: poster.id,
    name: payload.name,
    description: payload.description,
    startTime: payload.startTime,
    endTime: payload.endTime,
    location: payload.location,
    cost: payload.cost,
    maxCapacity: payload.maxCapacity,
    category: payload.category,
    status: "active",
    type: payload.type,
    createdAt: now,
    updatedAt: now,
    poster,
    invites,
    acceptances,
    comments: [],
    acceptedCount: acceptances.length,
    pendingCount: invites.filter((invite) => invite.status === "pending").length,
    declinedCount: 0,
    waitlistedCount: 0,
    rsvpCloseTime: null,
    currentUserInvite,
    isAccepted: currentUserInvite?.status === "accepted" || false,
    hasResponded: currentUserResponded,
  } satisfies ActivityWithDetails;
};

export const sortActivitiesByStartTime = (activities: ActivityWithDetails[]) =>
  [...activities].sort((a, b) => {
    const toTimestamp = (value: ActivityWithDetails["startTime"]) => {
      if (!value) {
        return Number.POSITIVE_INFINITY;
      }
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
    };

    return toTimestamp(a.startTime) - toTimestamp(b.startTime);
  });
