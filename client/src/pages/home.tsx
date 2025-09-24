import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Compass,
  Heart,
  Lightbulb,
  ListChecks,
  MapPin,
  Plane,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  Users,
  DollarSign,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { CreateTripModal } from "@/components/create-trip-modal";
import { NotificationIcon } from "@/components/notification-icon";
import { TravelLoading } from "@/components/LoadingSpinners";
import { TravelMascot } from "@/components/TravelMascot";
import { ManualRefreshButton } from "@/components/manual-refresh-button";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { TripWithDetails } from "@shared/schema";

const TRIP_GRADIENT_BACKGROUND =
  "bg-gradient-to-br from-primary via-rose-500 to-orange-400";

const getCountdownLabel = (startDate: string | Date) => {
  const start = new Date(startDate);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays > 1) {
    return `${diffDays} days to go`;
  }
  if (diffDays === 1) {
    return "1 day to go";
  }
  if (diffDays === 0) {
    return "Happening today";
  }
  return "In progress";
};

const getMemberInitial = (firstName?: string | null, email?: string | null) => {
  if (firstName && firstName.trim().length > 0) {
    return firstName[0]?.toUpperCase();
  }
  if (email && email.includes("@")) {
    return email[0]?.toUpperCase();
  }
  return "T";
};

const formatMemberName = (firstName?: string | null, email?: string | null) => {
  if (firstName && firstName.trim().length > 0) {
    return firstName;
  }
  if (email && email.includes("@")) {
    return email.split("@")[0];
  }
  return "Traveler";
};

type StatType = "upcomingTrips" | "travelCompanions" | "destinations";

interface StatDefinition {
  type: StatType;
  label: string;
  value: number;
  icon: LucideIcon;
  accent: string;
}

interface CompanionDetail {
  id: string;
  name: string;
  email: string | null;
  trips: string[];
  initial: string;
}

interface DestinationDetail {
  name: string;
  totalTrips: number;
  upcomingTrips: number;
}

export default function Home() {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedStat, setSelectedStat] = useState<StatType | null>(null);
  const [isStatsDialogOpen, setIsStatsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: trips, isLoading, error } = useQuery<TripWithDetails[]>({
    queryKey: ["/api/trips"],
    enabled: !!user,
    retry: false,
  });

  const deleteTripMutation = useMutation({
    mutationFn: async (tripId: number) => {
      return apiRequest(`/api/trips/${tripId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({
        title: "Trip deleted",
        description: "Your past trip has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete trip",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const formatDateRange = (
    startDate: string | Date,
    endDate: string | Date,
  ) => {
    const start =
      typeof startDate === "string" ? new Date(startDate) : startDate;
    const end = typeof endDate === "string" ? new Date(endDate) : endDate;
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  };

  const getUpcomingTrips = () => {
    if (!trips) return [];
    const now = new Date();
    return trips.filter((trip) => new Date(trip.startDate) >= now);
  };

  const getPastTrips = () => {
    if (!trips) return [];
    const now = new Date();
    return trips.filter((trip) => new Date(trip.endDate) < now);
  };

  const handleStatClick = (statType: StatType) => {
    setSelectedStat(statType);
    setIsStatsDialogOpen(true);
  };

  const handleStatsDialogOpenChange = (open: boolean) => {
    setIsStatsDialogOpen(open);
    if (!open) {
      setSelectedStat(null);
    }
  };

  const handleLogout = async () => {
    console.log("Logout button clicked");
    localStorage.clear();
    sessionStorage.clear();
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch (logoutError) {
      console.error("Error logging out:", logoutError);
    } finally {
      queryClient.clear();
      window.location.href = "/login";
    }
  };

  const upcomingTrips = getUpcomingTrips();
  const pastTrips = getPastTrips();
  const totalCompanions =
    trips?.reduce((total, trip) => total + trip.memberCount, 0) ?? 0;
  const uniqueDestinations = trips
    ? new Set(trips.map((trip) => trip.destination)).size
    : 0;
  const sortedUpcomingTrips = [...upcomingTrips].sort(
    (a, b) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );
  const highlightTrip = sortedUpcomingTrips[0];
  const highlightHasCover = Boolean(highlightTrip?.coverImageUrl);
  const highlightCountdown = highlightTrip
    ? getCountdownLabel(highlightTrip.startDate)
    : undefined;
  const highlightDestinationName = highlightTrip?.destination
    ? highlightTrip.destination.split(",")[0]?.trim() || highlightTrip.destination
    : undefined;
  const heroSubtitle = highlightTrip
    ? highlightCountdown === "Happening today"
      ? `It's go day for ${highlightDestinationName}! Check off your final details below.`
      : highlightCountdown === "In progress"
        ? `You're already exploring ${highlightDestinationName}. Keep everyone aligned with live updates.`
        : `${highlightCountdown} until ${highlightDestinationName}. Let's make sure everything is locked in.`
    : "Plan something unforgettable—start by creating your next itinerary.";
  const travelFocusName = highlightDestinationName ?? "your next destination";
  const recentMembers = highlightTrip?.members?.slice(0, 3) ?? [];
  const stats: StatDefinition[] = [
    {
      type: "upcomingTrips",
      label: "Upcoming trips",
      value: upcomingTrips.length,
      icon: Calendar,
      accent: "bg-sky-100 text-sky-600",
    },
    {
      type: "travelCompanions",
      label: "Travel companions",
      value: totalCompanions,
      icon: Users,
      accent: "bg-emerald-100 text-emerald-600",
    },
    {
      type: "destinations",
      label: "Destinations",
      value: uniqueDestinations,
      icon: MapPin,
      accent: "bg-violet-100 text-violet-600",
    },
  ];

  const companionMap = new Map<string, CompanionDetail>();
  (trips ?? []).forEach((trip) => {
    const tripName = trip.name?.trim() || "Unnamed trip";
    (trip.members ?? []).forEach((member) => {
      const user = member.user;
      if (!user?.id) {
        return;
      }
      const existingCompanion = companionMap.get(user.id);
      const companionName = formatMemberName(user.firstName, user.email);
      const companionInitial = getMemberInitial(user.firstName, user.email);
      const email = user.email ?? null;

      if (existingCompanion) {
        if (!existingCompanion.trips.includes(tripName)) {
          existingCompanion.trips.push(tripName);
        }
      } else {
        companionMap.set(user.id, {
          id: user.id,
          name: companionName,
          email,
          trips: [tripName],
          initial: companionInitial,
        });
      }
    });
  });
  const companionDetails = Array.from(companionMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const destinationMap = new Map<string, DestinationDetail>();
  const currentDate = new Date();
  (trips ?? []).forEach((trip) => {
    const rawDestination = trip.destination ?? "Destination TBA";
    const displayDestination =
      rawDestination && rawDestination.trim().length > 0
        ? rawDestination.trim()
        : "Destination TBA";
    const mapKey = rawDestination || "Destination TBA";
    const existingDestination = destinationMap.get(mapKey);
    const tripStart = new Date(trip.startDate);
    const isUpcoming = tripStart >= currentDate;

    if (existingDestination) {
      existingDestination.totalTrips += 1;
      if (isUpcoming) {
        existingDestination.upcomingTrips += 1;
      }
    } else {
      destinationMap.set(mapKey, {
        name: displayDestination,
        totalTrips: 1,
        upcomingTrips: isUpcoming ? 1 : 0,
      });
    }
  });
  const destinationDetails = Array.from(destinationMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const statDescriptions: Record<StatType, string> = {
    upcomingTrips:
      "Preview names, dates, and destinations for each upcoming trip.",
    travelCompanions:
      "See who is joining you and which adventures you're sharing together.",
    destinations:
      "Review every destination you've saved across your journeys.",
  };

  const activeStat = selectedStat
    ? stats.find((stat) => stat.type === selectedStat)
    : undefined;

  const renderSelectedStatContent = () => {
    if (!selectedStat) {
      return null;
    }

    if (selectedStat === "upcomingTrips") {
      if (sortedUpcomingTrips.length === 0) {
        return (
          <p className="text-sm text-slate-600">
            You're all caught up! Create a new trip to see it here.
          </p>
        );
      }

      return (
        <div className="space-y-3">
          {sortedUpcomingTrips.map((trip) => {
            const countdown = getCountdownLabel(trip.startDate);

            return (
              <div
                key={trip.id}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {trip.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {trip.destination || "Destination TBA"}
                    </p>
                  </div>
                  <Badge className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
                    {countdown}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    {formatDateRange(trip.startDate, trip.endDate)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-slate-500" />
                    {trip.memberCount} companion{trip.memberCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (selectedStat === "travelCompanions") {
      if (companionDetails.length === 0) {
        return (
          <p className="text-sm text-slate-600">
            Invite friends and family to your trips to see them listed here.
          </p>
        );
      }

      return (
        <div className="space-y-3">
          {companionDetails.map((companion) => {
            const tripNames = companion.trips;
            const displayedTrips = tripNames.slice(0, 3).join(", ");
            const remainingCount = Math.max(tripNames.length - 3, 0);
            const tripLabel =
              tripNames.length === 0
                ? "No trips recorded yet"
                : tripNames.length === 1
                  ? `Trip: ${tripNames[0]}`
                  : `Trips: ${displayedTrips}${
                      remainingCount > 0 ? ` +${remainingCount} more` : ""
                    }`;

            return (
              <div
                key={companion.id}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                  {companion.initial}
                </div>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-slate-900">{companion.name}</p>
                  {companion.email && (
                    <p className="text-xs text-slate-500">{companion.email}</p>
                  )}
                  <p className="text-xs text-slate-500">{tripLabel}</p>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (selectedStat === "destinations") {
      if (destinationDetails.length === 0) {
        return (
          <p className="text-sm text-slate-600">
            Plan a trip to start building your destination list.
          </p>
        );
      }

      return (
        <div className="space-y-3">
          {destinationDetails.map((destination) => (
            <div
              key={destination.name}
              className="space-y-2 rounded-2xl border border-slate-200 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-violet-600" />
                  <p className="text-sm font-semibold text-slate-900">
                    {destination.name}
                  </p>
                </div>
                <Badge className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
                  {destination.totalTrips} trip{destination.totalTrips === 1 ? "" : "s"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                {destination.upcomingTrips > 0
                  ? `${destination.upcomingTrips} upcoming ${
                      destination.upcomingTrips === 1 ? "adventure" : "adventures"
                    } planned`
                  : "No upcoming adventures planned"}
              </p>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <TravelLoading
          variant="travel"
          size="lg"
          text="Loading your travel dashboard..."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-xl">
          <div className="mb-6 flex justify-center">
            <TravelMascot type="plane" animated={false} className="text-primary" />
          </div>
          <h2 className="mb-3 text-xl font-bold text-slate-900">Session issue</h2>
          <p className="mb-6 text-slate-600">
            Your session has expired. Click the refresh button to log in again and continue using the app.
          </p>
          <ManualRefreshButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-12 px-4 py-12 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div
            className={cn(
              "relative overflow-hidden rounded-3xl border border-slate-200 p-8 shadow-sm sm:p-12",
              highlightHasCover ? "text-white bg-neutral-900" : "text-white",
            )}
          >
            {highlightHasCover ? (
              <>
                <img
                  src={highlightTrip?.coverImageUrl ?? undefined}
                  alt={
                    highlightTrip
                      ? `Cover photo for ${highlightTrip.name}`
                      : "Trip cover background"
                  }
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/40 to-transparent"
                  aria-hidden="true"
                />
              </>
            ) : (
              <>
                <div
                  className={cn("absolute inset-0", TRIP_GRADIENT_BACKGROUND)}
                  aria-hidden="true"
                />
                <div
                  className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(circle_at_top_left,rgba(255,255,255,0.65),transparent_55%)]"
                  aria-hidden="true"
                />
              </>
            )}
            <div className="relative z-10 flex h-full flex-col justify-between gap-8">
              <div className="space-y-6">
                <Badge className="w-fit rounded-full bg-white/15 px-4 py-1 text-sm font-semibold text-white shadow-sm backdrop-blur">
                  <Sparkles className="mr-2 h-4 w-4 text-amber-200" />
                  Next adventure awaits
                </Badge>
                <div className="space-y-3">
                  <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    Welcome back, {user?.firstName || "Traveler"} 👋
                  </h1>
                  <p className="max-w-2xl text-lg text-white/80">{heroSubtitle}</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  className="bg-primary px-6 text-white shadow-md transition hover:shadow-lg"
                  onClick={() => {
                    setShowCreateModal(true);
                  }}
                  data-onboarding="create-trip"
                >
                  <Plus className="h-5 w-5" />
                  Plan New Trip
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  className="justify-start px-0 text-white/90 hover:bg-transparent hover:text-white"
                  asChild
                >
                  <Link href="/how-it-works">
                    Learn how VacationSync keeps everyone aligned
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="pointer-events-none absolute -bottom-3 -right-3 hidden lg:block">
              <TravelMascot type="plane" size="lg" />
            </div>
          </div>

          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardHeader className="space-y-1 pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Quick actions
                </CardTitle>
                <NotificationIcon />
              </div>
              <p className="text-sm text-slate-600">
                Jump back into the tools you need most.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button
                variant="outline"
                className="justify-between rounded-2xl border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                asChild
              >
                <Link href="/currency-converter">
                  <span className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    Currency toolkit
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-slate-500" />
                </Link>
              </Button>
              <Button
                variant="outline"
                className="justify-between rounded-2xl border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                asChild
              >
                <Link href="/how-it-works">
                  <span className="flex items-center gap-2">
                    <Compass className="h-4 w-4 text-sky-600" />
                    Explore features
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-slate-500" />
                </Link>
              </Button>
              <Button
                variant="outline"
                className="justify-between rounded-2xl border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                asChild
              >
                <Link href="/profile">
                  <span className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-purple-600" />
                    Profile & preferences
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-slate-500" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="justify-start px-3 text-slate-500 hover:text-slate-900"
                onClick={handleLogout}
              >
                Log out
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-3xl border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                const showDivider = index < stats.length - 1;

                return (
                  <button
                    key={stat.label}
                    type="button"
                    onClick={() => handleStatClick(stat.type)}
                    className={`group flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                      showDivider ? "md:border-r md:border-slate-200 md:pr-6" : ""
                    } md:w-auto`}
                    aria-label={`View details for ${stat.label}`}
                  >
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${stat.accent} transition group-hover:scale-105`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-slate-900">
                        {stat.value}
                      </p>
                      <p className="text-sm capitalize text-slate-600 group-hover:text-slate-800">
                        {stat.label}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={isStatsDialogOpen}
          onOpenChange={handleStatsDialogOpenChange}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{activeStat?.label ?? "Details"}</DialogTitle>
              {selectedStat && (
                <DialogDescription>
                  {statDescriptions[selectedStat]}
                </DialogDescription>
              )}
            </DialogHeader>
            <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
              {renderSelectedStatContent()}
            </div>
          </DialogContent>
        </Dialog>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Upcoming adventures</h2>
              <p className="text-sm text-slate-600">Keep tabs on what’s coming up next.</p>
            </div>
            {highlightTrip && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-slate-200"
                asChild
              >
                <Link href={`/trip/${highlightTrip.id}`}>
                  Open {highlightTrip.name}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>

          {upcomingTrips.length === 0 ? (
            <Card className="rounded-3xl border-dashed border-slate-200 bg-white shadow-sm">
              <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
                <TravelMascot type="map" size="lg" animated={false} />
                <h3 className="text-lg font-semibold text-slate-900">
                  No upcoming trips yet
                </h3>
                <p className="max-w-md text-slate-600">
                  Start planning your next getaway and invite your travel crew to collaborate.
                </p>
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-primary text-white hover:bg-primary/90"
                  data-onboarding="create-trip"
                >
                  <Plus className="h-4 w-4" />
                  Plan your first trip
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {sortedUpcomingTrips.map((trip) => (
                <Link
                  key={trip.id}
                  href={`/trip/${trip.id}`}
                  aria-label={`Open trip ${trip.name}`}
                  className="group block rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <Card className="h-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-lg">
                    <div className="relative h-40 w-full overflow-hidden">
                      {trip.coverImageUrl ? (
                        <>
                          <img
                            src={trip.coverImageUrl}
                            alt={`Cover photo for ${trip.name}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                          <div
                            className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent"
                            aria-hidden="true"
                          />
                        </>
                      ) : (
                        <>
                          <div
                            className={cn("absolute inset-0", TRIP_GRADIENT_BACKGROUND)}
                            aria-hidden="true"
                          />
                          <div
                            className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(circle_at_top_left,rgba(255,255,255,0.6),transparent_55%)]"
                            aria-hidden="true"
                          />
                        </>
                      )}
                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white">
                        <div>
                          <p className="text-xs uppercase tracking-widest text-white/80">
                            Adventure
                          </p>
                          <h3 className="text-lg font-semibold leading-tight">
                            {trip.name}
                          </h3>
                        </div>
                        <Badge className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                          <Users className="h-3.5 w-3.5" />
                          {trip.memberCount}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="space-y-4 p-6">
                      <div className="space-y-3 text-sm text-slate-600">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                            <MapPin className="h-4 w-4" />
                          </span>
                          <span className="font-medium text-slate-900">
                            {trip.destination}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                            <Calendar className="h-4 w-4" />
                          </span>
                          <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                            <Clock className="h-4 w-4" />
                          </span>
                          <span className="font-medium text-slate-900">
                            {getCountdownLabel(trip.startDate)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 pt-2">
                        <div className="flex -space-x-2">
                          {(trip.members || []).slice(0, 3).map((member) => (
                            <div
                              key={member.id}
                              className="h-9 w-9 overflow-hidden rounded-full border-2 border-white bg-slate-200 ring-1 ring-slate-200"
                            >
                              {member.user.profileImageUrl ? (
                                <img
                                  src={member.user.profileImageUrl}
                                  alt={formatMemberName(
                                    member.user.firstName,
                                    member.user.email,
                                  )}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-600">
                                  {getMemberInitial(
                                    member.user.firstName,
                                    member.user.email,
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                          {trip.memberCount > 3 && (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                              +{trip.memberCount - 3}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Helpful insights</h2>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                    <ListChecks className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Continue planning
                    </h3>
                    <p className="text-sm text-slate-600">
                      {highlightTrip
                        ? heroSubtitle
                        : "Organize the essentials, then invite your crew to collaborate."}
                    </p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                    Confirm travel dates and share them with everyone involved.
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                    Align on budget expectations and capture key expenses early.
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                    Add can't-miss experiences so each traveler can weigh in.
                  </li>
                </ul>
                {highlightTrip && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full px-4"
                    asChild
                  >
                    <Link href={`/trip/${highlightTrip.id}`}>
                      Go to planning hub
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                    <Lightbulb className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Travel tips
                    </h3>
                    <p className="text-sm text-slate-600">
                      Smart suggestions tailored to {travelFocusName}.
                    </p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <Plane className="mt-0.5 h-4 w-4 text-sky-500" />
                    Double-check flight deals midweek—prices dip most on Tuesdays and Wednesdays.
                  </li>
                  <li className="flex items-start gap-2">
                    <Camera className="mt-0.5 h-4 w-4 text-rose-500" />
                    Save a shared album so everyone can drop must-see spots and photo ideas.
                  </li>
                  <li className="flex items-start gap-2">
                    <Heart className="mt-0.5 h-4 w-4 text-purple-500" />
                    Book one group experience early to give the crew something to look forward to.
                  </li>
                </ul>
                {highlightTrip && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start px-0 text-slate-700 hover:text-slate-900"
                    asChild
                  >
                    <Link href={`/trip/${highlightTrip.id}`}>
                      View trip recommendations
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-200 text-slate-700">
                    <Clock className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Recent activity
                    </h3>
                    <p className="text-sm text-slate-600">
                      {highlightTrip
                        ? `Stay in sync with ${highlightTrip.memberCount} traveler${
                            highlightTrip.memberCount === 1 ? "" : "s"
                          }.`
                        : "Activity from your travel crew will appear here."}
                    </p>
                  </div>
                </div>
                {recentMembers.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex -space-x-2">
                      {recentMembers.map((member) => (
                        <div
                          key={member.id}
                          className="h-9 w-9 overflow-hidden rounded-full border-2 border-white bg-slate-200 ring-1 ring-slate-200"
                        >
                          {member.user.profileImageUrl ? (
                            <img
                              src={member.user.profileImageUrl}
                              alt={formatMemberName(
                                member.user.firstName,
                                member.user.email,
                              )}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-600">
                              {getMemberInitial(
                                member.user.firstName,
                                member.user.email,
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-slate-600">
                      {recentMembers
                        .map((member) =>
                          formatMemberName(
                            member.user.firstName,
                            member.user.email,
                          ),
                        )
                        .join(", ")}{" "}
                      {recentMembers.length === 1 ? "is" : "are"} gearing up for this getaway. Share an update to keep everyone in the loop.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">
                    No updates yet. Start the conversation by posting your first idea or inviting new companions.
                  </p>
                )}
                {highlightTrip && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start px-0 text-slate-700 hover:text-slate-900"
                    asChild
                  >
                    <Link href={`/trip/${highlightTrip.id}`}>
                      Open trip space
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {pastTrips.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Past trips</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pastTrips.map((trip) => (
                <Card
                  key={trip.id}
                  className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm transition-shadow hover:shadow-md"
                >
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <Link href={`/trip/${trip.id}`} className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900 transition-colors hover:text-primary">
                          {trip.name}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-2">
                        <Badge className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                          Completed
                        </Badge>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              data-testid={`delete-trip-${trip.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Past Trip</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{trip.name}"? This action cannot be undone and will permanently remove all trip data including activities, expenses, and memories.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteTripMutation.mutate(trip.id)}
                                disabled={deleteTripMutation.isPending}
                                className="bg-red-600 hover:bg-red-700"
                                data-testid={`confirm-delete-trip-${trip.id}`}
                              >
                                {deleteTripMutation.isPending
                                  ? "Deleting..."
                                  : "Delete Trip"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <Link href={`/trip/${trip.id}`}>
                      <div className="space-y-3 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-slate-500" />
                          <span>{trip.destination}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-500" />
                          <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
                        </div>
                      </div>
                    </Link>
                    <div className="flex -space-x-2">
                      {(trip.members || []).slice(0, 3).map((member) => (
                        <div
                          key={member.id}
                          className="h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-slate-200 ring-1 ring-slate-200"
                        >
                          {member.user.profileImageUrl ? (
                            <img
                              src={member.user.profileImageUrl}
                              alt={formatMemberName(
                                member.user.firstName,
                                member.user.email,
                              )}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-600">
                              {getMemberInitial(
                                member.user.firstName,
                                member.user.email,
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {trip.memberCount > 3 && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                          +{trip.memberCount - 3}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>

      <CreateTripModal
        open={showCreateModal}
        onOpenChange={(open) => {
          setShowCreateModal(open);
        }}
      />
    </div>
  );
}
