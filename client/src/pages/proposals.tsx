import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  Trophy,
  AlertCircle,
  TrendingUp,
  ThumbsUp,
  MessageSquare,
  Eye,
  Crown,
  Calendar,
  CheckCircle,
  XCircle,
  User as UserIcon,
  Heart
} from "lucide-react";
import { TravelLoading } from "@/components/LoadingSpinners";
import type {
  HotelProposalWithDetails,
  FlightProposalWithDetails,
  ActivityProposalWithDetails,
  RestaurantProposalWithDetails,
  TripWithDetails,
  User,
} from "@shared/schema";

interface ProposalsPageProps {
  tripId?: number;
}

type ProposalOwnerFilter = "all" | "mine";
type ProposalStatusFilter = "all" | "active" | "canceled";

const normalizeStatus = (status?: string | null): string =>
  (status ?? "active").toLowerCase();

type RankingWithUser = {
  id: number;
  user?: User | null;
};

function applyProposalFilters<T extends { proposedBy?: string | null; status?: string | null }>(
  proposals: T[],
  options: {
    ownerFilter: ProposalOwnerFilter;
    statusFilter: ProposalStatusFilter;
    currentUserId?: string;
  },
): T[] {
  const { ownerFilter, statusFilter, currentUserId } = options;

  return proposals.filter((proposal) => {
    const proposalStatus = normalizeStatus(proposal.status);

    if (ownerFilter === "mine" && (!currentUserId || proposal.proposedBy !== currentUserId)) {
      return false;
    }

    if (statusFilter === "active" && proposalStatus === "canceled") {
      return false;
    }

    if (statusFilter === "canceled" && proposalStatus !== "canceled") {
      return false;
    }

    return true;
  });
}

function ProposalsPage({ tripId }: ProposalsPageProps = {}) {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("hotels");
  const [ownerFilter, setOwnerFilter] = useState<ProposalOwnerFilter>("all");
  const [statusFilter, setStatusFilter] = useState<ProposalStatusFilter>("all");
  const [pendingCancel, setPendingCancel] = useState<
    { type: "hotel" | "flight" | "restaurant"; id: number }
  | null>(null);

  const currentUserId = user?.id;
  const isMyFilter = ownerFilter === "mine";

  const renderVoteSummary = (rankings?: RankingWithUser[]) => {
    const safeRankings = rankings ?? [];
    const totalVotes = safeRankings.length;

    if (totalVotes === 0) {
      return (
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Users className="w-4 h-4" />
          <span>No votes yet</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3 text-sm text-neutral-600">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          <span>
            {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
          </span>
        </div>
        <div className="flex items-center">
          <div className="flex -space-x-2">
            {safeRankings.slice(0, 3).map((ranking) => {
              const member = ranking.user;
              const displayLetter =
                member?.firstName?.charAt(0) ??
                member?.lastName?.charAt(0) ??
                member?.email?.charAt(0) ??
                "?";

              return (
                <Avatar key={ranking.id} className="h-6 w-6 border border-white">
                  <AvatarImage
                    src={member?.profileImageUrl ?? undefined}
                    alt={member?.firstName ?? member?.email ?? "Trip member"}
                  />
                  <AvatarFallback>{displayLetter}</AvatarFallback>
                </Avatar>
              );
            })}
          </div>
          {totalVotes > 3 && (
            <span className="ml-2 text-xs text-neutral-500">
              +{totalVotes - 3}
            </span>
          )}
        </div>
      </div>
    );
  };

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

  const filteredHotelProposals = useMemo(
    () =>
      applyProposalFilters(hotelProposals, {
        ownerFilter,
        statusFilter,
        currentUserId,
      }),
    [hotelProposals, ownerFilter, statusFilter, currentUserId],
  );

  const filteredFlightProposals = useMemo(
    () =>
      applyProposalFilters(flightProposals, {
        ownerFilter,
        statusFilter,
        currentUserId,
      }),
    [flightProposals, ownerFilter, statusFilter, currentUserId],
  );

  const filteredActivityProposals = useMemo(
    () =>
      applyProposalFilters(activityProposals, {
        ownerFilter,
        statusFilter,
        currentUserId,
      }),
    [activityProposals, ownerFilter, statusFilter, currentUserId],
  );

  const filteredRestaurantProposals = useMemo(
    () =>
      applyProposalFilters(restaurantProposals, {
        ownerFilter,
        statusFilter,
        currentUserId,
      }),
    [restaurantProposals, ownerFilter, statusFilter, currentUserId],
  );

  const hotelHasUserProposals = useMemo(
    () =>
      Boolean(currentUserId) &&
      hotelProposals.some((proposal) => proposal.proposedBy === currentUserId),
    [hotelProposals, currentUserId],
  );

  const flightHasUserProposals = useMemo(
    () =>
      Boolean(currentUserId) &&
      flightProposals.some((proposal) => proposal.proposedBy === currentUserId),
    [flightProposals, currentUserId],
  );

  const activityHasUserProposals = useMemo(
    () =>
      Boolean(currentUserId) &&
      activityProposals.some((proposal) => proposal.proposedBy === currentUserId),
    [activityProposals, currentUserId],
  );

  const restaurantHasUserProposals = useMemo(
    () =>
      Boolean(currentUserId) &&
      restaurantProposals.some((proposal) => proposal.proposedBy === currentUserId),
    [restaurantProposals, currentUserId],
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

  const cancelHotelProposalMutation = useMutation({
    mutationFn: async (proposalId: number) => {
      const response = await apiRequest(`/api/hotel-proposals/${proposalId}/cancel`, {
        method: "POST",
      });
      return (await response.json()) as HotelProposalWithDetails;
    },
    onSuccess: (proposal) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${proposal.tripId}/hotel-proposals`],
      });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${proposal.tripId}`] });
      toast({
        title: "Proposal canceled",
        description: `${proposal.hotelName} was canceled for the group.`,
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/login";
        return;
      }
      toast({
        title: "Unable to cancel proposal",
        description: "Something went wrong while canceling this proposal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const cancelFlightProposalMutation = useMutation({
    mutationFn: async (proposalId: number) => {
      const response = await apiRequest(`/api/flight-proposals/${proposalId}/cancel`, {
        method: "POST",
      });
      return (await response.json()) as FlightProposalWithDetails;
    },
    onSuccess: (proposal) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${proposal.tripId}/flight-proposals`],
      });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${proposal.tripId}`] });
      toast({
        title: "Proposal canceled",
        description: `${proposal.airline} ${proposal.flightNumber} was canceled for the group.`,
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/login";
        return;
      }
      toast({
        title: "Unable to cancel proposal",
        description: "Something went wrong while canceling this proposal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const cancelRestaurantProposalMutation = useMutation({
    mutationFn: async (proposalId: number) => {
      const response = await apiRequest(`/api/restaurant-proposals/${proposalId}/cancel`, {
        method: "POST",
      });
      return (await response.json()) as RestaurantProposalWithDetails;
    },
    onSuccess: (proposal) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${proposal.tripId}/restaurant-proposals`],
      });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${proposal.tripId}`] });
      toast({
        title: "Proposal canceled",
        description: `${proposal.restaurantName} was canceled for the group.`,
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/login";
        return;
      }
      toast({
        title: "Unable to cancel proposal",
        description: "Something went wrong while canceling this proposal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getProposalName = (
    type: "hotel" | "flight" | "restaurant",
    proposal:
      | HotelProposalWithDetails
      | FlightProposalWithDetails
      | RestaurantProposalWithDetails,
  ) => {
    if (type === "hotel") {
      return (proposal as HotelProposalWithDetails).hotelName;
    }
    if (type === "flight") {
      const flightProposal = proposal as FlightProposalWithDetails;
      return `${flightProposal.airline} ${flightProposal.flightNumber}`.trim();
    }
    return (proposal as RestaurantProposalWithDetails).restaurantName;
  };

  const isCancelingProposal = (
    type: "hotel" | "flight" | "restaurant",
    proposalId: number,
  ) => {
    if (!pendingCancel || pendingCancel.type !== type || pendingCancel.id !== proposalId) {
      return false;
    }

    if (type === "hotel") {
      return cancelHotelProposalMutation.isPending;
    }

    if (type === "flight") {
      return cancelFlightProposalMutation.isPending;
    }

    return cancelRestaurantProposalMutation.isPending;
  };

  const handleCancelProposal = async (
    type: "hotel" | "flight" | "restaurant",
    proposalId: number,
  ) => {
    setPendingCancel({ type, id: proposalId });
    try {
      if (type === "hotel") {
        await cancelHotelProposalMutation.mutateAsync(proposalId);
      } else if (type === "flight") {
        await cancelFlightProposalMutation.mutateAsync(proposalId);
      } else {
        await cancelRestaurantProposalMutation.mutateAsync(proposalId);
      }
    } finally {
      setPendingCancel(null);
    }
  };

  const renderCancelAction = (
    type: "hotel" | "flight" | "restaurant",
    proposal:
      | HotelProposalWithDetails
      | FlightProposalWithDetails
      | RestaurantProposalWithDetails,
  ) => {
    const isOwner = currentUserId && proposal.proposedBy === currentUserId;
    const status = normalizeStatus(proposal.status);

    if (!isOwner || status === "canceled") {
      return null;
    }

    const isPending = isCancelingProposal(type, proposal.id);
    const proposalName = getProposalName(type, proposal);
    const testIdSuffix =
      type === "hotel" ? "hotel" : type === "flight" ? "flight" : "restaurant";

    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="destructive"
            size="sm"
            disabled={isPending}
            data-testid={`button-open-cancel-${testIdSuffix}-${proposal.id}`}
          >
            {isPending ? "Canceling..." : "Cancel proposal"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this proposal for everyone?</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${proposalName}" will be removed from the group calendar and everyone’s schedules.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep proposal</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={async () => {
                  await handleCancelProposal(type, proposal.id);
                }}
                disabled={isPending}
                data-testid={`button-confirm-cancel-${testIdSuffix}-${proposal.id}`}
              >
                {isPending ? "Canceling..." : "Yes, cancel it"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  // Helper function to get user's ranking for a proposal
  const getUserRanking = (rankings: any[], userId: string) => {
    return rankings.find(r => r.userId === userId)?.ranking;
  };

  // Helper function to get ranking color
  const getRankingColor = (ranking: number) => {
    switch (ranking) {
      case 1: return "text-green-600 bg-green-100";
      case 2: return "text-blue-600 bg-blue-100";
      case 3: return "text-orange-600 bg-orange-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  // Helper function to calculate rooms needed (2 people per room by default)
  const calculateRoomsNeeded = (groupSize: number): number => {
    return Math.ceil(groupSize / 2);
  };

  // Helper function to parse price from string (handle "$150", "$150/night", etc.)
  const parsePrice = (priceStr: string | number): number => {
    if (typeof priceStr === 'number') return priceStr;
    
    // Handle various price formats: "$150", "150", "$150.00", "$1,250", "$150/night", etc.
    const cleanPrice = priceStr.toString()
      .replace(/[\$,\s]/g, '') // Remove dollar signs, commas, and spaces
      .replace(/\/night|\/day|per night|per day/gi, '') // Remove time qualifiers
      .trim();
    
    const parsed = parseFloat(cleanPrice);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  };

  // Helper function to calculate group budget breakdown
  const calculateGroupBudget = (pricePerNight: string | number, groupSize: number) => {
    const parsedPrice = parsePrice(pricePerNight);
    
    // Handle edge cases
    if (groupSize <= 0 || !groupSize) {
      return {
        roomsNeeded: 0,
        totalCost: 0,
        perPersonCost: 0,
        pricePerRoom: parsedPrice,
        hasError: true,
        errorMessage: "Group size not available"
      };
    }
    
    if (parsedPrice <= 0) {
      return {
        roomsNeeded: calculateRoomsNeeded(groupSize),
        totalCost: 0,
        perPersonCost: 0,
        pricePerRoom: 0,
        hasError: true,
        errorMessage: "Price information not available"
      };
    }
    
    const roomsNeeded = calculateRoomsNeeded(groupSize);
    const totalCost = parsedPrice * roomsNeeded;
    const perPersonCost = totalCost / groupSize;
    
    return {
      roomsNeeded,
      totalCost,
      perPersonCost,
      pricePerRoom: parsedPrice,
      hasError: false
    };
  };

  // Helper function to get proposal status badge
  const getStatusBadge = (status: string, averageRanking?: number) => {
    const normalizedStatus = normalizeStatus(status);

    if (normalizedStatus === "canceled") {
      return (
        <Badge className="bg-neutral-200 text-neutral-700">
          <XCircle className="w-3 h-3 mr-1" />
          Canceled
        </Badge>
      );
    }

    if (normalizedStatus === "scheduled" || normalizedStatus === "confirmed") {
      return (
        <Badge className="bg-indigo-100 text-indigo-700">
          <Calendar className="w-3 h-3 mr-1" />
          Scheduled
        </Badge>
      );
    }

    if (normalizedStatus === "selected") {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Selected
        </Badge>
      );
    }

    if (normalizedStatus === "rejected") {
      return (
        <Badge className="bg-red-100 text-red-800">
          <XCircle className="w-3 h-3 mr-1" />
          Rejected
        </Badge>
      );
    }

    if (normalizedStatus === "proposed") {
      return (
        <Badge className="bg-slate-100 text-slate-700">
          <Vote className="w-3 h-3 mr-1" />
          Proposed
        </Badge>
      );
    }

    if (typeof averageRanking === "number" && averageRanking <= 1.5) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800">
          <Crown className="w-3 h-3 mr-1" />
          Top Choice
        </Badge>
      );
    }

    return (
      <Badge className="bg-blue-100 text-blue-800">
        <Vote className="w-3 h-3 mr-1" />
        Active Voting
      </Badge>
    );
  };

  // Restaurant proposal card component
  const RestaurantProposalCard = ({ proposal }: { proposal: RestaurantProposalWithDetails }) => {
    const userRanking = getUserRanking(proposal.rankings || [], user?.id || '');
    
    return (
      <Card className="mb-4 hover:shadow-md transition-shadow" data-testid={`card-restaurant-proposal-${proposal.id}`}>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
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
            {getStatusBadge(
              proposal.status || 'active',
              proposal.averageRanking ?? undefined,
            )}
          </div>
        </CardHeader>
        <CardContent>
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
              <UserIcon className="w-4 h-4" />
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

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
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

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-3">
              {renderVoteSummary(proposal.rankings)}
              {renderCancelAction("restaurant", proposal)}
            </div>
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
    
    return (
      <Card className="mb-4 hover:shadow-md transition-shadow" data-testid={`card-hotel-proposal-${proposal.id}`}>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
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
            {getStatusBadge(
              proposal.status || 'active',
              proposal.averageRanking ?? undefined,
            )}
          </div>
        </CardHeader>
        <CardContent>
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
              <UserIcon className="w-4 h-4" />
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

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
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

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-3">
              {renderVoteSummary(proposal.rankings)}
              {renderCancelAction("hotel", proposal)}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Flight proposal card component
  const FlightProposalCard = ({ proposal }: { proposal: FlightProposalWithDetails }) => {
    const userRanking = getUserRanking(proposal.rankings || [], user?.id || '');
    
    return (
      <Card className="mb-4 hover:shadow-md transition-shadow" data-testid={`card-flight-proposal-${proposal.id}`}>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
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
            {getStatusBadge(
              proposal.status || 'active',
              proposal.averageRanking ?? undefined,
            )}
          </div>
        </CardHeader>
        <CardContent>
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
              <UserIcon className="w-4 h-4" />
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

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
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

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-3">
              {renderVoteSummary(proposal.rankings)}
              {renderCancelAction("flight", proposal)}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Empty state component
  const EmptyState = ({
    type,
    icon: Icon,
    ownerFilter,
    statusFilter,
    hasAnyProposals,
    hasUserProposals,
  }: {
    type: string;
    icon: any;
    ownerFilter: ProposalOwnerFilter;
    statusFilter: ProposalStatusFilter;
    hasAnyProposals: boolean;
    hasUserProposals: boolean;
  }) => {
    const typeLower = type.toLowerCase();
    let title = `No ${type} Proposals Yet`;
    let description = `Group members can propose ${typeLower} options for voting. Check the ${type} page to add proposals!`;

    if (ownerFilter === "mine") {
      if (!hasUserProposals) {
        title = "You haven’t proposed anything yet.";
        description = `Use the ${typeLower} page to suggest something to your group.`;
      } else if (statusFilter !== "all") {
        title = "No proposals match these filters.";
        description = "Try adjusting the status filter to see your proposals.";
      } else {
        title = "No proposals match these filters.";
        description = "Adjust your filters to see more of your proposals.";
      }
    } else if (statusFilter !== "all" && hasAnyProposals) {
      title = "No proposals match these filters.";
      description = "Try changing the status filter to see other group suggestions.";
    }

    return (
      <div className="text-center py-12">
        <Icon className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-neutral-600 mb-2">{title}</h3>
        <p className="text-neutral-500 mb-6">{description}</p>
        <Link href={`/trip/${tripId}/${typeLower}`}>
          <Button data-testid={`button-add-${typeLower}-proposal`}>
            <Icon className="w-4 h-4 mr-2" />
            Browse {type}
          </Button>
        </Link>
      </div>
    );
  };

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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <ToggleGroup
            type="single"
            value={ownerFilter}
            onValueChange={(value) => {
              if (value) {
                setOwnerFilter(value as ProposalOwnerFilter);
              }
            }}
            variant="outline"
            className="w-full sm:w-auto"
            data-testid="toggle-proposal-owner-filter"
          >
            <ToggleGroupItem
              value="all"
              className="flex-1 sm:flex-none px-4 py-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              data-testid="toggle-owner-all"
            >
              All proposals
            </ToggleGroupItem>
            <ToggleGroupItem
              value="mine"
              className="flex-1 sm:flex-none px-4 py-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              data-testid="toggle-owner-mine"
            >
              My proposals
            </ToggleGroupItem>
          </ToggleGroup>

          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as ProposalStatusFilter)}
          >
            <SelectTrigger className="sm:w-[220px]" data-testid="select-proposal-status">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="option-status-all">
                All statuses
              </SelectItem>
              <SelectItem value="active" data-testid="option-status-active">
                Active
              </SelectItem>
              <SelectItem value="canceled" data-testid="option-status-canceled">
                Canceled
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
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
            ) : (
              <EmptyState
                type="Hotel"
                icon={Hotel}
                ownerFilter={ownerFilter}
                statusFilter={statusFilter}
                hasAnyProposals={hotelProposals.length > 0}
                hasUserProposals={hotelHasUserProposals}
              />
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
            ) : (
              <EmptyState
                type="Flight"
                icon={Plane}
                ownerFilter={ownerFilter}
                statusFilter={statusFilter}
                hasAnyProposals={flightProposals.length > 0}
                hasUserProposals={flightHasUserProposals}
              />
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
            ) : (
              <EmptyState
                type="Activity"
                icon={MapPin}
                ownerFilter={ownerFilter}
                statusFilter={statusFilter}
                hasAnyProposals={activityProposals.length > 0}
                hasUserProposals={activityHasUserProposals}
              />
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
            ) : (
              <EmptyState
                type="Restaurant"
                icon={Utensils}
                ownerFilter={ownerFilter}
                statusFilter={statusFilter}
                hasAnyProposals={restaurantProposals.length > 0}
                hasUserProposals={restaurantHasUserProposals}
              />
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