import { useCallback, useMemo } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

import { useToast } from "@/hooks/use-toast";
import { buildActivitySubmission } from "@/lib/activitySubmission";
import { ApiError, apiRequest } from "@/lib/queryClient";
import type { ActivityType, ActivityWithDetails, TripMember, User } from "@shared/schema";

export interface ActivityCreateFormValues {
  name: string;
  description?: string;
  startDate: string;
  startTime: string;
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
    payload: ReturnType<typeof buildActivitySubmission>["payload"];
    optimisticId: number;
  };
};

interface OptimisticContext {
  previousScheduled?: ActivityWithDetails[];
  previousProposals?: ActivityWithDetails[];
  previousCalendar?: ActivityWithDetails[];
  optimisticId: number;
  submissionType: ActivityType;
}

interface MutationResult {
  activity: ActivityWithDetails;
}

const networkErrorMessage = "We couldn’t reach the server. Check your connection and try again.";
const permissionErrorMessage = "You don’t have permission to perform this action.";
const serverErrorMessage = "Something went wrong on our side. Please try again.";
const tripMembershipErrorMessage = "You’re not a member of this trip.";
const tripMissingErrorMessage = "We couldn’t find this trip. Please refresh or check with the organizer.";
const duplicateActivityErrorMessage = "This looks like a duplicate activity.";

const serverFieldMap: Partial<Record<string, keyof ActivityCreateFormValues>> = {
  name: "name",
  description: "description",
  startTime: "startTime",
  endTime: "endTime",
  location: "location",
  cost: "cost",
  maxCapacity: "maxCapacity",
  category: "category",
  attendeeIds: "attendeeIds",
  startDate: "startDate",
};

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

const sortByStartTime = (activities: ActivityWithDetails[]) =>
  [...activities].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );

const generateOptimisticId = (() => {
  let counter = -1;
  return () => {
    counter -= 1;
    return counter;
  };
})();

const buildOptimisticActivity = (
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

  const invites = values.attendeeIds.map((attendeeId, index) => {
    const member = attendeeLookup.get(String(attendeeId));
    const inviteUser = member?.user ?? poster;
    const isCreator = String(attendeeId) === String(currentUserId ?? "");
    return {
      id: optimisticId * 100 - index,
      activityId: optimisticId,
      userId: String(attendeeId),
      status: values.type === "SCHEDULED" && isCreator ? "accepted" : "pending",
      respondedAt: values.type === "SCHEDULED" && isCreator ? now : null,
      createdAt: now,
      updatedAt: now,
      user: inviteUser,
    };
  });

  const acceptances = invites
    .filter((invite) => invite.status === "accepted")
    .map((invite, index) => ({
      id: optimisticId * 1000 - index,
      activityId: optimisticId,
      userId: invite.userId,
      acceptedAt: now,
      user: invite.user,
    }));

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
    currentUserInvite: invites.find((invite) => invite.userId === String(currentUserId ?? "")) ?? null,
    isAccepted: acceptances.some((invite) => invite.userId === String(currentUserId ?? "")),
    hasResponded: acceptances.some((invite) => invite.userId === String(currentUserId ?? "")),
  } satisfies ActivityWithDetails;
};

const mapApiErrorToValidation = (error: ApiError): ActivityValidationError | null => {
  if (error.status !== 400) {
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
  };
};

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

  const mutation = useMutation<MutationResult, Error, InternalActivityCreateVariables, OptimisticContext>({
    mutationFn: async (variables) => {
      const endpoint =
        variables.type === "PROPOSE"
          ? `/api/trips/${tripId}/proposals/activities`
          : `/api/trips/${tripId}/activities`;

      const response = await apiRequest(endpoint, {
        method: "POST",
        body: variables.__meta.payload,
      });

      const created = (await response.json()) as ActivityWithDetails;

      return { activity: created } satisfies MutationResult;
    },
    onMutate: async (variables) => {
      if (!enabled) {
        return {
          optimisticId: variables.__meta.optimisticId,
          submissionType: variables.type,
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

      const applyUpdate = (queryKey: QueryKey, shouldAdd: boolean) => {
        if (!shouldAdd) return;
        queryClient.setQueryData<ActivityWithDetails[]>(queryKey, (existing = []) => {
          const filtered = existing.filter((item) => item.id !== optimisticActivity.id);
          return sortByStartTime([...filtered, optimisticActivity]);
        });
      };

      applyUpdate(scheduledActivitiesQueryKey, true);
      applyUpdate(calendarActivitiesQueryKey, true);
      applyUpdate(proposalActivitiesQueryKey, variables.type === "PROPOSE");

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
      } satisfies OptimisticContext;
    },
    onSuccess: (result, variables, context) => {
      if (!enabled) {
        return;
      }

      const replaceOptimisticActivity = (queryKey: QueryKey, shouldReplace: boolean) => {
        if (!shouldReplace) return;
        queryClient.setQueryData<ActivityWithDetails[]>(queryKey, (existing = []) => {
          const withoutOptimistic = existing.filter((item) => item.id !== context.optimisticId);
          return sortByStartTime([...withoutOptimistic, result.activity]);
        });
      };

      replaceOptimisticActivity(scheduledActivitiesQueryKey, true);
      replaceOptimisticActivity(calendarActivitiesQueryKey, true);
      replaceOptimisticActivity(proposalActivitiesQueryKey, variables.type === "PROPOSE");

      queryClient.invalidateQueries({ queryKey: scheduledActivitiesQueryKey });
      if (variables.type === "PROPOSE") {
        queryClient.invalidateQueries({ queryKey: proposalActivitiesQueryKey });
      }
      queryClient.invalidateQueries({ queryKey: calendarActivitiesQueryKey });

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

      if (context.previousScheduled) {
        queryClient.setQueryData(scheduledActivitiesQueryKey, context.previousScheduled);
      }
      if (context.previousProposals) {
        queryClient.setQueryData(proposalActivitiesQueryKey, context.previousProposals);
      }
      if (context.previousCalendar) {
        queryClient.setQueryData(calendarActivitiesQueryKey, context.previousCalendar);
      }

      queryClient.invalidateQueries({ queryKey: scheduledActivitiesQueryKey });
      if (variables.type === "PROPOSE") {
        queryClient.invalidateQueries({ queryKey: proposalActivitiesQueryKey });
      }
      queryClient.invalidateQueries({ queryKey: calendarActivitiesQueryKey });

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

        if (error.status === 401) {
          toast({
            title: "Permission required",
            description: permissionErrorMessage,
            variant: "destructive",
          });
          return;
        }

        if (error.status === 403) {
          toast({
            title: "Access denied",
            description: tripMembershipErrorMessage,
            variant: "destructive",
          });
          return;
        }

        if (error.status === 404) {
          toast({
            title: "Trip not found",
            description: tripMissingErrorMessage,
            variant: "destructive",
          });
          return;
        }

        if (error.status === 409) {
          toast({
            title: "Possible duplicate",
            description: duplicateActivityErrorMessage,
            variant: "destructive",
          });
          return;
        }

        if (error.status >= 500) {
          const data = error.data as { correlationId?: string } | undefined;
          toast({
            title: "We ran into a problem",
            description: data?.correlationId
              ? `${serverErrorMessage} Reference: ${data.correlationId}.`
              : serverErrorMessage,
            variant: "destructive",
          });
          return;
        }
      }

      const message = error instanceof Error ? error.message : networkErrorMessage;

      toast({
        title: "Request failed",
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

      const optimisticId = generateOptimisticId();

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

      mutation.mutate({
        ...values,
        __meta: {
          payload,
          optimisticId,
        },
      });
    },
    [enabled, mutation, tripId],
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

