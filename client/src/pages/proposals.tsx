import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { differenceInMinutes, format, formatDistanceToNow } from "date-fns";
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
}

type ProposalTab = "my-proposals" | "hotels" | "flights" | "activities" | "restaurants";

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

function ProposalsPage({ tripId }: ProposalsPageProps = {}) {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ProposalTab>("hotels");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "canceled">("all");

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
  const { data: hotelProposals = [], isLoading: hotelProposalsLoading } = useQuery<HotelProposalWithDetails[]>({
    queryKey: [`/api/trips/${tripId}/hotel-proposals`],
    enabled: !!tripId && isAuthenticated,
  });

  // Fetch flight proposals
  const { data: flightProposals = [], isLoading: flightProposalsLoading } = useQuery<FlightProposalWithDetails[]>({
    queryKey: [`/api/trips/${tripId}/flight-proposals`],
    enabled: !!tripId && isAuthenticated,
  });

  // For now, activity and restaurant proposals use placeholder data
  // TODO: Implement API routes for activity and restaurant proposals
  const { data: rawActivityProposals = [], isLoading: activityProposalsLoading } = useQuery<ActivityWithDetails[]>({
    queryKey: [`/api/trips/${tripId}/activities`],
    enabled: !!tripId && isAuthenticated,
  });

  const { data: restaurantProposals = [], isLoading: restaurantProposalsLoading } = useQuery<RestaurantProposalWithDetails[]>({
    queryKey: ["/api/trips", tripId, "restaurant-proposals"],
    enabled: !!tripId && isAuthenticated,
  });

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
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/hotel-proposals`] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId.toString(), "flight-proposals"] });
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
          [`/api/trips/${tripId}/hotel-proposals`],
          (previous) => previous?.filter((proposal) => proposal.id !== proposalId),
        );
        queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/hotel-proposals`] });
      } else if (type === "flight") {
        queryClient.setQueryData<FlightProposalWithDetails[] | undefined>(
          [`/api/trips/${tripId}/flight-proposals`],
          (previous) => previous?.filter((proposal) => proposal.id !== proposalId),
        );
        queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/flight-proposals`] });
      } else if (type === "restaurant") {
        queryClient.setQueryData<RestaurantProposalWithDetails[] | undefined>(
          ["/api/trips", tripId, "restaurant-proposals"],
          (previous) => previous?.filter((proposal) => proposal.id !== proposalId),
        );
        queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "restaurant-proposals"] });
      } else if (type === "activity") {
        queryClient.setQueryData<ActivityWithDetails[] | undefined>(
          [`/api/trips/${tripId}/activities`],
          (previous) => previous?.filter((proposal) => proposal.id !== proposalId),
        );
        queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/activities`] });
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
    onSuccess: (_data, variables) => {
      if (tripId) {
        queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/activities`] });
      }

      const action = variables.action;
      let title = "RSVP updated";
      let description = "We saved your response.";

      if (action === "ACCEPT") {
        title = "You're going!";
        description = "This activity is on your personal schedule now.";
      } else if (action === "DECLINE") {
        title = "You declined this activity";
        description = "We won't show it on your personal schedule.";
      } else if (action === "WAITLIST") {
        title = "Joined the waitlist";
        description = "We'll let you know if a spot opens up.";
      } else {
        title = "Marked as undecided";
        description = "You can update your RSVP anytime.";
      }

      toast({ title, description });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/login";
        return;
      }

      toast({
        title: "Unable to update RSVP",
        description: "Please try again.",
        variant: "destructive",
      });
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

  const normalizeStatus = (status?: string | null) =>
    (status ?? "active").toLowerCase();

  const applyProposalFilters = useCallback(
    <T extends BaseProposal>(items: T[]): T[] => {
      return items.filter((item) => {
        if (statusFilter === "all") {
          return true;
        }

        const normalizedStatus = normalizeStatus(item.status);
        if (statusFilter === "canceled") {
          return normalizedStatus === "canceled" || normalizedStatus === "cancelled";
        }

        return normalizedStatus !== "canceled" && normalizedStatus !== "cancelled";
      });
    },
    [statusFilter],
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

    if (normalizedStatus === "canceled" || normalizedStatus === "cancelled") {
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
    const normalizedStatus = (proposal.status ?? "scheduled").toLowerCase();
    const canCancel = isMyProposal(proposal) && normalizedStatus !== "canceled" && normalizedStatus !== "cancelled";
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
                    ? "Saving..."
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
                    ? "Saving..."
                    : "Decline"}
                </Button>
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
    
    const normalizedStatus = (proposal.status ?? "active").toLowerCase();
    const canCancel = isMyProposal(proposal) && normalizedStatus !== "canceled" && normalizedStatus !== "cancelled";
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

  if (!tripId) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
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
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <TravelLoading variant="journey" size="lg" text="Loading your proposals..." />
      </div>
    );
  }

  if (tripError) {
    const parsedError = parseApiError(tripError);

    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
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
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
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

  // Hotel proposal card component
  const HotelProposalCard = ({ proposal }: { proposal: HotelProposalWithDetails }) => {
    const userRanking = getUserRanking(proposal.rankings || [], user?.id || '');
    const groupSize = trip?.members?.length || 0;
    const budgetBreakdown = calculateGroupBudget(proposal.price, groupSize);
    
    const normalizedStatus = (proposal.status ?? "active").toLowerCase();
    const canCancel = isMyProposal(proposal) && normalizedStatus !== "canceled" && normalizedStatus !== "cancelled";
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

  // Flight proposal card component
  const FlightProposalCard = ({ proposal }: { proposal: FlightProposalWithDetails }) => {
    const userRanking = getUserRanking(proposal.rankings || [], user?.id || "");
    const normalizedStatus = (proposal.status ?? "active").toLowerCase();
    const canCancel = isMyProposal(proposal) && normalizedStatus !== "canceled" && normalizedStatus !== "cancelled";
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
                  Departs: {proposal.departureTime}
                </div>
                <div className="text-sm text-neutral-600" data-testid={`text-flight-arrival-${proposal.id}`}>
                  Arrives: {proposal.arrivalTime}
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
      rawActivityProposals.map((activity) => ({
        ...activity,
        tripId: activity.tripCalendarId,
        proposedBy: activity.postedBy,
        proposer: activity.poster,
        status: getActivityProposalStatus(activity),
        activityName: activity.name,
        rankings: [],
        averageRanking: null,
      })),
    [getActivityProposalStatus, rawActivityProposals],
  );

  const otherHotelProposals = useMemo(
    () => hotelProposals.filter((proposal) => !isMyProposal(proposal)),
    [hotelProposals, isMyProposal],
  );
  const otherFlightProposals = useMemo(
    () => flightProposals.filter((proposal) => !isMyProposal(proposal)),
    [flightProposals, isMyProposal],
  );
  const otherActivityProposals = useMemo(
    () => activityProposals.filter((proposal) => !isMyProposal(proposal)),
    [activityProposals, isMyProposal],
  );
  const otherRestaurantProposals = useMemo(
    () => restaurantProposals.filter((proposal) => !isMyProposal(proposal)),
    [restaurantProposals, isMyProposal],
  );

  const filteredHotelProposals = useMemo(
    () => applyProposalFilters(otherHotelProposals),
    [applyProposalFilters, otherHotelProposals],
  );
  const filteredFlightProposals = useMemo(
    () => applyProposalFilters(otherFlightProposals),
    [applyProposalFilters, otherFlightProposals],
  );
  const filteredActivityProposals = useMemo(
    () => applyProposalFilters(otherActivityProposals),
    [applyProposalFilters, otherActivityProposals],
  );
  const filteredRestaurantProposals = useMemo(
    () => applyProposalFilters(otherRestaurantProposals),
    [applyProposalFilters, otherRestaurantProposals],
  );

  const myHotelProposals = useMemo(
    () => hotelProposals.filter((proposal) => isMyProposal(proposal)),
    [hotelProposals, isMyProposal],
  );
  const myFlightProposals = useMemo(
    () => flightProposals.filter((proposal) => isMyProposal(proposal)),
    [flightProposals, isMyProposal],
  );
  const myActivityProposals = useMemo(
    () => activityProposals.filter((proposal) => isMyProposal(proposal)),
    [activityProposals, isMyProposal],
  );
  const myRestaurantProposals = useMemo(
    () => restaurantProposals.filter((proposal) => isMyProposal(proposal)),
    [restaurantProposals, isMyProposal],
  );

  const filteredMyHotelProposals = useMemo(
    () => applyProposalFilters(myHotelProposals),
    [applyProposalFilters, myHotelProposals],
  );
  const filteredMyFlightProposals = useMemo(
    () => applyProposalFilters(myFlightProposals),
    [applyProposalFilters, myFlightProposals],
  );
  const filteredMyActivityProposals = useMemo(
    () => applyProposalFilters(myActivityProposals),
    [applyProposalFilters, myActivityProposals],
  );
  const filteredMyRestaurantProposals = useMemo(
    () => applyProposalFilters(myRestaurantProposals),
    [applyProposalFilters, myRestaurantProposals],
  );

  const totalMyProposals =
    filteredMyHotelProposals.length +
    filteredMyFlightProposals.length +
    filteredMyActivityProposals.length +
    filteredMyRestaurantProposals.length;

  const hasAnyMyProposals =
    myHotelProposals.length +
    myFlightProposals.length +
    myActivityProposals.length +
    myRestaurantProposals.length >
    0;

  const totalAvailableProposals =
    otherHotelProposals.length +
    otherFlightProposals.length +
    otherActivityProposals.length +
    otherRestaurantProposals.length;

  const noProposalsAtAll = totalAvailableProposals === 0;

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
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

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">Vote on Group Proposals</h2>
          <p className="text-neutral-600">
            Review and rank proposals from your group members. Your votes help determine the best options for everyone.
          </p>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-end mb-6" data-testid="proposals-filters">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-neutral-600">Status</span>
            <Select value={statusFilter} onValueChange={(value: "all" | "active" | "canceled") => setStatusFilter(value)}>
              <SelectTrigger className="w-[170px]" data-testid="filter-proposals-status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
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
              Hotels {otherHotelProposals.length > 0 && `(${otherHotelProposals.length})`}
            </TabsTrigger>
            <TabsTrigger value="flights" className="flex items-center gap-2" data-testid="tab-flights">
              <Plane className="w-4 h-4" />
              Flights {otherFlightProposals.length > 0 && `(${otherFlightProposals.length})`}
            </TabsTrigger>
            <TabsTrigger value="activities" className="flex items-center gap-2" data-testid="tab-activities">
              <MapPin className="w-4 h-4" />
              Activities {otherActivityProposals.length > 0 && `(${otherActivityProposals.length})`}
            </TabsTrigger>
            <TabsTrigger value="restaurants" className="flex items-center gap-2" data-testid="tab-restaurants">
              <Utensils className="w-4 h-4" />
              Restaurants {otherRestaurantProposals.length > 0 && `(${otherRestaurantProposals.length})`}
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
            ) : filteredHotelProposals.length > 0 ? (
              <div data-testid="list-hotel-proposals">
                {filteredHotelProposals.map((proposal) => (
                  <HotelProposalCard key={proposal.id} proposal={proposal} />
                ))}
              </div>
            ) : hotelProposals.length > 0 ? (
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
            ) : filteredFlightProposals.length > 0 ? (
              <div data-testid="list-flight-proposals">
                {filteredFlightProposals.map((proposal) => (
                  <FlightProposalCard key={proposal.id} proposal={proposal} />
                ))}
              </div>
            ) : flightProposals.length > 0 ? (
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
            ) : filteredActivityProposals.length > 0 ? (
              <div data-testid="list-activity-proposals">
                {filteredActivityProposals.map((proposal) => (
                  <ActivityProposalCard key={proposal.id} proposal={proposal} />
                ))}
              </div>
            ) : activityProposals.length > 0 ? (
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
            ) : filteredRestaurantProposals.length > 0 ? (
              <div data-testid="list-restaurant-proposals">
                {filteredRestaurantProposals.map((proposal) => (
                  <RestaurantProposalCard key={proposal.id} proposal={proposal} />
                ))}
              </div>
            ) : restaurantProposals.length > 0 ? (
              <FilteredEmptyState type="Restaurant" />
            ) : (
              <EmptyState type="Restaurant" icon={Utensils} />
            )}
          </TabsContent>
        </Tabs>
      </div>
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