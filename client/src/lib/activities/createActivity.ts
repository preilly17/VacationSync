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
import type { ActivityType, ActivityWithDetails, TripMember, User } from "@shared/schema";

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
  activitiesVersion?: "legacy" | "v2";
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
  activitiesVersion = "legacy",
}: UseCreateActivityOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const trackEvent = useMemo(createAnalyticsTracker, []);
  const useActivitiesV2 = activitiesVersion === "v2";

  const mutation = useMutation<
    MutationResult,
    Error,
    InternalActivityCreateVariables,
    OptimisticContext
  >({
    mutationKey: ["create-activity", tripId, useActivitiesV2 ? "v2" : "legacy"],
    mutationFn: async (variables) => {
      const activity = await submitActivityRequest<ActivityWithDetails>({
        tripId,
        version: useActivitiesV2 ? "v2" : "legacy",
        payload: variables.__meta.payload,
      });

      return { activity } satisfies MutationResult;
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
          return sortActivitiesByStartTime([...filtered, optimisticActivity]);
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

      if (!context) {
        return;
      }

      const replaceOptimisticActivity = (queryKey: QueryKey, shouldReplace: boolean) => {
        if (!shouldReplace) return;
        queryClient.setQueryData<ActivityWithDetails[]>(queryKey, (existing = []) => {
          const withoutOptimistic = existing.filter((item) => item.id !== context.optimisticId);
          return sortActivitiesByStartTime([...withoutOptimistic, result.activity]);
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

      if (context?.previousScheduled) {
        queryClient.setQueryData(scheduledActivitiesQueryKey, context.previousScheduled);
      }
      if (context?.previousProposals) {
        queryClient.setQueryData(proposalActivitiesQueryKey, context.previousProposals);
      }
      if (context?.previousCalendar) {
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

      let submission;
      try {
        submission = prepareActivitySubmission({ tripId, values });
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
            submission_type: values.type,
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
            submission_type: values.type,
            error_message: CLIENT_VALIDATION_FALLBACK_MESSAGE,
          });
        }

        return;
      }

      mutation.mutate({
        ...submission.sanitizedValues,
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
