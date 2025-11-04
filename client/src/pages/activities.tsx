import { useState, useEffect, useCallback, useMemo, useRef, FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import SmartLocationSearch from "@/components/SmartLocationSearch";
import { TravelLoading } from "@/components/LoadingSpinners";
import { BookingConfirmationModal } from "@/components/booking-confirmation-modal";
import { AddActivityModal, type ActivityComposerPrefill } from "@/components/add-activity-modal";
import { useBookingConfirmation } from "@/hooks/useBookingConfirmation";
import {
  ArrowLeft,
  Search,
  Star,
  Clock,
  MapPin,
  DollarSign,
  ExternalLink,
  Users,
  Calendar as CalendarGlyph,
  ShoppingCart,
  CalendarIcon,
  X
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { ACTIVITY_CATEGORY_VALUES } from "@shared/activityValidation";
import type { ActivityType, ActivityWithDetails, TripWithDetails } from "@shared/schema";
import type { DateRange } from "react-day-picker";
import { resolveTripTimezone } from "@/lib/timezone";

interface Activity {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  category: string;
  price: string;
  duration: string;
  rating: number;
  bookingUrl: string;
  provider?: string;
  isGroupActivity?: boolean;
  activityId?: number;
  proposedBy?: string;
}

export default function Activities() {
  const { tripId } = useParams();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [priceRange, setPriceRange] = useState("all");
  const [sortBy, setSortBy] = useState("popularity");
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [displayCount, setDisplayCount] = useState(20);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [autoSearchTriggered, setAutoSearchTriggered] = useState(false);
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [timeWindow, setTimeWindow] = useState("any");
  const [durationFilter, setDurationFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [freeCancellationOnly, setFreeCancellationOnly] = useState(false);
  const [showActivityComposer, setShowActivityComposer] = useState(false);
  const [activityComposerPrefill, setActivityComposerPrefill] = useState<ActivityComposerPrefill | null>(null);
  const [activityComposerMode, setActivityComposerMode] = useState<ActivityType>("PROPOSE");
  const [activityComposerDate, setActivityComposerDate] = useState<Date | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const parsedTripId = useMemo(() => (tripId ? Number.parseInt(tripId, 10) || 0 : 0), [tripId]);
  const activitiesQueryKey = useMemo(
    () => [`/api/trips/${tripId ?? ""}/activities`],
    [tripId],
  );
  const activityProposalsQueryKey = useMemo(
    () => [`/api/trips/${tripId ?? ""}/proposals/activities`],
    [tripId],
  );
  const [shouldAutoSearch, setShouldAutoSearch] = useState(false);
  useEffect(() => {
    if (isSearchPanelOpen || typeof window === "undefined") {
      return;
    }

    const raf = window.requestAnimationFrame(() => {
      triggerButtonRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(raf);
  }, [isSearchPanelOpen]);

  // Booking confirmation system
  const { showModal, bookingData, storeBookingIntent, closeModal } = useBookingConfirmation();

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
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Get trip data
  const { data: trip, isLoading: tripLoading } = useQuery<TripWithDetails>({
    queryKey: ["/api/trips", tripId],
    enabled: !!tripId && isAuthenticated,
    retry: false,
  });

  const activityTimezone = useMemo(() => {
    const tripWithTimezone = trip as (TripWithDetails & { timezone?: string | null }) | undefined;
    return resolveTripTimezone({
      tripTimezone: tripWithTimezone?.timezone ?? null,
      userTimezone: user?.timezone ?? null,
    });
  }, [trip, user?.timezone]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("panel") === "discover") {
      setIsSearchPanelOpen(true);
      if (params.get("auto") === "1") {
        setShouldAutoSearch(true);
      }
    }
  }, []);

  // Set default location from trip destination
  useEffect(() => {
    if (!trip || autoSearchTriggered) {
      return;
    }

    if (!locationSearch) {
      setLocationSearch(trip.destination);
    }

    if (!selectedLocation) {
      setSelectedLocation({
        id: `trip-${trip.id}`,
        name: trip.destination,
        type: "CITY",
        detailedName: trip.destination,
        displayName: trip.destination,
        relevance: 100,
        isPopular: true,
        alternativeNames: [],
      });
    }

    if (shouldAutoSearch && trip.destination) {
      setHasSearched(true);
      setAutoSearchTriggered(true);
    }
  }, [trip, autoSearchTriggered, shouldAutoSearch, selectedLocation, locationSearch]);

  // Get group activities (already proposed to the trip)
  const { data: groupActivities = [] } = useQuery<ActivityWithDetails[]>({
    queryKey: activitiesQueryKey,
    enabled: !!tripId && isAuthenticated,
    retry: false,
  });

  // Get activities from external search
  const { data: searchActivities, isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: [
      "/api/activities/discover",
      locationSearch,
      searchTerm,
      selectedCategory,
      priceRange,
      sortBy,
      dateRange?.from?.toISOString?.() ?? "",
      dateRange?.to?.toISOString?.() ?? "",
      timeWindow,
      durationFilter,
      ratingFilter,
      freeCancellationOnly,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        location: locationSearch,
        searchTerm,
        category: selectedCategory,
        priceRange,
        sortBy,
        timeWindow,
        duration: durationFilter,
        rating: ratingFilter,
        freeCancellation: freeCancellationOnly ? "1" : "0",
      });

      if (dateRange?.from) {
        params.set("startDate", dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        params.set("endDate", dateRange.to.toISOString());
      }

      const response = await apiFetch(`/api/activities/discover?${params}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch activities');
      }
      
      return response.json();
    },
    enabled: !!locationSearch && isAuthenticated && hasSearched,
    retry: false,
  });

  // Combine search activities with group activities for unified display
  const combinedActivities: Activity[] = useMemo(() => [
    ...(searchActivities ?? []),
    ...groupActivities.map((activity) => ({
      id: `group-${activity.id}`,
      name: activity.name,
      description: activity.description,
      location: activity.location,
      category: activity.category,
      price: "0",
      duration: "Varies",
      rating: 4,
      bookingUrl: "",
      provider: "Group Activity",
      isGroupActivity: true,
      activityId: activity.id,
      proposedBy:
        activity.poster.firstName ||
        activity.poster.email ||
        activity.poster.username ||
        "Group member",
    })),
  ], [searchActivities, groupActivities]);

  const handleSearch = useCallback(() => {
    const searchLocation = selectedLocation?.name || locationSearch.trim();
    if (!searchLocation) {
      return;
    }

    setLocationSearch(searchLocation);
    setHasSearched(true);
    setAutoSearchTriggered(true);
  }, [locationSearch, selectedLocation]);

  const handleLocationSelect = (location: any) => {
    setSelectedLocation(location);
    setLocationSearch(location.name);
  };

  const handleClosePanel = useCallback(() => {
    setIsSearchPanelOpen(false);
  }, []);

  const handleOpenPanel = useCallback(() => {
    setIsSearchPanelOpen(true);
  }, []);

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      handleSearch();
    },
    [handleSearch],
  );

  const handleProposeActivity = useCallback(
    (activity: Activity) => {
      if (!parsedTripId) {
        toast({
          title: "Unable to propose activity",
          description: "We couldn't determine which trip to update.",
          variant: "destructive",
        });
        return;
      }

      if (!trip) {
        toast({
          title: "Trip still loading",
          description: "Please wait a moment and try proposing the activity again.",
          variant: "destructive",
        });
        return;
      }

      const normalizedCategory = (() => {
        const candidate = activity.category?.toLowerCase?.() ?? "";
        return (ACTIVITY_CATEGORY_VALUES as readonly string[]).includes(candidate)
          ? (candidate as (typeof ACTIVITY_CATEGORY_VALUES)[number])
          : "other";
      })();

      const defaultDate = (() => {
        if (dateRange?.from) {
          return dateRange.from;
        }

        if (trip.startDate) {
          const parsed = new Date(trip.startDate);
          return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        return null;
      })();

      setActivityComposerPrefill({
        name: activity.name,
        description: activity.description ?? undefined,
        location: activity.location ?? undefined,
        category: normalizedCategory,
        cost: activity.price ?? undefined,
        type: "PROPOSE",
      });
      setActivityComposerMode("PROPOSE");
      setActivityComposerDate(defaultDate);
      setShowActivityComposer(true);
      setShowDetailsDialog(false);
    },
    [parsedTripId, trip, dateRange, toast],
  );

  if (authLoading || tripLoading || activitiesLoading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <TravelLoading variant="mountain" size="lg" text="Discovering amazing activities..." />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <h1 className="text-xl font-bold text-neutral-900 mb-2">Trip not found</h1>
            <p className="text-neutral-600 mb-4">
              The trip you're looking for doesn't exist or you don't have access to it.
            </p>
            <Button onClick={() => setLocation("/")}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-primary/5 to-emerald-50/60">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => setLocation(`/trip/${tripId}`)}
                className="p-2"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-neutral-900">
                  Activities in {trip.destination}
                  {combinedActivities && combinedActivities.length > 0 && (
                    <span className="text-lg font-normal text-neutral-500 ml-2">
                      ({combinedActivities.length} activities available)
                    </span>
                  )}
                </h1>
                <p className="text-neutral-600">
                  Discover authentic experiences powered by Amadeus Global Distribution System
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Discover panel trigger */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Discover activities</h2>
            <p className="text-sm text-neutral-600">
              Use filters to search for experiences without leaving the activities hub.
            </p>
          </div>
          {!isSearchPanelOpen && (
            <Button
              ref={triggerButtonRef}
              onClick={handleOpenPanel}
              variant="outline"
              className="flex items-center"
            >
              <Search className="mr-2 h-4 w-4" />
              Discover activities
            </Button>
          )}
        </div>
      </div>

      <div className="px-4 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <Collapsible open={isSearchPanelOpen} onOpenChange={setIsSearchPanelOpen}>
            {isSearchPanelOpen && (
              <Card className="border border-white/80 shadow-lg bg-white/95 backdrop-blur">
                <CardHeader className="space-y-1 border-b border-neutral-200 bg-white/90 supports-[backdrop-filter]:bg-white/80">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
                        <MapPin className="h-5 w-5" />
                        Search activities
                      </CardTitle>
                      <p className="text-sm text-neutral-600">
                        Enter a destination and optional filters, then run the search when you are ready.
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClosePanel}
                      className="text-neutral-500 hover:text-neutral-900"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Hide search
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <form className="space-y-6" onSubmit={handleSearchSubmit}>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-2 md:col-span-2 lg:col-span-1">
                        <Label className="text-sm font-medium text-neutral-700">Destination</Label>
                        <SmartLocationSearch
                          placeholder="Enter destination (e.g., Zagreb, Tokyo, London...)"
                          value={locationSearch}
                          onLocationSelect={handleLocationSelect}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-neutral-700">Date range</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-between text-left font-normal"
                            >
                              {dateRange?.from ? (
                                dateRange.to ? (
                                  <span>
                                    {dateRange.from.toLocaleDateString()} – {dateRange.to.toLocaleDateString()}
                                  </span>
                                ) : (
                                  <span>{dateRange.from.toLocaleDateString()}</span>
                                )
                              ) : (
                                <span>Select dates</span>
                              )}
                              <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0" align="start">
                            <Calendar
                              mode="range"
                              numberOfMonths={2}
                              selected={dateRange}
                              onSelect={setDateRange}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-neutral-700">Time window (optional)</Label>
                        <Select value={timeWindow} onValueChange={setTimeWindow}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Any time" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any time</SelectItem>
                            <SelectItem value="morning">Morning</SelectItem>
                            <SelectItem value="afternoon">Afternoon</SelectItem>
                            <SelectItem value="evening">Evening</SelectItem>
                            <SelectItem value="night">Late night</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-neutral-700">Category</Label>
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="All categories" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            <SelectItem value="sightseeing">Sightseeing</SelectItem>
                            <SelectItem value="food">Food & Dining</SelectItem>
                            <SelectItem value="adventure">Adventure</SelectItem>
                            <SelectItem value="culture">Culture</SelectItem>
                            <SelectItem value="nature">Nature</SelectItem>
                            <SelectItem value="entertainment">Entertainment</SelectItem>
                            <SelectItem value="shopping">Shopping</SelectItem>
                            <SelectItem value="nightlife">Nightlife</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-neutral-700">Search keyword</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                          <Input
                            placeholder="Search activities..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-neutral-700">Price</Label>
                        <Select value={priceRange} onValueChange={setPriceRange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="All prices" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Prices</SelectItem>
                            <SelectItem value="0-25">$0 - $25</SelectItem>
                            <SelectItem value="25-50">$25 - $50</SelectItem>
                            <SelectItem value="50-100">$50 - $100</SelectItem>
                            <SelectItem value="100-200">$100 - $200</SelectItem>
                            <SelectItem value="200+">$200+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-neutral-700">Duration</Label>
                        <Select value={durationFilter} onValueChange={setDurationFilter}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Any duration" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Any Duration</SelectItem>
                            <SelectItem value="short">Up to 2 hours</SelectItem>
                            <SelectItem value="medium">2-4 hours</SelectItem>
                            <SelectItem value="long">4+ hours</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-neutral-700">Rating</Label>
                        <Select value={ratingFilter} onValueChange={setRatingFilter}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Any rating" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Any Rating</SelectItem>
                            <SelectItem value="4">4.0 and up</SelectItem>
                            <SelectItem value="4.5">4.5 and up</SelectItem>
                            <SelectItem value="5">5 stars only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-neutral-700">Sort by</Label>
                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Sort by" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="popularity">Popularity</SelectItem>
                            <SelectItem value="price_low">Price: Low to High</SelectItem>
                            <SelectItem value="price_high">Price: High to Low</SelectItem>
                            <SelectItem value="rating">Rating</SelectItem>
                            <SelectItem value="duration">Duration</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-3 md:col-span-2 lg:col-span-1">
                        <Switch
                          id="free-cancellation"
                          checked={freeCancellationOnly}
                          onCheckedChange={setFreeCancellationOnly}
                        />
                        <Label htmlFor="free-cancellation" className="text-sm text-neutral-700">
                          Free cancellation only
                        </Label>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setSearchTerm("");
                          setSelectedCategory("all");
                          setPriceRange("all");
                          setSortBy("popularity");
                          setDateRange(undefined);
                          setTimeWindow("any");
                          setDurationFilter("all");
                          setRatingFilter("all");
                          setFreeCancellationOnly(false);
                        }}
                      >
                        Reset filters
                      </Button>
                      <Button type="submit" disabled={!locationSearch.trim()}>
                        <Search className="mr-2 h-4 w-4" />
                        Search activities
                      </Button>
                    </div>
                  </form>

                  <div className="border-t border-neutral-200 pt-6">
                    {!hasSearched ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                          <MapPin className="text-white w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                          Ready to find something unforgettable?
                        </h3>
                        <p className="text-neutral-600 max-w-md mx-auto">
                          Choose a destination, adjust any filters you need, and run the search when you’re ready.
                        </p>
                      </div>
                    ) : activitiesLoading ? (
                      <div className="py-12 text-center">
                        <TravelLoading variant="compass" size="lg" text="Discovering amazing activities..." />
                      </div>
                    ) : (searchActivities ?? []).length === 0 ? (
                      <div className="py-12 text-center">
                        <h3 className="text-lg font-semibold text-neutral-900 mb-2">No activities found</h3>
                        <p className="text-neutral-600">
                          Try broadening your filters or searching a nearby city to see more options.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
                          {(searchActivities ?? []).slice(0, displayCount).map((activity) => (
                            <Card
                              key={activity.id}
                              className="overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col"
                              onClick={() => {
                                setSelectedActivity(activity);
                                setShowDetailsDialog(true);
                              }}
                            >
                              <CardHeader className="pb-3">
                                <div className="space-y-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <CardTitle className="text-base lg:text-lg leading-tight">
                                      {activity.name}
                                    </CardTitle>
                                    {activity.provider && (
                                      <Badge variant="outline" className="text-xs">
                                        {activity.provider}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3 text-sm text-neutral-600">
                                      <div className="flex items-center">
                                        <Star className="w-4 h-4 text-yellow-400 mr-1" />
                                        <span>{activity.rating}</span>
                                      </div>
                                      <div className="flex items-center">
                                        <Clock className="w-4 h-4 mr-1" />
                                        <span className="truncate">{activity.duration}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="flex flex-col flex-1 pt-2">
                                <div className="flex-1 space-y-3">
                                  <p className="text-neutral-600 text-sm line-clamp-3 leading-relaxed">
                                    {activity.description}
                                  </p>
                                  <div className="flex items-center text-sm text-neutral-600">
                                    <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                                    <span className="truncate">{activity.location}</span>
                                  </div>
                                  <div className="flex items-center text-lg lg:text-xl font-bold text-green-600">
                                    <DollarSign className="w-5 h-5 mr-1" />
                                    <span>{activity.price}</span>
                                  </div>
                                </div>
                                <div className="space-y-2 mt-4 pt-3 border-t border-gray-100">
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleProposeActivity(activity);
                                    }}
                                    className="w-full bg-primary hover:bg-red-600 text-white text-xs lg:text-sm"
                                  >
                                    <Users className="w-4 h-4 mr-2" />
                                    Propose
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedActivity(activity);
                                      setShowBookingDialog(true);
                                    }}
                                    className="w-full text-xs lg:text-sm"
                                  >
                                    <ShoppingCart className="w-4 h-4 mr-2" />
                                    Add
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>

                        {(searchActivities ?? []).length > displayCount && (
                          <div className="text-center">
                            <Button
                              onClick={() => {
                                setIsLoadingMore(true);
                                setTimeout(() => {
                                  setDisplayCount((prev) => Math.min(prev + 20, (searchActivities ?? []).length));
                                  setIsLoadingMore(false);
                                }, 500);
                              }}
                              disabled={isLoadingMore}
                              variant="outline"
                            >
                              {isLoadingMore ? "Loading more..." : "Load more results"}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            {!isSearchPanelOpen && (
              <div className="rounded-lg border border-dashed border-neutral-300 bg-white/60 p-6 text-center">
                <p className="text-sm text-neutral-600">
                  Use the discover panel to search for new experiences. When you’re ready, open it above.
                </p>
                <Button className="mt-4" ref={triggerButtonRef} onClick={handleOpenPanel} variant="secondary">
                  <Search className="mr-2 h-4 w-4" />
                  Discover activities
                </Button>
              </div>
            )}
          </Collapsible>
        </div>
      </div>

      {/* Existing trip activities */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 pb-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-neutral-900">Activities already on this trip</h3>
            <p className="text-sm text-neutral-600">
              These are proposals or scheduled plans your group is already tracking.
            </p>
          </div>
        </div>

        {groupActivities.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-neutral-600">
            Nothing here yet. Use the discover panel above or add your own activity to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
            {groupActivities.map((activity) => (
              <Card
                key={activity.id}
                className="overflow-hidden border-blue-200 bg-blue-50/40 hover:shadow-md transition-shadow h-full flex flex-col"
              >
                <CardHeader className="pb-3">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <CardTitle className="text-base lg:text-lg leading-tight">
                          {activity.name}
                        </CardTitle>
                        <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 text-xs">
                          <Users className="w-3 h-3 mr-1" />
                          Group
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm text-neutral-600">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center">
                          <CalendarGlyph className="w-4 h-4 mr-1" />
                          <span>
                            {activity.startTime
                              ? new Date(activity.startTime).toLocaleDateString()
                              : "Date TBA"}
                          </span>
                        </div>
                        {activity.location && (
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            <span className="truncate">{activity.location}</span>
                          </div>
                        )}
                      </div>
                      <Badge variant="secondary" className="capitalize text-xs">
                        {activity.category}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 pt-2">
                  <p className="text-neutral-600 text-sm line-clamp-4 leading-relaxed">
                    {activity.description || "Group activity"}
                  </p>
                  <div className="mt-4 pt-3 border-t border-neutral-200 text-xs text-neutral-500">
                    <p>
                      Proposed by {activity.poster.firstName || activity.poster.email || "Group member"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      {/* Activity Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Activity Details</DialogTitle>
            <DialogDescription>
              View complete activity information and booking options
            </DialogDescription>
          </DialogHeader>
          {selectedActivity && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-xl mb-2">{selectedActivity.name}</h3>
                <div className="flex items-center space-x-4 text-sm text-neutral-600 mb-4">
                  <div className="flex items-center">
                    <Star className="w-4 h-4 text-yellow-400 mr-1" />
                    <span>{selectedActivity.rating}</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    <span>{selectedActivity.duration}</span>
                  </div>
                  <div className="flex items-center">
                    <DollarSign className="w-4 h-4 mr-1" />
                    <span className="font-semibold text-green-600">${selectedActivity.price}</span>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {selectedActivity.category}
                  </Badge>
                </div>
                <div className="flex items-center mb-4 text-sm text-neutral-600">
                  <MapPin className="w-4 h-4 mr-2" />
                  <span>{selectedActivity.location}</span>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Description</h4>
                <p className="text-neutral-600 leading-relaxed whitespace-pre-wrap">
                  {selectedActivity.description}
                </p>
              </div>
              
              <div className="border-t pt-4 flex space-x-3">
                <Button
                  onClick={() => {
                    setShowDetailsDialog(false);
                    handleProposeActivity(selectedActivity);
                  }}
                  className="flex-1"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Propose to Group
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDetailsDialog(false);
                    setShowBookingDialog(true);
                  }}
                  className="flex-1"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Book Now
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Booking Dialog */}
      <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Book Activity</DialogTitle>
            <DialogDescription>
              Proceed to authentic booking platform
            </DialogDescription>
          </DialogHeader>
          {selectedActivity && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{selectedActivity.name}</h3>
                <p className="text-sm text-neutral-600 mb-2">{selectedActivity.location}</p>
                <div className="flex items-center space-x-4 text-sm text-neutral-600">
                  <div className="flex items-center">
                    <Star className="w-4 h-4 text-yellow-400 mr-1" />
                    <span>{selectedActivity.rating}</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    <span>{selectedActivity.duration}</span>
                  </div>
                  <div className="flex items-center">
                    <DollarSign className="w-4 h-4 mr-1" />
                    <span className="font-semibold">${selectedActivity.price}</span>
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <p className="text-sm text-neutral-600 mb-4">
                  This authentic activity is provided by Amadeus Global Distribution System. You'll be redirected to complete your reservation.
                </p>
                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowBookingDialog(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      // Store booking intent before opening external site
                      const activityData = {
                        type: 'activity',
                        name: selectedActivity.name,
                        location: selectedActivity.location,
                        category: selectedActivity.category,
                        price: selectedActivity.price,
                        duration: selectedActivity.duration,
                        rating: selectedActivity.rating,
                        bookingUrl: selectedActivity.bookingUrl,
                        provider: selectedActivity.provider || 'Amadeus'
                      };

                      storeBookingIntent('activity', activityData, parsedTripId);
                      window.open(selectedActivity.bookingUrl, '_blank');
                      setShowBookingDialog(false);
                      toast({
                        title: "Redirecting to Amadeus booking platform",
                        description: "Opening the authentic booking page in a new tab...",
                      });
                    }}
                    className="flex-1"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Continue to Book
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AddActivityModal
        open={showActivityComposer}
        onOpenChange={(open) => {
          setShowActivityComposer(open);
          if (!open) {
            setActivityComposerPrefill(null);
            setActivityComposerDate(null);
            setActivityComposerMode("PROPOSE");
          }
        }}
        tripId={parsedTripId}
        selectedDate={activityComposerDate}
        members={trip?.members ?? []}
        defaultMode={activityComposerMode}
        allowModeToggle
        currentUserId={user?.id}
        prefill={activityComposerPrefill}
        tripStartDate={trip?.startDate ?? null}
        tripEndDate={trip?.endDate ?? null}
        tripTimezone={activityTimezone}
        scheduledActivitiesQueryKey={activitiesQueryKey}
        proposalActivitiesQueryKey={activityProposalsQueryKey}
        calendarActivitiesQueryKey={activitiesQueryKey}
      />

      {/* Booking Confirmation Modal */}
      <BookingConfirmationModal
        isOpen={showModal}
        onClose={closeModal}
        bookingType={bookingData?.type || 'activity'}
        bookingData={bookingData?.data}
        tripId={parsedTripId}
        onSuccess={() => {
          // You could refetch activities data here if needed
          console.log('Activity booking confirmed');
        }}
      />
    </div>
  );
}