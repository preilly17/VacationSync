import { useCallback, useMemo } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/queryClient";
import {
  ActivitySubmissionError,
  buildOptimisticActivity,
  mapApiErrorToValidation,
  prepareActivitySubmission,
  sortActivitiesByStartTime,
  submitActivityRequest,
  type ActivityCreateFormValues,
  type ActivityValidationError,
} from "./activityCreation";
import { CLIENT_VALIDATION_FALLBACK_MESSAGE } from "./clientValidation";
import { normalizeActivityTypeInput } from "@shared/activityValidation";
import type { ActivityType, ActivityWithDetails, TripMember, User, ActivityInviteStatus } from "@shared/schema";

const mapStatusToLegacyType = (status: unknown): ActivityType => {
  if (typeof status === "string" && status.trim().toLowerCase() === "proposed") {
    return "PROPOSE";
  }

  return "SCHEDULED";
};

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isValidDateValue = (value: unknown): boolean => {
  if (!value) {
    return false;
  }

  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime());
  }

  return false;
};

const getTimeZoneOffsetInMilliseconds = (instant: Date, timeZone: string): number => {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const parts = formatter.formatToParts(instant);
    const lookup: Record<string, number> = {};

    for (const part of parts) {
      if (part.type === "literal") continue;
      const parsed = Number.parseInt(part.value, 10);
      if (!Number.isNaN(parsed)) {
        lookup[part.type] = parsed;
      }
    }

    const year = lookup.year ?? instant.getUTCFullYear();
    const month = (lookup.month ?? instant.getUTCMonth() + 1) - 1;
    const day = lookup.day ?? instant.getUTCDate();
    const hour = lookup.hour ?? instant.getUTCHours();
    const minute = lookup.minute ?? instant.getUTCMinutes();
    const second = lookup.second ?? instant.getUTCSeconds();

    const asUtc = Date.UTC(year, month, day, hour, minute, second);
    return asUtc - instant.getTime();
  } catch (error) {
    console.warn("Failed to determine timezone offset", { error, timeZone });
    return 0;
  }
};

const combineDateAndTimeInUtc = (
  date: string | null | undefined,
  time: string | null | undefined,
  timeZone: string,
): string | null => {
  if (!date || !time) {
    return null;
  }

  const [yearStr, monthStr, dayStr] = date.split("-");
  const [hourStr = "0", minuteStr = "0"] = time.split(":");

  const year = Number.parseInt(yearStr ?? "", 10);
  const month = Number.parseInt(monthStr ?? "", 10);
  const day = Number.parseInt(dayStr ?? "", 10);
  const hour = Number.parseInt(hourStr ?? "", 10);
  const minute = Number.parseInt(minuteStr ?? "", 10);

  if (
    Number.isNaN(year)
    || Number.isNaN(month)
    || Number.isNaN(day)
    || Number.isNaN(hour)
    || Number.isNaN(minute)
  ) {
    return null;
  }

  try {
    const provisional = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    const offset = getTimeZoneOffsetInMilliseconds(provisional, timeZone);
    return new Date(provisional.getTime() - offset).toISOString();
  } catch (error) {
    console.warn("Failed to convert activity time to UTC", {
      error,
      date,
      time,
      timeZone,
    });
    return `${date}T${time}:00.000Z`;
  }
};

const normalizeLegacyActivity = (activity: ActivityWithDetails): ActivityWithDetails => {
  const rawType = activity?.type;
  const derivedType = mapStatusToLegacyType((activity as { status?: unknown }).status);
  const normalizedType =
    typeof rawType === "string" && rawType.trim().length > 0 ? (rawType as ActivityType) : derivedType;

  const invites: ActivityWithDetails["invites"] = Array.isArray(activity.invites)
    ? activity.invites
    : [];
  const acceptances: ActivityWithDetails["acceptances"] = Array.isArray(activity.acceptances)
    ? activity.acceptances
    : [];
  const comments: ActivityWithDetails["comments"] = Array.isArray(activity.comments)
    ? activity.comments
    : [];

  const acceptedCount = typeof activity.acceptedCount === "number"
    ? activity.acceptedCount
    : invites.filter((invite) => invite.status === "accepted").length;
  const pendingCount = typeof activity.pendingCount === "number"
    ? activity.pendingCount
    : invites.filter((invite) => invite.status === "pending").length;
  const declinedCount = typeof activity.declinedCount === "number"
    ? activity.declinedCount
    : invites.filter((invite) => invite.status === "declined").length;
  const waitlistedCount = typeof activity.waitlistedCount === "number"
    ? activity.waitlistedCount
    : invites.filter((invite) => invite.status === "waitlisted").length;

  const currentUserInvite = (activity as { currentUserInvite?: ActivityWithDetails["currentUserInvite"] }).currentUserInvite
    ?? null;
  const normalizedCurrentUserInvite = currentUserInvite ?? null;
  const derivedIsAccepted = typeof activity.isAccepted === "boolean"
    ? (activity.isAccepted ? true : undefined)
    : normalizedCurrentUserInvite && normalizedCurrentUserInvite.status === "accepted"
      ? true
      : undefined;
  const derivedHasResponded = typeof activity.hasResponded === "boolean"
    ? (activity.hasResponded ? true : undefined)
    : normalizedCurrentUserInvite && normalizedCurrentUserInvite.status !== "pending"
      ? true
      : undefined;

  const maybeV2 = activity as ActivityWithDetails & {
    title?: string | null;
    date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    timezone?: string | null;
    timeZone?: string | null;
  };

  const resolvedName = toTrimmedString(activity.name) ?? toTrimmedString(maybeV2.title) ?? activity.name;

  const timezone =
    toTrimmedString(maybeV2.timezone)
    ?? toTrimmedString(maybeV2.timeZone)
    ?? "UTC";

  const dateCandidate = toTrimmedString(maybeV2.date);
  const startTimeCandidate =
    toTrimmedString(maybeV2.start_time)
    ?? toTrimmedString((maybeV2 as { startTime?: string | null }).startTime)
    ?? (typeof activity.startTime === "string" ? toTrimmedString(activity.startTime) : null);
  const endTimeCandidate =
    toTrimmedString(maybeV2.end_time)
    ?? toTrimmedString((maybeV2 as { endTime?: string | null }).endTime)
    ?? (typeof activity.endTime === "string" ? toTrimmedString(activity.endTime) : null);

  const resolvedStartTime = isValidDateValue(activity.startTime)
    ? activity.startTime
    : combineDateAndTimeInUtc(dateCandidate, startTimeCandidate, timezone) ?? null;

  const resolvedEndTime = isValidDateValue(activity.endTime)
    ? activity.endTime
    : combineDateAndTimeInUtc(dateCandidate, endTimeCandidate, timezone);

  const normalizedStatus = (() => {
    const rawStatus = toTrimmedString((activity as { status?: string | null }).status);
    if (!rawStatus) {
      return activity.status;
    }

    if (rawStatus.toLowerCase() === "cancelled") {
      return "canceled";
    }

    return rawStatus.toLowerCase() === "scheduled" ? "active" : activity.status;
  })();

  return {
    ...activity,
    type: normalizedType,
    name: resolvedName,
    startTime: resolvedStartTime ?? null,
    endTime: resolvedEndTime ?? null,
    status: normalizedStatus,
    invites,
    acceptances,
    comments,
    acceptedCount,
    pendingCount,
    declinedCount,
    waitlistedCount,
    currentUserInvite: normalizedCurrentUserInvite,
    isAccepted: derivedIsAccepted,
    hasResponded: derivedHasResponded,
  } satisfies ActivityWithDetails;
};

export const normalizeActivityFromServer = (
  activity: ActivityWithDetails,
): ActivityWithDetails => normalizeLegacyActivity(activity);

export type { ActivityCreateFormValues, ActivityValidationError } from "./activityCreation";

export interface UseCreateActivityOptions {
  tripId: number;
  scheduledActivitiesQueryKey: QueryKey;
  proposalActivitiesQueryKey: QueryKey;
  calendarActivitiesQueryKey: QueryKey;
  members: (TripMember & { user: User })[];
  currentUserId?: string;
  onSuccess?: (activity: ActivityWithDetails, values: ActivityCreateFormValues) => void;
  onValidationError?: (error: ActivityValidationError) => void;
  enabled?: boolean;
}

type InternalActivityCreateVariables = ActivityCreateFormValues & {
  __meta: {
    payload: ReturnType<typeof prepareActivitySubmission>["payload"];
    optimisticId: number;
  };
};

interface OptimisticContext {
  previousScheduled?: ActivityWithDetails[];
  previousProposals?: ActivityWithDetails[];
  previousCalendar?: ActivityWithDetails[];
  optimisticId: number;
  submissionType: ActivityType;
  affected?: {
    scheduled: boolean;
    proposals: boolean;
    calendar: boolean;
  };
}

interface MutationResult {
  activity: ActivityWithDetails;
}

const networkErrorMessage = "We couldn’t reach the server. Check your connection and try again.";

const createAnalyticsTracker = () => {
  const analyticsWindow = typeof window !== "undefined"
    ? (window as typeof window & {
        analytics?: { track?: (eventName: string, payload?: Record<string, unknown>) => void };
      })
    : null;

  return (eventName: string, payload?: Record<string, unknown>) => {
    analyticsWindow?.analytics?.track?.(eventName, payload);
  };
};

const generateOptimisticId = (() => {
  let counter = -1;
  return () => {
    counter -= 1;
    return counter;
  };
})();

export function useCreateActivity({
  tripId,
  scheduledActivitiesQueryKey,
  proposalActivitiesQueryKey,
  calendarActivitiesQueryKey,
  members,
  currentUserId,
  onSuccess,
  onValidationError,
  enabled = true,
}: UseCreateActivityOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const trackEvent = useMemo(createAnalyticsTracker, []);

  const mutation = useMutation<
    MutationResult,
    Error,
    InternalActivityCreateVariables,
    OptimisticContext
  >({
    mutationKey: ["create-activity", tripId],
    mutationFn: async (variables) => {
      const activity = await submitActivityRequest<ActivityWithDetails>({
        tripId,
        payload: variables.__meta.payload,
      });

      const normalizedActivity = normalizeActivityFromServer(activity);

      return { activity: normalizedActivity } satisfies MutationResult;
    },
    onMutate: async (variables) => {
      if (!enabled) {
        return {
          optimisticId: variables.__meta.optimisticId,
          submissionType: variables.type,
          affected: {
            scheduled: false,
            proposals: false,
            calendar: false,
          },
        } satisfies OptimisticContext;
      }

      const optimisticActivity = buildOptimisticActivity(
        variables,
        variables.__meta.payload,
        variables.__meta.optimisticId,
        members,
        currentUserId,
      );

      await Promise.all([
        queryClient.cancelQueries({ queryKey: scheduledActivitiesQueryKey }),
        queryClient.cancelQueries({ queryKey: proposalActivitiesQueryKey }),
        queryClient.cancelQueries({ queryKey: calendarActivitiesQueryKey }),
      ]);

      const previousScheduled = queryClient.getQueryData<ActivityWithDetails[]>(scheduledActivitiesQueryKey);
      const previousProposals = queryClient.getQueryData<ActivityWithDetails[]>(proposalActivitiesQueryKey);
      const previousCalendar = queryClient.getQueryData<ActivityWithDetails[]>(calendarActivitiesQueryKey);

      const affectsScheduled = variables.type === "SCHEDULED";
      const affectsProposals = variables.type === "PROPOSE";
      const affectsCalendar = affectsScheduled;

      const applyUpdate = (queryKey: QueryKey, shouldAdd: boolean) => {
        if (!shouldAdd) return;
        queryClient.setQueryData<ActivityWithDetails[]>(queryKey, (existing = []) => {
          const filtered = existing.filter((item) => item.id !== optimisticActivity.id);
          return sortActivitiesByStartTime([...filtered, optimisticActivity]);
        });
      };

      applyUpdate(scheduledActivitiesQueryKey, affectsScheduled);
      applyUpdate(calendarActivitiesQueryKey, affectsCalendar);
      applyUpdate(proposalActivitiesQueryKey, affectsProposals);

      trackEvent("activity_create_submit", {
        trip_id: tripId,
        submission_type: variables.type,
      });

      return {
        previousScheduled,
        previousProposals,
        previousCalendar,
        optimisticId: variables.__meta.optimisticId,
        submissionType: variables.type,
        affected: {
          scheduled: affectsScheduled,
          proposals: affectsProposals,
          calendar: affectsCalendar,
        },
      } satisfies OptimisticContext;
    },
    onSuccess: (result, variables, context) => {
      if (!enabled) {
        return;
      }

      if (!context) {
        return;
      }

      const affectsScheduled = context.affected?.scheduled ?? context.submissionType === "SCHEDULED";
      const affectsProposals = context.affected?.proposals ?? context.submissionType === "PROPOSE";
      const affectsCalendar = context.affected?.calendar ?? context.submissionType === "SCHEDULED";

      const replaceOptimisticActivity = (queryKey: QueryKey, shouldReplace: boolean) => {
        if (!shouldReplace) return;
        queryClient.setQueryData<ActivityWithDetails[]>(queryKey, (existing = []) => {
          const withoutOptimistic = existing.filter((item) => item.id !== context.optimisticId);
          return sortActivitiesByStartTime([...withoutOptimistic, result.activity]);
        });
      };

      replaceOptimisticActivity(scheduledActivitiesQueryKey, affectsScheduled);
      replaceOptimisticActivity(calendarActivitiesQueryKey, affectsCalendar);
      replaceOptimisticActivity(proposalActivitiesQueryKey, affectsProposals);

      if (affectsScheduled) {
        queryClient.invalidateQueries({ queryKey: scheduledActivitiesQueryKey });
      }
      if (affectsProposals) {
        queryClient.invalidateQueries({ queryKey: proposalActivitiesQueryKey });
      }
      if (affectsCalendar) {
        queryClient.invalidateQueries({ queryKey: calendarActivitiesQueryKey });
      }

      trackEvent("activity_create_success", {
        trip_id: tripId,
        submission_type: variables.type,
        activity_id: result.activity.id,
      });

      toast({
        title: variables.type === "PROPOSE" ? "Activity proposed!" : "Activity created!",
        description:
          variables.type === "PROPOSE"
            ? "Your idea has been shared with the group for feedback."
            : "Your activity has been added to the trip calendar.",
      });

      onSuccess?.(result.activity, variables);
    },
    onError: (error, variables, context) => {
      if (!enabled) {
        return;
      }

      const affectsScheduled = context?.affected?.scheduled ?? context?.submissionType === "SCHEDULED";
      const affectsProposals = context?.affected?.proposals ?? context?.submissionType === "PROPOSE";
      const affectsCalendar = context?.affected?.calendar ?? context?.submissionType === "SCHEDULED";

      if (affectsScheduled && context?.previousScheduled) {
        queryClient.setQueryData(scheduledActivitiesQueryKey, context.previousScheduled);
      }
      if (affectsProposals && context?.previousProposals) {
        queryClient.setQueryData(proposalActivitiesQueryKey, context.previousProposals);
      }
      if (affectsCalendar && context?.previousCalendar) {
        queryClient.setQueryData(calendarActivitiesQueryKey, context.previousCalendar);
      }

      if (affectsScheduled) {
        queryClient.invalidateQueries({ queryKey: scheduledActivitiesQueryKey });
      }
      if (affectsProposals) {
        queryClient.invalidateQueries({ queryKey: proposalActivitiesQueryKey });
      }
      if (affectsCalendar) {
        queryClient.invalidateQueries({ queryKey: calendarActivitiesQueryKey });
      }

      trackEvent("activity_create_failure", {
        trip_id: tripId,
        submission_type: variables.type,
        error_message: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof ApiError) {
        const validationError = mapApiErrorToValidation(error);
        if (validationError) {
          onValidationError?.(validationError);
          return;
        }

        const errorData = (error.data ?? null) as Record<string, unknown> | null;
        const rawMessage =
          (errorData && typeof errorData.message === "string" && errorData.message.trim().length > 0
            ? errorData.message.trim()
            : error.message?.trim()) ?? "";
        const correlationId =
          errorData && typeof errorData.correlationId === "string" && errorData.correlationId.trim().length > 0
            ? errorData.correlationId.trim()
            : null;
        const fallback = error.status
          ? `Request failed with status ${error.status}`
          : networkErrorMessage;
        const displayMessage = rawMessage.length > 0 ? rawMessage : fallback;
        const description = correlationId ? `${displayMessage} (Ref: ${correlationId})` : displayMessage;

        toast({
          title: "Activity wasn’t saved",
          description,
          variant: "destructive",
        });
        return;
      }

      const message = error instanceof Error ? error.message : networkErrorMessage;

      toast({
        title: "Activity wasn’t saved",
        description: message || networkErrorMessage,
        variant: "destructive",
      });
    },
  });

  const submit = useCallback(
    (values: ActivityCreateFormValues) => {
      if (!enabled) {
        return;
      }

      const normalizedType = normalizeActivityTypeInput(values.type, "SCHEDULED");
      const normalizedValues: ActivityCreateFormValues = {
        ...values,
        type: normalizedType,
      };

      const optimisticId = generateOptimisticId();

      let submission;
      try {
        submission = prepareActivitySubmission({ tripId, values: normalizedValues });
      } catch (error) {
        console.error("Failed to prepare activity submission:", error);

        if (error instanceof ActivitySubmissionError) {
          if (onValidationError) {
            onValidationError(error.validation);
          } else {
            toast({
              title: "Please fix the highlighted fields",
              description: error.message,
              variant: "destructive",
            });
          }

          trackEvent("activity_create_failure", {
            trip_id: tripId,
            submission_type: normalizedType,
            error_message: error.message,
          });
        } else {
          toast({
            title: "Please fix the highlighted fields",
            description: CLIENT_VALIDATION_FALLBACK_MESSAGE,
            variant: "destructive",
          });

          trackEvent("activity_create_failure", {
            trip_id: tripId,
            submission_type: normalizedType,
            error_message: CLIENT_VALIDATION_FALLBACK_MESSAGE,
          });
        }

        return;
      }

      mutation.mutate({
        ...submission.sanitizedValues,
        type: normalizedType,
        __meta: {
          payload: submission.payload,
          optimisticId,
        },
      });
    },
    [enabled, mutation, onValidationError, toast, trackEvent, tripId],
  );

  return {
    submit,
    mutate: submit,
    reset: mutation.reset,
    status: mutation.status,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
  };
}
