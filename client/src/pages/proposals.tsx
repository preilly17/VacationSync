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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { format, formatDistanceToNow } from "date-fns";
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
  Bell,
} from "lucide-react";
import { TravelLoading } from "@/components/LoadingSpinners";
import type {
  HotelProposalWithDetails,
  FlightProposalWithDetails,
  ActivityProposalWithDetails,
  RestaurantProposalWithDetails,
  TripWithDetails,
  ActivityWithDetails,
  ActivityInviteStatus,
} from "@shared/schema";
import { ActivityCard } from "@/components/activity-card";

interface ProposalsPageProps {
  tripId?: number;
}

type ProposalTab = "invites" | "hotels" | "flights" | "activities" | "restaurants";

function ProposalsPage({ tripId }: ProposalsPageProps = {}) {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ProposalTab>("hotels");
  const [hasSeededTab, setHasSeededTab] = useState(false);
  const [proposalFilter, setProposalFilter] = useState<"all" | "mine">("all");
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
  const { data: trip, isLoading: tripLoading } = useQuery<TripWithDetails>({
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
  const { data: activityProposals = [], isLoading: activityProposalsLoading } = useQuery<ActivityProposalWithDetails[]>({
    queryKey: [`/api/trips/${tripId}/activity-proposals`],
    enabled: !!tripId && isAuthenticated,
    queryFn: () => Promise.resolve([]), // Placeholder - will need actual API route
  });

  const { data: restaurantProposals = [], isLoading: restaurantProposalsLoading } = useQuery<RestaurantProposalWithDetails[]>({
    queryKey: ["/api/trips", tripId, "restaurant-proposals"],
    enabled: !!tripId && isAuthenticated,
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<ActivityWithDetails[]>({
    queryKey: [`/api/trips/${tripId}/activities`],
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
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId.toString(), "hotel-proposals"] });
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

  const respondToInviteMutation = useMutation({
    mutationFn: async ({
      activityId,
      status,
    }: {
      activityId: number;
      status: ActivityInviteStatus;
    }) => {
      const response = await apiRequest(`/api/activities/${activityId}/respond`, {
        method: "POST",
        body: { status },
      });

      return (await response.json()) as {
        invite: unknown;
        activity: ActivityWithDetails | null;
      };
    },
    onSuccess: (_data, variables) => {
      if (tripId) {
        queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/activities`] });
      }

      const status = variables.status;
      let title = "RSVP updated";
      let description = "We saved your response.";

      if (status === "accepted") {
        title = "You're going!";
        description = "This activity is on your personal schedule now.";
      } else if (status === "declined") {
        title = "You declined this activity";
        description = "We won't show it on your personal schedule.";
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

  const cancelProposalMutation = useMutation({
    mutationFn: async ({
      type,
      proposalId,
    }: {
      type: "hotel" | "flight" | "restaurant";
      proposalId: number;
    }) => {
      const endpointMap = {
        hotel: `/api/hotel-proposals/${proposalId}/cancel`,
        flight: `/api/flight-proposals/${proposalId}/cancel`,
        restaurant: `/api/restaurant-proposals/${proposalId}/cancel`,
      } as const;

      const res = await apiRequest(endpointMap[type], { method: "POST" });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      if (!tripId) {
        return;
      }

      switch (variables.type) {
        case "hotel":
          queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/hotel-proposals`] });
          break;
        case "flight":
          queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/flight-proposals`] });
          break;
        case "restaurant":
          queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "restaurant-proposals"] });
          break;
      }

      toast({
        title: "Proposal canceled",
        description: "We’ve let everyone know this proposal is no longer happening.",
      });
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to cancel proposal";
      toast({
        title: "Unable to cancel proposal",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  type BaseProposal = {
    id: number;
    tripId: number;
    status?: string | null;
    proposedBy?: string | null;
    proposer?: { id?: string | null } | null;
  };

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
        if (proposalFilter === "mine" && !isMyProposal(item)) {
          return false;
        }

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
    [isMyProposal, proposalFilter, statusFilter],
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

    if (normalizedStatus === "scheduled") {
      return <Badge className="bg-emerald-100 text-emerald-700"><Calendar className="w-3 h-3 mr-1" />Scheduled</Badge>;
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  disabled={isCancelling}
                  onClick={() => {
                    if (window.confirm("Cancel this proposal for everyone?")) {
                      cancelProposalMutation.mutate({ type: "restaurant", proposalId: proposal.id });
                    }
                  }}
                  data-testid={`button-cancel-restaurant-proposal-${proposal.id}`}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  {isCancelling ? "Canceling..." : "Cancel"}
                </Button>
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

  if (authLoading || tripLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <TravelLoading variant="journey" size="lg" text="Loading your proposals..." />
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  disabled={isCancelling}
                  onClick={() => {
                    if (window.confirm("Cancel this proposal for everyone?")) {
                      cancelProposalMutation.mutate({ type: "hotel", proposalId: proposal.id });
                    }
                  }}
                  data-testid={`button-cancel-hotel-proposal-${proposal.id}`}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  {isCancelling ? "Canceling..." : "Cancel"}
                </Button>
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  disabled={isCancelling}
                  onClick={() => {
                    if (window.confirm("Cancel this proposal for everyone?")) {
                      cancelProposalMutation.mutate({ type: "flight", proposalId: proposal.id });
                    }
                  }}
                  data-testid={`button-cancel-flight-proposal-${proposal.id}`}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  {isCancelling ? "Canceling..." : "Cancel"}
                </Button>
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
  const EmptyState = ({ type, icon: Icon }: { type: string; icon: any }) => (
    <div className="text-center py-12">
      <Icon className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-neutral-600 mb-2">No {type} Proposals Yet</h3>
      <p className="text-neutral-500 mb-6">
        Group members can propose {type.toLowerCase()} options for voting. 
        Check the {type} page to add proposals!
      </p>
      <Link href={`/trip/${tripId}/${type.toLowerCase()}`}>
        <Button data-testid={`button-add-${type.toLowerCase()}-proposal`}>
          <Icon className="w-4 h-4 mr-2" />
          Browse {type}
        </Button>
      </Link>
    </div>
  );

  const MyProposalsEmptyState = ({ type }: { type: string }) => (
    <div className="text-center py-12" data-testid={`empty-my-${type.toLowerCase()}-proposals`}>
      <User className="w-10 h-10 text-neutral-400 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-neutral-600 mb-2">You haven’t proposed anything yet.</h3>
      <p className="text-neutral-500">
        When you share a {type.toLowerCase()} idea with the group, it will appear here for quick access.
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

  const filteredHotelProposals = useMemo(
    () => applyProposalFilters(hotelProposals),
    [applyProposalFilters, hotelProposals],
  );
  const filteredFlightProposals = useMemo(
    () => applyProposalFilters(flightProposals),
    [applyProposalFilters, flightProposals],
  );
  const filteredActivityProposals = useMemo(
    () => applyProposalFilters(activityProposals),
    [applyProposalFilters, activityProposals],
  );
  const filteredRestaurantProposals = useMemo(
    () => applyProposalFilters(restaurantProposals),
    [applyProposalFilters, restaurantProposals],
  );

  const pendingInviteActivities = useMemo(() => {
    if (!user?.id) {
      return [] as ActivityWithDetails[];
    }

    return activities
      .filter((activity) => {
        const invite =
          activity.currentUserInvite ??
          activity.invites.find((item) => item.userId === user.id);
        return invite?.status === "pending";
      })
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
  }, [activities, user?.id]);

  useEffect(() => {
    if (hasSeededTab || activitiesLoading) {
      return;
    }

    if (pendingInviteActivities.length > 0) {
      setActiveTab("invites");
    }

    setHasSeededTab(true);
  }, [activitiesLoading, hasSeededTab, pendingInviteActivities.length]);

  const handleRespondToInvite = useCallback(
    (activityId: number, status: ActivityInviteStatus) => {
      respondToInviteMutation.mutate({ activityId, status });
    },
    [respondToInviteMutation],
  );

  const respondingActivityId = respondToInviteMutation.variables?.activityId ?? null;

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

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6" data-testid="proposals-filters">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-neutral-600">Show</span>
            <div className="inline-flex rounded-md border border-neutral-200 bg-white p-1 shadow-sm">
              <Button
                type="button"
                size="sm"
                variant={proposalFilter === "all" ? "default" : "ghost"}
                className={`rounded-sm ${proposalFilter === "all" ? "bg-primary text-white hover:bg-primary/90" : "text-neutral-700"}`}
                onClick={() => setProposalFilter("all")}
                data-testid="filter-proposals-all"
              >
                All proposals
              </Button>
              <Button
                type="button"
                size="sm"
                variant={proposalFilter === "mine" ? "default" : "ghost"}
                className={`rounded-sm ${proposalFilter === "mine" ? "bg-primary text-white hover:bg-primary/90" : "text-neutral-700"}`}
                onClick={() => setProposalFilter("mine")}
                data-testid="filter-proposals-mine"
              >
                My proposals
              </Button>
            </div>
          </div>

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
            <TabsTrigger value="invites" className="flex items-center gap-2" data-testid="tab-invites">
              <Bell className="w-4 h-4" />
              My Invites {pendingInviteActivities.length > 0 && `(${pendingInviteActivities.length})`}
            </TabsTrigger>
            <TabsTrigger value="hotels" className="flex items-center gap-2" data-testid="tab-hotels">
              <Hotel className="w-4 h-4" />
              Hotels {hotelProposals.length > 0 && `(${hotelProposals.length})`}
            </TabsTrigger>
            <TabsTrigger value="flights" className="flex items-center gap-2" data-testid="tab-flights">
              <Plane className="w-4 h-4" />
              Flights {flightProposals.length > 0 && `(${flightProposals.length})`}
            </TabsTrigger>
            <TabsTrigger value="activities" className="flex items-center gap-2" data-testid="tab-activities">
              <MapPin className="w-4 h-4" />
              Activities {activityProposals.length > 0 && `(${activityProposals.length})`}
            </TabsTrigger>
            <TabsTrigger value="restaurants" className="flex items-center gap-2" data-testid="tab-restaurants">
              <Utensils className="w-4 h-4" />
              Restaurants {restaurantProposals.length > 0 && `(${restaurantProposals.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invites" className="space-y-6">
            {activitiesLoading ? (
              <div className="flex justify-center py-8">
                <TravelLoading text="Checking your invites..." />
              </div>
            ) : pendingInviteActivities.length > 0 ? (
              <div className="space-y-4" data-testid="list-pending-invites">
                {pendingInviteActivities.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    currentUser={user || undefined}
                    onAccept={() => handleRespondToInvite(activity.id, "accepted")}
                    onDecline={() => handleRespondToInvite(activity.id, "declined")}
                    onMaybe={() => handleRespondToInvite(activity.id, "pending")}
                    isLoading={
                      respondToInviteMutation.isPending &&
                      respondingActivityId === activity.id
                    }
                  />
                ))}
              </div>
            ) : (
              <Card className="border border-dashed border-neutral-200 bg-neutral-50">
                <CardContent className="py-10 text-center space-y-3">
                  <Bell className="w-10 h-10 mx-auto text-neutral-400" />
                  <h3 className="text-lg font-semibold text-neutral-900">No pending invites</h3>
                  <p className="text-sm text-neutral-600">
                    You're all caught up! We'll list new activity invites here when your group adds you.
                  </p>
                </CardContent>
              </Card>
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
            ) : proposalFilter === "mine" ? (
              <MyProposalsEmptyState type="Hotel" />
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
            ) : proposalFilter === "mine" ? (
              <MyProposalsEmptyState type="Flight" />
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
                {/* Activity proposals would go here once API is implemented */}
                <p className="text-center text-neutral-500 py-8">Activity proposals coming soon!</p>
              </div>
            ) : proposalFilter === "mine" ? (
              <MyProposalsEmptyState type="Activity" />
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
            ) : proposalFilter === "mine" ? (
              <MyProposalsEmptyState type="Restaurant" />
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