import { useState, useEffect, useMemo, useRef, useCallback, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import SmartLocationSearch from "@/components/SmartLocationSearch";
import { TravelLoading } from "@/components/LoadingSpinners";
import {
  Search,
  Star,
  Clock,
  MapPin,
  DollarSign,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { buildActivitySubmission } from "@/lib/activitySubmission";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { markExternalRedirect, ACTIVITY_REDIRECT_STORAGE_KEY } from "@/lib/externalRedirects";
import { format } from "date-fns";
import type { ActivityWithDetails, ActivityType, TripWithDetails, User } from "@shared/schema";
import { ATTENDEE_REQUIRED_MESSAGE } from "@shared/activityValidation";

const MANUAL_ACTIVITY_CATEGORY = "manual";

const getMemberDisplayName = (member?: User | null) => {
  if (!member) return "Trip member";
  const first = member.firstName?.trim();
  const last = member.lastName?.trim();
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (member.username) return member.username;
  return member.email || "Trip member";
};

const MANUAL_STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" },
] as const;

type ManualStatusValue = (typeof MANUAL_STATUS_OPTIONS)[number]["value"];

const MANUAL_STATUS_LABELS: Record<ManualStatusValue, string> = MANUAL_STATUS_OPTIONS.reduce(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {} as Record<ManualStatusValue, string>,
);

const MANUAL_CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"] as const;

const parseManualActivityDescription = (description?: string | null) => {
  const fallbackStatus: ManualStatusValue = "planned";
  const fallbackCurrency = "USD";

  if (!description) {
    return {
      statusValue: fallbackStatus,
      statusLabel: MANUAL_STATUS_LABELS[fallbackStatus],
      currency: fallbackCurrency,
    };
  }

  const statusMatch = description.match(/Status:\s*([A-Za-z ]+)/i);
  const currencyMatch = description.match(/Currency:\s*([A-Za-z]{3})/i);

  const matchedStatusLabel = statusMatch?.[1]?.trim() || MANUAL_STATUS_LABELS[fallbackStatus];
  const normalizedStatusValue = matchedStatusLabel.toLowerCase() as ManualStatusValue;
  const statusValue = MANUAL_STATUS_LABELS[normalizedStatusValue]
    ? normalizedStatusValue
    : fallbackStatus;

  return {
    statusValue,
    statusLabel: MANUAL_STATUS_LABELS[statusValue],
    currency: currencyMatch?.[1]?.trim().toUpperCase() || fallbackCurrency,
  };
};

const isManualActivity = (activity: ActivityWithDetails) => {
  const category = activity.category?.toLowerCase();
  if (category === MANUAL_ACTIVITY_CATEGORY) {
    return true;
  }

  const description = activity.description?.toLowerCase() ?? "";
  return description.includes("manual entry");
};

interface Activity {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  category: string;
  price: number;
  currency?: string;
  duration: string;
  rating: number;
  bookingUrl: string;
  provider?: string;
  images?: string[];
}

interface ActivitySearchProps {
  tripId: number;
  trip?: TripWithDetails | null;
  user?: User | null;
  manualFormOpenSignal?: number;
}

export default function ActivitySearch({ tripId, trip, user: _user, manualFormOpenSignal }: ActivitySearchProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [priceRange, setPriceRange] = useState("all");
  const [sortBy, setSortBy] = useState("popularity");
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [submittedLocation, setSubmittedLocation] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [shouldAutoSearch, setShouldAutoSearch] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualFormData, setManualFormData] = useState<{
    name: string;
    location: string;
    dateTime: string;
    price: string;
    currency: string;
    status: ManualStatusValue;
  }>({
    name: "",
    location: trip?.destination ?? "",
    dateTime: trip?.startDate ? format(new Date(trip.startDate), "yyyy-MM-dd'T'HH:mm") : "",
    price: "",
    currency: MANUAL_CURRENCY_OPTIONS[0],
    status: MANUAL_STATUS_OPTIONS[0].value,
  });
  const memberOptions = useMemo(
    () =>
      (trip?.members ?? []).map((member) => ({
        id: String(member.userId),
        name: getMemberDisplayName(member.user),
      })),
    [trip?.members],
  );
  const defaultMemberIds = useMemo(() => memberOptions.map((member) => member.id), [memberOptions]);
  const [manualAttendeeIds, setManualAttendeeIds] = useState<string[]>(defaultMemberIds);
  const [manualMode, setManualMode] = useState<ActivityType>("SCHEDULED");
  const locationInputRef = useRef<HTMLInputElement | null>(null);
  const manualSignalRef = useRef(manualFormOpenSignal ?? 0);

  const focusLocationInput = useCallback(() => {
    if (typeof window === "undefined") {
      locationInputRef.current?.focus();
      return;
    }

    window.requestAnimationFrame(() => {
      locationInputRef.current?.focus();
    });
  }, []);

  const handleLocationSelect = (location: any) => {
    setSelectedLocation(location);
    const locationName = location?.city || location?.name || location?.code || location;
    setLocationSearch(locationName);
    focusLocationInput();
  };

  useEffect(() => {
    setManualAttendeeIds((prev) => {
      if (defaultMemberIds.length === 0) {
        return [];
      }

      const valid = prev.filter((id) => defaultMemberIds.includes(id));
      if (valid.length === prev.length) {
        return prev;
      }

      return valid;
    });
  }, [defaultMemberIds]);

  const resetManualForm = useCallback(() => {
    setManualFormData({
      name: "",
      location: trip?.destination ?? "",
      dateTime: trip?.startDate ? format(new Date(trip.startDate), "yyyy-MM-dd'T'HH:mm") : "",
      price: "",
      currency: MANUAL_CURRENCY_OPTIONS[0],
      status: MANUAL_STATUS_OPTIONS[0].value,
    });
    setManualAttendeeIds(defaultMemberIds);
    setManualMode("SCHEDULED");
  }, [defaultMemberIds, trip?.destination, trip?.startDate]);

  const openManualForm = useCallback(() => {
    resetManualForm();
    setIsManualModalOpen(true);
  }, [resetManualForm]);

  const closeManualForm = useCallback(() => {
    setIsManualModalOpen(false);
    resetManualForm();
  }, [resetManualForm]);

  const getTripDateRange = useCallback(() => {
    const start = trip?.startDate ? format(new Date(trip.startDate), "yyyy-MM-dd") : "";
    const end = trip?.endDate ? format(new Date(trip.endDate), "yyyy-MM-dd") : "";

    return {
      start,
      end: end || start,
    };
  }, [trip?.endDate, trip?.startDate]);

  const handleViatorLink = useCallback(() => {
    const location = (locationSearch.trim() || trip?.destination || "").trim();
    if (!location) {
      toast({
        title: "Add a destination",
        description: "Enter a destination to search on Viator.",
        variant: "destructive",
      });
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const url = new URL("https://www.viator.com/searchResults/all");
    url.searchParams.set("text", location);
    url.searchParams.set("vs_source", "tripsync");
    url.searchParams.set("vs_vendor", "viator");
    url.searchParams.set("vs_city", location);
    url.searchParams.set("vs_return", "1");
    url.searchParams.set("vs_trip", String(tripId));

    markExternalRedirect(ACTIVITY_REDIRECT_STORAGE_KEY);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }, [locationSearch, toast, trip?.destination, tripId]);

  const handleAirbnbLink = useCallback(() => {
    const location = (locationSearch.trim() || trip?.destination || "").trim();
    if (!location) {
      toast({
        title: "Add a destination",
        description: "Enter a destination to search on Airbnb Experiences.",
        variant: "destructive",
      });
      return;
    }

    const { start, end } = getTripDateRange();
    if (!start) {
      toast({
        title: "Add trip dates",
        description: "Add trip dates to build an Airbnb Experiences link.",
        variant: "destructive",
      });
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const url = new URL("https://www.airbnb.com/s/experiences");
    url.searchParams.set("query", location);
    url.searchParams.set("checkin", start);
    if (end) {
      url.searchParams.set("checkout", end);
    }
    url.searchParams.set("adults", "1");

    markExternalRedirect(ACTIVITY_REDIRECT_STORAGE_KEY);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }, [getTripDateRange, locationSearch, toast, trip?.destination]);

  // Prefill destination from query params if provided
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const queryDestination = params.get("q");
    const autoParam = params.get("auto");

    if (queryDestination) {
      setLocationSearch(queryDestination);
      setSelectedLocation((prev: any) =>
        prev ?? {
          name: queryDestination,
          displayName: queryDestination,
          city: queryDestination
        }
      );

      if (autoParam === "1") {
        setShouldAutoSearch(true);
      }
    }
  }, []);

  useEffect(() => {
    if (shouldAutoSearch && locationSearch.trim()) {
      setSubmittedLocation(locationSearch.trim());
      setHasSearched(true);
      setShouldAutoSearch(false);
    }
  }, [shouldAutoSearch, locationSearch]);

  useEffect(() => {
    const currentSignal = manualFormOpenSignal ?? 0;
    if (currentSignal > manualSignalRef.current) {
      openManualForm();
    }
    manualSignalRef.current = currentSignal;
  }, [manualFormOpenSignal, openManualForm]);

  const handleSearch = () => {
    if (!locationSearch.trim()) {
      setHasSearched(false);
      setSubmittedLocation("");
      return;
    }

    setSubmittedLocation(locationSearch.trim());
    setHasSearched(true);
  };

  const trimmedLocation = useMemo(() => submittedLocation.trim(), [submittedLocation]);

  const { data: tripActivities = [], isLoading: tripActivitiesLoading } = useQuery<ActivityWithDetails[]>({
    queryKey: [`/api/trips/${tripId}/activities`],
    enabled: !!tripId,
  });

  const manualActivities = useMemo(
    () => tripActivities.filter((activity) => isManualActivity(activity)),
    [tripActivities],
  );

  const sortedManualActivities = useMemo(() => {
    return [...manualActivities].sort((a, b) => {
      const aTime = new Date(a.startTime as string).getTime();
      const bTime = new Date(b.startTime as string).getTime();
      return aTime - bTime;
    });
  }, [manualActivities]);

  const manualActivitiesLoading = tripActivitiesLoading;
  const hasManualActivities = sortedManualActivities.length > 0;
  const canBuildExternalLink = Boolean((locationSearch.trim() || trip?.destination) && trip?.startDate);

  const createManualActivityMutation = useMutation({
    mutationFn: async ({
      payload,
      submissionType,
    }: {
      payload: ReturnType<typeof buildActivitySubmission>["payload"];
      submissionType: ActivityType;
    }) => {
      const endpoint =
        submissionType === "PROPOSE"
          ? `/api/trips/${tripId}/proposals/activities`
          : `/api/trips/${tripId}/activities`;

      const response = await apiRequest(endpoint, {
        method: "POST",
        body: payload,
      });

      return await response.json();
    },
    onSuccess: (_createdActivity, variables) => {
      const submissionType = variables?.submissionType ?? "SCHEDULED";

      toast({
        title: submissionType === "PROPOSE" ? "Activity proposed" : "Activity saved",
        description:
          submissionType === "PROPOSE"
            ? "We shared this idea with your group for feedback."
            : "We added your manual activity to the trip.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/activities`] });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/proposals/activities`] });
      closeManualForm();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Please try again.";
      toast({
        title: "Unable to save activity",
        description: message,
        variant: "destructive",
      });
    },
  });

  const isSavingManualActivity = createManualActivityMutation.isPending;

  const handleManualToggleAttendee = useCallback(
    (memberId: string, checked: boolean | "indeterminate") => {
      const normalizedId = String(memberId);
      setManualAttendeeIds((current) => {
        const next = new Set(current);
        if (checked === true) {
          next.add(normalizedId);
        } else if (checked === false) {
          next.delete(normalizedId);
        }
        return Array.from(next);
      });
    },
    [],
  );

  const handleManualSelectAll = useCallback(() => {
    setManualAttendeeIds(defaultMemberIds);
  }, [defaultMemberIds]);

  const handleManualClearAttendees = useCallback(() => {
    setManualAttendeeIds([]);
  }, []);

  const handleManualFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = manualFormData.name.trim();
    const trimmedLocation = manualFormData.location.trim();

    if (!trimmedName || !trimmedLocation || !manualFormData.dateTime) {
      toast({
        title: "Missing details",
        description: "Add a name, location, and date/time to save the activity.",
        variant: "destructive",
      });
      return;
    }

    const parsedDate = new Date(manualFormData.dateTime);
    if (Number.isNaN(parsedDate.getTime())) {
      toast({
        title: "Invalid date",
        description: "Choose a valid date and time for the activity.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { payload } = buildActivitySubmission({
        tripId,
        name: trimmedName,
        description: `Manual entry · Status: ${MANUAL_STATUS_LABELS[manualFormData.status]} · Currency: ${manualFormData.currency}`,
        date: format(parsedDate, "yyyy-MM-dd"),
        startTime: format(parsedDate, "HH:mm"),
        endTime: null,
        location: trimmedLocation,
        cost: manualFormData.price,
        maxCapacity: null,
        category: MANUAL_ACTIVITY_CATEGORY,
        attendeeIds: manualAttendeeIds,
        type: manualMode,
      });

      createManualActivityMutation.mutate({ payload, submissionType: manualMode });
    } catch (error) {
      const message = error instanceof Error ? error.message : ATTENDEE_REQUIRED_MESSAGE;
      toast({
        title: "Unable to save activity",
        description: message,
        variant: "destructive",
      });
    }
  };

  const { data: activities, isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities/discover", trimmedLocation, searchTerm, selectedCategory, priceRange, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams({
        location: trimmedLocation || trip?.destination || "",
        searchTerm,
        category: selectedCategory,
        priceRange,
        sortBy
      });
      
      const response = await apiFetch(`/api/activities/discover?${params}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to search activities');
        }
        const errorText = await response.text();
        throw new Error(`Failed to fetch activities: ${errorText}`);
      }
      
      const data = await response.json();
      return data;
    },
    enabled: !!trimmedLocation && hasSearched,
    retry: 1,
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Discover Activities
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Search for activities and experiences at your destination
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Location Search */}
          <div className="space-y-2">
            <Label>Search Destination</Label>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                handleSearch();
              }}
            >
              <div className="flex-1">
                <SmartLocationSearch
                  id="discover-activities-destination"
                  placeholder={`Search activities in ${trip?.destination || 'any destination'}`}
                  value={locationSearch}
                  onLocationSelect={handleLocationSelect}
                  ref={locationInputRef}
                />
              </div>
              <Button type="submit" disabled={!locationSearch.trim()}>
                <Search className="w-4 h-4 mr-2" />
                Search Activities
              </Button>
            </form>
            {trip?.destination && !hasSearched && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLocationSearch(trip.destination);
                  setHasSearched(false);
                  focusLocationInput();
                }}
                className="mt-2"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Search in {trip.destination}
              </Button>
            )}
          </div>

          {/* Search Filters */}
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={handleViatorLink}
              disabled={!canBuildExternalLink}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Search on Viator
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={handleAirbnbLink}
              disabled={!canBuildExternalLink}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Search on Airbnb Experiences
            </Button>
          </div>

          {/* Search Filters */}
          {hasSearched && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
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
                </SelectContent>
              </Select>
              <Select value={priceRange} onValueChange={setPriceRange}>
                <SelectTrigger>
                  <SelectValue placeholder="Price Range" />
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
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
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
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">Manually Added Activities</CardTitle>
            <p className="text-sm text-muted-foreground">
              Keep track of activities you booked outside of VacationSync.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={openManualForm}>
            Add activity
          </Button>
        </CardHeader>
        <CardContent>
          {manualActivitiesLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
            </div>
          ) : hasManualActivities ? (
            <div className="grid gap-4">
              {sortedManualActivities.map((activity) => {
                const metadata = parseManualActivityDescription(activity.description);
                const startLabel = activity.startTime
                  ? (() => {
                      const date = new Date(activity.startTime as string);
                      return Number.isNaN(date.getTime())
                        ? "Date TBD"
                        : format(date, "MMM d, yyyy • h:mm a");
                    })()
                  : "Date TBD";
                const priceLabel =
                  typeof activity.cost === "number"
                    ? formatCurrency(activity.cost, {
                        currency: metadata.currency,
                        fallback: "",
                      })
                    : "";

                return (
                  <div
                    key={activity.id}
                    className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-neutral-900">{activity.name}</p>
                        <p className="text-sm text-neutral-600">
                          {activity.location || "Location TBD"}
                        </p>
                        <p className="text-sm text-neutral-500">{startLabel}</p>
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <Badge variant="outline" className="uppercase tracking-wide">
                          {metadata.statusLabel}
                        </Badge>
                        {priceLabel ? (
                          <span className="text-sm font-medium text-neutral-900">{priceLabel}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-neutral-200 p-6 text-center">
              <p className="text-sm text-neutral-600">
                Log activities you booked elsewhere to keep everyone aligned.
              </p>
              <Button variant="outline" onClick={openManualForm}>
                Add activity manually
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activities Results */}
      {hasSearched ? (
        activitiesLoading ? (
          <Card className="mt-4">
            <CardContent className="text-center py-12">
              <TravelLoading variant="compass" size="lg" text="Discovering amazing activities..." />
            </CardContent>
          </Card>
        ) : activities && activities.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activities.map((activity) => (
              <Card
                key={activity.id}
                className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col"
                onClick={() => {
                  setSelectedActivity(activity);
                  setShowDetailsDialog(true);
                }}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-base lg:text-lg leading-tight">
                    {activity.name}
                  </CardTitle>
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
                    {activity.provider && (
                      <Badge variant="outline" className="text-xs">
                        {activity.provider}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 flex-1 flex flex-col">
                  <p className="text-sm text-neutral-600 mb-4 line-clamp-3 flex-1">
                    {activity.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-lg font-semibold text-green-600">
                      <DollarSign className="w-4 h-4" />
                      <span>{activity.currency || '$'}{activity.price}</span>
                    </div>
                    <Button size="sm" variant="outline">
                      <ExternalLink className="w-4 h-4 mr-1" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mt-4">
            <CardContent className="text-center py-12">
              <h3 className="text-xl font-bold text-neutral-900 mb-2">No Activities Found</h3>
              <p className="text-neutral-600 mb-4">
                No activities were found for "{submittedLocation || locationSearch}". Try a different destination or broader search terms.
              </p>
              <Button variant="outline" onClick={() => setHasSearched(false)}>
                Try Different Location
              </Button>
            </CardContent>
          </Card>
        )
      ) : null}

      <Dialog
        open={isManualModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeManualForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add activity manually</DialogTitle>
            <DialogDescription>
              Log a confirmed booking or experience you found outside VacationSync.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleManualFormSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manual-activity-type">Activity type</Label>
              <ToggleGroup
                type="single"
                value={manualMode}
                onValueChange={(value) => {
                  if (value) {
                    setManualMode(value as ActivityType);
                  }
                }}
                className="flex"
              >
                <ToggleGroupItem value="SCHEDULED" className="flex-1">
                  Add to schedule
                </ToggleGroupItem>
                <ToggleGroupItem value="PROPOSE" className="flex-1">
                  Propose to group
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-activity-name">Activity name</Label>
              <Input
                id="manual-activity-name"
                value={manualFormData.name}
                onChange={(event) =>
                  setManualFormData((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Morning walking tour"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-activity-location">Location</Label>
              <Input
                id="manual-activity-location"
                value={manualFormData.location}
                onChange={(event) =>
                  setManualFormData((prev) => ({ ...prev, location: event.target.value }))
                }
                placeholder="Paris, France"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manual-activity-datetime">Date &amp; time</Label>
                <Input
                  id="manual-activity-datetime"
                  type="datetime-local"
                  value={manualFormData.dateTime}
                  onChange={(event) =>
                    setManualFormData((prev) => ({ ...prev, dateTime: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-activity-price">Price</Label>
                <Input
                  id="manual-activity-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualFormData.price}
                  onChange={(event) =>
                    setManualFormData((prev) => ({ ...prev, price: event.target.value }))
                  }
                  placeholder="150"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="manual-attendees">Who's going?</Label>
                <span className="text-xs text-neutral-500">{manualAttendeeIds.length} selected</span>
              </div>
              <p className="text-xs text-neutral-500">
                We'll send invites to everyone you include. They can RSVP from their schedule.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleManualSelectAll}
                  disabled={memberOptions.length === 0 || manualAttendeeIds.length === defaultMemberIds.length}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleManualClearAttendees}
                  disabled={manualAttendeeIds.length === 0}
                >
                  Clear
                </Button>
              </div>
              <ScrollArea
                className={`mt-3 max-h-40 rounded-lg border ${
                  manualAttendeeIds.length === 0 ? "border-red-300" : "border-neutral-200"
                }`}
              >
                <div className="p-3 space-y-2">
                  {memberOptions.length === 0 ? (
                    <p className="text-sm text-neutral-500">
                      Invite friends to your trip to pick attendees.
                    </p>
                  ) : (
                    memberOptions.map((member) => {
                      const isChecked = manualAttendeeIds.includes(member.id);
                      return (
                        <div key={member.id} className="flex items-center space-x-3">
                          <Checkbox
                            id={`manual-attendee-${member.id}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => handleManualToggleAttendee(member.id, checked)}
                          />
                          <Label htmlFor={`manual-attendee-${member.id}`} className="text-sm text-neutral-700">
                            {member.name}
                          </Label>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
              {manualAttendeeIds.length === 0 && (
                <p className="text-sm text-red-600">
                  {ATTENDEE_REQUIRED_MESSAGE}
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manual-activity-currency">Currency</Label>
                <Select
                  value={manualFormData.currency}
                  onValueChange={(value) =>
                    setManualFormData((prev) => ({ ...prev, currency: value }))
                  }
                >
                  <SelectTrigger id="manual-activity-currency">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {MANUAL_CURRENCY_OPTIONS.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-activity-status">Status</Label>
                <Select
                  value={manualFormData.status}
                  onValueChange={(value) =>
                    setManualFormData((prev) => ({
                      ...prev,
                      status: value as ManualStatusValue,
                    }))
                  }
                >
                  <SelectTrigger id="manual-activity-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {MANUAL_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={closeManualForm}
                disabled={isSavingManualActivity}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingManualActivity}>
                {isSavingManualActivity ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save activity"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Activity Details Dialog */}
      {selectedActivity && (
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {selectedActivity.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center space-x-4 text-sm text-neutral-600">
                <div className="flex items-center">
                  <Star className="w-4 h-4 text-yellow-400 mr-1" />
                  <span>{selectedActivity.rating} rating</span>
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  <span>{selectedActivity.duration}</span>
                </div>
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  <span>{selectedActivity.location}</span>
                </div>
              </div>
              
              <p className="text-neutral-700 leading-relaxed">
                {selectedActivity.longDescription || selectedActivity.description}
              </p>
              
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center text-xl font-bold text-green-600">
                  <DollarSign className="w-5 h-5" />
                  <span>{selectedActivity.currency || '$'}{selectedActivity.price}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                    Close
                  </Button>
                  <Button onClick={() => window.open(selectedActivity.bookingUrl, '_blank')}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Book Now
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}