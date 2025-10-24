import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { differenceInMinutes, format, formatDistanceToNow } from "date-fns";
import { filterActiveProposals, isCanceledStatus } from "./proposalStatusFilters";
import {
  ArrowLeft,
  Hotel,
  Plane,
  MapPin,
  Utensils,
  Users,
  Star,
  Clock,
  DollarSign,
  ExternalLink,
  Vote,
  AlertCircle,
  TrendingUp,
  Eye,
  Crown,
  Calendar,
  CheckCircle,
  XCircle,
  User,
  Activity,
} from "lucide-react";
import { TravelLoading } from "@/components/LoadingSpinners";
import type {
  HotelProposalWithDetails,
  FlightProposalWithDetails,
  ActivityWithDetails,
  RestaurantProposalWithDetails,
  TripWithDetails,
  ActivityInviteStatus,
} from "@shared/schema";

type CancelableProposalType = "hotel" | "flight" | "restaurant" | "activity";

type ParsedApiError = {
  status?: number;
  message: string;
};

const parseApiError = (error: unknown): ParsedApiError => {
  if (error instanceof ApiError) {
    let message: string | undefined;
    if (error.data && typeof error.data === "object" && "message" in error.data) {
      const dataMessage = (error.data as { message?: unknown }).message;
      if (typeof dataMessage === "string") {
        message = dataMessage;
      } else if (dataMessage != null) {
        message = String(dataMessage);
      }
    }

    return { status: error.status, message: message ?? error.message };
  }

  if (error instanceof Error) {
    const match = error.message.match(/^(\d{3}):\s*(.*)$/);
    if (match) {
      const status = Number(match[1]);
      const body = match[2]?.trim();
      if (body) {
        const tryParse = (value: string) => {
          try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === "object" && "message" in parsed) {
              const parsedMessage = parsed.message;
              if (typeof parsedMessage === "string") {
                return parsedMessage;
              }
              if (parsedMessage != null) {
                return String(parsedMessage);
              }
            }
          } catch {
            return null;
          }
          return null;
        };

        const directParse = tryParse(body);
        if (directParse) {
          return { status, message: directParse };
        }

        const sanitized = body
          .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
          .replace(/'/g, '"');
        const sanitizedParse = tryParse(sanitized);
        if (sanitizedParse) {
          return { status, message: sanitizedParse };
        }

        return { status, message: body };
      }

      return { status, message: `Request failed with status ${status}` };
    }

    return { message: error.message };
  }

  return { message: "Something went wrong. Please try again." };
};

interface ProposalsPageProps {
  tripId?: number;
  embedded?: boolean;
  includeUserProposalsInCategories?: boolean;
  formatFlightDateTime?: (value?: string | Date | null) => string;
}

type ProposalTab = "my-proposals" | "hotels" | "flights" | "activities" | "restaurants";

const normalizeArrayData = <T,>(value: unknown): { items: T[]; isInvalid: boolean } => {
  if (Array.isArray(value)) {
    return { items: value as T[], isInvalid: false };
  }

  return { items: [], isInvalid: value !== undefined && value !== null };
};

const getInlineErrorMessage = (error: unknown, invalid: boolean, fallback: string) => {
  if (invalid) {
    return fallback;
  }

  if (error) {
    const parsed = parseApiError(error);
    return parsed.message || fallback;
  }

  return fallback;
};

type ActivityRsvpAction = "ACCEPT" | "DECLINE" | "WAITLIST" | "MAYBE";

const inviteStatusBadgeClasses: Record<ActivityInviteStatus, string> = {
  accepted: "bg-green-100 text-green-800 border-green-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  declined: "bg-red-100 text-red-800 border-red-200",
  waitlisted: "bg-blue-100 text-blue-800 border-blue-200",
};

const inviteStatusLabels: Record<ActivityInviteStatus, string> = {
  accepted: "Going",
  pending: "No response yet",
  declined: "Not going",
  waitlisted: "Waitlisted",
};

const actionToStatusMap: Record<ActivityRsvpAction, ActivityInviteStatus | null> = {
  ACCEPT: "accepted",
  DECLINE: "declined",
  WAITLIST: "waitlisted",
  MAYBE: "pending",
};

function ProposalsPage({
  tripId,
  embedded = false,
  includeUserProposalsInCategories = false,
  formatFlightDateTime,
}: ProposalsPageProps = {}) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ProposalTab>("hotels");
  const [responseFilter, setResponseFilter] = useState<"needs-response" | "accepted">(
    "needs-response",
  );

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [authLoading, isAuthenticated, toast]);

  // Fetch trip data
  const {
    data: trip,
    isLoading: tripLoading,
    error: tripError,
  } = useQuery<TripWithDetails>({
    queryKey: [`/api/trips/${tripId}`],
    enabled: !!tripId && isAuthenticated,
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/login";
        return false;
      }
      return failureCount < 3;
    },
  });

  // Fetch hotel proposals
  const {
    data: hotelProposalsData,
    isLoading: hotelProposalsLoading,
    error: hotelProposalsError,
    refetch: refetchHotelProposals,
  } = useQuery<unknown>({
    queryKey: [`/api/trips/${tripId}/proposals/hotels`],
    enabled: !!tripId && isAuthenticated,
  });

  const {
    data: myHotelProposalsData,
    isLoading: myHotelProposalsLoading,
    error: myHotelProposalsError,
  } = useQuery<unknown>({
    queryKey: [`/api/trips/${tripId}/proposals/hotels?mineOnly=true`],
    enabled: !!tripId && isAuthenticated,
  });

  // Fetch flight proposals
  const {
    data: flightProposalsData,
    isLoading: flightProposalsLoading,
    error: flightProposalsError,
    refetch: refetchFlightProposals,
  } = useQuery<unknown>({
    queryKey: [`/api/trips/${tripId}/proposals/flights`],
    enabled: !!tripId && isAuthenticated,
  });

  const {
    data: myFlightProposalsData,
    isLoading: myFlightProposalsLoading,
    error: myFlightProposalsError,
  } = useQuery<unknown>({
    queryKey: [`/api/trips/${tripId}/proposals/flights?mineOnly=true`],
    enabled: !!tripId && isAuthenticated,
  });

  // Fetch activity and restaurant proposals
  const {
    data: rawActivityProposalsData,
    isLoading: activityProposalsLoading,
    error: activityProposalsError,
    refetch: refetchActivityProposals,
  } = useQuery<unknown>({
    queryKey: [`/api/trips/${tripId}/proposals/activities`],
    enabled: !!tripId && isAuthenticated,
  });

  const {
    data: restaurantProposalsData,
    isLoading: restaurantProposalsLoading,
    error: restaurantProposalsError,
    refetch: refetchRestaurantProposals,
  } = useQuery<unknown>({
    queryKey: ["/api/trips", tripId, "restaurant-proposals"],
    enabled: !!tripId && isAuthenticated,
  });

  const { items: hotelProposals, isInvalid: hotelProposalsInvalid } = normalizeArrayData<HotelProposalWithDetails>(
    hotelProposalsData,
  );
  const { items: myHotelProposalsFromApi, isInvalid: myHotelProposalsInvalid } = normalizeArrayData<HotelProposalWithDetails>(
    myHotelProposalsData,
  );
  const { items: flightProposals, isInvalid: flightProposalsInvalid } = normalizeArrayData<FlightProposalWithDetails>(
    flightProposalsData,
  );
  const { items: myFlightProposalsFromApi, isInvalid: myFlightProposalsInvalid } = normalizeArrayData<FlightProposalWithDetails>(
    myFlightProposalsData,
  );
  const { items: rawActivityProposals, isInvalid: activityProposalsInvalid } = normalizeArrayData<ActivityWithDetails>(
    rawActivityProposalsData,
  );
  const { items: restaurantProposals, isInvalid: restaurantProposalsInvalid } = normalizeArrayData<
    RestaurantProposalWithDetails
  >(restaurantProposalsData);

  const hotelProposalsHasError = Boolean(hotelProposalsError) || hotelProposalsInvalid;
  const flightProposalsHasError = Boolean(flightProposalsError) || flightProposalsInvalid;
  const activityProposalsHasError = Boolean(activityProposalsError) || activityProposalsInvalid;
  const restaurantProposalsHasError = Boolean(restaurantProposalsError) || restaurantProposalsInvalid;

  const hotelProposalsErrorMessage = getInlineErrorMessage(
    hotelProposalsError,
    hotelProposalsInvalid,
    "We couldn't load the hotel proposals. Please try again.",
  );
  const flightProposalsErrorMessage = getInlineErrorMessage(
    flightProposalsError,
    flightProposalsInvalid,
    "We couldn't load the flight proposals. Please try again.",
  );
  const activityProposalsErrorMessage = getInlineErrorMessage(
    activityProposalsError,
    activityProposalsInvalid,
    "We couldn't load the activity proposals. Please try again.",
  );
  const restaurantProposalsErrorMessage = getInlineErrorMessage(
    restaurantProposalsError,
    restaurantProposalsInvalid,
    "We couldn't load the restaurant proposals. Please try again.",
  );

  // Hotel ranking mutation
  const rankHotelMutation = useMutation({
    mutationFn: ({ proposalId, ranking }: { proposalId: number; ranking: number }) => {
      return apiRequest(`/api/hotel-proposals/${proposalId}/rank`, {
        method: "POST",
        body: { ranking },
      });
    },
    onSuccess: () => {
      if (!tripId) {
        return;
      }
      // PROPOSALS FEATURE: refresh hotel proposals so saved-hotel votes appear immediately.
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/proposals/hotels`] });
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/proposals/hotels?mineOnly=true`],
      });
      toast({
        title: "Vote Recorded",
        description: "Your hotel preference has been saved.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/login";
        return;
      }
      toast({
        title: "Error",
        description: "Failed to record your vote. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Flight ranking mutation
  const rankFlightMutation = useMutation({
    mutationFn: ({ proposalId, ranking }: { proposalId: number; ranking: number }) => {
      return apiRequest(`/api/flight-proposals/${proposalId}/rank`, {
        method: "POST",
        body: { ranking },
      });
    },
    onSuccess: () => {
      if (!tripId) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/proposals/flights`] });
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/proposals/flights?mineOnly=true`],
      });
      toast({
        title: "Vote Recorded",
        description: "Your flight preference has been saved.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/login";
        return;
      }
      toast({
        title: "Error",
        description: "Failed to record your vote. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Restaurant ranking mutation
  const rankRestaurantMutation = useMutation({
    mutationFn: ({ proposalId, ranking }: { proposalId: number; ranking: number }) => {
      return apiRequest(`/api/restaurant-proposals/${proposalId}/rank`, {
        method: "POST",
        body: { ranking },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "restaurant-proposals"] });
      toast({
        title: "Vote Recorded",
        description: "Your restaurant preference has been saved.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/login";
        return;
      }
      toast({
        title: "Error",
        description: "Failed to record your vote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const cancelProposalMutation = useMutation({
    mutationFn: async ({
      type,
      proposalId,
    }: {
      type: CancelableProposalType;
      proposalId: number;
    }) => {
      const endpointMap = {
        hotel: `/api/hotel-proposals/${proposalId}/cancel`,
        flight: `/api/flight-proposals/${proposalId}/cancel`,
        restaurant: `/api/restaurant-proposals/${proposalId}/cancel`,
        activity: `/api/activities/${proposalId}/cancel`,
      } as const;

      const res = await apiRequest(endpointMap[type], { method: "POST" });
      try {
        return await res.json();
      } catch {
        return null;
      }
    },
    onSuccess: (_data, variables) => {
      if (!tripId) {
        return;
      }

      const { proposalId, type } = variables;

      if (type === "hotel") {
        queryClient.setQueryData<HotelProposalWithDetails[] | undefined>(
          [`/api/trips/${tripId}/proposals/hotels`],
          (previous) => previous?.filter((proposal) => proposal.id !== proposalId),
        );
        queryClient.setQueryData<HotelProposalWithDetails[] | undefined>(
          [`/api/trips/${tripId}/proposals/hotels?mineOnly=true`],
          (previous) => previous?.filter((proposal) => proposal.id !== proposalId),
        );
        queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/proposals/hotels`] });
        queryClient.invalidateQueries({
          queryKey: [`/api/trips/${tripId}/proposals/hotels?mineOnly=true`],
        });
      } else if (type === "flight") {
        queryClient.setQueryData<FlightProposalWithDetails[] | undefined>(
          [`/api/trips/${tripId}/proposals/flights`],
          (previous) => previous?.filter((proposal) => proposal.id !== proposalId),
        );
        queryClient.setQueryData<FlightProposalWithDetails[] | undefined>(
          [`/api/trips/${tripId}/proposals/flights?mineOnly=true`],
          (previous) => previous?.filter((proposal) => proposal.id !== proposalId),
        );
        queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/proposals/flights`] });
        queryClient.invalidateQueries({
          queryKey: [`/api/trips/${tripId}/proposals/flights?mineOnly=true`],
        });
      } else if (type === "restaurant") {
        queryClient.setQueryData<RestaurantProposalWithDetails[] | undefined>(
          ["/api/trips", tripId, "restaurant-proposals"],
          (previous) => previous?.filter((proposal) => proposal.id !== proposalId),
        );
        queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "restaurant-proposals"] });
      } else if (type === "activity") {
        queryClient.setQueryData<ActivityWithDetails[] | undefined>(
          [`/api/trips/${tripId}/proposals/activities`],
          (previous) => previous?.filter((proposal) => proposal.id !== proposalId),
        );
        queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/proposals/activities`] });
      }

      toast({
        title: "Proposal canceled",
        description: "We’ve let everyone know this proposal is no longer happening.",
      });
    },
    onError: (error) => {
      const parsedError = parseApiError(error);

      if (parsedError.status === 401 || isUnauthorizedError(error)) {
        window.location.href = "/login";
        return;
      }

      let title = "Unable to cancel proposal";
      let description = parsedError.message || "Failed to cancel proposal. Please try again.";

      if (parsedError.status === 403) {
        title = "You can't cancel this proposal";
        if (!parsedError.message) {
          description = "Only the person who created it can cancel.";
        }
      } else if (parsedError.status === 404) {
        title = "Proposal not found";
        if (!parsedError.message) {
          description = "This proposal may have already been removed.";
        }
      }

      toast({
        title,
        description,
        variant: "destructive",
      });
    },
  });

  const convertActivityProposalMutation = useMutation<
    ActivityWithDetails,
    unknown,
    { activityId: number }
  >({
    mutationFn: async ({ activityId }) => {
      const res = await apiRequest(`/api/activities/${activityId}/convert`, { method: "POST" });
      return (await res.json()) as ActivityWithDetails;
    },
    onSuccess: (activity) => {
      if (!tripId) {
        return;
      }

      queryClient.setQueryData<ActivityWithDetails[] | undefined>(
        [`/api/trips/${tripId}/proposals/activities`],
        (previous) => previous?.filter((proposal) => proposal.id !== activity.id),
      );

      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/proposals/activities`] });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/activities`] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "activities"] });

      const startTime = activity.startTime ? new Date(activity.startTime) : null;
      const hasValidStart = !!(startTime && !Number.isNaN(startTime.getTime()));
      const description =
        hasValidStart && startTime
          ? `We added this plan for ${format(startTime, "EEE, MMM d 'at' h:mm a")}. Everyone has been notified.`
          : "We added this plan to the calendar and notified the group.";

      toast({
        title: "Activity scheduled!",
        description,
      });
    },
    onError: (error) => {
      const parsedError = parseApiError(error);

      if (parsedError.status === 401 || isUnauthorizedError(error)) {
        window.location.href = "/login";
        return;
      }

      toast({
        title: "Unable to schedule activity",
        description: parsedError.message || "We couldn't schedule this activity. Please try again.",
        variant: "destructive",
      });
    },
  });

  const respondToInviteMutation = useMutation({
    mutationFn: async ({
      activityId,
      action,
    }: {
      activityId: number;
      action: ActivityRsvpAction;
    }) => {
      const response = await apiRequest(`/api/activities/${activityId}/responses`, {
        method: "POST",
        body: { rsvp: action },
      });
      return (await response.json()) as {
        invite: unknown;
        activity: ActivityWithDetails | null;
        promotedUserId?: string | null;
      };
    },
    onMutate: async ({ activityId, action }) => {
      const nextStatus = actionToStatusMap[action];
      if (!tripId || !nextStatus) {
        return {};
      }

      const queryKey = [`/api/trips/${tripId}/proposals/activities`] as const;
      await queryClient.cancelQueries({ queryKey });

      const previousActivities = queryClient.getQueryData<ActivityWithDetails[]>(queryKey) ?? null;
      if (previousActivities) {
        const updatedActivities = previousActivities.map((activity) =>
          activity.id === activityId ? applyOptimisticActivityInviteUpdate(activity, nextStatus) : activity,
        );
        queryClient.setQueryData(queryKey, updatedActivities);
      }

      return { previousActivities, queryKey } as const;
    },
    onError: (error, _variables, context) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/login";
        return;
      }

      if (context?.previousActivities && context.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousActivities);
      }

      const parsedError = parseApiError(error);
      let description = parsedError.message || "We couldn’t save your RSVP. Please try again.";
      if (parsedError.status === 404 || parsedError.status === 409 || parsedError.status === 410) {
        description = "This item is no longer available to RSVP.";
      }

      toast({
        title: "Unable to update RSVP",
        description,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      if (tripId) {
        queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/proposals/activities`] });
      }
    },
  });

  const CancelProposalButton = ({
    type,
    proposalId,
    proposalName,
    isCancelling,
    triggerTestId,
    disabled,
  }: {
    type: CancelableProposalType;
    proposalId: number;
    proposalName?: string | null;
    isCancelling: boolean;
    triggerTestId: string;
    disabled?: boolean;
  }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const typeLabelMap: Record<CancelableProposalType, string> = {
      hotel: "hotel",
      flight: "flight",
      restaurant: "restaurant",
      activity: "activity",
    };

    const proposalDisplayName = proposalName?.trim();
    const formattedName = proposalDisplayName ? `"${proposalDisplayName}"` : "this proposal";

    const handleConfirm = async () => {
      try {
        await cancelProposalMutation.mutateAsync({ type, proposalId });
        setIsDialogOpen(false);
      } catch {
        // Errors are handled via the mutation's onError callback.
      }
    };

    return (
      <AlertDialog
        open={isDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!isCancelling) {
            setIsDialogOpen(nextOpen);
          }
        }}
      >
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            disabled={disabled || isCancelling}
            data-testid={triggerTestId}
          >
            <XCircle className="w-4 h-4 mr-1" />
            {isCancelling ? "Canceling..." : "Cancel"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{`Cancel ${typeLabelMap[type]} proposal?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {`Canceling will remove ${formattedName} from everyone's proposals, clear it from calendars, and send a cancellation notice.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Keep proposal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isCancelling}>
              {isCancelling ? "Canceling..." : "Yes, cancel it"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  type BaseProposal = {
    id: number;
    tripId: number;
    status?: string | null;
    proposedBy?: string | null;
    proposer?: { id?: string | null } | null;
  };

  type NormalizedActivityProposal = ActivityWithDetails & {
    tripId: number;
    proposedBy: string;
    proposer: ActivityWithDetails["poster"];
    status: string;
    activityName: string;
    rankings: [];
    averageRanking: number | null;
  };

  const getActivityProposalStatus = useCallback((activity: ActivityWithDetails) => {
    const now = new Date();
    const startTime = activity.startTime ? new Date(activity.startTime) : null;
    const endTime = activity.endTime ? new Date(activity.endTime) : null;

    if (!startTime) {
      return "proposed";
    }

    if (endTime && endTime < now) {
      return "completed";
    }

    if (startTime <= now && (!endTime || endTime >= now)) {
      return "in-progress";
    }

    return "scheduled";
  }, []);

  const isMyProposal = useCallback(
    (proposal: BaseProposal): boolean => {
      if (!user?.id) {
        return false;
      }

      const proposerId = proposal.proposedBy ?? proposal.proposer?.id ?? null;
      return proposerId === user.id;
    },
    [user?.id],
  );

  type ActivityInviteWithUser = ActivityWithDetails["invites"][number];
  type ActivityAcceptanceWithUser = ActivityWithDetails["acceptances"][number];

  const applyOptimisticActivityInviteUpdate = useCallback(
    (activity: ActivityWithDetails, nextStatus: ActivityInviteStatus): ActivityWithDetails => {
      const nowIso = new Date().toISOString();
      const invites: ActivityInviteWithUser[] = activity.invites
        ? activity.invites.map((invite) => ({ ...invite }))
        : [];

      const targetUserId = user?.id ?? activity.currentUserInvite?.userId ?? null;
      if (!targetUserId) {
        return activity;
      }

      const existingIndex = invites.findIndex((invite) => invite.userId === targetUserId);
      let updatedInvite: ActivityInviteWithUser | null = null;

      if (existingIndex >= 0) {
        const baseInvite = invites[existingIndex];
        updatedInvite = {
          ...baseInvite,
          status: nextStatus,
          respondedAt: nextStatus === "pending" ? null : nowIso,
          updatedAt: nowIso,
          user: baseInvite.user ?? user ?? baseInvite.user,
        };
        invites[existingIndex] = updatedInvite;
      } else if (user && user.id === targetUserId) {
        updatedInvite = {
          id: -Math.abs(Date.now()),
          activityId: activity.id,
          userId: targetUserId,
          status: nextStatus,
          respondedAt: nextStatus === "pending" ? null : nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
          user,
        } as ActivityInviteWithUser;
        invites.push(updatedInvite);
      }

      if (!updatedInvite) {
        return activity;
      }

      const counts = invites.reduce(
        (acc, invite) => {
          if (invite.status === "accepted") {
            acc.accepted += 1;
          } else if (invite.status === "declined") {
            acc.declined += 1;
          } else if (invite.status === "waitlisted") {
            acc.waitlisted += 1;
          } else {
            acc.pending += 1;
          }
          return acc;
        },
        { accepted: 0, pending: 0, declined: 0, waitlisted: 0 },
      );

      const acceptances: ActivityAcceptanceWithUser[] = invites
        .filter((invite) => invite.status === "accepted")
        .map((invite) => ({
          id: invite.id,
          activityId: activity.id,
          userId: invite.userId,
          acceptedAt: invite.respondedAt,
          user: invite.user,
        }));

      return {
        ...activity,
        invites,
        currentUserInvite: updatedInvite,
        acceptedCount: counts.accepted,
        pendingCount: counts.pending,
        declinedCount: counts.declined,
        waitlistedCount: counts.waitlisted,
        acceptances,
        isAccepted: nextStatus === "accepted" ? true : undefined,
        hasResponded: nextStatus === "pending" ? undefined : true,
      };
    },
    [user],
  );

  const applyActivityResponseFilter = useCallback(
    (items: NormalizedActivityProposal[]): NormalizedActivityProposal[] => {
      return filterActiveProposals(items).filter((proposal) => {
        if (user?.id) {
          const proposerId = proposal.proposedBy ?? proposal.proposer?.id ?? null;
          if (proposerId === user.id) {
            return true;
          }
        }

        const responseStatus: ActivityInviteStatus = proposal.currentUserInvite?.status
          ?? (proposal.isAccepted ? "accepted" : "pending");

        if (responseFilter === "needs-response") {
          return responseStatus === "pending";
        }

        if (responseFilter === "accepted") {
          return responseStatus === "accepted";
        }

        return false;
      });
    },
    [responseFilter, user?.id],
  );

  const getUserRanking = (
    rankings: Array<{ userId: string; ranking: number }>,
    userId: string,
  ) => {
    if (!userId) {
      return undefined;
    }

    return rankings.find((ranking) => ranking.userId === userId)?.ranking;
  };

  const getRankingColor = (ranking: number) => {
    switch (ranking) {
      case 1:
        return "text-green-600 bg-green-100";
      case 2:
        return "text-blue-600 bg-blue-100";
      case 3:
        return "text-orange-600 bg-orange-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const calculateRoomsNeeded = (groupSize: number): number => {
    return Math.ceil(groupSize / 2);
  };

  const parsePrice = (priceStr: string | number): number => {
    if (typeof priceStr === "number") {
      return priceStr;
    }

    const cleanPrice = priceStr
      .toString()
      .replace(/[\$,\s]/g, "")
      .replace(/\/night|\/day|per night|per day/gi, "")
      .trim();

    const parsed = parseFloat(cleanPrice);
    return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
  };

  const calculateGroupBudget = (pricePerNight: string | number, groupSize: number) => {
    const parsedPrice = parsePrice(pricePerNight);

    if (!groupSize || groupSize <= 0) {
      return {
        roomsNeeded: 0,
        totalCost: 0,
        perPersonCost: 0,
        pricePerRoom: parsedPrice,
        hasError: true,
        errorMessage: "Group size not available",
      } as const;
    }

    if (parsedPrice <= 0) {
      return {
        roomsNeeded: calculateRoomsNeeded(groupSize),
        totalCost: 0,
        perPersonCost: 0,
        pricePerRoom: 0,
        hasError: true,
        errorMessage: "Price information not available",
      } as const;
    }

    const roomsNeeded = calculateRoomsNeeded(groupSize);
    const totalCost = parsedPrice * roomsNeeded;
    const perPersonCost = totalCost / groupSize;

    return {
      roomsNeeded,
      totalCost,
      perPersonCost,
      pricePerRoom: parsedPrice,
      hasError: false,
    } as const;
  };

  const getUserInitials = (
    participant?: {
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
      username?: string | null;
    } | null,
  ) => {
    if (!participant) {
      return "?";
    }

    const first = participant.firstName?.trim()?.charAt(0);
    const last = participant.lastName?.trim()?.charAt(0);
    if (first || last) {
      return `${first ?? ""}${last ?? ""}` || (first ?? last) || "?";
    }

    const usernameInitial = participant.username?.trim()?.charAt(0);
    if (usernameInitial) {
      return usernameInitial.toUpperCase();
    }

    const emailInitial = participant.email?.trim()?.charAt(0);
    return emailInitial ? emailInitial.toUpperCase() : "?";
  };

  const renderRankingPreview = (
    rankings: Array<{ id: number; user: { firstName?: string | null; lastName?: string | null; email?: string | null; username?: string | null; profileImageUrl?: string | null } }>,
  ) => {
    if (!rankings || rankings.length === 0) {
      return (
        <div className="flex items-center gap-2 text-xs text-neutral-500" data-testid="preview-no-votes">
          <Users className="w-4 h-4" />
          <span>No votes yet</span>
        </div>
      );
    }

    const visibleRankings = rankings.slice(0, 3);
    const remaining = rankings.length - visibleRankings.length;

    return (
      <div className="flex items-center gap-3 text-xs text-neutral-600" data-testid="preview-votes">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          <div className="flex -space-x-2">
            {visibleRankings.map((ranking) => (
              <Avatar key={ranking.id} className="h-7 w-7 border border-white shadow-sm">
                {ranking.user.profileImageUrl ? (
                  <AvatarImage src={ranking.user.profileImageUrl ?? undefined} alt={ranking.user.firstName ?? ranking.user.username ?? "Group member"} />
                ) : null}
                <AvatarFallback>{getUserInitials(ranking.user)}</AvatarFallback>
              </Avatar>
            ))}
          </div>
        </div>
        <span className="font-medium">
          {rankings.length} {rankings.length === 1 ? "vote" : "votes"}
        </span>
        {remaining > 0 && <span className="text-neutral-400">+{remaining} more</span>}
      </div>
    );
  };

  // Helper function to get proposal status badge
  const getStatusBadge = (status: string, averageRanking?: number) => {
    const normalizedStatus = (status || "active").toLowerCase();

    if (normalizedStatus === "selected") {
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Selected</Badge>;
    }

    if (normalizedStatus === "booked") {
      return <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle className="w-3 h-3 mr-1" />Booked</Badge>;
    }

    if (normalizedStatus === "scheduled") {
      return <Badge className="bg-emerald-100 text-emerald-700"><Calendar className="w-3 h-3 mr-1" />Scheduled</Badge>;
    }

    if (normalizedStatus === "in-progress") {
      return <Badge className="bg-sky-100 text-sky-700"><Activity className="w-3 h-3 mr-1" />Happening Now</Badge>;
    }

    if (normalizedStatus === "completed") {
      return <Badge className="bg-lime-100 text-lime-700"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
    }

    if (normalizedStatus === "rejected") {
      return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
    }

    if (isCanceledStatus(status)) {
      return <Badge className="bg-rose-100 text-rose-700"><XCircle className="w-3 h-3 mr-1" />Canceled</Badge>;
    }

    if (normalizedStatus === "proposed") {
      return <Badge className="bg-blue-100 text-blue-800"><Vote className="w-3 h-3 mr-1" />Proposed</Badge>;
    }

    if (typeof averageRanking === "number" && averageRanking <= 1.5) {
      return <Badge className="bg-yellow-100 text-yellow-800"><Crown className="w-3 h-3 mr-1" />Top Choice</Badge>;
    }

    return <Badge className="bg-blue-100 text-blue-800"><Vote className="w-3 h-3 mr-1" />Active Voting</Badge>;
  };

  const ActivityProposalCard = ({ proposal }: { proposal: NormalizedActivityProposal }) => {
    const startTime = proposal.startTime ? new Date(proposal.startTime) : null;
    const endTime = proposal.endTime ? new Date(proposal.endTime) : null;
    const createdAt = proposal.createdAt ? new Date(proposal.createdAt) : null;
    const isCanceled = isCanceledStatus(proposal.status);
    const canCancel = isMyProposal(proposal) && !isCanceled;
    const canConvert = isMyProposal(proposal) && !isCanceled && proposal.type === "PROPOSE";
    const hasStartTime = Boolean(proposal.startTime);
    const isConverting =
      convertActivityProposalMutation.isPending
      && convertActivityProposalMutation.variables?.activityId === proposal.id;
    const isCancelling =
      cancelProposalMutation.isPending &&
      cancelProposalMutation.variables?.proposalId === proposal.id &&
      cancelProposalMutation.variables?.type === "activity";

    const durationMinutes =
      startTime && endTime ? Math.max(differenceInMinutes(endTime, startTime), 0) : null;

    const formattedDuration = (() => {
      if (durationMinutes === null) {
        return null;
      }

      if (durationMinutes === 0) {
        return "Less than 1 minute";
      }

      if (durationMinutes < 60) {
        return `${durationMinutes} min`;
      }

      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    })();

    const acceptedCount =
      typeof proposal.acceptedCount === "number"
        ? proposal.acceptedCount
        : proposal.acceptances?.length ?? 0;

    const pendingCount = proposal.pendingCount ?? 0;
    const declinedCount = proposal.declinedCount ?? 0;

    const proposerName =
      proposal.proposer?.firstName?.trim() ||
      proposal.proposer?.username?.trim() ||
      proposal.proposer?.email?.trim() ||
      "Group member";

    const currentInvite =
      proposal.currentUserInvite
        ?? proposal.invites?.find((invite) => invite.userId === user?.id)
        ?? null;

    const derivedStatus: ActivityInviteStatus = currentInvite?.status
      ?? (proposal.isAccepted ? "accepted" : "pending");
    const statusLabel = inviteStatusLabels[derivedStatus];
    const badgeClasses = inviteStatusBadgeClasses[derivedStatus];
    const isResponding =
      respondToInviteMutation.isPending &&
      respondToInviteMutation.variables?.activityId === proposal.id;

    const viewerCanRespond = !isMyProposal(proposal);

    const submitAction = (action: ActivityRsvpAction) => {
      const targetStatus = actionToStatusMap[action];
      if (targetStatus && targetStatus === derivedStatus) {
        return;
      }

      respondToInviteMutation.mutate({ activityId: proposal.id, action });
    };

    return (
      <Card className="mb-4 hover:shadow-md transition-shadow" data-testid={`card-activity-proposal-${proposal.id}`}>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2" data-testid={`text-activity-name-${proposal.id}`}>
                <MapPin className="w-5 h-5 text-purple-600" />
                {proposal.activityName}
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2 mt-1 text-neutral-600">
                {proposal.category ? (
                  <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs" data-testid={`text-activity-category-${proposal.id}`}>
                    {proposal.category}
                  </span>
                ) : null}
                {startTime ? (
                  <span className="flex items-center gap-1" data-testid={`text-activity-start-${proposal.id}`}>
                    <Calendar className="w-3 h-3" />
                    {format(startTime, "EEE, MMM d • h:mm a")}
                  </span>
                ) : (
                  <span className="flex items-center gap-1" data-testid={`text-activity-start-${proposal.id}`}>
                    <Calendar className="w-3 h-3" />
                    Date to be decided
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              {getStatusBadge(proposal.status || "scheduled")}
              {canConvert ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => convertActivityProposalMutation.mutate({ activityId: proposal.id })}
                    disabled={!hasStartTime || isConverting}
                    title={!hasStartTime ? "Add a date and time before scheduling this activity." : undefined}
                    data-testid={`button-convert-activity-proposal-${proposal.id}`}
                  >
                    {isConverting ? "Scheduling..." : "Book now"}
                  </Button>
                  {!hasStartTime ? (
                    <span className="text-xs text-neutral-500 text-right max-w-[12rem]">
                      Add a date &amp; time to enable scheduling.
                    </span>
                  ) : null}
                </>
              ) : null}
              {canCancel ? (
                <CancelProposalButton
                  type="activity"
                  proposalId={proposal.id}
                  proposalName={proposal.activityName ?? proposal.name}
                  isCancelling={isCancelling}
                  triggerTestId={`button-cancel-activity-proposal-${proposal.id}`}
                />
              ) : null}
              {createdAt ? (
                <span className="text-xs text-neutral-500" data-testid={`text-activity-created-${proposal.id}`}>
                  Added {formatDistanceToNow(createdAt, { addSuffix: true })}
                </span>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm text-neutral-600">
            <div className="flex items-center gap-2" data-testid={`text-activity-time-${proposal.id}`}>
              <Clock className="w-4 h-4 text-neutral-400" />
              {startTime ? format(startTime, "h:mm a") : "Time TBD"}
              {formattedDuration ? <span className="text-neutral-400">• {formattedDuration}</span> : null}
            </div>
            <div className="flex items-center gap-2" data-testid={`text-activity-location-${proposal.id}`}>
              <MapPin className="w-4 h-4 text-neutral-400" />
              {proposal.location ? proposal.location : "Location TBD"}
            </div>
            <div className="flex items-center gap-2" data-testid={`text-activity-attendance-${proposal.id}`}>
              <Users className="w-4 h-4 text-neutral-400" />
              <span className="font-medium text-neutral-700">{acceptedCount}</span> going
              {pendingCount > 0 ? (
                <span className="text-neutral-400">• {pendingCount} pending</span>
              ) : null}
              {declinedCount > 0 ? (
                <span className="text-neutral-400">• {declinedCount} declined</span>
              ) : null}
            </div>
          </div>

          {proposal.description ? (
            <p className="text-sm text-neutral-600" data-testid={`text-activity-description-${proposal.id}`}>
              {proposal.description}
            </p>
          ) : null}

          <div className="flex items-center justify-between text-sm text-neutral-600">
            <div className="flex items-center gap-2" data-testid={`text-activity-proposer-${proposal.id}`}>
              <User className="w-4 h-4 text-neutral-400" />
              Proposed by {proposerName}
            </div>
            <Link
              href={`/trip/${proposal.tripId}`}
              className="text-primary hover:underline flex items-center gap-1"
              data-testid={`link-view-activity-${proposal.id}`}
            >
              <ExternalLink className="w-4 h-4" /> View in trip
            </Link>
          </div>

          {viewerCanRespond ? (
            <div className="mt-4 border-t pt-4 space-y-3" data-testid={`activity-response-actions-${proposal.id}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
                <Badge
                  variant="secondary"
                  className={`border ${badgeClasses}`}
                  data-testid={`badge-activity-response-${proposal.id}`}
                >
                  {statusLabel}
                </Badge>
                <span>Your response</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => submitAction("ACCEPT")}
                  disabled={isResponding}
                  data-testid={`button-accept-activity-proposal-${proposal.id}`}
                >
                  {isResponding && respondToInviteMutation.variables?.action === "ACCEPT"
                    ? "Updating..."
                    : "Accept"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => submitAction("DECLINE")}
                  disabled={isResponding}
                  data-testid={`button-decline-activity-proposal-${proposal.id}`}
                >
                  {isResponding && respondToInviteMutation.variables?.action === "DECLINE"
                    ? "Updating..."
                    : "Decline"}
                </Button>
                {isResponding ? (
                  <div
                    className="basis-full text-xs text-neutral-500"
                    data-testid={`text-activity-rsvp-updating-${proposal.id}`}
                  >
                    Updating response…
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  };

  // Restaurant proposal card component
  const RestaurantProposalCard = ({ proposal }: { proposal: RestaurantProposalWithDetails }) => {
    const userRanking = getUserRanking(proposal.rankings || [], user?.id || '');
    
    const isCanceled = isCanceledStatus(proposal.status);
    const canCancel = isMyProposal(proposal) && !isCanceled;
    const isCancelling =
      cancelProposalMutation.isPending &&
      cancelProposalMutation.variables?.proposalId === proposal.id &&
      cancelProposalMutation.variables?.type === "restaurant";

    return (
      <Card className="mb-4 hover:shadow-md transition-shadow" data-testid={`card-restaurant-proposal-${proposal.id}`}>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2" data-testid={`text-restaurant-name-${proposal.id}`}>
                <Utensils className="w-5 h-5 text-green-600" />
                {proposal.restaurantName}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <span className="bg-gray-100 px-2 py-1 rounded text-xs" data-testid={`text-restaurant-cuisine-${proposal.id}`}>
                  {proposal.cuisineType || 'Restaurant'}
                </span>
                <span className="text-gray-600" data-testid={`text-restaurant-price-range-${proposal.id}`}>
                  {proposal.priceRange}
                </span>
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              {getStatusBadge(
                proposal.status || "active",
                proposal.averageRanking ?? undefined,
              )}
              {canCancel && (
                <CancelProposalButton
                  type="restaurant"
                  proposalId={proposal.id}
                  proposalName={proposal.restaurantName}
                  isCancelling={isCancelling}
                  triggerTestId={`button-cancel-restaurant-proposal-${proposal.id}`}
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">{renderRankingPreview(proposal.rankings ?? [])}</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="text-sm" data-testid={`text-restaurant-address-${proposal.id}`}>
                {proposal.address}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="font-medium" data-testid={`text-restaurant-rating-${proposal.id}`}>
                {proposal.rating ? parseFloat(proposal.rating.toString()).toFixed(1) : 'N/A'} rating
              </span>
            </div>
          </div>

          {/* Restaurant-specific details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              <span className="font-medium capitalize" data-testid={`text-restaurant-meal-time-${proposal.id}`}>
                {proposal.preferredMealTime || 'Any time'}
              </span>
            </div>
            {Array.isArray(proposal.preferredDates) && proposal.preferredDates.length > 0 &&
              typeof proposal.preferredDates[0] === "string" && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span className="text-sm" data-testid={`text-restaurant-preferred-dates-${proposal.id}`}>
                  {format(new Date(proposal.preferredDates[0]), "PPP")}
                  {proposal.preferredDates.length > 1 && ` +${proposal.preferredDates.length - 1} more`}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <User className="w-4 h-4" />
              <span>Proposed by {proposal.proposer?.firstName || 'Unknown'}</span>
              <Clock className="w-4 h-4 ml-2" />
              <span data-testid={`text-restaurant-created-${proposal.id}`}>
                {proposal.createdAt ? formatDistanceToNow(new Date(proposal.createdAt), { addSuffix: true }) : 'Unknown'}
              </span>
            </div>
            {proposal.averageRanking != null && (
              <div className="flex items-center gap-1 text-sm">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span data-testid={`text-restaurant-avg-ranking-${proposal.id}`}>
                  Avg: {proposal.averageRanking.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3 items-center">
            <Select
              value={userRanking?.toString() || ""}
              onValueChange={(value) => {
                rankRestaurantMutation.mutate({ 
                  proposalId: proposal.id, 
                  ranking: parseInt(value) 
                });
              }}
              data-testid={`select-restaurant-ranking-${proposal.id}`}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Rank this option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1" data-testid={`option-ranking-1-${proposal.id}`}>🥇 1st Choice</SelectItem>
                <SelectItem value="2" data-testid={`option-ranking-2-${proposal.id}`}>🥈 2nd Choice</SelectItem>
                <SelectItem value="3" data-testid={`option-ranking-3-${proposal.id}`}>🥉 3rd Choice</SelectItem>
                <SelectItem value="4" data-testid={`option-ranking-4-${proposal.id}`}>4th Choice</SelectItem>
                <SelectItem value="5" data-testid={`option-ranking-5-${proposal.id}`}>5th Choice</SelectItem>
              </SelectContent>
            </Select>
            
            {userRanking && (
              <Badge className={getRankingColor(userRanking)} data-testid={`badge-user-ranking-${proposal.id}`}>
                Your choice: #{userRanking}
              </Badge>
            )}
            
            {proposal.website && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(proposal.website ?? undefined, '_blank')}
                data-testid={`button-view-restaurant-${proposal.id}`}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                View Restaurant
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Hotel proposal card component
  const HotelProposalCard = ({ proposal }: { proposal: HotelProposalWithDetails }) => {
    const userRanking = getUserRanking(proposal.rankings || [], user?.id || '');
    const groupSize = trip?.members?.length || 0;
    const budgetBreakdown = calculateGroupBudget(proposal.price, groupSize);
    
    const isCanceled = isCanceledStatus(proposal.status);
    const canCancel = isMyProposal(proposal) && !isCanceled;
    const isCancelling =
      cancelProposalMutation.isPending &&
      cancelProposalMutation.variables?.proposalId === proposal.id &&
      cancelProposalMutation.variables?.type === "hotel";

    return (
      <Card className="mb-4 hover:shadow-md transition-shadow" data-testid={`card-hotel-proposal-${proposal.id}`}>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2" data-testid={`text-hotel-name-${proposal.id}`}>
                <Hotel className="w-5 h-5 text-blue-600" />
                {proposal.hotelName}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <MapPin className="w-4 h-4" />
                <span data-testid={`text-hotel-location-${proposal.id}`}>{proposal.location}</span>
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              {getStatusBadge(
                proposal.status || "active",
                proposal.averageRanking ?? undefined,
              )}
              {canCancel && (
                <CancelProposalButton
                  type="hotel"
                  proposalId={proposal.id}
                  proposalName={proposal.hotelName}
                  isCancelling={isCancelling}
                  triggerTestId={`button-cancel-hotel-proposal-${proposal.id}`}
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            {renderRankingPreview(proposal.rankings ?? [])}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="font-medium" data-testid={`text-hotel-rating-${proposal.id}`}>
                {proposal.rating} stars
              </span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="font-medium" data-testid={`text-hotel-price-${proposal.id}`}>
                ${proposal.price}
                {proposal.pricePerNight && <span className="text-sm text-neutral-600">/night</span>}
              </span>
            </div>
          </div>

          {/* Group Budget Section */}
          {groupSize > 0 && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200" data-testid={`group-budget-${proposal.id}`}>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-blue-900">Group Budget Breakdown</h4>
              </div>
              
              {budgetBreakdown.hasError ? (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded border border-amber-200" data-testid={`error-message-${proposal.id}`}>
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{budgetBreakdown.errorMessage}</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="flex flex-col" data-testid={`text-group-size-${proposal.id}`}>
                    <span className="text-neutral-600">For your group</span>
                    <span className="font-semibold text-blue-900">
                      {groupSize} people, {budgetBreakdown.roomsNeeded} room{budgetBreakdown.roomsNeeded > 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-neutral-500">
                      Assuming 2 people per room
                    </span>
                  </div>
                  <div className="flex flex-col" data-testid={`text-total-cost-${proposal.id}`}>
                    <span className="text-neutral-600">Total per night</span>
                    <span className="font-semibold text-green-700">
                      ${budgetBreakdown.totalCost.toFixed(2)}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {budgetBreakdown.roomsNeeded} × ${budgetBreakdown.pricePerRoom}
                    </span>
                  </div>
                  <div className="flex flex-col" data-testid={`text-per-person-cost-${proposal.id}`}>
                    <span className="text-neutral-600">Per person/night</span>
                    <span className="font-semibold text-purple-700">
                      ${budgetBreakdown.perPersonCost.toFixed(2)}
                    </span>
                    <span className="text-xs text-neutral-500">
                      Split {groupSize} ways
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {proposal.amenities && (
            <div className="mb-4">
              <p className="text-sm text-neutral-600" data-testid={`text-hotel-amenities-${proposal.id}`}>
                <strong>Amenities:</strong> {proposal.amenities}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <User className="w-4 h-4" />
              <span>Proposed by {proposal.proposer?.firstName || 'Unknown'}</span>
              <Clock className="w-4 h-4 ml-2" />
              <span data-testid={`text-hotel-created-${proposal.id}`}>
                {proposal.createdAt ? formatDistanceToNow(new Date(proposal.createdAt), { addSuffix: true }) : 'Unknown'}
              </span>
            </div>
            {proposal.averageRanking != null && (
              <div className="flex items-center gap-1 text-sm">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span data-testid={`text-hotel-avg-ranking-${proposal.id}`}>
                  Avg: {proposal.averageRanking.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3 items-center">
            <Select
              value={userRanking?.toString() || ""}
              onValueChange={(value) => {
                rankHotelMutation.mutate({ 
                  proposalId: proposal.id, 
                  ranking: parseInt(value) 
                });
              }}
              data-testid={`select-hotel-ranking-${proposal.id}`}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Rank this option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1" data-testid={`option-ranking-1-${proposal.id}`}>🥇 1st Choice</SelectItem>
                <SelectItem value="2" data-testid={`option-ranking-2-${proposal.id}`}>🥈 2nd Choice</SelectItem>
                <SelectItem value="3" data-testid={`option-ranking-3-${proposal.id}`}>🥉 3rd Choice</SelectItem>
                <SelectItem value="4" data-testid={`option-ranking-4-${proposal.id}`}>4th Choice</SelectItem>
                <SelectItem value="5" data-testid={`option-ranking-5-${proposal.id}`}>5th Choice</SelectItem>
              </SelectContent>
            </Select>
            
            {userRanking && (
              <Badge className={getRankingColor(userRanking)} data-testid={`badge-user-ranking-${proposal.id}`}>
                Your choice: #{userRanking}
              </Badge>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(proposal.bookingUrl, '_blank')}
              data-testid={`button-view-hotel-${proposal.id}`}
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              View Hotel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const getFlightDateLabel = useCallback(
    (value?: string | Date | null) => {
      if (formatFlightDateTime) {
        return formatFlightDateTime(value);
      }

      if (!value) {
        return "TBD";
      }

      const date = value instanceof Date ? value : new Date(value);

      if (Number.isNaN(date.getTime())) {
        return "TBD";
      }

      try {
        return format(date, "MMM d, yyyy, h:mm a");
      } catch {
        return "TBD";
      }
    },
    [formatFlightDateTime],
  );

  // Flight proposal card component
  const FlightProposalCard = ({ proposal }: { proposal: FlightProposalWithDetails }) => {
    const userRanking = getUserRanking(proposal.rankings || [], user?.id || "");
    const isCanceled = isCanceledStatus(proposal.status);
    const canCancel = isMyProposal(proposal) && !isCanceled;
    const isCancelling =
      cancelProposalMutation.isPending &&
      cancelProposalMutation.variables?.proposalId === proposal.id &&
      cancelProposalMutation.variables?.type === "flight";

    return (
      <Card className="mb-4 hover:shadow-md transition-shadow" data-testid={`card-flight-proposal-${proposal.id}`}>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2" data-testid={`text-flight-number-${proposal.id}`}>
                <Plane className="w-5 h-5 text-blue-600" />
                {proposal.airline} {proposal.flightNumber}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <span data-testid={`text-flight-route-${proposal.id}`}>
                  {proposal.departureAirport} → {proposal.arrivalAirport}
                </span>
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              {getStatusBadge(
                proposal.status || "active",
                proposal.averageRanking ?? undefined,
              )}
              {canCancel && (
                <CancelProposalButton
                  type="flight"
                  proposalId={proposal.id}
                  proposalName={[proposal.airline, proposal.flightNumber].filter(Boolean).join(" ")}
                  isCancelling={isCancelling}
                  triggerTestId={`button-cancel-flight-proposal-${proposal.id}`}
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">{renderRankingPreview(proposal.rankings ?? [])}</div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <div>
                <div className="font-medium" data-testid={`text-flight-departure-${proposal.id}`}>
                  Departs: {getFlightDateLabel(proposal.departureTime)}
                </div>
                <div className="text-sm text-neutral-600" data-testid={`text-flight-arrival-${proposal.id}`}>
                  Arrives: {getFlightDateLabel(proposal.arrivalTime)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="font-medium" data-testid={`text-flight-price-${proposal.id}`}>
                ${parseFloat(proposal.price.toString()).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-600" />
              <span className="font-medium" data-testid={`text-flight-duration-${proposal.id}`}>
                {proposal.duration}
                {proposal.stops > 0 && (
                  <span className="text-sm text-neutral-600 ml-1">
                    ({proposal.stops} stop{proposal.stops > 1 ? 's' : ''})
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <User className="w-4 h-4" />
              <span>Proposed by {proposal.proposer?.firstName || 'Unknown'}</span>
              <Clock className="w-4 h-4 ml-2" />
              <span data-testid={`text-flight-created-${proposal.id}`}>
                {proposal.createdAt ? formatDistanceToNow(new Date(proposal.createdAt), { addSuffix: true }) : 'Unknown'}
              </span>
            </div>
            {proposal.averageRanking != null && (
              <div className="flex items-center gap-1 text-sm">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span data-testid={`text-flight-avg-ranking-${proposal.id}`}>
                  Avg: {proposal.averageRanking.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3 items-center">
            <Select
              value={userRanking?.toString() || ""}
              onValueChange={(value) => {
                rankFlightMutation.mutate({ 
                  proposalId: proposal.id, 
                  ranking: parseInt(value) 
                });
              }}
              data-testid={`select-flight-ranking-${proposal.id}`}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Rank this option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1" data-testid={`option-ranking-1-${proposal.id}`}>🥇 1st Choice</SelectItem>
                <SelectItem value="2" data-testid={`option-ranking-2-${proposal.id}`}>🥈 2nd Choice</SelectItem>
                <SelectItem value="3" data-testid={`option-ranking-3-${proposal.id}`}>🥉 3rd Choice</SelectItem>
                <SelectItem value="4" data-testid={`option-ranking-4-${proposal.id}`}>4th Choice</SelectItem>
                <SelectItem value="5" data-testid={`option-ranking-5-${proposal.id}`}>5th Choice</SelectItem>
              </SelectContent>
            </Select>
            
            {userRanking && (
              <Badge className={getRankingColor(userRanking)} data-testid={`badge-user-ranking-${proposal.id}`}>
                Your choice: #{userRanking}
              </Badge>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(proposal.bookingUrl, '_blank')}
              data-testid={`button-view-flight-${proposal.id}`}
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              View Flight
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const InlineErrorState = ({
    message,
    onRetry,
    testId,
  }: {
    message: string;
    onRetry: () => void;
    testId: string;
  }) => (
    <div className="text-center py-12 space-y-4" data-testid={testId}>
      <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-neutral-700">We hit a snag</h3>
        <p className="text-neutral-500 max-w-md mx-auto">{message}</p>
      </div>
      <Button variant="outline" onClick={onRetry} data-testid={`${testId}-retry`}>
        Try again
      </Button>
    </div>
  );

  // Empty state component
  const EmptyState = ({ type, icon: Icon }: { type: string; icon: any }) => {
    const showGlobalEmpty = noProposalsAtAll;

    return (
      <div className="text-center py-12">
        <Icon className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-neutral-600 mb-2">
          {showGlobalEmpty ? "No proposals yet for this trip." : `No ${type} Proposals Yet`}
        </h3>
        <p className="text-neutral-500 mb-6">
          {showGlobalEmpty
            ? "Suggest an activity, restaurant, hotel, or flight to get started."
            : `Group members can propose ${type.toLowerCase()} options for voting. Check the ${type} page to add proposals!`}
        </p>
        <Link href={`/trip/${tripId}/${type.toLowerCase()}`}>
          <Button data-testid={`button-add-${type.toLowerCase()}-proposal`}>
            <Icon className="w-4 h-4 mr-2" />
            Browse {type}
          </Button>
        </Link>
      </div>
    );
  };

  const MyProposalsEmptyState = ({ hasAny }: { hasAny: boolean }) => (
    <div className="text-center py-12" data-testid="empty-my-proposals">
      <User className="w-10 h-10 text-neutral-400 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-neutral-600 mb-2">
        {hasAny ? "No proposals match these filters." : "You haven’t proposed anything yet."}
      </h3>
      <p className="text-neutral-500">
        {hasAny
          ? "Try adjusting the filters to see your proposals."
          : "Suggest an activity, restaurant, hotel, or flight to get started."}
      </p>
    </div>
  );

  const FilteredEmptyState = ({ type }: { type: string }) => (
    <div className="text-center py-12" data-testid={`empty-filtered-${type.toLowerCase()}-proposals`}>
      <Eye className="w-10 h-10 text-neutral-400 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-neutral-600 mb-2">No {type.toLowerCase()} match these filters.</h3>
      <p className="text-neutral-500">Try adjusting the filters to see more options.</p>
    </div>
  );

  const activityProposals = useMemo<NormalizedActivityProposal[]>(
    () =>
      rawActivityProposals
        .filter((activity) => activity.type === "PROPOSE")
        .map((activity) => {
          const isCanceled = isCanceledStatus(activity.status);

          return {
            ...activity,
            tripId: activity.tripCalendarId,
            proposedBy: activity.postedBy,
            proposer: activity.poster,
            status: isCanceled
              ? activity.status ?? "canceled"
              : getActivityProposalStatus(activity),
            activityName: activity.name,
            rankings: [],
            averageRanking: null,
          };
        }),
    [getActivityProposalStatus, rawActivityProposals],
  );

  const hotelProposalsForCategories = useMemo(
    () =>
      includeUserProposalsInCategories
        ? hotelProposals
        : hotelProposals.filter((proposal) => !isMyProposal(proposal)),
    [hotelProposals, includeUserProposalsInCategories, isMyProposal],
  );
  const activeHotelProposalsForCategories = useMemo(
    () => filterActiveProposals(hotelProposalsForCategories),
    [hotelProposalsForCategories],
  );
  const flightProposalsForCategories = useMemo(
    () =>
      includeUserProposalsInCategories
        ? flightProposals
        : flightProposals.filter((proposal) => !isMyProposal(proposal)),
    [flightProposals, includeUserProposalsInCategories, isMyProposal],
  );
  const activeFlightProposalsForCategories = useMemo(
    () => filterActiveProposals(flightProposalsForCategories),
    [flightProposalsForCategories],
  );
  const activityProposalsForCategories = useMemo(
    () =>
      includeUserProposalsInCategories
        ? activityProposals
        : activityProposals.filter((proposal) => !isMyProposal(proposal)),
    [activityProposals, includeUserProposalsInCategories, isMyProposal],
  );
  const activeActivityProposalsForCategories = useMemo(
    () => filterActiveProposals(activityProposalsForCategories),
    [activityProposalsForCategories],
  );
  const restaurantProposalsForCategories = useMemo(
    () =>
      includeUserProposalsInCategories
        ? restaurantProposals
        : restaurantProposals.filter((proposal) => !isMyProposal(proposal)),
    [restaurantProposals, includeUserProposalsInCategories, isMyProposal],
  );
  const activeRestaurantProposalsForCategories = useMemo(
    () => filterActiveProposals(restaurantProposalsForCategories),
    [restaurantProposalsForCategories],
  );

  const filteredHotelProposals = useMemo(
    () => filterActiveProposals(hotelProposalsForCategories),
    [hotelProposalsForCategories],
  );
  const filteredFlightProposals = useMemo(
    () => filterActiveProposals(flightProposalsForCategories),
    [flightProposalsForCategories],
  );
  const filteredActivityProposals = useMemo(
    () => applyActivityResponseFilter(activityProposalsForCategories),
    [applyActivityResponseFilter, activityProposalsForCategories],
  );
  const filteredRestaurantProposals = useMemo(
    () => filterActiveProposals(restaurantProposalsForCategories),
    [restaurantProposalsForCategories],
  );

  const myHotelProposals = useMemo(() => {
    if (myHotelProposalsLoading || myHotelProposalsInvalid || myHotelProposalsError) {
      return hotelProposals.filter((proposal) => isMyProposal(proposal));
    }

    return myHotelProposalsFromApi;
  }, [
    hotelProposals,
    isMyProposal,
    myHotelProposalsError,
    myHotelProposalsFromApi,
    myHotelProposalsInvalid,
    myHotelProposalsLoading,
  ]);
  const myFlightProposals = useMemo(() => {
    if (myFlightProposalsLoading || myFlightProposalsInvalid || myFlightProposalsError) {
      return flightProposals.filter((proposal) => isMyProposal(proposal));
    }

    return myFlightProposalsFromApi;
  }, [
    flightProposals,
    isMyProposal,
    myFlightProposalsError,
    myFlightProposalsFromApi,
    myFlightProposalsInvalid,
    myFlightProposalsLoading,
  ]);
  const myActivityProposals = useMemo(
    () => activityProposals.filter((proposal) => isMyProposal(proposal)),
    [activityProposals, isMyProposal],
  );
  const myRestaurantProposals = useMemo(
    () => restaurantProposals.filter((proposal) => isMyProposal(proposal)),
    [restaurantProposals, isMyProposal],
  );

  const activeMyHotelProposals = useMemo(
    () => filterActiveProposals(myHotelProposals),
    [myHotelProposals],
  );
  const activeMyFlightProposals = useMemo(
    () => filterActiveProposals(myFlightProposals),
    [myFlightProposals],
  );
  const activeMyActivityProposals = useMemo(
    () => filterActiveProposals(myActivityProposals),
    [myActivityProposals],
  );
  const activeMyRestaurantProposals = useMemo(
    () => filterActiveProposals(myRestaurantProposals),
    [myRestaurantProposals],
  );

  const filteredMyHotelProposals = useMemo(
    () => filterActiveProposals(myHotelProposals),
    [myHotelProposals],
  );
  const filteredMyFlightProposals = useMemo(
    () => filterActiveProposals(myFlightProposals),
    [myFlightProposals],
  );
  const filteredMyActivityProposals = useMemo(
    () => applyActivityResponseFilter(myActivityProposals),
    [applyActivityResponseFilter, myActivityProposals],
  );
  const filteredMyRestaurantProposals = useMemo(
    () => filterActiveProposals(myRestaurantProposals),
    [myRestaurantProposals],
  );

  const totalMyProposals =
    filteredMyHotelProposals.length +
    filteredMyFlightProposals.length +
    filteredMyActivityProposals.length +
    filteredMyRestaurantProposals.length;

  const totalActiveMyProposals =
    activeMyHotelProposals.length +
    activeMyFlightProposals.length +
    activeMyActivityProposals.length +
    activeMyRestaurantProposals.length;

  const hasAnyMyProposals = totalActiveMyProposals > 0;

  const totalActiveProposals =
    activeHotelProposalsForCategories.length +
    activeFlightProposalsForCategories.length +
    activeActivityProposalsForCategories.length +
    activeRestaurantProposalsForCategories.length;
  const hasProposalDataIssues =
    hotelProposalsHasError ||
    flightProposalsHasError ||
    activityProposalsHasError ||
    restaurantProposalsHasError;

  const noProposalsAtAll = !hasProposalDataIssues && totalActiveProposals === 0;

  const boundaryWrapperClass = embedded
    ? "py-12 flex items-center justify-center"
    : "min-h-screen bg-neutral-50 flex items-center justify-center";

  if (!tripId) {
    return (
      <div className={boundaryWrapperClass}>
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Trip not specified</h2>
            <p className="text-neutral-600 mb-4">
              We couldn't determine which trip to load proposals for. Please go back and pick a trip first.
            </p>
            <Link href="/">
              <Button data-testid="button-trip-missing-back-home">Back to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authLoading || tripLoading) {
    return (
      <div className={boundaryWrapperClass}>
        <TravelLoading variant="journey" size="lg" text="Loading your proposals..." />
      </div>
    );
  }

  if (tripError) {
    const parsedError = parseApiError(tripError);

    return (
      <div className={boundaryWrapperClass}>
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Unable to load trip</h2>
            <p className="text-neutral-600 mb-4">
              {parsedError.message || "Something went wrong while loading this trip. Please try again."}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={() => queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}`] })}>
                Try again
              </Button>
              <Link href="/">
                <Button variant="outline" data-testid="button-trip-error-back-home">
                  Back to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className={boundaryWrapperClass}>
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Trip Not Found</h2>
            <p className="text-neutral-600 mb-4">
              The trip you're looking for doesn't exist or you don't have access to it.
            </p>
            <Link href="/">
              <Button data-testid="button-back-home">Back to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const mainContent = (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Vote on Group Proposals</h2>
        <p className="text-neutral-600">
          Review and rank proposals from your group members. Your votes help determine the best options for everyone.
        </p>
      </div>

      <div className="flex md:justify-end" data-testid="proposals-filters">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3" data-testid="filter-proposals-response">
          <span className="text-sm font-medium text-neutral-600">Show</span>
          <ToggleGroup
            type="single"
            value={responseFilter}
            onValueChange={(value) => {
              if (value) {
                setResponseFilter(value as typeof responseFilter);
              }
            }}
            className="justify-start sm:justify-center"
          >
            <ToggleGroupItem value="needs-response" className="px-3 py-1 text-sm">
              Needs response
            </ToggleGroupItem>
            <ToggleGroupItem value="accepted" className="px-3 py-1 text-sm">
              Accepted
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as ProposalTab)}
        className="space-y-6"
      >
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger
              value="my-proposals"
              className="flex items-center gap-2"
              data-testid="tab-my-proposals"
            >
              <User className="w-4 h-4" />
              My Proposals {totalMyProposals > 0 && `(${totalMyProposals})`}
            </TabsTrigger>
            <TabsTrigger value="hotels" className="flex items-center gap-2" data-testid="tab-hotels">
              <Hotel className="w-4 h-4" />
              Hotels {filteredHotelProposals.length > 0 && `(${filteredHotelProposals.length})`}
            </TabsTrigger>
            <TabsTrigger value="flights" className="flex items-center gap-2" data-testid="tab-flights">
              <Plane className="w-4 h-4" />
              Flights {filteredFlightProposals.length > 0 && `(${filteredFlightProposals.length})`}
            </TabsTrigger>
            <TabsTrigger value="activities" className="flex items-center gap-2" data-testid="tab-activities">
              <MapPin className="w-4 h-4" />
              Activities {filteredActivityProposals.length > 0 && `(${filteredActivityProposals.length})`}
            </TabsTrigger>
            <TabsTrigger value="restaurants" className="flex items-center gap-2" data-testid="tab-restaurants">
              <Utensils className="w-4 h-4" />
              Restaurants {filteredRestaurantProposals.length > 0 && `(${filteredRestaurantProposals.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-proposals" className="space-y-6">
            {totalMyProposals > 0 ? (
              <div className="space-y-8" data-testid="list-my-proposals">
                {filteredMyHotelProposals.length > 0 && (
                  <section className="space-y-4" data-testid="section-my-hotel-proposals">
                    <div className="flex items-center gap-2 text-neutral-700">
                      <Hotel className="w-4 h-4" />
                      <h3 className="text-lg font-semibold">
                        Hotel proposals ({filteredMyHotelProposals.length})
                      </h3>
                    </div>
                    <div className="space-y-4">
                      {filteredMyHotelProposals.map((proposal) => (
                        <HotelProposalCard key={proposal.id} proposal={proposal} />
                      ))}
                    </div>
                  </section>
                )}

                {filteredMyFlightProposals.length > 0 && (
                  <section className="space-y-4" data-testid="section-my-flight-proposals">
                    <div className="flex items-center gap-2 text-neutral-700">
                      <Plane className="w-4 h-4" />
                      <h3 className="text-lg font-semibold">
                        Flight proposals ({filteredMyFlightProposals.length})
                      </h3>
                    </div>
                    <div className="space-y-4">
                      {filteredMyFlightProposals.map((proposal) => (
                        <FlightProposalCard key={proposal.id} proposal={proposal} />
                      ))}
                    </div>
                  </section>
                )}

                {filteredMyActivityProposals.length > 0 && (
                  <section className="space-y-4" data-testid="section-my-activity-proposals">
                    <div className="flex items-center gap-2 text-neutral-700">
                      <MapPin className="w-4 h-4" />
                      <h3 className="text-lg font-semibold">
                        Activity proposals ({filteredMyActivityProposals.length})
                      </h3>
                    </div>
                    <div className="space-y-4">
                      {filteredMyActivityProposals.map((proposal) => (
                        <ActivityProposalCard key={proposal.id} proposal={proposal} />
                      ))}
                    </div>
                  </section>
                )}

                {filteredMyRestaurantProposals.length > 0 && (
                  <section className="space-y-4" data-testid="section-my-restaurant-proposals">
                    <div className="flex items-center gap-2 text-neutral-700">
                      <Utensils className="w-4 h-4" />
                      <h3 className="text-lg font-semibold">
                        Restaurant proposals ({filteredMyRestaurantProposals.length})
                      </h3>
                    </div>
                    <div className="space-y-4">
                      {filteredMyRestaurantProposals.map((proposal) => (
                        <RestaurantProposalCard key={proposal.id} proposal={proposal} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <MyProposalsEmptyState hasAny={hasAnyMyProposals} />
            )}
          </TabsContent>

          <TabsContent value="hotels" className="space-y-6">
            {hotelProposalsLoading ? (
              <div className="flex justify-center py-8">
                <TravelLoading text="Loading hotel proposals..." />
              </div>
            ) : hotelProposalsHasError ? (
              <InlineErrorState
                message={hotelProposalsErrorMessage}
                onRetry={() => void refetchHotelProposals()}
                testId="error-hotel-proposals"
              />
            ) : filteredHotelProposals.length > 0 ? (
              <div data-testid="list-hotel-proposals">
                {filteredHotelProposals.map((proposal) => (
                  <HotelProposalCard key={proposal.id} proposal={proposal} />
                ))}
              </div>
            ) : activeHotelProposalsForCategories.length > 0 ? (
              <FilteredEmptyState type="Hotel" />
            ) : (
              <EmptyState type="Hotel" icon={Hotel} />
            )}
          </TabsContent>

          <TabsContent value="flights" className="space-y-6">
            {flightProposalsLoading ? (
              <div className="flex justify-center py-8">
                <TravelLoading text="Loading flight proposals..." />
              </div>
            ) : flightProposalsHasError ? (
              <InlineErrorState
                message={flightProposalsErrorMessage}
                onRetry={() => void refetchFlightProposals()}
                testId="error-flight-proposals"
              />
            ) : filteredFlightProposals.length > 0 ? (
              <div data-testid="list-flight-proposals">
                {filteredFlightProposals.map((proposal) => (
                  <FlightProposalCard key={proposal.id} proposal={proposal} />
                ))}
              </div>
            ) : activeFlightProposalsForCategories.length > 0 ? (
              <FilteredEmptyState type="Flight" />
            ) : (
              <EmptyState type="Flight" icon={Plane} />
            )}
          </TabsContent>

          <TabsContent value="activities" className="space-y-6">
            {activityProposalsLoading ? (
              <div className="flex justify-center py-8">
                <TravelLoading text="Loading activity proposals..." />
              </div>
            ) : activityProposalsHasError ? (
              <InlineErrorState
                message={activityProposalsErrorMessage}
                onRetry={() => void refetchActivityProposals()}
                testId="error-activity-proposals"
              />
            ) : filteredActivityProposals.length > 0 ? (
              <div data-testid="list-activity-proposals">
                {filteredActivityProposals.map((proposal) => (
                  <ActivityProposalCard key={proposal.id} proposal={proposal} />
                ))}
              </div>
            ) : activeActivityProposalsForCategories.length > 0 ? (
              <FilteredEmptyState type="Activity" />
            ) : (
              <EmptyState type="Activity" icon={MapPin} />
            )}
          </TabsContent>

          <TabsContent value="restaurants" className="space-y-6">
            {restaurantProposalsLoading ? (
              <div className="flex justify-center py-8">
                <TravelLoading text="Loading restaurant proposals..." />
              </div>
            ) : restaurantProposalsHasError ? (
              <InlineErrorState
                message={restaurantProposalsErrorMessage}
                onRetry={() => void refetchRestaurantProposals()}
                testId="error-restaurant-proposals"
              />
            ) : filteredRestaurantProposals.length > 0 ? (
              <div data-testid="list-restaurant-proposals">
                {filteredRestaurantProposals.map((proposal) => (
                  <RestaurantProposalCard key={proposal.id} proposal={proposal} />
                ))}
              </div>
            ) : activeRestaurantProposalsForCategories.length > 0 ? (
              <FilteredEmptyState type="Restaurant" />
            ) : (
              <EmptyState type="Restaurant" icon={Utensils} />
            )}
          </TabsContent>
        </Tabs>
      </div>
  );

  if (embedded) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">{mainContent}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href={`/trip/${tripId}`}>
                <Button variant="ghost" size="sm" data-testid="button-back-to-trip">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Trip
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold" data-testid="text-page-title">
                  Group Proposals
                </h1>
                <p className="text-sm text-neutral-600" data-testid="text-trip-name">
                  {trip.name}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{mainContent}</div>
    </div>
  );
}

// Route wrapper component for standalone routes
function ProposalsRoute() {
  const { tripId } = useParams<{ tripId: string }>();
  return <ProposalsPage tripId={parseInt(tripId || "0")} />;
}

// Export both components
export default ProposalsPage;
export { ProposalsRoute };